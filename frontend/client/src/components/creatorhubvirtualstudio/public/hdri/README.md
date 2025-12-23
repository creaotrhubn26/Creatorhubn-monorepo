# HDRI Environment Maps

HDRI (High Dynamic Range Image) environment maps provide realistic lighting and reflections in the 3D viewport.

## Required HDRI Files

For production use, download and place the following HDRI files in this directory:

### 1. **white-cyc.hdr** - White Cyclorama Studio
- **Description**: Bright white studio with seamless curved backdrop
- **Use Case**: Product photography, clean portraits
- **Lighting**: Bright, even, neutral
- **Download**: [Poly Haven - Studio Small 03](https://polyhaven.com/a/studio_small_03)

### 2. **black-void.hdr** - Black Void
- **Description**: Pure black environment with minimal ambient light
- **Use Case**: Dramatic portraits, product shots with controlled lighting
- **Lighting**: Dark, minimal ambient
- **Download**: [Poly Haven - Night Sky](https://polyhaven.com/a/kloppenheim_02)

### 3. **photo-studio.hdr** - Photography Studio
- **Description**: Professional photo studio with equipment and lights
- **Use Case**: Realistic studio environment
- **Lighting**: Medium, studio-like
- **Download**: [Poly Haven - Photo Studio 01](https://polyhaven.com/a/photo_studio_01)

### 4. **outdoor-overcast.hdr** - Outdoor Overcast
- **Description**: Soft outdoor lighting on an overcast day
- **Use Case**: Natural portraits, outdoor product shots
- **Lighting**: Soft, diffused, natural
- **Download**: [Poly Haven - Kloofendal Overcast](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)

### 5. **golden-hour.hdr** - Golden Hour Sunset
- **Description**: Warm sunset lighting with golden tones
- **Use Case**: Dramatic portraits, warm product shots
- **Lighting**: Warm, directional, dramatic
- **Download**: [Poly Haven - Venice Sunset](https://polyhaven.com/a/venice_sunset)

## Download Instructions

1. Visit [Poly Haven](https://polyhaven.com/hdris) (free, CC0 license)
2. Download HDRIs in **2K or 4K resolution** (.hdr format)
3. Rename files to match the names above
4. Place in this directory

## Alternative Sources

- **HDRI Haven**: https://polyhaven.com/hdris (Free, CC0)
- **HDRI Skies**: https://hdri-skies.com/ (Free with attribution)
- **HDRIHaven**: https://hdrihaven.com/ (Free, CC0)
- **Blender Market**: https://blendermarket.com/ (Paid, high quality)

## Technical Specifications

- **Format**: .hdr (Radiance HDR)
- **Resolution**: 2K (2048x1024) minimum, 4K (4096x2048) recommended
- **Color Space**: Linear
- **Bit Depth**: 32-bit float
- **File Size**: 5-20MB per file (2K), 20-80MB per file (4K)

## Usage in Virtual Studio

1. Open Virtual Studio
2. Go to Environment Settings
3. Select "HDRI Environment"
4. Choose from available HDRI files
5. Adjust intensity and rotation as needed

## Creating Custom HDRIs

To create custom HDRI environments:
1. Use a 360° camera or HDRI capture rig
2. Shoot bracketed exposures (-3 to +3 EV)
3. Merge to HDR using software like:
   - Photomatix Pro
   - Adobe Lightroom + Photoshop
   - Luminance HDR (free)
4. Convert to equirectangular projection
5. Save as .hdr format

## Placeholder Files

For development/testing, you can use solid color environments:
- Create 512x256 .hdr files with solid colors
- Use tools like GIMP or Photoshop to create simple gradients
- These will work but won't provide realistic reflections

## License

All recommended HDRIs from Poly Haven are **CC0 (Public Domain)**.
No attribution required, free for commercial use.

## File Naming Convention

- Use lowercase with hyphens: `white-cyc.hdr`
- Keep names descriptive and short
- Avoid spaces and special characters

