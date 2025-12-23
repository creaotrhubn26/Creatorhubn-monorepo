#!/usr/bin/env python3
"""
Generate Photorealistic Lighting Modifiers using Blender Python API
Creates ultra high-quality 3D models with visible screws, bolts, and realistic materials

Requirements:
- Blender 3.0+ installed
- Run with: blender --background --python generate_modifiers_blender.py

This script generates:
1. Beauty Dish - Parabolic reflector with center deflector and mounting screws
2. Softbox 80x120cm - Rectangular with aluminum frame rods and corner joints
3. Stripbox 30x180cm - Tall narrow design with support brackets
4. Octabox 120cm - Octagonal with 8-sided frame and corner joints
5. Standard Reflector - Small parabolic with honeycomb grid and mount ring
"""

import bpy
import bmesh
import math
from pathlib import Path

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "models" / "modifiers"

def clear_scene():
    """Remove all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def create_screw(location, scale=1.0):
    """Create a detailed Phillips head screw"""
    # Screw head (cylinder with Phillips cross)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.004 * scale,
        depth=0.002 * scale,
        location=location,
        vertices=16
    )
    head = bpy.context.active_object
    head.name = "screw_head"
    
    # Screw shaft
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.002 * scale,
        depth=0.008 * scale,
        location=(location[0], location[1], location[2] - 0.005 * scale),
        vertices=16
    )
    shaft = bpy.context.active_object
    shaft.name = "screw_shaft"
    
    # Phillips cross (two intersecting boxes)
    bpy.ops.mesh.primitive_cube_add(
        size=0.001 * scale,
        location=(location[0], location[1], location[2] + 0.001 * scale)
    )
    cross1 = bpy.context.active_object
    cross1.scale = (3, 0.5, 0.5)
    
    bpy.ops.mesh.primitive_cube_add(
        size=0.001 * scale,
        location=(location[0], location[1], location[2] + 0.001 * scale)
    )
    cross2 = bpy.context.active_object
    cross2.scale = (0.5, 3, 0.5)
    
    # Join all parts
    bpy.ops.object.select_all(action='DESELECT')
    head.select_set(True)
    shaft.select_set(True)
    cross1.select_set(True)
    cross2.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.join()
    
    return head

def create_beauty_dish():
    """Create a photorealistic beauty dish with visible hardware"""
    clear_scene()
    
    # Main parabolic reflector
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.25,
        location=(0, 0, 0),
        segments=64,
        ring_count=32
    )
    dish = bpy.context.active_object
    dish.name = "beauty_dish"
    
    # Cut the sphere in half and shape it
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.transform.resize(value=(1, 1, 0.88))  # Make it parabolic
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Center deflector plate
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.08,
        depth=0.01,
        location=(0, 0, 0.15),
        vertices=32
    )
    deflector = bpy.context.active_object
    deflector.name = "deflector_plate"
    
    # Add mounting screws around the rim (8 screws)
    for i in range(8):
        angle = (i / 8) * 2 * math.pi
        x = 0.23 * math.cos(angle)
        y = 0.23 * math.sin(angle)
        screw = create_screw((x, y, -0.05), scale=1.5)
        screw.name = f"mount_screw_{i}"
    
    # Bowens mount ring
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.05,
        depth=0.008,
        location=(0, 0, -0.11),
        vertices=64
    )
    mount = bpy.context.active_object
    mount.name = "bowens_mount"
    
    # Add material (silver aluminum)
    mat = bpy.data.materials.new(name="Silver_Aluminum")
    mat.use_nodes = True
    mat.metallic = 0.9
    mat.roughness = 0.2
    dish.data.materials.append(mat)
    
    # Export to OBJ (GLB requires numpy which may not be available in Blender's Python)
    output_path_obj = OUTPUT_DIR / "beauty-dish" / "beauty-dish.obj"
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_export(
        filepath=str(output_path_obj),
        export_selected_objects=False,
        export_materials=True,
        export_normals=True,
        export_uv=True
    )

    print(f"✅ Beauty Dish exported to {output_path_obj}")

def create_softbox():
    """Create a photorealistic rectangular softbox with frame rods"""
    clear_scene()
    
    # Front diffusion panel (white fabric)
    bpy.ops.mesh.primitive_plane_add(
        size=1,
        location=(0, 0, 0.2)
    )
    front = bpy.context.active_object
    front.scale = (0.80, 1.20, 1)
    front.name = "diffusion_panel"
    
    # Back panel (black)
    bpy.ops.mesh.primitive_plane_add(
        size=1,
        location=(0, 0, -0.2)
    )
    back = bpy.context.active_object
    back.scale = (0.70, 1.10, 1)
    back.name = "back_panel"
    
    # Aluminum frame rods (4 corners)
    corners = [
        (0.40, 0.60, 0),
        (-0.40, 0.60, 0),
        (0.40, -0.60, 0),
        (-0.40, -0.60, 0)
    ]
    
    for i, corner in enumerate(corners):
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.008,
            depth=0.45,
            location=corner,
            vertices=16
        )
        rod = bpy.context.active_object
        rod.rotation_euler = (math.pi/2, 0, 0)
        rod.name = f"frame_rod_{i}"
        
        # Add corner joint with screws
        bpy.ops.mesh.primitive_cube_add(
            size=0.02,
            location=corner
        )
        joint = bpy.context.active_object
        joint.name = f"corner_joint_{i}"
        
        # Add 2 screws per corner
        create_screw((corner[0] + 0.01, corner[1], corner[2]), scale=0.8)
        create_screw((corner[0], corner[1] + 0.01, corner[2]), scale=0.8)
    
    # Export to OBJ
    output_path_obj = OUTPUT_DIR / "softbox" / "softbox.obj"
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_export(
        filepath=str(output_path_obj),
        export_selected_objects=False,
        export_materials=True,
        export_normals=True,
        export_uv=True
    )

    print(f"✅ Softbox exported to {output_path_obj}")

def create_stripbox():
    """Create a tall narrow stripbox with support brackets"""
    clear_scene()

    # Front diffusion panel
    bpy.ops.mesh.primitive_plane_add(
        size=1,
        location=(0, 0, 0.15)
    )
    front = bpy.context.active_object
    front.scale = (0.30, 1.80, 1)
    front.name = "diffusion_panel"

    # Frame rods (4 corners)
    corners = [
        (0.15, 0.90, 0),
        (-0.15, 0.90, 0),
        (0.15, -0.90, 0),
        (-0.15, -0.90, 0)
    ]

    for i, corner in enumerate(corners):
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.006,
            depth=0.35,
            location=corner,
            vertices=16
        )
        rod = bpy.context.active_object
        rod.rotation_euler = (math.pi/2, 0, 0)
        rod.name = f"frame_rod_{i}"

    # Support brackets (3 along the length)
    for i in range(3):
        y_pos = -0.60 + (i * 0.60)
        bpy.ops.mesh.primitive_cube_add(
            size=0.015,
            location=(0, y_pos, 0)
        )
        bracket = bpy.context.active_object
        bracket.scale = (2, 1, 1)
        bracket.name = f"support_bracket_{i}"

        # Add screws to bracket
        create_screw((0.02, y_pos, 0), scale=0.6)
        create_screw((-0.02, y_pos, 0), scale=0.6)

    # Export to OBJ
    output_path_obj = OUTPUT_DIR / "stripbox" / "stripbox.obj"
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_export(
        filepath=str(output_path_obj),
        export_selected_objects=False,
        export_materials=True,
        export_normals=True,
        export_uv=True
    )

    print(f"✅ Stripbox exported to {output_path_obj}")

def create_octabox():
    """Create an octagonal softbox with 8-sided frame"""
    clear_scene()

    # Front diffusion panel (octagon)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.60,
        depth=0.01,
        location=(0, 0, 0.2),
        vertices=8
    )
    front = bpy.context.active_object
    front.name = "diffusion_panel"

    # Back panel (smaller octagon)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.50,
        depth=0.01,
        location=(0, 0, -0.2),
        vertices=8
    )
    back = bpy.context.active_object
    back.name = "back_panel"

    # Frame rods (8 corners)
    for i in range(8):
        angle = (i / 8) * 2 * math.pi
        x = 0.58 * math.cos(angle)
        y = 0.58 * math.sin(angle)

        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.008,
            depth=0.45,
            location=(x, y, 0),
            vertices=16
        )
        rod = bpy.context.active_object
        rod.rotation_euler = (math.pi/2, 0, 0)
        rod.name = f"frame_rod_{i}"

        # Corner joint with screws
        bpy.ops.mesh.primitive_cube_add(
            size=0.02,
            location=(x, y, 0)
        )
        joint = bpy.context.active_object
        joint.name = f"corner_joint_{i}"

        create_screw((x + 0.01, y, 0), scale=0.8)

    # Export to OBJ
    output_path_obj = OUTPUT_DIR / "octabox" / "octabox.obj"
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_export(
        filepath=str(output_path_obj),
        export_selected_objects=False,
        export_materials=True,
        export_normals=True,
        export_uv=True
    )

    print(f"✅ Octabox exported to {output_path_obj}")

def create_standard_reflector():
    """Create a standard parabolic reflector with honeycomb grid"""
    clear_scene()

    # Main parabolic reflector
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.12,
        location=(0, 0, 0),
        segments=48,
        ring_count=24
    )
    reflector = bpy.context.active_object
    reflector.name = "standard_reflector"

    # Shape it into a parabola
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.transform.resize(value=(1, 1, 0.75))
    bpy.ops.object.mode_set(mode='OBJECT')

    # Honeycomb grid (hexagonal pattern)
    for ring in range(3):
        for i in range(6 * (ring + 1)):
            angle = (i / (6 * (ring + 1))) * 2 * math.pi
            radius = 0.03 * (ring + 1)
            x = radius * math.cos(angle)
            y = radius * math.sin(angle)

            bpy.ops.mesh.primitive_cylinder_add(
                radius=0.008,
                depth=0.02,
                location=(x, y, 0.08),
                vertices=6
            )
            cell = bpy.context.active_object
            cell.name = f"honeycomb_cell_{ring}_{i}"

    # Mount ring with bolts
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.04,
        depth=0.006,
        location=(0, 0, -0.09),
        vertices=64
    )
    mount = bpy.context.active_object
    mount.name = "mount_ring"

    # Add 4 mounting bolts
    for i in range(4):
        angle = (i / 4) * 2 * math.pi
        x = 0.035 * math.cos(angle)
        y = 0.035 * math.sin(angle)
        create_screw((x, y, -0.09), scale=1.2)

    # Export to OBJ
    output_path_obj = OUTPUT_DIR / "standard-reflector" / "standard-reflector.obj"
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.obj_export(
        filepath=str(output_path_obj),
        export_selected_objects=False,
        export_materials=True,
        export_normals=True,
        export_uv=True
    )

    print(f"✅ Standard Reflector exported to {output_path_obj}")

# Main execution
if __name__ == "__main__":
    print("\n" + "="*70)
    print("🎨 BLENDER PHOTOREALISTIC MODIFIER GENERATOR")
    print("="*70)

    create_beauty_dish()
    create_softbox()
    create_stripbox()
    create_octabox()
    create_standard_reflector()

    print("\n" + "="*70)
    print("✅ GENERATION COMPLETE!")
    print("="*70)
    print(f"\n📁 Output: {OUTPUT_DIR}")
    print("\n💡 To generate all modifiers, run:")
    print("   blender --background --python generate_modifiers_blender.py")
    print()

