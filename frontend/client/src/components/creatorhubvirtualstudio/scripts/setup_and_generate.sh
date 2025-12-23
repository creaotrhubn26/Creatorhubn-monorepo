#!/bin/bash

# Complete setup and generation script for 3D modifiers
# This script will:
# 1. Install all required dependencies
# 2. Generate reference images using AI
# 3. Generate 3D models using TripoSR
# 4. Create all necessary output files

set -e  # Exit on error

echo "========================================================================"
echo "🎨 3D Modifier Generation - Complete Setup"
echo "========================================================================"
echo ""

# ============================================================================
# Step 1: Install Core Dependencies
# ============================================================================

echo "📦 Step 1/5: Installing core dependencies..."
echo ""

# Install PyTorch first (required by most AI models)
echo "Installing PyTorch..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet

# Install basic utilities
echo "Installing utilities..."
pip install numpy Pillow requests tqdm PyYAML --quiet

# Install mesh processing tools
echo "Installing mesh processing tools..."
pip install trimesh pymeshfix pyvista meshio --quiet

# Install computer vision
echo "Installing OpenCV and MediaPipe..."
pip install opencv-python mediapipe --quiet

# Install Hugging Face tools
echo "Installing Hugging Face tools..."
pip install huggingface-hub diffusers transformers accelerate --quiet

# Install background removal
echo "Installing background removal..."
pip install rembg --quiet

# Install TripoSR
echo "Installing TripoSR..."
pip install triposr --quiet

echo "✅ Core dependencies installed!"
echo ""

# ============================================================================
# Step 2: Create Directory Structure
# ============================================================================

echo "📁 Step 2/5: Creating directory structure..."
echo ""

mkdir -p reference_images/modifiers
mkdir -p public/models/modifiers/beauty-dish
mkdir -p public/models/modifiers/softbox
mkdir -p public/models/modifiers/stripbox
mkdir -p public/models/modifiers/octabox
mkdir -p public/models/modifiers/reflector

echo "✅ Directories created!"
echo ""

# ============================================================================
# Step 3: Generate Reference Images (AI)
# ============================================================================

echo "🎨 Step 3/5: Generating reference images with AI..."
echo ""

python3 << 'PYTHON_SCRIPT'
from diffusers import StableDiffusionPipeline
import torch
from PIL import Image
import os

print("Loading Stable Diffusion model...")
pipe = StableDiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float32
)

modifiers = {
    "beauty-dish": "professional Profoto beauty dish, white interior, 50cm diameter, Bowens mount, studio lighting equipment, product photo, white background, high detail, 8k, photorealistic",
    "softbox": "professional rectangular softbox, 80x120cm, white diffusion fabric, Bowens mount, studio lighting equipment, product photo, white background, high detail, 8k, photorealistic",
    "stripbox": "professional stripbox, narrow rectangular softbox, 35x160cm, white diffusion fabric, Bowens mount, studio lighting equipment, product photo, white background, high detail, 8k, photorealistic",
    "octabox": "professional octagonal softbox, 120cm diameter, white diffusion fabric, Bowens mount, studio lighting equipment, product photo, white background, high detail, 8k, photorealistic",
    "reflector": "professional standard reflector, 7 inch parabolic reflector, silver interior, Bowens mount, studio lighting equipment, product photo, white background, high detail, 8k, photorealistic"
}

for modifier_id, prompt in modifiers.items():
    print(f"Generating {modifier_id}...")
    image = pipe(prompt, num_inference_steps=50).images[0]
    image.save(f"reference_images/modifiers/{modifier_id}.jpg")
    print(f"✅ Saved: reference_images/modifiers/{modifier_id}.jpg")

print("✅ All reference images generated!")
PYTHON_SCRIPT

echo ""

# ============================================================================
# Step 4: Generate 3D Models
# ============================================================================

echo "🎨 Step 4/5: Generating 3D models with TripoSR..."
echo ""

python3 generate_modifiers_triposr.py

echo ""

# ============================================================================
# Step 5: Verify Output
# ============================================================================

echo "✅ Step 5/5: Verifying output..."
echo ""

echo "Generated files:"
ls -lh public/models/modifiers/

echo ""
echo "========================================================================"
echo "🎉 Setup and generation complete!"
echo "========================================================================"
echo ""
echo "Next steps:"
echo "1. Check generated models in: public/models/modifiers/"
echo "2. Review metadata: public/models/modifiers/modifiers.json"
echo "3. Test in Virtual Studio: npm run dev"
echo ""

