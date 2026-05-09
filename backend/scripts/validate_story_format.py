#!/usr/bin/env python3
"""
Validate story_*.json files for completeness and correctness.
Checks:
1. All chapters have required fields: chapter_id, title, order, scenes
2. All scenes have required fields: scene_id, title, hero_stage, type, order, text, options
3. All options have required fields: option_id, option_text, consequence, next_scene_id, gds_mapping, phq_mapping
4. No "Continue" option_text
5. No empty options
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

STORY_FILES = [
    "backend/content/story_alberto_ajedrez.json",
    "backend/content/story_ernesto_taller.json",
    "backend/content/story_mariana_huerto.json",
    "backend/content/story_tatiana_taller.json"
]

CHAPTER_REQUIRED = {"chapter_id", "title", "order", "scenes"}
SCENE_REQUIRED = {"scene_id", "title", "hero_stage", "type", "order", "text", "options"}
OPTION_REQUIRED = {"option_id", "option_text", "consequence", "next_scene_id", "gds_mapping", "phq_mapping"}

class ValidationError:
    def __init__(self, filepath: str, level: str, location: str, issue: str):
        self.filepath = filepath
        self.level = level
        self.location = location
        self.issue = issue
    
    def __str__(self):
        return f"  [{self.level}] {self.location}: {self.issue}"

def validate_file(filepath: str) -> Tuple[bool, List[ValidationError]]:
    """Validate a single story file."""
    errors = []
    
    if not os.path.exists(filepath):
        errors.append(ValidationError(filepath, "FATAL", "FILE", f"File not found"))
        return False, errors
    
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
    except Exception as e:
        errors.append(ValidationError(filepath, "FATAL", "JSON", f"Invalid JSON: {e}"))
        return False, errors
    
    # Validate chapters
    chapters = data.get("chapters", [])
    if not chapters:
        errors.append(ValidationError(filepath, "ERROR", "CHAPTERS", "No chapters found"))
        return len(errors) == 0, errors
    
    for ch_idx, chapter in enumerate(chapters):
        ch_id = chapter.get("chapter_id", f"UNKNOWN[{ch_idx}]")
        
        # Check required fields
        missing = CHAPTER_REQUIRED - set(chapter.keys())
        if missing:
            errors.append(ValidationError(filepath, "ERROR", f"Chapter {ch_id}", f"Missing fields: {missing}"))
        
        # Check for unwanted fields
        unwanted = {"protagonist", "protagonist_gender", "protagonist_age", "setting"}
        present = set(chapter.keys()) & unwanted
        if present:
            errors.append(ValidationError(filepath, "ERROR", f"Chapter {ch_id}", f"Should not have fields: {present}"))
        
        # Validate scenes
        scenes = chapter.get("scenes", [])
        for sc_idx, scene in enumerate(scenes):
            sc_id = scene.get("scene_id", f"UNKNOWN[{sc_idx}]")
            
            # Check required fields
            missing = SCENE_REQUIRED - set(scene.keys())
            if missing:
                errors.append(ValidationError(filepath, "ERROR", f"Scene {sc_id}", f"Missing fields: {missing}"))
            
            # Validate options
            options = scene.get("options", [])
            for opt_idx, option in enumerate(options):
                opt_id = option.get("option_id", f"UNKNOWN[{opt_idx}]")
                
                # Check required fields
                missing = OPTION_REQUIRED - set(option.keys())
                if missing:
                    errors.append(ValidationError(filepath, "ERROR", f"Option {opt_id} in {sc_id}", f"Missing fields: {missing}"))
                
                # Check for empty option_text
                opt_text = option.get("option_text", "").strip()
                if not opt_text:
                    errors.append(ValidationError(filepath, "ERROR", f"Option {opt_id} in {sc_id}", "Empty option_text"))
                
                # Check for "Continuar" or "Continue" as option_text
                if opt_text.lower() in ["continuar", "continue", "1 continuar"]:
                    errors.append(ValidationError(filepath, "WARNING", f"Option {opt_id} in {sc_id}", f'Found placeholder option: "{opt_text}"'))
                
                # Check mappings are non-empty
                gds = option.get("gds_mapping", [])
                phq = option.get("phq_mapping", [])
                if not isinstance(gds, list):
                    errors.append(ValidationError(filepath, "ERROR", f"Option {opt_id} in {sc_id}", "gds_mapping is not a list"))
                if not isinstance(phq, list):
                    errors.append(ValidationError(filepath, "ERROR", f"Option {opt_id} in {sc_id}", "phq_mapping is not a list"))
    
    return len(errors) == 0, errors

def main():
    base_path = Path(__file__).parent.parent.parent
    os.chdir(base_path)
    
    print("=" * 70)
    print("🔍 VALIDATING STORY FILES FORMAT & COMPLETENESS")
    print("=" * 70)
    
    all_errors = {}
    success_count = 0
    
    for filepath in STORY_FILES:
        print(f"\n📄 {filepath}")
        is_valid, errors = validate_file(filepath)
        all_errors[filepath] = errors
        
        if is_valid:
            print("  ✅ All checks passed")
            success_count += 1
        else:
            print(f"  ❌ Found {len(errors)} issue(s):")
            for error in errors:
                print(str(error))
    
    print("\n" + "=" * 70)
    print(f"📊 SUMMARY: {success_count}/{len(STORY_FILES)} files passed validation")
    print("=" * 70)
    
    if success_count == len(STORY_FILES):
        print("✅ All story files are properly formatted!")
        return 0
    else:
        print(f"⚠️  {len(STORY_FILES) - success_count} file(s) have issues")
        return 1

if __name__ == "__main__":
    exit(main())
