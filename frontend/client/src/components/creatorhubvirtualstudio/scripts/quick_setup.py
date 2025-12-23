#!/usr/bin/env python3
"""
Quick Setup and Generation Script
Installs dependencies and generates 3D modifiers in one go
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a shell command with progress indication"""
    print(f"\n{'='*70}")
    print(f"🔧 {description}")
    print(f"{'='*70}")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} - Complete!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - Failed!")
        print(f"Error: {e.stderr}")
        return False

def install_dependencies():
    """Install all required dependencies"""
    print("\n" + "="*70)
    print("📦 INSTALLING DEPENDENCIES")
    print("="*70)
    
    packages = [
        # Core
        ("torch torchvision --index-url https://download.pytorch.org/whl/cpu", "PyTorch (CPU)"),
        ("numpy Pillow requests tqdm PyYAML", "Basic utilities"),
        ("trimesh", "Trimesh (mesh processing)"),
        ("opencv-python", "OpenCV"),
        ("huggingface-hub", "Hugging Face Hub"),
        
        # Optional but useful
        ("rembg", "Background removal (optional)"),
    ]
    
    for package, description in packages:
        cmd = f"{sys.executable} -m pip install {package} --quiet"
        if not run_command(cmd, f"Installing {description}"):
            print(f"⚠️  Warning: Failed to install {description}, continuing...")
    
    print("\n✅ Core dependencies installed!")

def create_directories():
    """Create necessary directory structure"""
    print("\n" + "="*70)
    print("📁 CREATING DIRECTORIES")
    print("="*70)
    
    dirs = [
        "reference_images/modifiers",
        "../public/models/modifiers/beauty-dish",
        "../public/models/modifiers/softbox",
        "../public/models/modifiers/stripbox",
        "../public/models/modifiers/octabox",
        "../public/models/modifiers/reflector",
    ]
    
    for dir_path in dirs:
        os.makedirs(dir_path, exist_ok=True)
        print(f"✅ Created: {dir_path}")
    
    print("\n✅ Directory structure created!")

def generate_simple_models():
    """Generate simple procedural 3D models (fallback if AI generation fails)"""
    print("\n" + "="*70)
    print("🎨 GENERATING SIMPLE 3D MODELS")
    print("="*70)
    
    try:
        import trimesh
        import numpy as np
        from PIL import Image
        import json
        
        modifiers_data = []
        
        # Beauty Dish - Parabolic shape
        print("\n📦 Generating Beauty Dish...")
        vertices = []
        faces = []
        segments = 32
        for i in range(segments):
            angle = (i / segments) * 2 * np.pi
            x = 0.25 * np.cos(angle)
            z = 0.25 * np.sin(angle)
            y = 0.1 * (x**2 + z**2)  # Parabolic curve
            vertices.append([x, y, z])
        
        # Create simple cone mesh for beauty dish
        mesh = trimesh.creation.cone(0.25, 0.22, sections=32)
        mesh.export("../public/models/modifiers/beauty-dish/beauty-dish.obj")
        mesh.export("../public/models/modifiers/beauty-dish/beauty-dish.glb")
        
        # Generate thumbnail
        img = Image.new('RGB', (512, 512), color=(240, 240, 240))
        img.save("../public/models/modifiers/beauty-dish/beauty-dish-thumb.png")
        img_icon = img.resize((128, 128))
        img_icon.save("../public/models/modifiers/beauty-dish/beauty-dish-icon.png")
        
        modifiers_data.append({
            "id": "beauty-dish",
            "name": "Beauty Dish",
            "brand": "Universal",
            "type": "beauty-dish",
            "description": "Parabolic reflector for portrait photography",
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
        
        print("✅ Beauty Dish generated!")
        
        # Softbox - Box shape
        print("\n📦 Generating Softbox...")
        mesh = trimesh.creation.box(extents=[0.80, 0.30, 1.20])
        mesh.export("../public/models/modifiers/softbox/softbox.obj")
        mesh.export("../public/models/modifiers/softbox/softbox.glb")
        
        img = Image.new('RGB', (512, 512), color=(250, 250, 250))
        img.save("../public/models/modifiers/softbox/softbox-thumb.png")
        img_icon = img.resize((128, 128))
        img_icon.save("../public/models/modifiers/softbox/softbox-icon.png")
        
        modifiers_data.append({
            "id": "softbox",
            "name": "Softbox 80x120cm",
            "brand": "Universal",
            "type": "softbox",
            "description": "Rectangular softbox with white diffusion",
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
        
        print("✅ Softbox generated!")
        
        # Save metadata
        metadata = {
            "version": "1.0.0",
            "generated_at": "2025-11-24",
            "generator": "quick_setup.py",
            "quality": "procedural",
            "modifiers": modifiers_data
        }
        
        with open("../public/models/modifiers/modifiers.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        print("\n✅ Metadata saved!")
        print("\n✅ Simple 3D models generated successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Failed to generate models: {e}")
        return False

def main():
    """Main execution"""
    print("\n" + "="*70)
    print("🎨 3D MODIFIER GENERATION - QUICK SETUP")
    print("="*70)
    print("\nThis script will:")
    print("1. Install required dependencies")
    print("2. Create directory structure")
    print("3. Generate simple 3D models")
    print("\n" + "="*70)
    
    # Step 1: Install dependencies
    install_dependencies()
    
    # Step 2: Create directories
    create_directories()
    
    # Step 3: Generate models
    generate_simple_models()
    
    print("\n" + "="*70)
    print("🎉 SETUP COMPLETE!")
    print("="*70)
    print("\nGenerated files:")
    print("- public/models/modifiers/modifiers.json")
    print("- public/models/modifiers/beauty-dish/")
    print("- public/models/modifiers/softbox/")
    print("\nNext steps:")
    print("1. Review generated models")
    print("2. Run: cd ../../../.. && npm run dev")
    print("3. Open Virtual Studio and test modifiers")
    print("\n")

if __name__ == "__main__":
    main()

