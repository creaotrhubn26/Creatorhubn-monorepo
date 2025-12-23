#!/usr/bin/env python3
"""
Generate High-Quality 3D Modifier Models using TripoSR
Supports: Beauty Dish, Softbox, Stripbox, Octabox, Standard Reflector

TripoSR is chosen for:
- Fast generation (5-10 seconds per model)
- High geometric accuracy
- Good detail preservation for mechanical objects
- Single image input support
"""

import os
import sys
import json
import torch
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Dict, List, Optional
import trimesh

# Check if TripoSR is installed
try:
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground
except ImportError:
    print("❌ TripoSR not installed!")
    print("Install with: pip install triposr")
    sys.exit(1)

# Configuration
OUTPUT_DIR = Path("public/models/modifiers")
METADATA_FILE = OUTPUT_DIR / "modifiers.json"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Modifier specifications
MODIFIERS = {
    "beauty-dish": {
        "name": "Beauty Dish",
        "description": "Parabolic reflector for portrait photography",
        "dimensions": {"diameter": 0.55, "depth": 0.25},  # meters
        "mount_type": "bowens",
        "material": "aluminum",
        "finish": "silver",
        "reference_image": "beauty-dish-reference.jpg",
        "prompt": "professional beauty dish light modifier, parabolic reflector, silver interior, Bowens mount, studio photography equipment, product photo, white background"
    },
    "softbox": {
        "name": "Softbox 60x90cm",
        "description": "Rectangular diffusion panel for soft lighting",
        "dimensions": {"width": 0.6, "height": 0.9, "depth": 0.3},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion",
        "reference_image": "softbox-reference.jpg",
        "prompt": "professional rectangular softbox, 60x90cm, white diffusion fabric, Bowens mount, studio lighting equipment, product photo, white background"
    },
    "stripbox": {
        "name": "Stripbox 30x120cm",
        "description": "Narrow rectangular softbox for edge lighting",
        "dimensions": {"width": 0.3, "height": 1.2, "depth": 0.25},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion",
        "reference_image": "stripbox-reference.jpg",
        "prompt": "professional stripbox light modifier, 30x120cm, narrow rectangular softbox, white diffusion, Bowens mount, studio equipment, product photo, white background"
    },
    "octabox": {
        "name": "Octabox 120cm",
        "description": "Octagonal softbox for natural-looking catchlights",
        "dimensions": {"diameter": 1.2, "depth": 0.5},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion",
        "reference_image": "octabox-reference.jpg",
        "prompt": "professional octagonal softbox, 120cm octabox, eight-sided diffusion panel, Bowens mount, studio lighting, product photo, white background"
    },
    "reflector": {
        "name": "Standard Reflector",
        "description": "Basic parabolic reflector for hard light",
        "dimensions": {"diameter": 0.18, "depth": 0.12},
        "mount_type": "bowens",
        "material": "aluminum",
        "finish": "silver",
        "reference_image": "reflector-reference.jpg",
        "prompt": "professional standard reflector, parabolic metal reflector, silver interior, Bowens mount, studio flash equipment, product photo, white background"
    }
}


def initialize_triposr():
    """Initialize TripoSR model"""
    print("🔧 Initializing TripoSR...")
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.to(DEVICE)
    print(f"✅ TripoSR loaded on {DEVICE}")
    return model


def preprocess_image(image_path: str) -> Image.Image:
    """Preprocess reference image for TripoSR"""
    print(f"📸 Processing image: {image_path}")
    
    # Load image
    image = Image.open(image_path).convert("RGB")
    
    # Remove background
    image = remove_background(image, rembg_session=None)
    
    # Resize and center foreground
    image = resize_foreground(image, ratio=0.85)
    
    return image


