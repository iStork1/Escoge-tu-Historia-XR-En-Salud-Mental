import json
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent

def load_structure():
    p = ROOT / 'twine' / 'game_structure.json'
    return json.loads(p.read_text(encoding='utf-8'))

def build_payload(struct):
    session_id = str(uuid4())
    decisions = []
    for ch in struct.get('chapters', []):
        chapter_id = ch['chapter_id']
        for scene in ch.get('scenes', []):
            # create a placeholder decision per scene
            decisions.append({
                'decision_id': str(uuid4()),
                'session_id': session_id,
                'timestamp': None,
                'chapter_id': chapter_id,
                'scene_id': scene.get('scene_id'),
                'option_id': scene.get('options', [{}])[0].get('option_id'),
                'option_text': scene.get('options', [{}])[0].get('text'),
                'time_to_decision_ms': None,
                'mapping_confidence': None,
                'raw_mapping': None
            })
    payload = {
        'session': {
            'session_id': session_id,
            'pseudonym': 'test-user-1',
            'source': 'twine-phase1',
            'consent_given': True
        },
        'decisions': decisions
    }
    return payload

def main():
    struct = load_structure()
    payload = build_payload(struct)
    out_dir = ROOT / 'twine' / 'payload_examples'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / 'phase1_payload_example.json'
    out_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
    print('Wrote payload example to', out_file)

if __name__ == '__main__':
    main()
