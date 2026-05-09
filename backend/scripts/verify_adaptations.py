#!/usr/bin/env python3
"""
Verify that Spain adaptations were applied correctly.
"""

import json
from pathlib import Path

def check_adaptations():
    """Check if Spain versions have adaptations."""
    print("=" * 70)
    print("🔍 VERIFICANDO ADAPTACIONES ESPAÑA")
    print("=" * 70)
    
    latam_file = Path("backend/content/latam/story_ernesto_taller.json")
    spain_file = Path("backend/content/spain/story_ernesto_taller.json")
    
    with open(latam_file, 'r', encoding='utf-8-sig') as f:
        latam_data = json.load(f)
    
    with open(spain_file, 'r', encoding='utf-8-sig') as f:
        spain_data = json.load(f)
    
    # Check chapter 1, scene 1
    latam_text = latam_data['chapters'][0]['scenes'][0]['text']
    spain_text = spain_data['chapters'][0]['scenes'][0]['text']
    
    print("\n📄 Chapter 1, Scene 1 - Comparación:")
    print(f"\n🇨🇴 LATAM (Cali):\n{latam_text[:200]}...\n")
    print(f"🇪🇸 SPAIN (Barcelona):\n{spain_text[:200]}...\n")
    
    # Check for specific adaptations
    adaptations_found = {
        "Cali → Barcelona": "Barcelona" in spain_text and "Cali" not in spain_text,
        "ferrería → ferretería": "ferrería" not in spain_text or "ferretería" in spain_text,
    }
    
    print("=" * 70)
    print("✅ ADAPTACIONES VERIFICADAS:")
    print("=" * 70)
    for adaptation, found in adaptations_found.items():
        status = "✅" if found else "❌"
        print(f"{status} {adaptation}")
    
    # Check Mariana file
    print("\n" + "=" * 70)
    print("📄 Verificando Mariana (Mariana_huerto)...")
    print("=" * 70)
    
    latam_m = Path("backend/content/latam/story_mariana_huerto.json")
    spain_m = Path("backend/content/spain/story_mariana_huerto.json")
    
    with open(latam_m, 'r', encoding='utf-8-sig') as f:
        latam_m_data = json.load(f)
    with open(spain_m, 'r', encoding='utf-8-sig') as f:
        spain_m_data = json.load(f)
    
    latam_text_m = latam_m_data['chapters'][0]['scenes'][0]['text']
    spain_text_m = spain_m_data['chapters'][0]['scenes'][0]['text']
    
    print(f"\n🇨🇴 LATAM (Bogotá):\n{latam_text_m[:200]}...\n")
    print(f"🇪🇸 SPAIN (Madrid):\n{spain_text_m[:200]}...\n")
    
    adaptations_m = {
        "Bogotá → Madrid": "Madrid" in spain_text_m and "Bogotá" not in spain_text_m,
        "porterÃ­a/casillero → portal/buzón": "portal" in spain_text_m or "buzón" in spain_text_m,
    }
    
    print("=" * 70)
    print("✅ ADAPTACIONES (Mariana):")
    print("=" * 70)
    for adaptation, found in adaptations_m.items():
        status = "✅" if found else "⚠️ "
        print(f"{status} {adaptation}")

if __name__ == "__main__":
    check_adaptations()
