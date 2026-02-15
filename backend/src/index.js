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
      return { version: '1.0', response: { outputSpeech: { type: 'PlainText', text }, shouldEndSession }, sessionAttributes };
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
        const slots = (body.request.intent && body.request.intent.slots) || {};
        const pseudonym = (slots.pseudonym && (slots.pseudonym.value || (slots.pseudonym.resolutions && slots.pseudonym.resolutions.resolutionsPerAuthority && slots.pseudonym.resolutions.resolutionsPerAuthority[0] && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values && slots.pseudonym.resolutions.resolutionsPerAuthority[0].values[0].value.name))) || null;
        if (pseudonym) {
          const sa = Object.assign({}, sessionAttrs, { stage: 'consent', pseudonym: String(pseudonym).slice(0,64) });
          const speech = `Hola ${pseudonym}. Antes de continuar, das tu consentimiento para registrar tu progreso? Di sí o no.`;
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse(speech, sa, false)));
        }
        // If no pseudonym provided, reprompt
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(alexaResponse('No entendí tu pseudónimo. Por favor dilo de nuevo.', sessionAttrs, false)));
      }

      // Consent handling
      if (sessionAttrs.stage === 'consent') {
        if (intentName === 'AMAZON.YesIntent') {
          // Create a session row now and present first scene
          const pseudonym = sessionAttrs.pseudonym || ((body.session && body.session.user && body.session.user.userId) ? String(body.session.user.userId).slice(0,64) : `anon_${Date.now()}`);
          const sessionPayload = { source: 'alexa', pseudonym, consent_given: true, chapter_id: 'c01' };
          try {
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
            const opts = (firstScene.options || []).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx+1, next_chapter_id: o.next_chapter_id }));
            // Build speech: scene text + numbered options
            let sceneSpeech = `${firstScene.text} `;
            for (const o of opts) { sceneSpeech += `Opción ${o.index}: ${o.option_text}. `; }
            const sa2 = Object.assign({}, sa, { current_scene_id: firstScene.scene_id, current_options: opts });
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(sceneSpeech, sa2, false)));
          } catch (err) {
            console.error('error creating session from consent', err);
            res.writeHead(500, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse('Hubo un error al crear la sesión.', sessionAttrs, true)));
          }
        }
        if (intentName === 'AMAZON.NoIntent') {
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
        let chosenVal = null;
        if (slots.option && slots.option.value) chosenVal = String(slots.option.value).toLowerCase();
        // support numeric replies like '1' or 'uno'
        let chosenOpt = null;
        const opts = sessionAttrs.current_options || [];
        if (chosenVal) {
          const asNum = parseInt(chosenVal.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(asNum)) chosenOpt = opts.find(o => o.index === asNum);
          if (!chosenOpt) chosenOpt = opts.find(o => o.option_text && o.option_text.toLowerCase() === chosenVal);
        }
        // fallback: try match by intentName to option id or text
        if (!chosenOpt) {
          const normIntent = (intentName || '').toLowerCase();
          chosenOpt = opts.find(o => (o.option_id && o.option_id.toLowerCase() === normIntent) || (o.option_text && o.option_text.toLowerCase() === normIntent));
        }
        // final fallback: take first option if nothing matched
        if (!chosenOpt && opts.length === 1) chosenOpt = opts[0];

        if (!chosenOpt) {
          res.writeHead(200, {'Content-Type':'application/json'});
          return res.end(JSON.stringify(alexaResponse('No entendí tu elección. Por favor di el número o el texto de la opción.', sessionAttrs, false)));
        }

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
            const speech = `Has seleccionado ${chosenOpt.option_text}. Fin del capítulo.`;
            const sa = Object.assign({}, sessionAttrs, { last_decision: chosenOpt.option_id });
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, sa, true)));
          }
          const nextCh = findChapter(nextChapterId);
          if (!nextCh || !nextCh.scenes || nextCh.scenes.length === 0) {
            const speech = `Has seleccionado ${chosenOpt.option_text}. No hay más escenas.`;
            const sa = Object.assign({}, sessionAttrs, { last_decision: chosenOpt.option_id });
            res.writeHead(200, {'Content-Type':'application/json'});
            return res.end(JSON.stringify(alexaResponse(speech, sa, true)));
          }
          const nextScene = nextCh.scenes[0];
          const nextOpts = (nextScene.options || []).map((o, idx) => ({ option_id: o.option_id, option_text: o.option_text, index: idx+1, next_chapter_id: o.next_chapter_id }));
          let nextSpeech = `${nextScene.text} `;
          for (const o of nextOpts) { nextSpeech += `Opción ${o.index}: ${o.option_text}. `; }
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
                      mapping_id: (m.mapping_id && uuidValidate(m.mapping_id)) ? m.mapping_id : uuidv4(),
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