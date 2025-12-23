#!/usr/bin/env python3
"""
Generate All 5 Modifiers with Procedural Geometry
Creates high-quality procedural 3D models for all lighting modifiers
"""

import trimesh
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import json
import os

def create_beauty_dish():
    """Create a beauty dish with parabolic reflector - DISTINCT SHAPE"""
    print("📦 Generating Beauty Dish...")

    # Create a proper beauty dish with parabolic curve and center deflector
    segments = 64

    # Main parabolic dish
    dish = trimesh.creation.cone(radius=0.25, height=0.15, sections=segments)
    dish.apply_translation([0, -0.075, 0])

    # Center deflector plate (characteristic of beauty dishes)
    deflector = trimesh.creation.cylinder(radius=0.08, height=0.02, sections=segments)
    deflector.apply_translation([0, 0.05, 0])

    # Mount ring at back
    mount_ring = trimesh.creation.cylinder(radius=0.05, height=0.03, sections=segments)
    mount_ring.apply_translation([0, -0.16, 0])

    # Combine all parts
    mesh = trimesh.util.concatenate([dish, deflector, mount_ring])
    mesh.fix_normals()

    return mesh

def create_softbox():
    """Create a rectangular softbox - DISTINCT TAPERED BOX"""
    print("📦 Generating Softbox...")

    # Create a proper tapered softbox with frame
    width, height, depth = 0.80, 1.20, 0.40

    # Front face (large diffusion panel)
    front_vertices = [
        [-width/2, -height/2, depth],
        [width/2, -height/2, depth],
        [width/2, height/2, depth],
        [-width/2, height/2, depth]
    ]

    # Back face (small mount point)
    back_size = 0.12
    back_vertices = [
        [-back_size/2, -back_size/2, 0],
        [back_size/2, -back_size/2, 0],
        [back_size/2, back_size/2, 0],
        [-back_size/2, back_size/2, 0]
    ]

    vertices = front_vertices + back_vertices

    # Create faces for tapered pyramid shape
    faces = [
        # Front face (white diffusion)
        [0, 1, 2], [0, 2, 3],
        # Back face (mount)
        [4, 6, 5], [4, 7, 6],
        # Tapered sides (fabric walls)
        [0, 4, 5], [0, 5, 1],
        [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3],
        [3, 7, 4], [3, 4, 0]
    ]

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))

    # Add frame rods (4 corners)
    rod_radius = 0.01
    for i in range(4):
        rod = trimesh.creation.cylinder(radius=rod_radius, height=depth, sections=8)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        rod.apply_translation([front_vertices[i][0], front_vertices[i][1], depth/2])
        mesh = trimesh.util.concatenate([mesh, rod])

    mesh.fix_normals()

    return mesh

def create_stripbox():
    """Create a narrow stripbox - DISTINCT TALL NARROW SHAPE"""
    print("📦 Generating Stripbox...")

    # Very narrow and tall - characteristic stripbox shape
    width, height, depth = 0.30, 1.80, 0.30

    front_vertices = [
        [-width/2, -height/2, depth],
        [width/2, -height/2, depth],
        [width/2, height/2, depth],
        [-width/2, height/2, depth]
    ]

    back_size = 0.10
    back_vertices = [
        [-back_size/2, -back_size/2, 0],
        [back_size/2, -back_size/2, 0],
        [back_size/2, back_size/2, 0],
        [-back_size/2, back_size/2, 0]
    ]

    vertices = front_vertices + back_vertices

    faces = [
        [0, 1, 2], [0, 2, 3],
        [4, 6, 5], [4, 7, 6],
        [0, 4, 5], [0, 5, 1],
        [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3],
        [3, 7, 4], [3, 4, 0]
    ]

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))

    # Add long support rods (characteristic of stripboxes)
    rod_radius = 0.008
    for i in range(4):
        rod = trimesh.creation.cylinder(radius=rod_radius, height=depth, sections=8)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        rod.apply_translation([front_vertices[i][0], front_vertices[i][1], depth/2])
        mesh = trimesh.util.concatenate([mesh, rod])

    # Add center support rod (stripboxes often have this)
    center_rod = trimesh.creation.cylinder(radius=rod_radius, height=height, sections=8)
    center_rod.apply_translation([0, 0, depth])
    mesh = trimesh.util.concatenate([mesh, center_rod])

    mesh.fix_normals()

    return mesh

