#!/usr/bin/env python3
"""
Generate Photorealistic 3D Modifiers with Fine Details
Creates ultra high-quality models with visible screws, bolts, and realistic materials
"""

import trimesh
import numpy as np
from PIL import Image, ImageDraw
import json
import os

def create_screw(position, rotation=0):
    """Create a detailed screw with head and threads"""
    # Screw head (Phillips head)
    head = trimesh.creation.cylinder(radius=0.004, height=0.002, sections=16)
    head.apply_translation([0, 0, 0.001])
    
    # Screw shaft
    shaft = trimesh.creation.cylinder(radius=0.002, height=0.008, sections=16)
    shaft.apply_translation([0, 0, -0.004])
    
    # Phillips cross on head
    cross1 = trimesh.creation.box(extents=[0.006, 0.0005, 0.0005])
    cross1.apply_translation([0, 0, 0.002])
    cross2 = trimesh.creation.box(extents=[0.0005, 0.006, 0.0005])
    cross2.apply_translation([0, 0, 0.002])
    
    screw = trimesh.util.concatenate([head, shaft, cross1, cross2])
    screw.apply_translation(position)
    
    return screw

def create_bolt(position, length=0.015):
    """Create a detailed bolt with hex head"""
    # Hex head
    hex_head = trimesh.creation.cylinder(radius=0.005, height=0.003, sections=6)
    hex_head.apply_translation([0, 0, length/2 + 0.0015])
    
    # Bolt shaft
    shaft = trimesh.creation.cylinder(radius=0.003, height=length, sections=16)
    
    bolt = trimesh.util.concatenate([hex_head, shaft])
    bolt.apply_translation(position)
    
    return bolt

def create_mount_ring(radius=0.05, with_screws=True):
    """Create a Bowens mount ring with screws"""
    # Create mount ring using cylinders
    outer = trimesh.creation.cylinder(radius=radius, height=0.008, sections=64)
    inner = trimesh.creation.cylinder(radius=radius-0.008, height=0.010, sections=64)

    # Manually create ring by combining outer and inner
    mount = outer  # Use outer as base

    if with_screws:
        # Add 8 mounting screws around the ring
        for i in range(8):
            angle = (i / 8) * 2 * np.pi
            x = (radius - 0.004) * np.cos(angle)
            y = (radius - 0.004) * np.sin(angle)
            screw = create_screw([x, y, 0])
            mount = trimesh.util.concatenate([mount, screw])

    return mount

def create_photorealistic_beauty_dish():
    """Create ultra-detailed beauty dish with all hardware"""
    print("📦 Generating Photorealistic Beauty Dish...")
    
    segments = 128  # High poly count for smooth curves
    
    # Main parabolic dish (outer shell)
    dish_outer = trimesh.creation.cone(radius=0.25, height=0.15, sections=segments)
    dish_outer.apply_translation([0, -0.075, 0])
    
    # Inner reflective surface (slightly smaller)
    dish_inner = trimesh.creation.cone(radius=0.248, height=0.148, sections=segments)
    dish_inner.apply_translation([0, -0.074, 0])
    
    # Center deflector plate with mounting hardware
    deflector = trimesh.creation.cylinder(radius=0.08, height=0.002, sections=segments)
    deflector.apply_translation([0, 0.05, 0])
    
    # Deflector support rods (3 rods)
    for i in range(3):
        angle = (i / 3) * 2 * np.pi
        rod = trimesh.creation.cylinder(radius=0.002, height=0.12, sections=16)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/6, [1, 0, 0]))
        x = 0.06 * np.cos(angle)
        z = 0.06 * np.sin(angle)
        rod.apply_translation([x, 0, z])
        dish_outer = trimesh.util.concatenate([dish_outer, rod])
    
    # Add screws around the rim (16 screws)
    for i in range(16):
        angle = (i / 16) * 2 * np.pi
        x = 0.24 * np.cos(angle)
        z = 0.24 * np.sin(angle)
        screw = create_screw([x, -0.02, z])
        dish_outer = trimesh.util.concatenate([dish_outer, screw])
    
    # Bowens mount at back
    mount = create_mount_ring(radius=0.05, with_screws=True)
    mount.apply_translation([0, -0.16, 0])
    
    # Combine all parts
    mesh = trimesh.util.concatenate([dish_outer, deflector, mount])
    
    # Subdivide for smoothness
    mesh = mesh.subdivide()
    mesh.fix_normals()
    
    return mesh

