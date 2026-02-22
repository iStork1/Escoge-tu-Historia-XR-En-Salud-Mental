try { require('dotenv').config(); } catch (e) { /* dotenv not installed in this environment; continue */ }
// Use native http server to avoid heavy external dependencies in local tests
const http = require('http');
let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  // Supabase SDK failed to load — continuing in local/mock mode without noisy stack
  // console.debug('Supabase load error:', e && e.message);
}
const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const fs = require('fs');
const path = require('path');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — running in local/mock mode');
}

// Provide a noop supabase client for local development when real credentials are missing
function makeNoopClient() {
  return {
    from: (table) => {
      const builder = {
        table,
        _payload: null,
        select: function () { return this; },
        eq: function () { return this; },
        maybeSingle: async function () { return { data: null, error: null }; },
        single: async function () { return { data: null, error: null }; },
        insert: async function (payload) { console.log('[noop] insert into', table, payload); return { data: null, error: null }; },
        upsert: function (payload) { this._payload = payload; return { select: () => ({ single: async () => ({ data: payload, error: null }) }) }; }
      };
      return builder;
    }
  };
}

const supabase = (createClient && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : makeNoopClient();

// Load chapter content file
let CHAPTERS = { chapters: [] };
try {
  const p = path.join(__dirname, '..', 'content', 'chapters.json');
  if (fs.existsSync(p)) {
    CHAPTERS = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log('Loaded chapters:', CHAPTERS.chapters.length);
  } else {
    console.warn('chapters.json not found at', p);
  }
} catch (e) {
  console.warn('Failed to load chapters.json', e && e.message);
}

function findChapter(chapter_id) {
  return (CHAPTERS.chapters || []).find(c => c.chapter_id === chapter_id) || null;
}

function findScene(chapter_id, scene_id) {
  const ch = findChapter(chapter_id);
  if (!ch) return null;
  return (ch.scenes || []).find(s => s.scene_id === scene_id) || null;
}

async function ensureOptionsUpsert() {
  try {
    for (const ch of (CHAPTERS.chapters || [])) {
      // Ensure chapter exists first to satisfy scenes -> chapters FK
      try {
        const chapterRow = { chapter_id: ch.chapter_id, title: ch.title || null };
        const { data: cdata, error: cerr } = await supabase.from('chapters').upsert([chapterRow], { onConflict: 'chapter_id' }).select();
        if (cerr) console.warn('chapters upsert error', cerr);
        else console.log('ensured chapter', ch.chapter_id);
      } catch (e) {
        console.warn('chapters ensure exception', e && e.message);
      }

      for (const sc of (ch.scenes || [])) {
        // Ensure scene exists before inserting options to satisfy FK constraints
        try {
          const sceneRow = { scene_id: sc.scene_id, chapter_id: ch.chapter_id, title: sc.title || sc.scene_id };
          const { data: sdata, error: serr } = await supabase.from('scenes').upsert([sceneRow], { onConflict: 'scene_id' }).select();
          if (serr) console.warn('scenes upsert error', serr);
          else console.log('ensured scene', sc.scene_id);
        } catch (e) {
          console.warn('scene ensure exception', e && e.message);
        }

        for (const opt of (sc.options || [])) {
          const optRow = {
            option_id: opt.option_id,
            chapter_id: ch.chapter_id,
            scene_id: sc.scene_id,
            option_text: opt.option_text,
            next_chapter_id: opt.next_chapter_id,
            metadata: opt.metadata || null
          };
          try {
            const { data: odata, error: oerr } = await supabase.from('options').upsert(optRow, { onConflict: 'option_id' }).select();
            if (oerr) console.warn('options upsert error', oerr);
            else console.log('upserted option', opt.option_id);
          } catch (e) { console.warn('options upsert exception', e && e.message); }

          // Upsert mappings for the option
          const mappings = opt.mappings || [];
          for (const m of mappings) {
            // Only include mapping_id if provided so DB can apply default gen_random_uuid()
            const mapRow = {
              option_id: opt.option_id,
              scale: m.scale || null,
              item: m.item || null,
              weight: m.weight || null,
              confidence: m.confidence || null,
              metadata: m.metadata || null
            };
            if (m.mapping_id) mapRow.mapping_id = m.mapping_id;
            try {
              // Use insert; if mapping_id provided use upsert behavior via upsert
              if (mapRow.mapping_id) {
                const { data: md, error: merr } = await supabase.from('option_mappings').upsert(mapRow, { onConflict: 'mapping_id' }).select();
                if (merr) console.warn('option_mappings upsert error', merr);
              } else {
                const { data: md, error: merr } = await supabase.from('option_mappings').insert(mapRow);
                if (merr) console.warn('option_mappings insert error', merr);
              }
            } catch (e) { console.warn('option_mappings error', e && e.message); }
          }
        }
      }
    }
  } catch (e) {
    console.warn('ensureOptionsUpsert failed', e && e.message);
  }
}

// Lightweight validator
function ensureSessionPayload(p) {
  if (!p) return false;
  return true;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Schedule reminder by appending to a local JSON file (demo persistence)
function scheduleReminderLocal(pseudonym, session_id, remindAtISO) {
  try {
    const dd = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dd)) fs.mkdirSync(dd, { recursive: true });
    const fp = path.join(dd, 'reminders.json');
    let list = [];
    if (fs.existsSync(fp)) {
      try { list = JSON.parse(fs.readFileSync(fp, 'utf8')) || []; } catch (e) { list = []; }
    }
    const entry = { reminder_id: uuidv4(), pseudonym: pseudonym || null, session_id: session_id || null, remind_at: remindAtISO, created_at: new Date().toISOString() };
    list.push(entry);
    fs.writeFileSync(fp, JSON.stringify(list, null, 2), 'utf8');
    console.log('scheduled reminder locally', entry);
    return entry;
  } catch (e) {
    console.warn('failed to schedule reminder locally', e && e.message);
    return null;
  }
}

