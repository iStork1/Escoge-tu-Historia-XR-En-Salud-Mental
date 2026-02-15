#!/usr/bin/env node
// Simple Twine -> chapters.json converter
// Supports Twine HTML (SugarCube) with <tw-passagedata> or a basic Twee export (:: Passage Title) format.
// Usage: node tools/twine_to_chapters.js input.html --out backend/content/chapters_from_twine.json

const fs = require('fs');
const path = require('path');

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function inferChapterId(title) {
  const m = title.match(/(c\d{2})/i);
  if (m) return m[1].toLowerCase();
  return 'c_misc';
}

function inferSceneId(title) {
  const m = title.match(/(c\d{2}-s\d{2})/i);
  if (m) return m[1].toLowerCase();
  return slug(title).slice(0, 48) || `scene-${Math.random().toString(36).slice(2,8)}`;
}

function parseTwineHtml(content) {
  const passages = [];
  const re = /<tw-passagedata[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/tw-passagedata>/gi;
  let m;
  while ((m = re.exec(content))) {
    const name = m[1];
    const body = m[2].replace(/\n\s*/g, '\n').trim();
    passages.push({ name, text: body });
  }
  return passages;
}

function parseTwee(content) {
  const passages = [];
  const parts = content.split(/^::\s+/m).slice(1);
  for (const p of parts) {
    const lines = p.split(/\r?\n/);
    const title = lines.shift().trim();
    const body = lines.join('\n').trim();
    passages.push({ name: title, text: body });
  }
  return passages;
}

function extractLinksWithMappings(text) {
  // Matches [[label|target]] optionally followed by a mapping comment or tag
  // e.g. [[Acercarte|c02-s01]] /* mappings: PHQ:9:1.0 */
  const links = [];
  const re = /\[\[([^\]]+)\]\]\s*(?:\/\*\s*mappings\s*:\s*([^*]+)\*\/|<<\s*mappings\s+([^>]+)>>)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1].trim();
    let label = raw, target = raw;
    if (raw.includes('->')) {
      const parts = raw.split('->'); label = parts[0].trim(); target = parts[1].trim();
    } else if (raw.includes('|')) {
      const parts = raw.split('|'); label = parts[0].trim(); target = parts[1].trim();
    }
    const mappingRaw = (m[2] || m[3] || '').trim();
    let linkMappings = [];
    if (mappingRaw) {
      const parts = mappingRaw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const bits = p.split(':').map(x => x.trim());
        const scale = bits[0] || null;
        const item = bits[1] ? parseInt(bits[1], 10) : null;
        const weight = bits[2] ? Number(bits[2]) : null;
        const confidence = bits[3] ? Number(bits[3]) : (bits[2] ? 0.9 : null);
        linkMappings.push({ scale, item, weight, confidence });
      }
    }
    links.push({ label, target, mappings: linkMappings });
  }
  return links;
}

function extractMappings(text) {
  // Accept comment style: /* mappings: PHQ:9:1.0, GDS:2:1.0 */
  // or tag style: <<mappings PHQ:9:1.0, GDS:2:1.0 >>
  const mappings = [];
  const re1 = /\/\*\s*mappings\s*:\s*([^*]+)\*\//i;
  const re2 = /<<\s*mappings\s+([^>]+)>>/i;
  let m = text.match(re1) || text.match(re2);
  if (!m) return { mappings, cleaned: text };
  const raw = m[1].trim();
  const parts = raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    // format SCALE:ITEM:WEIGHT[:CONF]
    const bits = p.split(':').map(x => x.trim());
    const scale = bits[0] || null;
    const item = bits[1] ? parseInt(bits[1], 10) : null;
    const weight = bits[2] ? Number(bits[2]) : null;
    const confidence = bits[3] ? Number(bits[3]) : (bits[2] ? 0.9 : null);
    mappings.push({ scale, item, weight, confidence });
  }
  const cleaned = text.replace(re1, '').replace(re2, '').trim();
  return { mappings, cleaned };
}

function buildChapters(passages) {
  const byName = new Map();
  for (const p of passages) byName.set(p.name, p);

  const chapters = {};
  for (const p of passages) {
    const chapter_id = inferChapterId(p.name);
    const scene_id = inferSceneId(p.name);
    if (!chapters[chapter_id]) chapters[chapter_id] = { chapter_id, title: chapter_id, scenes: [] };
    const { mappings: passageMappings, cleaned } = extractMappings(p.text);
    const links = extractLinksWithMappings(cleaned);
    const options = links.map((lk, idx) => {
      const option_id = `${scene_id}-o${String(idx+1).padStart(1,'0')}`;
      return { option_id, option_text: lk.label, next_chapter_id: (byName.has(lk.target) ? inferChapterId(lk.target) : null), mappings: (lk.mappings || []) };
    });
    // If passage-level mappings exist and there are options, attach them to the first option by default
    if (passageMappings.length > 0 && options.length > 0) {
      options[0].mappings = (options[0].mappings || []).concat(passageMappings.map(m => ({ scale: m.scale, item: m.item, weight: m.weight, confidence: m.confidence })));
    }
    chapters[chapter_id].scenes.push({ scene_id, text: cleaned.replace(/\[\[[^\]]+\]\]/g, '').trim(), options });
  }

  return { chapters: Object.values(chapters) };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) { console.error('Usage: node tools/twine_to_chapters.js <input.html|.twee> [--out out.json]'); process.exit(2); }
  const infile = argv[0];
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 && argv[outIdx+1] ? argv[outIdx+1] : path.join('backend','content','chapters_from_twine.json');
  const data = fs.readFileSync(infile, 'utf8');
  let passages = [];
  if (data.includes('<tw-passagedata')) passages = parseTwineHtml(data);
  else passages = parseTwee(data);
  const chapters = buildChapters(passages);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(chapters, null, 2), 'utf8');
  console.log('Wrote', outFile, 'with', (chapters.chapters || []).length, 'chapters');
}

main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(1); });
