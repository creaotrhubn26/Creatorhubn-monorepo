#!/usr/bin/env python3
"""
Generate PNG thumbnails from 3D models using Blender
"""

import bpy
import sys
from pathlib import Path
import math

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "models" / "modifiers"

def setup_scene():
    """Setup Blender scene for rendering thumbnails"""
    # Clear existing objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Setup camera
    bpy.ops.object.camera_add(location=(2, -2, 1.5))
    camera = bpy.context.active_object
    camera.rotation_euler = (math.radians(60), 0, math.radians(45))
    bpy.context.scene.camera = camera
    
    # Setup lighting (3-point lighting)
    # Key light
    bpy.ops.object.light_add(type='AREA', location=(3, -3, 3))
    key_light = bpy.context.active_object
    key_light.data.energy = 500
    key_light.data.size = 2
    
    # Fill light
    bpy.ops.object.light_add(type='AREA', location=(-2, -2, 2))
    fill_light = bpy.context.active_object
    fill_light.data.energy = 200
    fill_light.data.size = 2
    
    # Rim light
    bpy.ops.object.light_add(type='AREA', location=(0, 2, 2))
    rim_light = bpy.context.active_object
    rim_light.data.energy = 300
    rim_light.data.size = 1.5
    
    # Setup render settings
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 128
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    bpy.context.scene.render.film_transparent = True
    
    # Setup world background (white)
    bpy.context.scene.world.use_nodes = True
    bg = bpy.context.scene.world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (1, 1, 1, 1)  # White
    bg.inputs[1].default_value = 0.5  # Strength

def render_thumbnail(obj_path, thumb_path, icon_path):
    """Render thumbnail and icon from OBJ file"""
    print(f"🎨 Rendering {obj_path.name}...")
    
    try:
        # Clear existing mesh objects
        for obj in bpy.data.objects:
            if obj.type == 'MESH':
                bpy.data.objects.remove(obj, do_unlink=True)
        
        # Import OBJ
        bpy.ops.wm.obj_import(filepath=str(obj_path))
        
        # Get imported object
        imported_obj = bpy.context.selected_objects[0]
        
        # Center and scale object
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        imported_obj.location = (0, 0, 0)
        
        # Auto-scale to fit in view
        max_dim = max(imported_obj.dimensions)
        if max_dim > 0:
            scale_factor = 1.5 / max_dim
            imported_obj.scale = (scale_factor, scale_factor, scale_factor)
        
        # Render thumbnail (512x512)
        bpy.context.scene.render.resolution_x = 512
        bpy.context.scene.render.resolution_y = 512
        bpy.context.scene.render.filepath = str(thumb_path)
        bpy.ops.render.render(write_still=True)
        print(f"  ✅ Thumbnail: {thumb_path.name} (512x512)")
        
        # Render icon (128x128)
        bpy.context.scene.render.resolution_x = 128
        bpy.context.scene.render.resolution_y = 128
        bpy.context.scene.render.filepath = str(icon_path)
        bpy.ops.render.render(write_still=True)
        print(f"  ✅ Icon: {icon_path.name} (128x128)")
        
        return True
    except Exception as e:
        print(f"  ❌ Failed: {e}")
        return False

def main():
    print("=" * 70)
    print("🎨 THUMBNAIL GENERATOR")
    print("=" * 70)
    print()
    
    # Setup scene once
    setup_scene()
    
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