// Helpers to call Alexa Reminders API using native https
const https = require('https');
// Toggle reminders (true = enabled)
const REMINDERS_ENABLED = true;
function alexaGetTimeZone(apiEndpoint, apiAccessToken, deviceId) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(`${apiEndpoint}/v2/devices/${deviceId}/settings/System.timeZone`);
      const options = { method: 'GET', headers: { Authorization: `Bearer ${apiAccessToken}` } };
      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (c) => body += c.toString());
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body.replace(/"/g, ''));
          return reject(new Error(`timezone lookup failed ${res.statusCode} ${body}`));
        });
      });
      req.on('error', reject);
      req.end();
    } catch (e) { reject(e); }
  });
}

function alexaCreateReminder(apiEndpoint, apiAccessToken, payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(`${apiEndpoint}/v1/alerts/reminders`);
      const body = JSON.stringify(payload);
      const options = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiAccessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body, 'utf8')
        }
      };
      const req = https.request(url, options, (res) => {
        let resp = '';
        res.on('data', (c) => resp += c.toString());
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ status: res.statusCode, body: resp });
          return reject({ status: res.statusCode, body: resp });
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    } catch (e) { reject(e); }
  });
}

async function handleTelemetry(req, res) {
  try {
    const payload = await parseJsonBody(req);
    if (!ensureSessionPayload(payload)) { res.writeHead(400, {'Content-Type':'application/json'}); return res.end(JSON.stringify({ error: 'invalid payload' })); }
    const result = await processTelemetryPayload(payload, req.headers);
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(result));
  } catch (err) {
    console.error('telemetry error', err && err.message, err);
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleIdentify(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { pseudonym } = body || {};
    if (!pseudonym) { res.writeHead(400, {'Content-Type':'application/json'}); return res.end(JSON.stringify({ error: 'pseudonym required' })); }

    const token = uuidv4();
    const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24h

    const { error: insErr } = await supabase.from('auth_tokens').insert([{ token, pseudonym, expires_at }]);
    if (insErr) throw insErr;

    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ ok: true, token, expires_at }));
  } catch (err) {
    console.error('identify error', err);
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

async function handleAlexa(req, res) {
  try {
    const body = await parseJsonBody(req);
    console.log('alexa request received');
    console.log(JSON.stringify(body));
    if (!body || !body.request) {
      res.writeHead(400, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ error: 'not an Alexa request' }));
    }

    // Helpers for Alexa responses
    function alexaResponse(text, sessionAttributes = {}, shouldEndSession = false) {
      const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text }, shouldEndSession }, sessionAttributes };
      try { console.log('alexa response =>', JSON.stringify(resp)); } catch (e) { console.log('alexa response (err stringify)'); }
      return resp;
    }

    const sessionAttrs = (body.session && body.session.attributes) ? body.session.attributes : {};

    // Flow states: 'login', 'consent', 'scene'
    if (body.request.type === 'LaunchRequest') {
      // Start mini-login flow
      const sa = Object.assign({}, sessionAttrs, { stage: 'login' });
      const speech = 'Bienvenido a Escoge tu Historia. Para comenzar, dime tu pseudónimo.';
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(alexaResponse(speech, sa, false)));
    }

    if (body.request.type === 'IntentRequest') {
      const intentName = (body.request.intent && body.request.intent.name) || 'UnknownIntent';

      // User provided pseudonym (expect slot named 'pseudonym')
      if (sessionAttrs.stage === 'login') {
        // Debug logs for login stage: show raw inputTranscript and provided slots
        try { console.log('login debug - inputTranscript:', body.request.inputTranscript || '(none)'); } catch (e) {}
        try { console.log('login debug - intent.slots:', JSON.stringify((body.request.intent && body.request.intent.slots) || {})); } catch (e) {}
        // Robust extraction: prefer explicit `pseudonym` slot, otherwise take first non-empty slot,
        // otherwise fall back to `inputTranscript` (useful when Alexa maps to Fallback/Resume intents).
        const slots = (body.request.intent && body.request.intent.slots) || {};
        // If Alexa recognized the intent but didn't provide slot values, ask for the `option` slot explicitly
        if (intentName === 'ChooseOptionIntent' && (!slots.option || !slots.option.value)) {
          try { console.log('ChooseOptionIntent received with empty slots; eliciting slot `option`.'); } catch (e) {}
          const resp = {
            version: '1.0',
            response: {
              outputSpeech: { type: 'PlainText', text: 'No entendí tu elección. Di uno, dos o tres.' },
              shouldEndSession: false,
              directives: [ { type: 'Dialog.ElicitSlot', slotToElicit: 'option' } ]
            },
            sessionAttributes: sessionAttrs
          };
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(resp));
        }
        let pseudonym = null;
        if (slots.pseudonym && (slots.pseudonym.value || (slots.pseudonym.resolutions && slots.pseudonym.resolutions.resolutionsPerAuthority && slots.pseudonym.resolutions.resolutionsPerAuthority[0] && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value.name))) {
          pseudonym = slots.pseudonym.value || (slots.pseudonym.resolutions && slots.pseudonym.resolutions.resolutionsPerAuthority && slots.pseudonym.resolutions.resolutionsPerAuthority[0] && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value.name) || null;
        }
        if (!pseudonym) {
          for (const k of Object.keys(slots || {})) {
            const s = slots[k];
            if (s && s.value) { pseudonym = s.value; break; }
          }
        }
        if (!pseudonym && body.request && body.request.inputTranscript) {
          pseudonym = String(body.request.inputTranscript).trim();
        }
        if (pseudonym) {
          const pn = String(pseudonym).slice(0,64);
          // Check if this pseudonym already gave consent in a previous session; if so, skip consent
          try {
            const { data: prev, error: prevErr } = await supabase.from('sessions').select('consent_given, session_id').eq('pseudonym', pn).order('started_at', { ascending: false }).limit(1).maybeSingle();
            if (prevErr) console.warn('prev session lookup error', prevErr);
            if (prev && prev.consent_given) {
              // Create a new session and present first scene directly
              const sessionPayload = { source: 'alexa', pseudonym: pn, consent_given: true, chapter_id: 'c01' };
              const persist = await processTelemetryPayload(sessionPayload, req.headers);
              const session_id = persist.session_id;
              const sa = Object.assign({}, sessionAttrs, { stage: 'scene', session_id, pseudonym: pn, consent_given: true, chapter_id: 'c01' });
              const chapter = findChapter('c01');
              const firstScene = (chapter && chapter.scenes && chapter.scenes[0]) ? chapter.scenes[0] : null;
              if (!firstScene) {
                res.writeHead(500, {'Content-Type':'application/json'});
                return res.end(JSON.stringify(alexaResponse('No se encontró la escena inicial.', sessionAttrs, true)));
              }
              const rawOpts = firstScene.options || [];
              const opts = rawOpts.slice(0, 3).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx + 1, next_chapter_id: o.next_chapter_id }));
              let sceneSpeech = `${firstScene.text} `;
              if (opts.length > 0) {
                const labels = ['uno', 'dos', 'tres'];
                sceneSpeech += opts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
                if (opts.length === 1) sceneSpeech += ' Di "uno" o "continuar" para elegir.';
                else if (opts.length === 2) sceneSpeech += ' Di "uno" o "dos" para elegir.';
                else sceneSpeech += ' Di "uno", "dos" o "tres" para elegir.';
              }
              const sa2 = Object.assign({}, sa, { current_scene_id: firstScene.scene_id, current_options: opts });
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(alexaResponse(sceneSpeech, sa2, false)));
            }
          } catch (e) { console.warn('pseudonym consent check error', e && e.message); }

          const sa = Object.assign({}, sessionAttrs, { stage: 'consent', pseudonym: pn });
          const speech = `Hola ${pn}. Antes de continuar, das tu consentimiento para registrar tu progreso? Di sí o no.`;
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sa, false)));
        }
        // If no pseudonym provided, reprompt
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('No entendí tu pseudónimo. Por favor dilo de nuevo.', sessionAttrs, false)));
      }

      // Scheduling decision: handle reminder confirmation
      if (sessionAttrs.stage === 'schedule_reminder') {
        const consentSlots = (body.request.intent && body.request.intent.slots) || {};
        const slotValues = Object.keys(consentSlots).map(k => (consentSlots[k] && consentSlots[k].value) || '').filter(Boolean).map(s => String(s).toLowerCase());
        const intentNorm = String(intentName || '').toLowerCase();
        const isYes = intentName === 'AMAZON.YesIntent' || intentNorm.endsWith('yesintent') || slotValues.some(v => ['si', 'sí', 'si.', 'sí.','yes','y'].includes(v));
        const isNo = intentName === 'AMAZON.NoIntent' || intentNorm.endsWith('nointent') || slotValues.some(v => ['no','nop','no.'].includes(v));
        if (isYes) {
            // Check system tokens for Reminders API and user consent
            const sys = (body.context && body.context.System) ? body.context.System : null;
            const apiAccessToken = sys && sys.apiAccessToken ? sys.apiAccessToken : null;
            const apiEndpoint = sys && sys.apiEndpoint ? sys.apiEndpoint : null;
            const deviceId = sys && sys.device && sys.device.deviceId ? sys.device.deviceId : null;
            const consentToken = sys && sys.user && sys.user.permissions && sys.user.permissions.consentToken ? sys.user.permissions.consentToken : null;
            if (!consentToken || !apiAccessToken || !apiEndpoint || !deviceId) {
              // Ask for permission via card (consentToken required)
              const speech = 'Necesito permiso para crear recordatorios. Por favor, revisa la app de Alexa.';
              const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: true, card: { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] } } };
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(resp));
            }

            // Ask user when they want the reminder
            const sa = Object.assign({}, sessionAttrs, { stage: 'reminder_time' });
            const speech = '¿Para cuándo quieres el recordatorio? Di por ejemplo "mañana" o una fecha en formato YYYY-guion-MM-guion-DD, o di "mañana a las 10".';
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, sa, false)));
        }
        if (isNo) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('De acuerdo. No programaré un recordatorio. Hasta luego.', {}, true)));
        }
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('No entendí. ¿Quieres que te recuerde mañana para continuar? Di sí o no.', sessionAttrs, false)));
      }

      // Consent handling (be tolerant to different intent names and slot values)
      // Reminder time handling: parse when the user wants the reminder and create it
      if (sessionAttrs.stage === 'reminder_time') {
        try {
          const sys = (body.context && body.context.System) ? body.context.System : null;
          const apiAccessToken = sys && sys.apiAccessToken ? sys.apiAccessToken : null;
          const apiEndpoint = sys && sys.apiEndpoint ? sys.apiEndpoint : null;
          const deviceId = sys && sys.device && sys.device.deviceId ? sys.device.deviceId : null;
          if (!apiAccessToken || !apiEndpoint || !deviceId) {
            const speech = 'Para programar recordatorios necesito permiso. Revisa la app de Alexa.';
            const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: true, card: { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] } } };
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(resp));
          }

          const slots = (body.request.intent && body.request.intent.slots) || {};
          const utter = Object.keys(slots).map(k => (slots[k] && slots[k].value) || '').filter(Boolean).join(' ').toLowerCase();

          // Basic parsing: support 'mañana', 'hoy', explicit YYYY-MM-DD, and optional hour like 'a las 10' or '10:30'
          let target = new Date();
          let hour = 9, minute = 0;
          if (!utter || utter === '') {
            target.setDate(target.getDate() + 1);
          } else if (/mañana|manana/.test(utter)) {
            target.setDate(target.getDate() + 1);
            const hm = utter.match(/(\d{1,2})(?::(\d{2}))?/);
            if (hm) { hour = parseInt(hm[1],10); if (hm[2]) minute = parseInt(hm[2],10); }
          } else if (/hoy/.test(utter)) {
            const hm = utter.match(/(\d{1,2})(?::(\d{2}))?/);
            if (hm) { hour = parseInt(hm[1],10); if (hm[2]) minute = parseInt(hm[2],10); }
          } else {
            const dateMatch = utter.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              const parts = dateMatch[1].split('-').map(n => parseInt(n,10));
              target = new Date(parts[0], parts[1]-1, parts[2]);
              const hm = utter.match(/(\d{1,2})(?::(\d{2}))?/);
              if (hm) { hour = parseInt(hm[1],10); if (hm[2]) minute = parseInt(hm[2],10); }
            } else {
              // fallback: if we detect hour only
              const hm = utter.match(/(\d{1,2})(?::(\d{2}))?/);
              if (hm) { target.setDate(target.getDate() + 1); hour = parseInt(hm[1],10); if (hm[2]) minute = parseInt(hm[2],10); }
              else { target.setDate(target.getDate() + 1); }
            }
          }

          target.setHours(hour, minute, 0, 0);

          // convert target to components in user's timezone
          let tz = 'UTC';
          try { tz = await alexaGetTimeZone(apiEndpoint, apiAccessToken, deviceId); } catch (e) { console.warn('timezone lookup failed', e && e.message); }
          const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(target);
          const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: '2-digit' }).format(target);
          const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: '2-digit' }).format(target);
          const hh = String(target.getHours()).padStart(2,'0');
          const mm = String(target.getMinutes()).padStart(2,'0');
          const scheduledTime = `${year}-${month}-${day}T${hh}:${mm}:00`;

          // Force locale to Spanish (United States) as requested
          const locale = 'es-US';
          const reminderPayload = {
            requestTime: new Date().toISOString(),
            trigger: { type: 'SCHEDULED_ABSOLUTE', scheduledTime, timeZoneId: tz },
            alertInfo: { spokenInfo: { content: [ { locale, text: 'Vuelve a Escoge tu Historia para continuar.' } ] } },
            pushNotification: { status: 'ENABLED' }
          };

          try {
            const apiResp = await alexaCreateReminder(apiEndpoint, apiAccessToken, reminderPayload);
            console.log('reminder created', apiResp && apiResp.status);
            // persist locally as well for demo
            try { scheduleReminderLocal(sessionAttrs.pseudonym, sessionAttrs.session_id, `${scheduledTime}`); } catch (e) { /* ignore */ }
            const speech = `He programado el recordatorio para ${year}-${month}-${day} a las ${hh}:${mm}.`;
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, {}, true)));
          } catch (apiErr) {
            console.warn('reminders api error', apiErr);
            if (apiErr && apiErr.status && (apiErr.status === 401 || apiErr.status === 403)) {
              const speech = 'Para programar recordatorios necesito permiso. Revisa la app de Alexa.';
              const resp = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: true, card: { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] } } };
              res.writeHead(200, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(resp));
            }
            // fallback to local scheduling
            scheduleReminderLocal(sessionAttrs.pseudonym, sessionAttrs.session_id, scheduledTime);
            const speech = 'No pude crear el recordatorio en el dispositivo, pero lo guardé localmente.';
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, {}, true)));
          }
        } catch (e) {
          console.warn('reminder_time handler failed', e && e.message);
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No entendí cuándo quieres el recordatorio. Vuelve a intentarlo más tarde.', sessionAttrs, true)));
        }
      }
      if (sessionAttrs.stage === 'consent') {
        const consentSlots = (body.request.intent && body.request.intent.slots) || {};
        const slotValues = Object.keys(consentSlots).map(k => (consentSlots[k] && consentSlots[k].value) || '').filter(Boolean).map(s => String(s).toLowerCase());
        const intentNorm = String(intentName || '').toLowerCase();
        const isYes = intentName === 'AMAZON.YesIntent' || intentNorm.endsWith('yesintent') || slotValues.some(v => ['si', 'sí', 'si.', 'sí.','yes','y'].includes(v));
        const isNo = intentName === 'AMAZON.NoIntent' || intentNorm.endsWith('nointent') || slotValues.some(v => ['no','nop','no.'].includes(v));
        console.log('consent check', { intentName, slotValues, isYes, isNo });

        if (isYes) {
          // Create a session row now and present first scene
          const pseudonym = sessionAttrs.pseudonym || ((body.session && body.session.user && body.session.user.userId) ? String(body.session.user.userId).slice(0,64) : `anon_${Date.now()}`);
          // Enforce one chapter per day per pseudonym
          try {
            const today = new Date().toISOString().slice(0,10);
            let recent = null;
            try {
              const { data: rdata, error: rerr } = await supabase.from('sessions').select('session_id, started_at').eq('pseudonym', pseudonym).order('started_at', { ascending: false }).limit(1).maybeSingle();
              if (rerr) console.warn('recent session lookup error', rerr);
              recent = rdata;
            } catch (e) { console.warn('recent session exception', e && e.message); }
            if (recent && recent.started_at) {
              const recentDate = new Date(recent.started_at).toISOString().slice(0,10);
              if (recentDate === today) {
                res.writeHead(200, {'Content-Type':'application/json'});
                return res.end(JSON.stringify(alexaResponse('Hoy ya has jugado un capítulo. Vuelve mañana para continuar con otro capítulo.', sessionAttrs, true)));
              }
            }

            const sessionPayload = { source: 'alexa', pseudonym, consent_given: true, chapter_id: 'c01' };
            const persist = await processTelemetryPayload(sessionPayload, req.headers);
            const session_id = persist.session_id;
            const sa = Object.assign({}, sessionAttrs, { stage: 'scene', session_id, pseudonym, consent_given: true, chapter_id: 'c01' });

            // Present first scene dynamically from content
            const chapter = findChapter('c01');
            const firstScene = (chapter && chapter.scenes && chapter.scenes[0]) ? chapter.scenes[0] : null;
            if (!firstScene) {
              res.writeHead(500, {'Content-Type':'application/json'});
              return res.end(JSON.stringify(alexaResponse('No se encontró la escena inicial.', sessionAttrs, true)));
            }
            // Present up to three numbered options (uno/dos/tres) for this single-decision chapter
            const rawOpts = firstScene.options || [];
            const opts = rawOpts.slice(0, 3).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx + 1, next_chapter_id: o.next_chapter_id }));
            // Build speech: long scene text + enumerated options
            let sceneSpeech = `${firstScene.text} `;
            if (opts.length > 0) {
              const labels = ['uno', 'dos', 'tres'];
              sceneSpeech += opts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
              if (opts.length === 1) sceneSpeech += ' Di "uno" o "continuar" para elegir.';
              else if (opts.length === 2) sceneSpeech += ' Di "uno" o "dos" para elegir.';
              else sceneSpeech += ' Di "uno", "dos" o "tres" para elegir.';
            }
            const sa2 = Object.assign({}, sa, { current_scene_id: firstScene.scene_id, current_options: opts });
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(sceneSpeech, sa2, false)));
          } catch (err) {
            console.error('error creating session from consent', err);
            res.writeHead(500, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Hubo un error al crear la sesión.', sessionAttrs, true)));
          }
        }
        if (isNo) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('Entiendo. Si cambias de opinión, vuelve cuando quieras.', {}, true)));
        }
        // Reprompt for consent
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('Por favor responde sí o no.', sessionAttrs, false)));
      }

      // Scene interaction: expect an intent that selects an option (we accept any intent name as option)
      if (sessionAttrs.stage === 'scene') {
        const slots = (body.request.intent && body.request.intent.slots) || {};
        try { console.log('scene debug - intent.slots:', JSON.stringify(slots || {})); } catch (e) {}
        try { console.log('scene debug - inputTranscript:', body.request.inputTranscript || '(none)'); } catch (e) {}
        
        // **REORDERED LOGIC**: Always try to extract chosenVal FIRST from (1) slots, (2) other slots, (3) inputTranscript
        // BEFORE deciding whether to elicit. Only elicit if ALL sources are empty.
        
        let chosenVal = null;
        
        // Try option slot first
        if (slots.option && slots.option.value) {
          chosenVal = String(slots.option.value).toLowerCase();
          try { console.log('scene: got chosenVal from option slot:', chosenVal); } catch (e) {}
        }
        
        // If no option slot value, scan all other slots
        if (!chosenVal) {
          for (const k of Object.keys(slots || {})) {
            if (k !== 'option') {  // skip option since we already tried it
              const s = slots[k];
              if (s && s.value) {
                chosenVal = String(s.value).toLowerCase();
                try { console.log('scene: got chosenVal from slot', k, ':', chosenVal); } catch (e) {}
                break;
              }
            }
          }
        }
        
        // If still no value from slots, try raw inputTranscript (handles "uno", "dos", "tres")
        if (!chosenVal && body.request && body.request.inputTranscript) {
          chosenVal = String(body.request.inputTranscript).toLowerCase().trim();
          try { console.log('scene: got chosenVal from inputTranscript:', chosenVal); } catch (e) {}
        }
        
        // **NOW** decide to elicit: only if we have NO value from any source
        if (!chosenVal) {
          try { console.log('scene: no chosenVal from any source (slots empty + no inputTranscript); eliciting option slot.'); } catch (e) {}
          const resp = {
            version: '1.0',
            response: {
              shouldEndSession: false,
              directives: [ { type: 'Dialog.ElicitSlot', slotToElicit: 'option' } ]
            },
            sessionAttributes: sessionAttributes
          };
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(resp));
        }

        // Normalizer for comparing option text (keep letters and numbers)
        function normalizeText(t) {
          return String(t || '').toLowerCase().replace(/[^\p{L}0-9]+/gu, ' ').replace(/\s+/g, ' ').trim();
        }
        // support numeric replies like '1' or Spanish words 'uno','dos','tres'
        let chosenOpt = null;
        const opts = sessionAttrs.current_options || [];
        if (chosenVal) {
          const wordNums = { 'uno': 1, 'dos': 2, 'tres': 3 };
          const raw = String(chosenVal || '').trim().toLowerCase();
          let asNum = NaN;
          if (wordNums[raw]) asNum = wordNums[raw];
          else {
            const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed)) asNum = parsed;
          }
          if (!isNaN(asNum)) chosenOpt = opts.find(o => o.index === asNum);
          if (!chosenOpt) {
            const nVal = normalizeText(chosenVal);
            chosenOpt = opts.find(o => normalizeText(o.option_text) === nVal);
          }
        }
        // fallback: try match by intentName to option id or text
        if (!chosenOpt) {
          const normIntent = (intentName || '').toLowerCase();
          chosenOpt = opts.find(o => (o.option_id && o.option_id.toLowerCase() === normIntent) || (o.option_text && o.option_text.toLowerCase() === normIntent));
        }
        // If still not matched, reprompt instead of auto-selecting
        if (!chosenOpt) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No entendí tu elección. Di "uno", "dos" o "tres" o el texto de la opción.', sessionAttrs, false)));
        }

        // Prevent processing the same decision twice if user repeats the same option
        try {
          if (sessionAttrs.last_decision && chosenOpt && sessionAttrs.last_decision === chosenOpt.option_id) {
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Ya registré esa opción. ¿Quieres hacer otra cosa o continuar?', sessionAttrs, false)));
          }
        } catch (e) { console.warn('duplicate decision check error', e && e.message); }

        // Persist decision with option_id and option_text
        const session_id = sessionAttrs.session_id || null;
        const decisionPayload = {
          session_id,
          source: 'alexa',
          pseudonym: sessionAttrs.pseudonym || null,
          chapter_id: sessionAttrs.chapter_id || null,
          decisions: [ { timestamp: new Date().toISOString(), scene_id: sessionAttrs.current_scene_id || null, option_id: chosenOpt.option_id, option_text: chosenOpt.option_text } ]
        };
        try {
          const persist = await processTelemetryPayload(decisionPayload, req.headers);
          // determine next chapter and present next scene or end
          const nextChapterId = chosenOpt.next_chapter_id || null;
          if (!nextChapterId) {
            // Try to render a richer consequence narration if provided in content
            let consequence = null;
            try {
              const curChapterId = sessionAttrs.chapter_id || null;
              const curSceneId = sessionAttrs.current_scene_id || null;
              const ch = curChapterId ? findChapter(curChapterId) : null;
              const sc = (ch && ch.scenes) ? ch.scenes.find(s => s.scene_id === curSceneId) : null;
              if (sc && sc.options) {
                const optDef = sc.options.find(o => o.option_id === chosenOpt.option_id);
                if (optDef) consequence = optDef.consequence || optDef.consequence_text || optDef.narrative || null;
              }
            } catch (e) { console.warn('consequence lookup error', e && e.message); }

            let speech = '';
            if (consequence) speech = String(consequence);
            else speech = `Has seleccionado ${chosenOpt.option_text}. Fin del capítulo.`;
            // Offer scheduling a reminder for the next day
            const sa = Object.assign({}, sessionAttrs, { last_decision: chosenOpt.option_id, stage: 'schedule_reminder' });
            const prompt = `${speech} ¿Quieres que te recuerde mañana para continuar? Di sí o no.`;
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(prompt, sa, false)));
          }
          const nextCh = findChapter(nextChapterId);
          if (!nextCh || !nextCh.scenes || nextCh.scenes.length === 0) {
            const speech = `Has seleccionado ${chosenOpt.option_text}. No hay más escenas.`;
            const sa = Object.assign({}, sessionAttrs, { last_decision: chosenOpt.option_id, stage: 'schedule_reminder' });
            const prompt2 = `${speech} ¿Quieres que te recuerde mañana para continuar? Di sí o no.`;
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(prompt2, sa, false)));
          }
          const nextScene = nextCh.scenes[0];
          // Present up to three numbered options for the next scene
          const rawNextOpts = nextScene.options || [];
          const nextOpts = rawNextOpts.slice(0, 3).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx + 1, next_chapter_id: o.next_chapter_id }));
          let nextSpeech = `${nextScene.text} `;
          if (nextOpts.length > 0) {
            const labels = ['uno', 'dos', 'tres'];
            nextSpeech += nextOpts.map((o, i) => `${labels[i]}. ${o.option_text}`).join('. ');
            if (nextOpts.length === 1) nextSpeech += ' Di "uno" o "continuar" para elegir.';
            else if (nextOpts.length === 2) nextSpeech += ' Di "uno" o "dos" para elegir.';
            else nextSpeech += ' Di "uno", "dos" o "tres" para elegir.';
          }
          const saNew = Object.assign({}, sessionAttrs, { current_scene_id: nextScene.scene_id, current_options: nextOpts, chapter_id: nextCh.chapter_id });
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(nextSpeech, saNew, false)));
        } catch (err) {
          console.error('error persisting decision', err);
          res.writeHead(500, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No se pudo registrar tu acción.', sessionAttrs, false)));
        }
      }

      // Fallback: echo intent name
      const speech = `Recibido intent ${intentName}.`;
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(alexaResponse(speech, sessionAttrs, false)));
    }

    // Unknown request type
    res.writeHead(400, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: 'unsupported Alexa request type' }));
  } catch (err) {
    console.error('alexa error', err);
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: err.message || String(err) }));
  }
}

