import json
import requests
import os

BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:7070')
PAYLOAD_PATH = os.path.join(os.path.dirname(__file__), '..', 'twine', 'payload_examples', 'one_chapter_payload.json')

def main():
    with open(PAYLOAD_PATH, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    url = f"{BACKEND_URL}/telemetry"
    print('Posting to', url)
    r = requests.post(url, json=payload, timeout=10)
    try:
        print('Status:', r.status_code)
        print('Response:', r.json())
    except Exception:
        print('Response text:', r.text)

if __name__ == '__main__':
    main()