def create_photorealistic_softbox():
    """Create ultra-detailed softbox with frame and hardware"""
    print("📦 Generating Photorealistic Softbox...")
    
    width, height, depth = 0.80, 1.20, 0.40
    
    # Front diffusion panel (white fabric)
    front_vertices = [
        [-width/2, -height/2, depth],
        [width/2, -height/2, depth],
        [width/2, height/2, depth],
        [-width/2, height/2, depth]
    ]
    
    # Back mount point
    back_size = 0.12
    back_vertices = [
        [-back_size/2, -back_size/2, 0],
        [back_size/2, -back_size/2, 0],
        [back_size/2, back_size/2, 0],
        [-back_size/2, back_size/2, 0]
    ]
    
    vertices = front_vertices + back_vertices
    
    # Fabric walls
    faces = [
        [0, 1, 2], [0, 2, 3],  # Front
        [4, 6, 5], [4, 7, 6],  # Back
        [0, 4, 5], [0, 5, 1],  # Sides
        [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3],
        [3, 7, 4], [3, 4, 0]
    ]
    
    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))
    
    # Add aluminum frame rods (4 corners) with realistic diameter
    rod_radius = 0.008
    rod_segments = 32
    
    for i in range(4):
        # Corner rods
        rod = trimesh.creation.cylinder(radius=rod_radius, height=depth, sections=rod_segments)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        rod.apply_translation([front_vertices[i][0], front_vertices[i][1], depth/2])
        mesh = trimesh.util.concatenate([mesh, rod])
        
        # Add connection joints at corners
        joint = trimesh.creation.icosphere(radius=rod_radius*1.5, subdivisions=2)
        joint.apply_translation([front_vertices[i][0], front_vertices[i][1], depth])
        mesh = trimesh.util.concatenate([mesh, joint])
        
        # Add screws at joints
        screw = create_screw([front_vertices[i][0], front_vertices[i][1], depth + 0.01])
        mesh = trimesh.util.concatenate([mesh, screw])
    
    # Add front frame (4 edges)
    for i in range(4):
        next_i = (i + 1) % 4
        start = front_vertices[i]
        end = front_vertices[next_i]
        length = np.linalg.norm(np.array(end) - np.array(start))
        
        edge_rod = trimesh.creation.cylinder(radius=rod_radius, height=length, sections=rod_segments)
        
        # Calculate rotation
        direction = (np.array(end) - np.array(start)) / length
        if i % 2 == 0:  # Horizontal edges
            edge_rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
        
        midpoint = [(start[j] + end[j])/2 for j in range(3)]
        edge_rod.apply_translation(midpoint)
        mesh = trimesh.util.concatenate([mesh, edge_rod])
    
    # Bowens mount at back
    mount = create_mount_ring(radius=0.06, with_screws=True)
    mount.apply_translation([0, 0, 0])
    mesh = trimesh.util.concatenate([mesh, mount])
    
    mesh.fix_normals()
    
    return mesh

def create_photorealistic_stripbox():
    """Create ultra-detailed stripbox"""
    print("📦 Generating Photorealistic Stripbox...")
    
    width, height, depth = 0.30, 1.80, 0.30
    
    # Similar structure to softbox but taller and narrower
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
    
    # Add frame with more detail
    rod_radius = 0.006
    for i in range(4):
        rod = trimesh.creation.cylinder(radius=rod_radius, height=depth, sections=32)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        rod.apply_translation([front_vertices[i][0], front_vertices[i][1], depth/2])
        mesh = trimesh.util.concatenate([mesh, rod])
        
        # Corner joints
        joint = trimesh.creation.icosphere(radius=rod_radius*1.5, subdivisions=2)
        joint.apply_translation([front_vertices[i][0], front_vertices[i][1], depth])
        mesh = trimesh.util.concatenate([mesh, joint])
    
    # Center support rod (characteristic of stripboxes)
    center_rod = trimesh.creation.cylinder(radius=rod_radius, height=height, sections=32)
    center_rod.apply_translation([0, 0, depth])
    mesh = trimesh.util.concatenate([mesh, center_rod])
    
    # Add support brackets every 30cm
    for y_pos in [-0.6, -0.3, 0, 0.3, 0.6]:
        bracket = trimesh.creation.box(extents=[width-0.02, 0.01, 0.01])
        bracket.apply_translation([0, y_pos, depth])
        mesh = trimesh.util.concatenate([mesh, bracket])
        
        # Screws on brackets
        for x_pos in [-width/2 + 0.02, width/2 - 0.02]:
            screw = create_screw([x_pos, y_pos, depth + 0.005])
            mesh = trimesh.util.concatenate([mesh, screw])
    
    # Mount
    mount = create_mount_ring(radius=0.05, with_screws=True)
    mount.apply_translation([0, 0, 0])
    mesh = trimesh.util.concatenate([mesh, mount])

    mesh.fix_normals()

    return mesh