def create_octabox():
    """Create an octagonal softbox - DISTINCT OCTAGON SHAPE"""
    print("📦 Generating Octabox...")

    # Create octagonal shape - very distinctive!
    diameter = 1.20
    depth = 0.40
    segments = 8

    # Front octagon (large diffusion panel)
    front_vertices = []
    for i in range(segments):
        angle = (i / segments) * 2 * np.pi
        x = (diameter / 2) * np.cos(angle)
        y = (diameter / 2) * np.sin(angle)
        front_vertices.append([x, y, depth])

    # Back octagon (small mount point)
    back_size = 0.12
    back_vertices = []
    for i in range(segments):
        angle = (i / segments) * 2 * np.pi
        x = (back_size / 2) * np.cos(angle)
        y = (back_size / 2) * np.sin(angle)
        back_vertices.append([x, y, 0])

    vertices = front_vertices + back_vertices

    # Create faces
    faces = []
    # Front octagonal face
    for i in range(segments - 2):
        faces.append([0, i + 1, i + 2])
    # Back octagonal face
    for i in range(segments - 2):
        faces.append([segments, segments + i + 2, segments + i + 1])
    # Tapered sides (8 trapezoids)
    for i in range(segments):
        next_i = (i + 1) % segments
        faces.append([i, next_i, segments + i])
        faces.append([next_i, segments + next_i, segments + i])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))

    # Add octagonal frame rods (8 edges)
    rod_radius = 0.01
    for i in range(segments):
        rod = trimesh.creation.cylinder(radius=rod_radius, height=depth, sections=8)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        angle = (i / segments) * 2 * np.pi
        x = (diameter / 2) * np.cos(angle)
        y = (diameter / 2) * np.sin(angle)
        rod.apply_translation([x, y, depth/2])
        mesh = trimesh.util.concatenate([mesh, rod])

    mesh.fix_normals()

    return mesh

def create_reflector():
    """Create a standard parabolic reflector - DISTINCT SMALL CONE"""
    print("📦 Generating Standard Reflector...")

    # Create small parabolic reflector with mount
    reflector_cone = trimesh.creation.cone(radius=0.09, height=0.10, sections=32)
    reflector_cone.apply_translation([0, -0.05, 0])

    # Add mount ring
    mount = trimesh.creation.cylinder(radius=0.04, height=0.04, sections=32)
    mount.apply_translation([0, -0.12, 0])

    # Add protective grid (characteristic of reflectors)
    grid_ring = trimesh.creation.torus(major_radius=0.08, minor_radius=0.003, sections=32)
    grid_ring.apply_translation([0, 0.01, 0])

    mesh = trimesh.util.concatenate([reflector_cone, mount, grid_ring])
    mesh.fix_normals()

    return mesh