def generate_3d_model(model: TSR, image: Image.Image, modifier_id: str) -> trimesh.Trimesh:
    """Generate 3D model from image using TripoSR"""
    print(f"🎨 Generating 3D model for {modifier_id}...")
    
    # Run TripoSR
    with torch.no_grad():
        scene_codes = model([image], device=DEVICE)
    
    # Extract mesh
    meshes = model.extract_mesh(scene_codes)
    mesh = meshes[0]
    
    print(f"✅ Generated mesh: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
    return mesh


def cleanup_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Clean up and optimize mesh"""
    print("🧹 Cleaning up mesh...")
    
    # Remove duplicate vertices
    mesh.merge_vertices()
    
    # Remove degenerate faces
    mesh.remove_degenerate_faces()
    
    # Remove unreferenced vertices
    mesh.remove_unreferenced_vertices()
    
    # Fix normals
    mesh.fix_normals()
    
    # Simplify if too many faces (target: 50k faces)
    if len(mesh.faces) > 50000:
        print(f"  Simplifying from {len(mesh.faces)} faces...")
        mesh = mesh.simplify_quadric_decimation(50000)
    
    print(f"✅ Cleaned mesh: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
    return mesh


def scale_mesh_to_real_dimensions(mesh: trimesh.Trimesh, modifier_id: str) -> trimesh.Trimesh:
    """Scale mesh to match real-world dimensions"""
    spec = MODIFIERS[modifier_id]
    dims = spec["dimensions"]

    # Get current bounding box
    bounds = mesh.bounds
    current_size = bounds[1] - bounds[0]

    # Calculate target size based on modifier type
    if "diameter" in dims:
        target_size = dims["diameter"]
        current_diameter = max(current_size[0], current_size[2])
        scale_factor = target_size / current_diameter
    elif "width" in dims and "height" in dims:
        target_width = dims["width"]
        target_height = dims["height"]
        scale_x = target_width / current_size[0]
        scale_y = target_height / current_size[1]
        scale_factor = (scale_x + scale_y) / 2
    else:
        scale_factor = 1.0

    # Apply scaling
    mesh.apply_scale(scale_factor)

    print(f"📏 Scaled to real dimensions: {scale_factor:.3f}x")
    return mesh


def export_mesh(mesh: trimesh.Trimesh, modifier_id: str):
    """Export mesh in multiple formats"""
    output_path = OUTPUT_DIR / modifier_id
    output_path.mkdir(parents=True, exist_ok=True)

    # Export as OBJ (for compatibility)
    obj_path = output_path / f"{modifier_id}.obj"
    mesh.export(str(obj_path))
    print(f"✅ Exported OBJ: {obj_path}")

    # Export as GLB (for web)
    glb_path = output_path / f"{modifier_id}.glb"
    mesh.export(str(glb_path))
    print(f"✅ Exported GLB: {glb_path}")

    # Generate thumbnail
    generate_thumbnail(mesh, output_path / f"{modifier_id}-thumb.png")

    # Generate icon
    generate_icon(mesh, output_path / f"{modifier_id}-icon.png")


def generate_thumbnail(mesh: trimesh.Trimesh, output_path: Path):
    """Generate 512x512 thumbnail"""
    scene = mesh.scene()

    # Set camera angle
    scene.camera.resolution = [512, 512]
    scene.camera.fov = [60, 60]

    # Render
    png = scene.save_image(resolution=[512, 512])

    with open(output_path, 'wb') as f:
        f.write(png)

    print(f"✅ Generated thumbnail: {output_path}")


def generate_icon(mesh: trimesh.Trimesh, output_path: Path):
    """Generate 128x128 icon"""
    scene = mesh.scene()

    # Set camera angle
    scene.camera.resolution = [128, 128]
    scene.camera.fov = [60, 60]

    # Render
    png = scene.save_image(resolution=[128, 128])

    with open(output_path, 'wb') as f:
        f.write(png)

    print(f"✅ Generated icon: {output_path}")


def save_metadata():
    """Save modifiers.json with all metadata"""
    metadata = {
        "version": "1.0.0",
        "generated_at": "2025-11-24",
        "generator": "TripoSR",
        "modifiers": []
    }

    for modifier_id, spec in MODIFIERS.items():
        metadata["modifiers"].append({
            "id": modifier_id,
            "name": spec["name"],
            "description": spec["description"],
            "dimensions": spec["dimensions"],
            "mount_type": spec["mount_type"],
            "material": spec["material"],
            "finish": spec["finish"],
            "files": {
                "obj": f"/models/modifiers/{modifier_id}/{modifier_id}.obj",
                "glb": f"/models/modifiers/{modifier_id}/{modifier_id}.glb",
                "thumbnail": f"/models/modifiers/{modifier_id}/{modifier_id}-thumb.png",
                "icon": f"/models/modifiers/{modifier_id}/{modifier_id}-icon.png"
            }
        })

    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"✅ Saved metadata: {METADATA_FILE}")


def main():
    """Main generation pipeline"""
    print("=" * 60)
    print("🎨 3D Modifier Generation Pipeline (TripoSR)")
    print("=" * 60)

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize model
    model = initialize_triposr()

    # Generate each modifier
    for modifier_id, spec in MODIFIERS.items():
        print(f"\n{'=' * 60}")
        print(f"📦 Generating: {spec['name']}")
        print(f"{'=' * 60}")

        # Check if reference image exists
        ref_image_path = Path("reference_images") / spec["reference_image"]
        if not ref_image_path.exists():
            print(f"⚠️  Reference image not found: {ref_image_path}")
            print(f"💡 Please provide reference image or use text-to-image generation")
            continue

        try:
            # Preprocess image
            image = preprocess_image(str(ref_image_path))

            # Generate 3D model
            mesh = generate_3d_model(model, image, modifier_id)

            # Clean up mesh
            mesh = cleanup_mesh(mesh)

            # Scale to real dimensions
            mesh = scale_mesh_to_real_dimensions(mesh, modifier_id)

            # Export
            export_mesh(mesh, modifier_id)

            print(f"✅ {spec['name']} complete!")

        except Exception as e:
            print(f"❌ Error generating {modifier_id}: {e}")
            continue

    # Save metadata
    save_metadata()

    print(f"\n{'=' * 60}")
    print("🎉 Generation complete!")
    print(f"{'=' * 60}")
    print(f"📁 Output directory: {OUTPUT_DIR}")
    print(f"📄 Metadata file: {METADATA_FILE}")


if __name__ == "__main__":
    main()