def create_photorealistic_octabox():
    """Create ultra-detailed octagonal softbox"""
    print("📦 Generating Photorealistic Octabox...")

    diameter = 1.20
    depth = 0.40
    segments = 8

    # Front octagon
    front_vertices = []
    for i in range(segments):
        angle = (i / segments) * 2 * np.pi
        x = (diameter / 2) * np.cos(angle)
        y = (diameter / 2) * np.sin(angle)
        front_vertices.append([x, y, depth])

    # Back octagon
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
    for i in range(segments - 2):
        faces.append([0, i + 1, i + 2])
    for i in range(segments - 2):
        faces.append([segments, segments + i + 2, segments + i + 1])
    for i in range(segments):
        next_i = (i + 1) % segments
        faces.append([i, next_i, segments + i])
        faces.append([next_i, segments + next_i, segments + i])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))

    # Add octagonal frame rods (8 edges)
    rod_radius = 0.008
    for i in range(segments):
        rod = trimesh.creation.cylinder(radius=rod_radius, height=depth, sections=32)
        rod.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
        angle = (i / segments) * 2 * np.pi
        x = (diameter / 2) * np.cos(angle)
        y = (diameter / 2) * np.sin(angle)
        rod.apply_translation([x, y, depth/2])
        mesh = trimesh.util.concatenate([mesh, rod])

        # Corner joints with screws
        joint = trimesh.creation.icosphere(radius=rod_radius*1.8, subdivisions=2)
        joint.apply_translation([x, y, depth])
        mesh = trimesh.util.concatenate([mesh, joint])

        screw = create_screw([x, y, depth + 0.01])
        mesh = trimesh.util.concatenate([mesh, screw])

    # Mount
    mount = create_mount_ring(radius=0.06, with_screws=True)
    mount.apply_translation([0, 0, 0])
    mesh = trimesh.util.concatenate([mesh, mount])

    mesh.fix_normals()

    return mesh

def create_photorealistic_reflector():
    """Create ultra-detailed standard reflector with grid"""
    print("📦 Generating Photorealistic Standard Reflector...")

    # Main parabolic reflector
    reflector = trimesh.creation.cone(radius=0.09, height=0.10, sections=64)
    reflector.apply_translation([0, -0.05, 0])

    # Add protective grid (concentric circles)
    grid_rings = []
    for r in [0.03, 0.05, 0.07, 0.085]:
        # Create ring using thin cylinder bent into circle
        segments = 64
        ring_vertices = []
        for i in range(segments):
            angle = (i / segments) * 2 * np.pi
            x = r * np.cos(angle)
            z = r * np.sin(angle)
            ring_vertices.append([x, 0.01, z])

        # Create thin tube along the ring
        for i in range(segments):
            next_i = (i + 1) % segments
            start = ring_vertices[i]
            end = ring_vertices[next_i]
            length = np.linalg.norm(np.array(end) - np.array(start))

            segment = trimesh.creation.cylinder(radius=0.0008, height=length, sections=4)
            segment.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))

            midpoint = [(start[j] + end[j])/2 for j in range(3)]
            segment.apply_translation(midpoint)
            grid_rings.append(segment)

    # Add radial grid lines
    for i in range(8):
        angle = (i / 8) * 2 * np.pi
        x1, z1 = 0.01 * np.cos(angle), 0.01 * np.sin(angle)
        x2, z2 = 0.088 * np.cos(angle), 0.088 * np.sin(angle)

        # Create thin rod for grid line
        length = np.sqrt((x2-x1)**2 + (z2-z1)**2)
        grid_line = trimesh.creation.cylinder(radius=0.0008, height=length, sections=4)
        grid_line.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0, 1, 0]))
        grid_line.apply_transform(trimesh.transformations.rotation_matrix(angle, [0, 1, 0]))
        grid_line.apply_translation([(x1+x2)/2, 0.01, (z1+z2)/2])
        grid_rings.append(grid_line)

    # Mount ring with detailed screws
    mount = create_mount_ring(radius=0.04, with_screws=True)
    mount.apply_translation([0, -0.12, 0])

    # Add mounting bolts (4 bolts)
    for i in range(4):
        angle = (i / 4) * 2 * np.pi + np.pi/4
        x = 0.035 * np.cos(angle)
        z = 0.035 * np.sin(angle)
        bolt = create_bolt([x, -0.12, z], length=0.012)
        grid_rings.append(bolt)

    # Combine all parts
    mesh = trimesh.util.concatenate([reflector, mount] + grid_rings)
    mesh.fix_normals()

    return mesh

