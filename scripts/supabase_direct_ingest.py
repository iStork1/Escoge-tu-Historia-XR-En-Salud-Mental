import os
import json
import requests
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAYLOAD = ROOT / 'twine' / 'payload_examples' / 'phase1_payload_example.json'

SUPABASE_URL = os.getenv('SUPABASE_URL')
SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_KEY:
    print('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env before running')
    raise SystemExit(1)

def headers():
    return {
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

def upsert_session(session):
    url = f"{SUPABASE_URL}/rest/v1/sessions"
    # Use POST with on_conflict to upsert (PostgREST supports Prefer: resolution=merge-duplicates)
    r = requests.post(url, headers={**headers(), 'Prefer': 'resolution=merge-duplicates,return=representation'}, json=[session])
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        return None

def insert_decisions(decisions):
    url = f"{SUPABASE_URL}/rest/v1/decisions"
    # Use merge-duplicates to upsert by primary key if present
    r = requests.post(url, headers={**headers(), 'Prefer': 'resolution=merge-duplicates'}, json=decisions)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        return None

def insert_clinical(rows):
    url = f"{SUPABASE_URL}/rest/v1/clinical_mappings"
    r = requests.post(url, headers=headers(), json=rows)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        return None

def main():
    payload = json.loads(PAYLOAD.read_text(encoding='utf-8'))
    session = payload.get('session')
    decisions = payload.get('decisions', [])

    print('Upserting session...')
    upsert_session(session)
    print('Inserting decisions...')
    insert_decisions(decisions)

    # No clinical_mappings in example payload; skip unless present
    clinical_rows = []
    for d in decisions:
        designer = d.get('designer_mapping') or []
        raw = d.get('raw_mapping') or []
        parsed = (d.get('parsed_mapping') or {}).get('clinical_mapping') or []
        for m in designer + raw + parsed:
            clinical_rows.append({
                'mapping_id': m.get('mapping_id'),
                'decision_id': d.get('decision_id'),
                'scale': m.get('scale'),
                'item': m.get('item'),
                'weight': m.get('weight'),
                'confidence': m.get('confidence'),
                'mapping_source': m.get('mapping_source') or 'designer',
                'source_confidence': m.get('source_confidence') or m.get('confidence')
            })
    if clinical_rows:
        print('Inserting clinical_mappings...')
        insert_clinical(clinical_rows)

    print('Ingest complete.')

if __name__ == '__main__':
    main()