def generate_thumbnail(modifier_type, modifier_name, color=(240, 240, 240)):
    """Generate a distinct thumbnail image for each modifier type"""
    img = Image.new('RGB', (512, 512), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)

    # Draw distinct shapes for each modifier type
    if modifier_type == "beauty-dish":
        # Circular dish with center deflector
        draw.ellipse([100, 100, 412, 412], fill=(230, 230, 235), outline=(150, 150, 160), width=4)
        draw.ellipse([206, 206, 306, 306], fill=(200, 200, 210), outline=(150, 150, 160), width=3)

    elif modifier_type == "softbox":
        # Rectangular shape
        draw.rectangle([80, 60, 432, 452], fill=(245, 245, 250), outline=(150, 150, 160), width=4)
        # Inner diffusion
        draw.rectangle([100, 80, 412, 432], fill=(255, 255, 255), outline=(180, 180, 190), width=2)

    elif modifier_type == "stripbox":
        # Tall narrow rectangle
        draw.rectangle([180, 40, 332, 472], fill=(245, 245, 250), outline=(150, 150, 160), width=4)
        # Inner diffusion
        draw.rectangle([195, 55, 317, 457], fill=(255, 255, 255), outline=(180, 180, 190), width=2)

    elif modifier_type == "octabox":
        # Octagon shape
        points = []
        for i in range(8):
            angle = (i / 8) * 2 * 3.14159 - 3.14159/8
            x = 256 + 180 * np.cos(angle)
            y = 256 + 180 * np.sin(angle)
            points.append((x, y))
        draw.polygon(points, fill=(245, 245, 250), outline=(150, 150, 160))
        draw.line(points + [points[0]], fill=(150, 150, 160), width=4)

    elif modifier_type == "reflector":
        # Small cone/circle
        draw.ellipse([150, 150, 362, 362], fill=(220, 220, 230), outline=(150, 150, 160), width=4)
        # Grid lines
        for i in range(3):
            y = 200 + i * 40
            draw.line([(170, y), (342, y)], fill=(180, 180, 190), width=2)

    # Add text label at bottom
    try:
        draw.text((256, 480), modifier_name, fill=(80, 80, 90), anchor="mm")
    except:
        pass  # Font not available

    return img

