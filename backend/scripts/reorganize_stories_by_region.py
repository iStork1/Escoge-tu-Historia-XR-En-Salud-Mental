#!/usr/bin/env python3
"""
Create Spain versions of story files and organize into latam/spain folders.
Adapts Colombian/Latin American context to Spanish (Spain) context.
"""

import json
import os
import shutil
from pathlib import Path
from typing import Dict, Any

# Mapping de adaptaciones: colombiano/latam → español
ADAPTATIONS = {
    # Ciudades y contextos
    "Bogotá": "Madrid",
    "Bogotá,": "Madrid,",
    "BogotÃ¡": "Madrid",
    "BogotÃ¡,": "Madrid,",
    "Cali": "Barcelona",
    "Cali,": "Barcelona,",
    "Medellín": "Valencia",
    "MedellÃ­n": "Valencia",
    "MedellÃ¡n": "Valencia",
    "MedellÃ­n,": "Valencia,",
    
    # Vocabulario - transporte
    "andén": "acera",
    "AnÃ¡n": "acera",
    "Andén": "Acera",
    "bus": "autobús",
    "Bus": "Autobús",
    "SITP": "TMB",
    "paradero": "parada",
    "Paradero": "Parada",
    
    # Vocabulario - comidas/bebidas
    "tinto": "café",
    "Tinto": "Café",
    "mogolla": "bollería",
    "Mogolla": "Bollería",
    "almojábana": "fritura tradicional",
    "Almojábana": "Fritura tradicional",
    "buñuelo": "buñuelo",
    "queso costeño": "queso fresco",
    "costeño": "fresco",
    "arepas": "panes",
    
    # Vocabulario - dinero/compras
    "galería": "mercado",
    "Galería": "Mercado",
    "carrera": "calle",
    "Carrera": "Calle",
    "domicilios": "envíos a domicilio",
    "volante de domicilios": "folleto de reparto a domicilio",
    
    # Vocabulario - teléfono
    "celular": "móvil",
    "Celular": "Móvil",
    "videollamada": "videollamada",
    
    # Vocabulario - instituciones
    "Alcaldía Mayor": "Ayuntamiento",
    "alcaldía": "ayuntamiento",
    "junta de acción comunal": "asociación de vecinos",
    "asociación de vecinos": "asociación de vecinos",
    "Casa Comunal": "Centro Cívico",
    "barrio Granada": "barrio del Ensanche",
    "El Peñón": "Malasaña",
    "Chapinero": "Salamanca",
    "Aranjuez": "Chamberí",
    
    # Vocabulario - herramientas/trabajo
    "ferrería": "ferretería",
    "ferreterÃ­a": "ferretería",
    "taller de reparación": "taller de reparación",
    "taller de cocina": "taller de cocina",
    
    # Expresiones culturales
    "se nota": "se ve",
    "maluco": "mal",
    "mazacote": "apelmazado",
    "parchado": "arreglado",
    "de su edad": "de su edad",
    
    # Naturaleza/clima
    "lluvia bogotana": "lluvia madrileña",
    "cerro": "sierra",
    "frío del cerro": "frío de la sierra",
}

STORY_FILES = [
    "story_alberto_ajedrez.json",
    "story_ernesto_taller.json",
    "story_mariana_huerto.json",
    "story_tatiana_taller.json"
]

def create_directories():
    """Create latam and spain directories."""
    latam_dir = Path("backend/content/latam")
    spain_dir = Path("backend/content/spain")
    
    latam_dir.mkdir(parents=True, exist_ok=True)
    spain_dir.mkdir(parents=True, exist_ok=True)
    
    return latam_dir, spain_dir

def adapt_text(text: str) -> str:
    """Adapt text from Colombian/Latin American to Spanish."""
    if not isinstance(text, str):
        return text
    
    adapted = text
    for latam, spain in ADAPTATIONS.items():
        # Case-sensitive replacements
        adapted = adapted.replace(latam, spain)
    
    return adapted

def adapt_story(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively adapt all text fields in story data."""
    if isinstance(data, dict):
        return {key: adapt_story(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [adapt_story(item) for item in data]
    elif isinstance(data, str):
        return adapt_text(data)
    else:
        return data

def process_stories():
    """Move current stories to latam and create Spain versions."""
    latam_dir, spain_dir = create_directories()
    
    print("=" * 70)
    print("📁 REORGANIZING STORY FILES: LATAM & SPAIN VERSIONS")
    print("=" * 70)
    
    for filename in STORY_FILES:
        source_path = Path("backend/content") / filename
        
        if not source_path.exists():
            print(f"⚠️  {filename}: No encontrado en backend/content/")
            continue
        
        print(f"\n📄 Procesando: {filename}")
        
        # 1. Move to latam
        latam_path = latam_dir / filename
        try:
            shutil.copy2(source_path, latam_path)
            print(f"  ✅ Copiado a latam/: {filename}")
        except Exception as e:
            print(f"  ❌ Error al copiar a latam: {e}")
            continue
        
        # 2. Create Spain version
        try:
            with open(source_path, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            
            # Adapt all text
            adapted_data = adapt_story(data)
            
            # Write Spain version
            spain_path = spain_dir / filename
            with open(spain_path, 'w', encoding='utf-8') as f:
                json.dump(adapted_data, f, ensure_ascii=False, indent=2, separators=(',', ': '))
            
            print(f"  ✅ Creado versión España: spain/{filename}")
            
        except Exception as e:
            print(f"  ❌ Error al crear versión España: {e}")
    
    # 3. Delete originals from root
    print("\n" + "=" * 70)
    print("🗑️  Eliminando archivos originales de backend/content/")
    print("=" * 70)
    for filename in STORY_FILES:
        source_path = Path("backend/content") / filename
        if source_path.exists() and source_path.name.startswith("story_"):
            try:
                source_path.unlink()
                print(f"  ✅ Eliminado: {filename}")
            except Exception as e:
                print(f"  ❌ Error al eliminar {filename}: {e}")
    
    print("\n" + "=" * 70)
    print("✅ REORGANIZACIÓN COMPLETA")
    print("=" * 70)
    print("📁 Estructura actual:")
    print("  backend/content/latam/  → Historias latino")
    print("  backend/content/spain/  → Historias España")
    print("=" * 70)

if __name__ == "__main__":
    os.chdir(Path(__file__).parent.parent.parent)
    process_stories()
