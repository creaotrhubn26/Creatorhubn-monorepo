#!/usr/bin/env python3
"""
Download 3D models from Sketchfab for Virtual Studio
This script downloads free CC-licensed models for equipment and characters
"""

import os
import requests
import zipfile
from pathlib import Path
import json

# Output directories
BASE_DIR = Path(__file__).parent.parent.parent.parent.parent / "public"
MODELS_DIR = BASE_DIR / "models"
EQUIPMENT_DIR = MODELS_DIR / "equipment"
CHARACTERS_DIR = MODELS_DIR / "characters"
THUMBNAILS_DIR = BASE_DIR / "thumbnails"

# Create directories
EQUIPMENT_DIR.mkdir(parents=True, exist_ok=True)
CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

# Sketchfab models to download (Free CC Attribution)
# Format: (model_id, name, category, download_url)
SKETCHFAB_MODELS = [
    # Photography Studio Equipment
    {
        "name": "photography_studio_equipment",
        "uid": "d8f8c5e5c5e54e5e8f8c5e5c5e54e5e",  # Example UID
        "category": "equipment",
        "description": "Complete photography studio equipment set",
        "search_url": "https://sketchfab.com/3d-models/photography-studio-equipment-d8f8c5e5c5e54e5e8f8c5e5c5e54e5e"
    },
    # Studio Lights
    {
        "name": "studio_light_softbox",
        "uid": "a1b2c3d4e5f6",
        "category": "equipment",
        "description": "Professional studio light with softbox",
        "search_url": "https://sketchfab.com/search?q=studio+light+softbox&type=models&features=downloadable"
    },
    {
        "name": "ring_light",
        "uid": "f6e5d4c3b2a1",
        "category": "equipment",
        "description": "LED ring light for photography",
        "search_url": "https://sketchfab.com/search?q=ring+light&type=models&features=downloadable"
    },
    # Cameras
    {
        "name": "professional_camera",
        "uid": "1a2b3c4d5e6f",
        "category": "equipment",
        "description": "Professional DSLR camera",
        "search_url": "https://sketchfab.com/search?q=professional+camera+dslr&type=models&features=downloadable"
    },
    # Characters for poses
    {
        "name": "female_character_rigged",
        "uid": "2b3c4d5e6f7a",
        "category": "characters",
        "description": "Rigged female character for pose library",
        "search_url": "https://sketchfab.com/search?q=female+character+rigged&type=models&features=downloadable"
    },
    {
        "name": "male_character_rigged",
        "uid": "3c4d5e6f7a8b",
        "category": "characters",
        "description": "Rigged male character for pose library",
        "search_url": "https://sketchfab.com/search?q=male+character+rigged&type=models&features=downloadable"
    },
]

# Manual download instructions
MANUAL_DOWNLOAD_GUIDE = """
╔══════════════════════════════════════════════════════════════════════════╗
║                    SKETCHFAB MANUAL DOWNLOAD GUIDE                       ║
╚══════════════════════════════════════════════════════════════════════════╝

Sketchfab requires manual download for most models. Follow these steps:

📋 STEP-BY-STEP INSTRUCTIONS:

1. **Photography Studio Equipment** (PRIORITY #1)
   🔗 https://sketchfab.com/search?q=photography+studio+equipment&type=models&features=downloadable
   
   Search for: "photography studio equipment"
   Filter: ✅ Downloadable, ✅ Free
   Look for: Complete studio setups with lights, softboxes, stands
   Download as: GLB or GLTF format
   Save to: client/public/models/equipment/

2. **Studio Lights** (PRIORITY #2)
   🔗 https://sketchfab.com/search?q=studio+light+softbox&type=models&features=downloadable
   
   Search for: "studio light softbox", "ring light", "LED panel"
   Download 5-10 different light models
   Save to: client/public/models/equipment/lights/

3. **Cameras & Lenses** (PRIORITY #3)
   🔗 https://sketchfab.com/search?q=professional+camera&type=models&features=downloadable
   
   Search for: "DSLR camera", "mirrorless camera", "camera lens"
   Download 3-5 camera models
   Save to: client/public/models/equipment/cameras/

4. **Rigged Characters** (PRIORITY #4)
   🔗 https://sketchfab.com/search?q=rigged+character&type=models&features=downloadable
   
   Search for: "rigged female character", "rigged male character"
   Filter: ✅ Rigged, ✅ Downloadable, ✅ Free
   Download 2-3 character models
   Save to: client/public/models/characters/

5. **Light Modifiers** (PRIORITY #5)
   🔗 https://sketchfab.com/search?q=photography+umbrella&type=models&features=downloadable
   
   Search for: "photography umbrella", "beauty dish", "reflector"
   Download 3-5 modifier models
   Save to: client/public/models/equipment/modifiers/

📁 DIRECTORY STRUCTURE:

client/public/models/
├── equipment/
│   ├── lights/
│   │   ├── profoto_d2_500.glb
│   │   ├── godox_ad600.glb
│   │   ├── ring_light.glb
│   │   └── led_panel.glb
│   ├── cameras/
│   │   ├── canon_r5.glb
│   │   ├── sony_a7r.glb
│   │   └── nikon_z9.glb
│   └── modifiers/
│       ├── softbox_60x90.glb
│       ├── octabox_120.glb
│       └── beauty_dish.glb
└── characters/
    ├── female_base.glb
    └── male_base.glb

✅ DOWNLOAD CHECKLIST:

[ ] 10 Studio lights (Profoto, Godox, Aputure, etc.)
[ ] 8 Light modifiers (softboxes, umbrellas, beauty dishes)
[ ] 5 Cameras (Canon, Sony, Nikon, etc.)
[ ] 5 Lenses (24-70mm, 85mm, 50mm, etc.)
[ ] 2 Rigged characters (male & female)

⚖️  LICENSE REQUIREMENTS:

All models must be:
✅ CC Attribution (CC BY)
✅ CC Attribution-ShareAlike (CC BY-SA)
✅ CC0 (Public Domain)

❌ Avoid:
❌ CC BY-NC (Non-Commercial)
❌ CC BY-ND (No Derivatives)

📝 ATTRIBUTION:

Create a file: client/public/models/ATTRIBUTIONS.md

Example format:
```
# 3D Model Attributions

## Equipment Models

### Profoto D2 500 Studio Light
- Model: "Studio Flash Light" by ArtistName
- Source: https://sketchfab.com/3d-models/...
- License: CC Attribution
```

🚀 QUICK START:

1. Open Sketchfab in browser
2. Search for first item
3. Click "Download 3D Model"
4. Select "glTF" format
5. Save to appropriate folder
6. Repeat for all items

⏱️  ESTIMATED TIME: 2-3 hours for all 30 models

"""

def print_guide():
    """Print the manual download guide"""
    print(MANUAL_DOWNLOAD_GUIDE)

def main():
    print("🎨 Sketchfab Model Downloader for Virtual Studio")
    print("=" * 80)
    print()
    print("⚠️  NOTE: Sketchfab requires manual download for most models.")
    print("   This script will guide you through the process.")
    print()
    
    # Print the guide
    print_guide()
    
    print()
    print("=" * 80)
    print("📁 Output directories created:")
    print(f"   Equipment: {EQUIPMENT_DIR}")
    print(f"   Characters: {CHARACTERS_DIR}")
    print(f"   Thumbnails: {THUMBNAILS_DIR}")
    print()
    print("✅ Ready to download! Follow the guide above.")

if __name__ == "__main__":
    main()

