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
    console.error('Usage: node scripts/query_session.js <session_id>');
    process.exit(1);
  }
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) {
      console.error('supabase error', error);
      process.exit(2);
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('unexpected error', e && e.message ? e.message : e);
    process.exit(3);
  }
}

main();
