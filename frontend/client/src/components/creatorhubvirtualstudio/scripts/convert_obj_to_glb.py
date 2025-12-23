#!/usr/bin/env python3
"""
Convert OBJ files to GLB format using trimesh
"""

import trimesh
from pathlib import Path

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "models" / "modifiers"

def convert_obj_to_glb(obj_path):
    """Convert OBJ file to GLB format"""
    print(f"🔄 Converting {obj_path.name}...")
    
    try:
        # Load OBJ file
        mesh = trimesh.load(obj_path, force='mesh')
        
        # Output GLB path
        glb_path = obj_path.with_suffix('.glb')
        
        # Export to GLB
        mesh.export(glb_path, file_type='glb')
        
        # Get file sizes
        obj_size = obj_path.stat().st_size / 1024  # KB
        glb_size = glb_path.stat().st_size / 1024  # KB
        
        print(f"✅ {obj_path.name} -> {glb_path.name}")
        print(f"   OBJ: {obj_size:.1f} KB | GLB: {glb_size:.1f} KB")
        
        return True
    except Exception as e:
        print(f"❌ Failed to convert {obj_path.name}: {e}")
        return False

def main():
    print("=" * 70)
    print("🔄 OBJ TO GLB CONVERTER")
    print("=" * 70)
    print()
    
    # Find all OBJ files
    obj_files = list(OUTPUT_DIR.glob("*/*.obj"))
    
    if not obj_files:
        print("❌ No OBJ files found!")
        return
    
    print(f"📁 Found {len(obj_files)} OBJ files")
    print()
    
    # Convert each file
    success_count = 0
    for obj_file in obj_files:
        if convert_obj_to_glb(obj_file):
            success_count += 1
        print()
    
    print("=" * 70)
    print(f"✅ CONVERSION COMPLETE: {success_count}/{len(obj_files)} files converted")
    print("=" * 70)

if __name__ == "__main__":
    main()

