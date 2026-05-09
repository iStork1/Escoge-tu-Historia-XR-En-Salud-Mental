#!/usr/bin/env python3
"""
Script to clean story_*.json files by removing extra fields at chapter level.
These files should match the format of chapters_expanded.json.

Removes: protagonist, protagonist_gender, protagonist_age, setting
Keeps: chapter_id, title, order, scenes
"""

import json
import os
import sys
from pathlib import Path

STORY_FILES = [
    "backend/content/story_alberto_ajedrez.json",
    "backend/content/story_ernesto_taller.json",
    "backend/content/story_mariana_huerto.json",
    "backend/content/story_tatiana_taller.json"
]

FIELDS_TO_REMOVE = ["protagonist", "protagonist_gender", "protagonist_age", "setting"]

def clean_chapter(chapter):
    """Remove unwanted fields from chapter level."""
    cleaned = {}
    for key, value in chapter.items():
        if key not in FIELDS_TO_REMOVE:
            cleaned[key] = value
    return cleaned

def process_file(filepath):
    """Process a single story file."""
    print(f"\n📄 Processing: {filepath}")
    
    if not os.path.exists(filepath):
        print(f"  ❌ File not found: {filepath}")
        return False
    
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        # Count removals
        total_chapters = len(data.get("chapters", []))
        removals_count = 0
        
        # Clean each chapter
        for chapter in data.get("chapters", []):
            before_keys = set(chapter.keys())
            chapter_cleaned = clean_chapter(chapter)
            
            # Count fields removed
            removed = before_keys - set(chapter_cleaned.keys())
            if removed:
                removals_count += len(removed)
                chapter.clear()
                chapter.update(chapter_cleaned)
        
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, separators=(',', ': '))
        
        print(f"  ✅ Cleaned: {total_chapters} chapters")
        print(f"  🗑️  Removed {removals_count} total fields")
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    base_path = Path(__file__).parent.parent.parent  # Go to project root
    os.chdir(base_path)
    
    print("=" * 60)
    print("🧹 CLEANING STORY FILES FORMAT")
    print("=" * 60)
    print(f"Base path: {base_path}")
    print(f"Files to process: {len(STORY_FILES)}")
    print(f"Fields to remove: {', '.join(FIELDS_TO_REMOVE)}")
    
    success_count = 0
    for filepath in STORY_FILES:
        if process_file(filepath):
            success_count += 1
    
    print("\n" + "=" * 60)
    print(f"✅ Processing complete: {success_count}/{len(STORY_FILES)} files cleaned")
    print("=" * 60)

if __name__ == "__main__":
    main()