def main():
    """Generate all modifiers"""
    print("\n" + "="*70)
    print("🎨 GENERATING ALL 5 MODIFIERS")
    print("="*70 + "\n")
    
    base_path = "../public/models/modifiers"
    
    modifiers_data = []
    
    # 1. Beauty Dish
    mesh = create_beauty_dish()
    mesh.export(f"{base_path}/beauty-dish/beauty-dish.obj")
    mesh.export(f"{base_path}/beauty-dish/beauty-dish.glb")
    img = generate_thumbnail("beauty-dish", "Beauty Dish")
    img.save(f"{base_path}/beauty-dish/beauty-dish-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/beauty-dish/beauty-dish-icon.png")
    
    modifiers_data.append({
        "id": "beauty-dish",
        "name": "Beauty Dish",
        "brand": "Universal",
        "type": "beauty-dish",
        "description": "Parabolic reflector for portrait photography with soft, even light",
        "dimensions": {"diameter": 0.50, "depth": 0.22},
        "mount_type": "bowens",
        "material": "aluminum",
        "finish": "silver",
        "weight_kg": 1.0,
        "files": {
            "obj": "/models/modifiers/beauty-dish/beauty-dish.obj",
            "glb": "/models/modifiers/beauty-dish/beauty-dish.glb",
            "thumbnail": "/models/modifiers/beauty-dish/beauty-dish-thumb.png",
            "icon": "/models/modifiers/beauty-dish/beauty-dish-icon.png"
        }
    })
    
    print("✅ Beauty Dish complete!\n")

    # 2. Softbox
    mesh = create_softbox()
    mesh.export(f"{base_path}/softbox/softbox.obj")
    mesh.export(f"{base_path}/softbox/softbox.glb")
    img = generate_thumbnail("Softbox", (250, 250, 250))
    img.save(f"{base_path}/softbox/softbox-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/softbox/softbox-icon.png")

    modifiers_data.append({
        "id": "softbox",
        "name": "Softbox 80x120cm",
        "brand": "Universal",
        "type": "softbox",
        "description": "Rectangular softbox with white diffusion for soft, directional light",
        "dimensions": {"width": 0.80, "height": 1.20, "depth": 0.30},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion",
        "weight_kg": 2.5,
        "files": {
            "obj": "/models/modifiers/softbox/softbox.obj",
            "glb": "/models/modifiers/softbox/softbox.glb",
            "thumbnail": "/models/modifiers/softbox/softbox-thumb.png",
            "icon": "/models/modifiers/softbox/softbox-icon.png"
        }
    })

    print("✅ Softbox complete!\n")

    # 3. Stripbox
    mesh = create_stripbox()
    mesh.export(f"{base_path}/stripbox/stripbox.obj")
    mesh.export(f"{base_path}/stripbox/stripbox.glb")
    img = generate_thumbnail("Stripbox", (248, 248, 252))
    img.save(f"{base_path}/stripbox/stripbox-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/stripbox/stripbox-icon.png")

    modifiers_data.append({
        "id": "stripbox",
        "name": "Stripbox 35x160cm",
        "brand": "Universal",
        "type": "stripbox",
        "description": "Narrow stripbox for edge lighting and full-length portraits",
        "dimensions": {"width": 0.35, "height": 1.60, "depth": 0.25},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion",
        "weight_kg": 2.0,
        "files": {
            "obj": "/models/modifiers/stripbox/stripbox.obj",
            "glb": "/models/modifiers/stripbox/stripbox.glb",
            "thumbnail": "/models/modifiers/stripbox/stripbox-thumb.png",
            "icon": "/models/modifiers/stripbox/stripbox-icon.png"
        }
    })

    print("✅ Stripbox complete!\n")

    # 4. Octabox
    mesh = create_octabox()
    mesh.export(f"{base_path}/octabox/octabox.obj")
    mesh.export(f"{base_path}/octabox/octabox.glb")
    img = generate_thumbnail("Octabox", (252, 250, 248))
    img.save(f"{base_path}/octabox/octabox-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/octabox/octabox-icon.png")

    modifiers_data.append({
        "id": "octabox",
        "name": "Octabox 120cm",
        "brand": "Universal",
        "type": "octabox",
        "description": "Octagonal softbox for natural-looking catchlights in eyes",
        "dimensions": {"diameter": 1.20, "depth": 0.35},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion",
        "weight_kg": 3.0,
        "files": {
            "obj": "/models/modifiers/octabox/octabox.obj",
            "glb": "/models/modifiers/octabox/octabox.glb",
            "thumbnail": "/models/modifiers/octabox/octabox-thumb.png",
            "icon": "/models/modifiers/octabox/octabox-icon.png"
        }
    })

    print("✅ Octabox complete!\n")

    # 5. Standard Reflector
    mesh = create_reflector()
    mesh.export(f"{base_path}/reflector/reflector.obj")
    mesh.export(f"{base_path}/reflector/reflector.glb")
    img = generate_thumbnail("Reflector", (235, 235, 240))
    img.save(f"{base_path}/reflector/reflector-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/reflector/reflector-icon.png")

    modifiers_data.append({
        "id": "reflector",
        "name": "Standard Reflector 7\"",
        "brand": "Universal",
        "type": "reflector",
        "description": "Basic parabolic reflector for hard, focused light",
        "dimensions": {"diameter": 0.18, "depth": 0.12},
        "mount_type": "bowens",
        "material": "aluminum",
        "finish": "silver",
        "weight_kg": 0.5,
        "files": {
            "obj": "/models/modifiers/reflector/reflector.obj",
            "glb": "/models/modifiers/reflector/reflector.glb",
            "thumbnail": "/models/modifiers/reflector/reflector-thumb.png",
            "icon": "/models/modifiers/reflector/reflector-icon.png"
        }
    })

    print("✅ Standard Reflector complete!\n")

    # Save metadata
    metadata = {
        "version": "1.0.0",
        "generated_at": "2025-11-24",
        "generator": "generate_all_modifiers.py",
        "quality": "procedural",
        "modifiers": modifiers_data
    }

    with open(f"{base_path}/modifiers.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("✅ Metadata saved!\n")

    print("="*70)
    print("🎉 ALL 5 MODIFIERS GENERATED SUCCESSFULLY!")
    print("="*70)
    print("\nGenerated files:")
    for mod in modifiers_data:
        print(f"  ✅ {mod['name']}")
    print(f"\n📄 Metadata: {base_path}/modifiers.json")
    print("\n")

if __name__ == "__main__":
    main()

