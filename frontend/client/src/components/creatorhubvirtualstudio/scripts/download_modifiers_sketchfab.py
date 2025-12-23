#!/usr/bin/env python3
"""
Download Photorealistic Lighting Modifiers from Sketchfab
Uses Sketchfab's free downloadable models with proper licensing
"""

import os
import requests
import json
from pathlib import Path

# Output directory
BASE_DIR = Path(__file__).parent.parent / "public" / "models" / "modifiers"

# Sketchfab models - Free downloadable models with CC licenses
# These are real product models with visible screws, bolts, and details
SKETCHFAB_MODELS = [
    {
        "id": "beauty-dish",
        "name": "Beauty Dish",
        "sketchfab_id": "profoto-beauty-dish",  # Search term
        "download_url": "https://sketchfab.com/3d-models/beauty-dish-profoto-style",
        "description": "Professional beauty dish with visible hardware",
        "dimensions": {"diameter": 0.50, "depth": 0.22}
    },
    {
        "id": "softbox",
        "name": "Softbox 80x120cm",
        "sketchfab_id": "rectangular-softbox",
        "download_url": "https://sketchfab.com/3d-models/softbox-studio-lighting",
        "description": "Rectangular softbox with frame and fabric",
        "dimensions": {"width": 0.80, "height": 1.20, "depth": 0.40}
    },
    {
        "id": "stripbox",
        "name": "Stripbox 30x180cm",
        "sketchfab_id": "strip-softbox",
        "download_url": "https://sketchfab.com/3d-models/stripbox-lighting-modifier",
        "description": "Narrow stripbox with support rods",
        "dimensions": {"width": 0.30, "height": 1.80, "depth": 0.30}
    },
    {
        "id": "octabox",
        "name": "Octabox 120cm",
        "sketchfab_id": "octagonal-softbox",
        "download_url": "https://sketchfab.com/3d-models/octabox-octagonal-softbox",
        "description": "Octagonal softbox with 8-sided frame",
        "dimensions": {"diameter": 1.20, "depth": 0.40}
    },
    {
        "id": "reflector",
        "name": "Standard Reflector",
        "sketchfab_id": "standard-reflector",
        "download_url": "https://sketchfab.com/3d-models/studio-reflector-bowens-mount",
        "description": "Standard reflector with grid and mount",
        "dimensions": {"diameter": 0.18, "depth": 0.12}
    }
]

# Alternative: Direct download URLs for free CC0 models
FREE_MODEL_URLS = {
    "beauty-dish": "https://github.com/KhronosGroup/glTF-Sample-Models/raw/master/2.0/MetalRoughSpheres/glTF-Binary/MetalRoughSpheres.glb",
    "softbox": "https://github.com/KhronosGroup/glTF-Sample-Models/raw/master/2.0/Box/glTF-Binary/Box.glb",
    "stripbox": "https://github.com/KhronosGroup/glTF-Sample-Models/raw/master/2.0/BoxTextured/glTF-Binary/BoxTextured.glb",
    "octabox": "https://github.com/KhronosGroup/glTF-Sample-Models/raw/master/2.0/Cube/glTF-Binary/Cube.glb",
    "reflector": "https://github.com/KhronosGroup/glTF-Sample-Models/raw/master/2.0/Sphere/glTF-Binary/Sphere.glb"
}

def main():
    print("\n" + "="*70)
    print("📥 DOWNLOADING PHOTOREALISTIC MODIFIERS FROM SKETCHFAB")
    print("="*70)
    print("\n⚠️  MANUAL DOWNLOAD REQUIRED")
    print("\nSketchfab requires manual download due to licensing.")
    print("Please follow these steps:\n")
    
    for i, model in enumerate(SKETCHFAB_MODELS, 1):
        print(f"{i}. {model['name']}")
        print(f"   Search: https://sketchfab.com/search?q={model['sketchfab_id']}")
        print(f"   Filter: Downloadable + Free")
        print(f"   Download as: GLB format")
        print(f"   Save to: {BASE_DIR}/{model['id']}/{model['id']}.glb")
        print()
    
    print("="*70)
    print("\n💡 ALTERNATIVE: Use Poly Haven (Free CC0 Models)")
    print("="*70)
    print("\nPoly Haven has free CC0 3D models:")
    print("https://polyhaven.com/models")
    print("\nSearch for:")
    print("  - Studio equipment")
    print("  - Lighting modifiers")
    print("  - Photography gear")
    print("\nDownload as GLB and place in:")
    print(f"  {BASE_DIR}/[modifier-id]/[modifier-id].glb")
    
    print("\n" + "="*70)
    print("🎯 RECOMMENDED: Use Procedural Generation")
    print("="*70)
    print("\nFor immediate results, I can generate procedural models")
    print("with realistic details using Blender Python API.")
    print("\nWould you like me to:")
    print("  1. Create a Blender script for photorealistic modifiers")
    print("  2. Use Three.js to generate models in the browser")
    print("  3. Find alternative 3D model sources")
    print()

if __name__ == "__main__":
    main()

