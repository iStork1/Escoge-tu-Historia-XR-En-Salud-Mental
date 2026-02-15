try { require('dotenv').config(); } catch (e) { }
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment (.env)');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchLatestSession() {
  const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchDecisions(session_id) {
  const { data, error } = await supabase.from('decisions').select('*').eq('session_id', session_id).order('timestamp', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchClinicalForDecisions(decisionIds) {
  if (!decisionIds || decisionIds.length === 0) return [];
  const { data, error } = await supabase.from('clinical_mappings').select('*').in('decision_id', decisionIds);
  if (error) throw error;
  return data || [];
}

async function main() {
  try {
    const arg = process.argv[2];
    let session = null;
    if (arg) {
      const { data, error } = await supabase.from('sessions').select('*').eq('session_id', arg).maybeSingle();
      if (error) throw error;
      session = data;
      if (!session) {
        console.error('No session found with id', arg);
        process.exit(2);
      }
    } else {
      session = await fetchLatestSession();
      if (!session) {
        console.error('No sessions found in database');
        process.exit(2);
      }
    }

    console.log('Session:', session.session_id, 'pseudonym:', session.pseudonym, 'chapter:', session.chapter_id, 'consent:', session.consent_given);

    const decisions = await fetchDecisions(session.session_id);
    console.log('Decisions:', decisions.length);
    decisions.forEach((d, i) => {
      console.log(`${i+1}. decision_id=${d.decision_id} scene=${d.scene_id} option_id=${d.option_id} option_text=${d.option_text} timestamp=${d.timestamp}`);
    });

    const decisionIds = decisions.map(d => d.decision_id).filter(Boolean);
    const clinical = await fetchClinicalForDecisions(decisionIds);
    console.log('Clinical mappings:', clinical.length);
    clinical.forEach((c, i) => {
      console.log(`${i+1}. mapping_id=${c.mapping_id} decision_id=${c.decision_id} scale=${c.scale} item=${c.item} weight=${c.weight} confidence=${c.confidence} source=${c.mapping_source}`);
    });

    process.exit(0);
  } catch (e) {
    console.error('Error verifying session:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
