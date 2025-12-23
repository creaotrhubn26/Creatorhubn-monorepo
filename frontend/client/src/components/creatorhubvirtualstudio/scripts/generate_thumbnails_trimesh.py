#!/usr/bin/env python3
"""
Generate PNG thumbnails from 3D models using trimesh
"""

import trimesh
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import io

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "models" / "modifiers"

def render_thumbnail(obj_path, thumb_path, icon_path):
    """Render thumbnail and icon from OBJ file using trimesh"""
    print(f"🎨 Rendering {obj_path.name}...")
    
    try:
        # Load OBJ file
        mesh = trimesh.load(obj_path, force='mesh')
        
        # Create scene
        scene = trimesh.Scene(mesh)
        
        # Render thumbnail (512x512)
        png_data = scene.save_image(resolution=[512, 512], visible=True)
        if png_data is not None:
            with open(thumb_path, 'wb') as f:
                f.write(png_data)
            print(f"  ✅ Thumbnail: {thumb_path.name} (512x512)")
        
        # Render icon (128x128)
        png_data = scene.save_image(resolution=[128, 128], visible=True)
        if png_data is not None:
            with open(icon_path, 'wb') as f:
                f.write(png_data)
            print(f"  ✅ Icon: {icon_path.name} (128x128)")
        
        return True
    except Exception as e:
        print(f"  ❌ Failed: {e}")
        # Create placeholder images
        try:
            # Create simple placeholder thumbnail
            thumb_img = Image.new('RGBA', (512, 512), (240, 240, 240, 255))
            draw = ImageDraw.Draw(thumb_img)
            draw.text((256, 256), obj_path.stem, fill=(100, 100, 100, 255), anchor="mm")
            thumb_img.save(thumb_path)
            print(f"  ⚠️  Created placeholder thumbnail: {thumb_path.name}")
            
            # Create simple placeholder icon
            icon_img = Image.new('RGBA', (128, 128), (240, 240, 240, 255))
            icon_img.save(icon_path)
            print(f"  ⚠️  Created placeholder icon: {icon_path.name}")
            
            return True
        except Exception as e2:
            print(f"  ❌ Failed to create placeholder: {e2}")
            return False

def main():
    print("=" * 70)
    print("🎨 THUMBNAIL GENERATOR (Trimesh)")
    print("=" * 70)
    print()
    
    # Find all OBJ files
    obj_files = list(OUTPUT_DIR.glob("*/*.obj"))
    
    if not obj_files:
        print("❌ No OBJ files found!")
        return
    
    print(f"📁 Found {len(obj_files)} OBJ files")
    print()
    
    # Render thumbnails for each file
    success_count = 0
    for obj_file in obj_files:
        modifier_name = obj_file.stem
        thumb_path = obj_file.parent / f"{modifier_name}-thumb.png"
        icon_path = obj_file.parent / f"{modifier_name}-icon.png"
        
        if render_thumbnail(obj_file, thumb_path, icon_path):
            success_count += 1
        print()
    
    print("=" * 70)
    print(f"✅ COMPLETE: {success_count}/{len(obj_files)} thumbnails generated")
    print("=" * 70)

if __name__ == "__main__":
    main()

