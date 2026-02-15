import json,uuid,requests
p=json.load(open('twine/payload_examples/one_chapter_payload.json'))
p['session_id']=str(uuid.uuid4())
p['decisions'][0]['decision_id']=str(uuid.uuid4())
url='http://localhost:7070/telemetry'
print('Posting to',url)
r=requests.post(url,json=p,timeout=20)
print('Status:',r.status_code)
print('Response:',r.text)
