# Gobo Textures

Gobo (Goes Before Optics) patterns are templates placed in front of lights to project patterns.

## Available Gobos

1. **window.png** - Window frame with 4 panes
2. **venetian-blinds.png** - Horizontal venetian blind slats
3. **trees.png** - Tree branches and leaves silhouette
4. **clouds.png** - Soft cloud patterns
5. **geometric-circles.png** - Circular geometric pattern
6. **geometric-hexagons.png** - Hexagonal grid pattern
7. **geometric-triangles.png** - Triangle pattern
8. **breakup.png** - Abstract breakup pattern
9. **dots.png** - Dot grid pattern
10. **stripes.png** - Vertical stripe pattern

## Usage

Gobos are used in the Virtual Studio by:
1. Selecting a light (spot light recommended)
2. Opening the light properties panel
3. Choosing a gobo from the library
4. Adjusting the projection intensity and focus

## Technical Specs

- Format: PNG with alpha channel
- Resolution: 512x512 pixels
- Color: Grayscale (white = transparent, black = opaque)
- File size: < 100KB each

## Creating Custom Gobos

To create custom gobos:
1. Create a 512x512 PNG image
2. Use grayscale values (0-255)
3. White areas will be transparent (light passes through)
4. Black areas will be opaque (blocks light)
5. Gray areas will be semi-transparent
6. Save with alpha channel
7. Place in this directory

## Note

These are placeholder descriptions. Actual PNG files need to be generated or sourced.
For production use, consider:
- Professional gobo libraries (Rosco, Apollo, GAM)
- Custom photography (windows, trees, textures)
- Procedural generation using Canvas API or image processing