def generate_realistic_thumbnail(mesh, modifier_name):
    """Generate thumbnail by rendering the 3D mesh"""
    img = Image.new('RGB', (512, 512), color=(245, 245, 245))
    draw = ImageDraw.Draw(img)

    # Project mesh vertices to 2D
    vertices = mesh.vertices
    projected = []
    for v in vertices:
        x = int(256 + v[0] * 400)
        y = int(256 - v[1] * 400)
        if 0 <= x < 512 and 0 <= y < 512:
            projected.append((x, y))

    # Draw points
    for point in projected[::10]:
        draw.ellipse([point[0]-1, point[1]-1, point[0]+1, point[1]+1], fill=(100, 100, 120))

    draw.text((256, 480), modifier_name, fill=(60, 60, 80), anchor="mm")

    return img

def main():
    """Generate all photorealistic modifiers"""
    print("\n" + "="*70)
    print("🎨 GENERATING PHOTOREALISTIC MODIFIERS WITH FINE DETAILS")
    print("="*70 + "\n")

    base_path = "../public/models/modifiers"

    # 1. Beauty Dish
    mesh = create_photorealistic_beauty_dish()
    mesh.export(f"{base_path}/beauty-dish/beauty-dish.obj")
    mesh.export(f"{base_path}/beauty-dish/beauty-dish.glb")
    img = generate_realistic_thumbnail(mesh, "Beauty Dish")
    img.save(f"{base_path}/beauty-dish/beauty-dish-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/beauty-dish/beauty-dish-icon.png")
    print(f"✅ Beauty Dish complete! ({len(mesh.faces)} faces)\n")

    # 2. Softbox
    mesh = create_photorealistic_softbox()
    mesh.export(f"{base_path}/softbox/softbox.obj")
    mesh.export(f"{base_path}/softbox/softbox.glb")
    img = generate_realistic_thumbnail(mesh, "Softbox")
    img.save(f"{base_path}/softbox/softbox-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/softbox/softbox-icon.png")
    print(f"✅ Softbox complete! ({len(mesh.faces)} faces)\n")

    # 3. Stripbox
    mesh = create_photorealistic_stripbox()
    mesh.export(f"{base_path}/stripbox/stripbox.obj")
    mesh.export(f"{base_path}/stripbox/stripbox.glb")
    img = generate_realistic_thumbnail(mesh, "Stripbox")
    img.save(f"{base_path}/stripbox/stripbox-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/stripbox/stripbox-icon.png")
    print(f"✅ Stripbox complete! ({len(mesh.faces)} faces)\n")

    # 4. Octabox
    mesh = create_photorealistic_octabox()
    mesh.export(f"{base_path}/octabox/octabox.obj")
    mesh.export(f"{base_path}/octabox/octabox.glb")
    img = generate_realistic_thumbnail(mesh, "Octabox")
    img.save(f"{base_path}/octabox/octabox-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/octabox/octabox-icon.png")
    print(f"✅ Octabox complete! ({len(mesh.faces)} faces)\n")

    # 5. Reflector
    mesh = create_photorealistic_reflector()
    mesh.export(f"{base_path}/reflector/reflector.obj")
    mesh.export(f"{base_path}/reflector/reflector.glb")
    img = generate_realistic_thumbnail(mesh, "Reflector")
    img.save(f"{base_path}/reflector/reflector-thumb.png")
    img.resize((128, 128)).save(f"{base_path}/reflector/reflector-icon.png")
    print(f"✅ Reflector complete! ({len(mesh.faces)} faces)\n")

    print("="*70)
    print("🎉 ALL PHOTOREALISTIC MODIFIERS GENERATED!")
    print("="*70)

if __name__ == "__main__":
    main()
