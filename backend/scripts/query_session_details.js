try { require('dotenv').config(); } catch (e) {}
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment (.env)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error('Usage: node scripts/query_session_details.js <session_id>');
    process.exit(1);
  }
  try {
    const [{ data: session, error: sErr }, { data: decisions, error: dErr }, { data: mappings, error: mErr }] = await Promise.all([
      supabase.from('sessions').select('*').eq('session_id', sessionId).maybeSingle(),
      supabase.from('decisions').select('*').eq('session_id', sessionId),
      supabase.from('clinical_mappings').select('*').eq('decision_id', 'eq.' + sessionId) // placeholder handled below
    ].map(p => p.catch ? p : p));

    // If the above mapping query was incorrect (we attempted to use sessionId), instead fetch mappings by decision ids.
    if (dErr) {
      console.error('decisions query error', dErr);
      process.exit(2);
    }

    const decisionsResult = decisions || [];

    // Collect decision ids and fetch mappings properly
    const decisionIds = decisionsResult.map(d => d.decision_id).filter(Boolean);
    let mappingRows = [];
    if (decisionIds.length > 0) {
      const { data: mData, error: mappingErr } = await supabase.from('clinical_mappings').select('*').in('decision_id', decisionIds);
      if (mappingErr) {
        console.error('clinical_mappings query error', mappingErr);
      } else {
        mappingRows = mData || [];
      }
    }

    console.log('SESSION:');
    console.log(JSON.stringify(session || null, null, 2));
    console.log('\nDECISIONS:');
    console.log(JSON.stringify(decisionsResult, null, 2));
    console.log('\nCLINICAL_MAPPINGS:');
    console.log(JSON.stringify(mappingRows, null, 2));
  } catch (e) {
    console.error('unexpected error', e && e.message ? e.message : e);
    process.exit(3);
  }
}

main();
