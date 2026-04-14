import json

def compress():
    with open('backend/content/chapters.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    c01 = next(c for c in data['chapters'] if c['chapter_id'] == 'c01')
    
    target_ids = [
        ('c01-s01', 'c01-s01'),
        ('c01-s02a', 'c01-s02'), 
        ('c01-s03', 'c01-s03'),
        ('c01-s04', 'c01-s04'),
        ('c01-s05', 'c01-s05'),
        ('c01-s06', 'c01-s06'),
        ('c01-s07a', 'c01-s07'),
        ('c01-s09', 'c01-s08'),
        ('c01-s10', 'c01-s09'),
        ('c01-s11a', 'c01-s10'),
        ('c01-s13', 'c01-s11'),
        ('c01-s15', 'c01-s12')
    ]
    
    new_scenes = []
    
    for idx, (old_id, new_id) in enumerate(target_ids, 1):
        scene = next((s for s in c01['scenes'] if s['scene_id'] == old_id), None)
        if not scene:
            print(f'Error: {old_id} no encontrado.')
            return
        scene['scene_id'] = new_id
        scene['order'] = idx
        new_scenes.append(scene)
        
    c01['scenes'] = new_scenes
    
    with open('backend/content/chapters.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    with open('backend/content/chapters_expanded.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print('C01 comprimido a 12 escenas exitosamente.')

if __name__ == '__main__':
    compress()