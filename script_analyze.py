
import json
import re

with open('backend/content/chapters.json', encoding='utf-8') as f:
    d = json.load(f)

for c in d['chapters']:
    cid = c.get('chapter_id')
    title = c.get('title')
    stages = set()
    for s in c.get('scenes', []):
        st = s.get('hero_stage')
        if st:
            stages.add(st)
    stages_str = ', '.join(sorted(stages))
    print(f'Chapter {cid}: {title} [Stages: {stages_str}]')
    
    for s in c.get('scenes', []):
        t = s.get('text', '')
        # find capitalized names roughly
        words = re.findall(r'\b[A-Z][a-z]+\b', t)
        print(f'  Scene {s.get("scene_id")}: {t[:100]}... [Stage: {s.get("hero_stage")}]')
    print('-'*40)

