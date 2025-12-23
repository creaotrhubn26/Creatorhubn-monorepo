#!/bin/bash

# Download Sample 3D Models Script
# Downloads free, high-quality 3D models from researched sources
# for testing the Virtual Studio asset systems

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Virtual Studio - Sample Model Downloader${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create directories
BASE_DIR="client/src/components/creatorhubvirtualstudio/public/library/models"
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p "$BASE_DIR/clothing"
mkdir -p "$BASE_DIR/props/furniture"
mkdir -p "$BASE_DIR/props/nature"
mkdir -p "$BASE_DIR/props/electronics"
mkdir -p "$BASE_DIR/props/decorations"
mkdir -p "$BASE_DIR/backdrops/studio"
mkdir -p "$BASE_DIR/backdrops/outdoor"
mkdir -p "$BASE_DIR/backdrops/indoor"
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Function to download file
download_file() {
  local url=$1
  local output=$2
  local name=$3
  
  echo -e "${YELLOW}Downloading: $name${NC}"
  if command -v curl &> /dev/null; then
    curl -L -o "$output" "$url" --progress-bar
  elif command -v wget &> /dev/null; then
    wget -O "$output" "$url" --show-progress
  else
    echo -e "${RED}Error: Neither curl nor wget is installed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Downloaded: $name${NC}"
  echo ""
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Downloading Props (Furniture)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Poly Pizza - Modern Chair
# Note: These are example URLs - you'll need to replace with actual download links
echo -e "${YELLOW}Note: Please manually download models from the following sources:${NC}"
echo ""

echo -e "${BLUE}1. Poly Pizza (https://poly.pizza)${NC}"
echo "   - Search for: 'modern chair', 'table', 'lamp'"
echo "   - Download as GLB format"
echo "   - Place in: $BASE_DIR/props/furniture/"
echo ""

echo -e "${BLUE}2. Quaternius (https://quaternius.com)${NC}"
echo "   - Download: Ultimate Nature Pack"
echo "   - Extract trees, rocks, plants"
echo "   - Convert to GLB if needed"
echo "   - Place in: $BASE_DIR/props/nature/"
echo ""

echo -e "${BLUE}3. Kenney (https://kenney.nl/assets)${NC}"
echo "   - Download: Furniture Kit"
echo "   - Extract models"
echo "   - Convert to GLB if needed"
echo "   - Place in: $BASE_DIR/props/furniture/"
echo ""

echo -e "${BLUE}4. Smithsonian 3D (https://3d.si.edu)${NC}"
echo "   - Search for interesting artifacts"
echo "   - Download as GLB format"
echo "   - Place in: $BASE_DIR/props/decorations/"
echo ""

echo -e "${BLUE}5. NASA 3D (https://nasa3d.arc.nasa.gov)${NC}"
echo "   - Download: ISS model or Mars Rover"
echo "   - Download as GLB format"
echo "   - Place in: $BASE_DIR/props/decorations/"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Alternative: Use Placeholder Models${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Would you like to create placeholder models for testing? (y/n)${NC}"
read -r create_placeholders

if [ "$create_placeholders" = "y" ] || [ "$create_placeholders" = "Y" ]; then
  echo ""
  echo -e "${YELLOW}Creating placeholder models...${NC}"
  
  # Create a simple placeholder GLB using Blender Python script
  # This requires Blender to be installed
  if command -v blender &> /dev/null; then
    echo -e "${GREEN}✓ Blender found, creating placeholder models...${NC}"
    
    # Create Python script for Blender
    cat > /tmp/create_placeholder.py << 'EOF'
import bpy
import sys
import os

# Get arguments
output_path = sys.argv[-2]
model_type = sys.argv[-1]

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Create different shapes based on type
if model_type == 'chair':
    # Simple chair
    bpy.ops.mesh.primitive_cube_add(size=0.4, location=(0, 0, 0.2))
    bpy.ops.mesh.primitive_cube_add(size=0.05, location=(0, 0, 0.5))
elif model_type == 'table':
    # Simple table
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.4))
    bpy.ops.mesh.primitive_cube_add(size=0.05, location=(0, 0, 0.2))
elif model_type == 'tree':
    # Simple tree
    bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=2.0, location=(0, 0, 1.0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, 0, 2.5))
else:
    # Default cube
    bpy.ops.mesh.primitive_cube_add(size=0.5)

# Export as GLB
bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
print(f"Created: {output_path}")
EOF

    # Create placeholder models
    blender --background --python /tmp/create_placeholder.py -- "$BASE_DIR/props/furniture/placeholder_chair.glb" "chair"
    blender --background --python /tmp/create_placeholder.py -- "$BASE_DIR/props/furniture/placeholder_table.glb" "table"
    blender --background --python /tmp/create_placeholder.py -- "$BASE_DIR/props/nature/placeholder_tree.glb" "tree"
    
    rm /tmp/create_placeholder.py
    echo -e "${GREEN}✓ Placeholder models created${NC}"
  else
    echo -e "${YELLOW}Blender not found. Please install Blender or download models manually.${NC}"
  fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Download models from the sources listed above"
echo "2. Place them in the appropriate directories"
echo "3. Update data libraries with actual model paths"
echo "4. Test loading in Virtual Studio"
echo ""