// Reusable processing function so other handlers (e.g. Alexa) can persist telemetry
async function processTelemetryPayload(payload, headers) {
        if (!ensureSessionPayload(payload)) throw new Error('invalid payload');
        // clone to avoid mutating original
        const p = JSON.parse(JSON.stringify(payload || {}));
        console.log('processing telemetry payload:', p);
        const _client_session_id = p.session_id;
        delete p.session_id;
        if (Array.isArray(p.decisions)) {
          for (const d of p.decisions) { delete d.decision_id; }
        }
        const userToken = (headers && headers['x-user-token']) || p.user_token || null;
        let pseudonym = p.pseudonym || null;

        if (userToken) {
          const { data: tokenRow, error: tokenErr } = await supabase
            .from('auth_tokens')
            .select('token, pseudonym, expires_at')
            .eq('token', userToken)
            .maybeSingle();
          if (tokenErr) console.warn('token lookup error', tokenErr);
          if (!tokenRow) throw new Error('invalid or expired user token');
          if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) throw new Error('user token expired');
          pseudonym = tokenRow.pseudonym;
        }

        const session_id = (p.session_id && uuidValidate(p.session_id)) ? p.session_id : uuidv4();
        pseudonym = pseudonym || `anon_${session_id.slice(0,8)}`;

        const sessionRow = {
          session_id,
          pseudonym,
          started_at: p.started_at || null,
          ended_at: p.ended_at || null,
          session_length_seconds: p.session_length_seconds || null,
          consent_given: !!p.consent_given,
          privacy_mode: p.privacy_mode || 'anonymous',
          abandonment_flag: !!p.abandonment_flag,
          chapter_id: p.chapter_id || null,
          metadata: p.metadata || null,
          source: p.source || 'alexa',
          ingest_batch_id: p.ingest_batch_id || null,
          normalized_emotional_score_gds: p.normalized_emotional_score_gds || null,
          normalized_emotional_score_phq: p.normalized_emotional_score_phq || null
        };

        console.log('sessionRow to upsert:', sessionRow);
        const { data: upsertSession, error: upsertErr } = await supabase
          .from('sessions')
          .upsert(sessionRow, { onConflict: 'session_id' })
          .select()
          .single();
        if (upsertErr) {
          console.error('upsert sessions error detail:', upsertErr);
          throw upsertErr;
        }

        const decisions = p.decisions || [];
        const decisionRows = decisions.map(d => ({
          decision_id: (d.decision_id && uuidValidate(d.decision_id)) ? d.decision_id : uuidv4(),
          session_id,
          timestamp: d.timestamp || new Date().toISOString(),
          chapter_id: d.chapter_id || sessionRow.chapter_id,
          scene_id: d.scene_id || null,
          option_id: d.option_id || null,
          option_text: d.option_text || null,
          time_to_decision_ms: d.time_to_decision_ms || null,
          mapping_confidence: d.mapping_confidence || (d.parsed_mapping && d.parsed_mapping.mapping_confidence) || null,
          validation_steps: d.validation_steps || null,
          risk_flags: d.risk_flags || null,
          raw_mapping: d.parsed_mapping || d.raw_mapping || null
        }));

        if (decisionRows.length > 0) {
          console.log('decisionRows to insert:', decisionRows);
            // Ensure referenced scenes exist to satisfy foreign key constraints.
            const sceneIds = Array.from(new Set(decisionRows.map(r => r.scene_id).filter(Boolean)));
            for (const sid of sceneIds) {
              try {
                const { data: existing, error: existErr } = await supabase.from('scenes').select('scene_id').eq('scene_id', sid).maybeSingle();
                if (existErr) console.warn('scene lookup error', existErr);
                if (!existing) {
                  try {
                    const { data: insData, error: insErr } = await supabase.from('scenes').upsert([{ scene_id: sid, chapter_id: sessionRow.chapter_id || null, title: sid }], { onConflict: 'scene_id' }).select();
                    if (insErr) {
                      console.warn('failed to upsert scene', sid, insErr);
                    } else {
                      console.log('upserted missing scene:', sid, insData);
                    }
                  } catch (insertSceneErr) {
                    console.warn('failed to upsert scene', sid, insertSceneErr && insertSceneErr.message ? insertSceneErr.message : insertSceneErr);
                  }
                }
              } catch (e) {
                console.warn('scene ensure error', sid, e && e.message);
              }
            }

            const { error: decErr } = await supabase.from('decisions').insert(decisionRows);
            if (decErr) {
              console.error('decisions insert error detail:', decErr);
              throw decErr;
            }
        }

        const clinicalRows = [];
        for (let i = 0; i < decisions.length; i++) {
          const d = decisions[i];
          const decision_id = decisionRows[i] && decisionRows[i].decision_id ? decisionRows[i].decision_id : ((d.decision_id && uuidValidate(d.decision_id)) ? d.decision_id : uuidv4());
          const designerMappings = d.designer_mapping || (d.raw_mapping && d.raw_mapping.designer_mapping) || [];
          for (const m of designerMappings) {
            clinicalRows.push({
              mapping_id: (m.mapping_id && uuidValidate(m.mapping_id)) ? m.mapping_id : uuidv4(),
              decision_id,
              scale: m.scale || null,
              item: m.item || null,
              weight: m.weight || null,
              confidence: m.confidence || m.source_confidence || null,
              primary_construct: m.primary_construct || null,
              rationale: m.rationale || null,
              mapping_source: 'designer',
              source_confidence: m.source_confidence || m.confidence || null,
              validated: m.validated || false
            });
          }
            const mappings = (d.parsed_mapping && d.parsed_mapping.clinical_mapping) || (d.raw_mapping && d.raw_mapping.clinical_mapping) || [];
          for (const m of mappings) {
            clinicalRows.push({
              mapping_id: (m.mapping_id && uuidValidate(m.mapping_id)) ? m.mapping_id : uuidv4(),
              decision_id,
              scale: m.scale || null,
              item: m.item || null,
              weight: m.weight || null,
              confidence: m.confidence || null,
              primary_construct: m.primary_construct || null,
              rationale: m.rationale || null,
              mapping_source: m.mapping_source || 'llm',
              source_confidence: m.source_confidence || m.confidence || null,
              validated: m.validated || false
            });
          }
        }

          // Additionally, if decisions reference an `option_id`, fetch any option_mappings
          for (let i = 0; i < decisionRows.length; i++) {
            const dr = decisionRows[i];
            if (dr.option_id) {
              try {
                const { data: optMaps, error: optMapErr } = await supabase.from('option_mappings').select('*').eq('option_id', dr.option_id);
                if (optMapErr) {
                  console.warn('option_mappings lookup error', optMapErr);
                } else if (optMaps && Array.isArray(optMaps)) {
                  for (const m of optMaps) {
                    clinicalRows.push({
                      mapping_id: uuidv4(),
                      decision_id: dr.decision_id || uuidv4(),
                      scale: m.scale || null,
                      item: m.item || null,
                      weight: m.weight || null,
                      confidence: m.confidence || null,
                      primary_construct: null,
                      rationale: 'mapped from option_mappings',
                      mapping_source: 'designer',
                      source_confidence: m.confidence || null,
                      validated: false
                    });
                  }
                }
              } catch (e) {
                console.warn('option_mappings fetch exception', e && e.message);
              }
            }
          }

          if (clinicalRows.length > 0) {
          console.log('clinicalRows to insert:', clinicalRows);
          const { error: cmErr } = await supabase.from('clinical_mappings').insert(clinicalRows);
          if (cmErr) {
            console.error('clinical_mappings insert error detail:', cmErr);
            throw cmErr;
          }
        }

        if (p.llm_request || p.llm_response) {
          const auditRow = {
            session_id,
            decision_id: p.decision_id || null,
            llm_request: p.llm_request || null,
            llm_response: p.llm_response || null,
            validation_result: p.validation_result || null,
            risk_flags: p.risk_flags || null,
            pseudonym
          };
          const { error: auditErr } = await supabase.from('decision_audit').insert(auditRow);
          if (auditErr) throw auditErr;
        }

        return { ok: true, session_id, decisions_inserted: decisionRows.length, clinical_mappings_inserted: clinicalRows.length };
      }

// Start HTTP server and route requests
const PORT = process.env.PORT || 7070;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  try {
    if (req.method === 'POST' && url === '/telemetry') return await handleTelemetry(req, res);
    if (req.method === 'POST' && url === '/identify') return await handleIdentify(req, res);
    if (req.method === 'POST' && url === '/alexa') return await handleAlexa(req, res);
    if (req.method === 'GET' && (url === '/' || url === '/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, uptime_seconds: Math.floor(process.uptime()) }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    console.error('server handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err && err.message ? err.message : String(err) }));
  }
});

// Ensure options and mappings are upserted from content, then start server
(async () => {
  try {
    await ensureOptionsUpsert();
  } catch (e) {
    console.warn('ensureOptionsUpsert failed at startup', e && e.message);
  }
  server.listen(PORT, HOST, () => console.log(`Telemetry API listening on ${PORT}`));
})();

process.on('uncaughtException', (err) => { console.error('uncaughtException', err); });
process.on('unhandledRejection', (r) => { console.error('unhandledRejection', r); });