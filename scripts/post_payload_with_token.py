import requests
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_URL = 'http://localhost:7070'

def identify(pseudonym):
    r = requests.post(BACKEND_URL + '/identify', json={'pseudonym': pseudonym})
    r.raise_for_status()
    return r.json().get('token')

def post_payload(token, payload_path):
    with open(payload_path, 'rb') as f:
        payload = f.read()
    headers = {'Content-Type': 'application/json', 'x-user-token': token}
    r = requests.post(BACKEND_URL + '/telemetry', data=payload, headers=headers)
    r.raise_for_status()
    return r.json()

def main():
    token = identify('test-user-1')
    print('Got token:', token)
    payload_file = ROOT / 'twine' / 'payload_examples' / 'phase1_payload_example.json'
    resp = post_payload(token, payload_file)
    print('Telemetry response:', resp)

if __name__ == '__main__':
    main()
