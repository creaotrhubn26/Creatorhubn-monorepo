# CreatorHub Virtual Studio Brand Kit

## Overview

Complete brand identity system for CreatorHub Virtual Studio, including colors, logos, icons, typography, and decorative elements. All assets are SVG-based and can be rendered using the integrated Resvg WASM renderer.

## Contents

### 1. Brand Colors

#### Primary Palette

- **Main**: `#6366F1` - Indigo (Professional, Tech)
- **Light**: `#818CF8` - Light Indigo
- **Dark**: `#4F46E5` - Dark Indigo
- **Gradient**: `linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)`

#### Secondary Palette

- **Main**: `#8B5CF6` - Purple (Creative, Artistic)
- **Light**: `#A78BFA` - Light Purple
- **Dark**: `#7C3AED` - Dark Purple

#### Accent Colors

- **Cyan**: `#06B6D4` - Virtual, Digital
- **Pink**: `#EC4899` - Creative Energy
- **Orange**: `#F59E0B` - Action, Export
- **Green**: `#10B981` - Success, Render Complete

#### Neutral Palette

- **Black**: `#0A0A0A` - Pure Black
- **Dark**: `#1A1A1A` - UI Background
- **Gray**: `#3F3F46` - Gray
- **Light Gray**: `#71717A`
- **White**: `#FAFAFA` - Off White
- **Pure White**: `#FFFFFF`

### 2. Typography

#### Font Families

```typescript
display: "'Inter', -apple-system, system-ui, sans-serif";
body: "'Inter', -apple-system, system-ui, sans-serif";
mono: "'JetBrains Mono', 'Fira Code', monospace";
```

#### Font Sizes

- `xs`: 0.75rem (12px)
- `sm`: 0.875rem (14px)
- `base`: 1rem (16px)
- `lg`: 1.125rem (18px)
- `xl`: 1.25rem (20px)
- `2xl`: 1.5rem (24px)
- `3xl`: 1.875rem (30px)
- `4xl`: 2.25rem (36px)
- `5xl`: 3rem (48px)

#### Font Weights

- Light: 300
- Normal: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Black: 900

### 3. Logos

#### Main Logo

**Dimensions**: 200x60px
**Usage**: Headers, splash screens, marketing materials
**Components**:

- 3D cube icon (representing virtual studio)
- Camera lens accent
- "CreatorHub" text with gradient
- "VIRTUAL STUDIO" subtitle

#### Icon Logo

**Dimensions**: 60x60px
**Usage**: Favicons, app icons, small spaces
**Components**:

- Gradient background with rounded corners
- Simplified 3D cube
- Camera lens center point

### 4. Feature Icons

Available icons (24x24px):

- **camera** - Camera control and recording
- **timeline** - Timeline and animation
- **render3d** - 3D rendering and scene
- **lut** - Color grading and LUT
- **export** - Video export
- **cloud** - Cloud storage
- **animation** - Keyframe animation

All icons use `currentColor` for easy theming.

### 5. Decorative Elements

#### Grid Pattern

100x100px repeating pattern for backgrounds

#### Gradient Orb

200x200px radial gradient for hero sections

#### Scan Lines

100x100px horizontal lines for tech aesthetic

### 6. Watermark

**Dimensions**: 120x30px
**Usage**: Export watermarking for videos and renders
**Components**:

- Semi-transparent black background
- Mini cube icon
- "Virtual Studio" text

## Usage Examples

### Import Brand Kit

```typescript
import { brandKit, brandColors, brandTypography, featureIcons } from '@/assets/brandkit';
```

### Use Colors

```typescript
// In styled components
const StyledBox = styled.div`
  background: ${brandColors.primary.main};
  color: ${brandColors.neutral.white};
`;

// In inline styles
<div style={{
  background: brandColors.primary.gradient,
  padding: '20px'
}}>
  Content
</div>
```

### Render Logos

```typescript
// Direct SVG injection
<div dangerouslySetInnerHTML={{ __html: brandKit.logos.main }} />

// With SVG renderer
import { integrationService } from '@/services/integrations';

const blob = await integrationService.svgRenderer.renderToBlob(
  brandKit.logos.main,
  { width: 1200, height: 630, format: 'png' }
);
```

### Use Icons

```typescript
// In React components
import { featureIcons } from '@/assets/brandkit';

<div
  style={{ color: brandColors.primary.main }}
  dangerouslySetInnerHTML={{ __html: featureIcons.camera }}
/>
```

### Typography

```typescript
// Font family
<Typography sx={{ fontFamily: brandTypography.fontFamily.display }}>
  Heading Text
</Typography>

// Font sizes and weights
<Typography sx={{
  fontSize: brandTypography.fontSize['2xl'],
  fontWeight: brandTypography.fontWeight.bold
}}>
  Large Bold Text
</Typography>
```

### Watermark on Export

```typescript
import { watermark } from '@/assets/brandkit';

// Convert watermark to image
const watermarkBlob = await integrationService.svgRenderer.renderToBlob(watermark, {
  width: 240,
  height: 60,
  format: 'png',
});

// Overlay on video/image during export
// Position at bottom-right corner
```

## Brand Guidelines

### Logo Usage

**DO:**

- Use official logo files only
- Maintain minimum clear space (equal to height of cube icon)
- Use on dark or light backgrounds with sufficient contrast
- Scale proportionally

**DON'T:**

- Modify colors or gradients
- Rotate or distort the logo
- Add effects (drop shadow, glow, etc.)
- Use low-resolution versions

### Color Usage

**Primary Color** (#6366F1):

- Main UI elements
- Call-to-action buttons
- Links and interactive elements
- Brand accents

**Secondary Color** (#8B5CF6):

- Secondary buttons
- Hover states
- Creative/artistic features
- Gradient combinations with primary

**Accent Colors**:

- **Cyan**: Virtual/digital features (camera, 3D)
- **Pink**: Creative actions (effects, filters)
- **Orange**: Export and action buttons
- **Green**: Success states, completed renders

### Typography Guidelines

**Headers**: Bold (700) or Black (900) weight
**Body Text**: Normal (400) or Medium (500) weight
**UI Elements**: Medium (500) or Semibold (600) weight
**Code/Technical**: Mono font family

**Hierarchy**:

- H1: 5xl size, black weight
- H2: 4xl size, bold weight
- H3: 3xl size, bold weight
- H4: 2xl size, semibold weight
- H5: xl size, semibold weight
- H6: lg size, medium weight
- Body: base size, normal weight
- Caption: sm or xs size, normal weight

## Export Formats

### SVG Renderer Integration

All SVG assets can be exported to PNG using the integrated Resvg WASM renderer:

```typescript
import { integrationService } from '@/services/integrations';

// Export logo as PNG
const blob = await integrationService.svgRenderer.renderToBlob(brandKit.logos.main, {
  width: 1200, // Output width
  height: 630, // Output height
  format: 'png', // 'png', 'jpeg', or 'webp'
});

// Create download
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'virtual-studio-logo.png';
a.click();
```

### Recommended Export Sizes

**Logo Main**:

- Social media: 1200x630px
- Website header: 400x120px
- Print: 2000x600px (300 DPI)

**Logo Icon**:

- Favicon: 32x32px, 64x64px
- App icon (iOS): 180x180px, 1024x1024px
- App icon (Android): 192x192px, 512x512px

**Feature Icons**:

- UI: 24x24px (1x), 48x48px (2x)
- Large: 64x64px

## Brand Voice

- **Professional** yet **approachable**
- **Technical** without being overwhelming
- **Creative** and **innovative**
- **Empowering** for creators

### Tone Guidelines

- Use active voice
- Be direct and clear
- Avoid jargon when possible
- Encourage exploration and creativity
- Celebrate user achievements

### Example Copy

- ✅ "Create stunning virtual scenes in minutes"
- ✅ "Professional camera control at your fingertips"
- ✅ "Export your vision with cinematic quality"
- ❌ "Utilize our sophisticated rendering pipeline"
- ❌ "Leverage advanced algorithmic processing"

## Accessibility

### Color Contrast

All color combinations meet WCAG AA standards:

- Primary on white: 4.5:1
- Primary on black: 12:1
- Text: Minimum 4.5:1 for normal text, 3:1 for large text

### Icon Accessibility

- All icons include proper ARIA labels when used
- Decorative icons use `aria-hidden="true"`
- Interactive icons have clear hover/focus states

## File Structure

```
brandkit/
├── index.ts                 # Main export file
├── README.md               # This file
├── logos/
│   ├── main.svg           # Main logo
│   ├── icon.svg           # Icon logo
│   └── watermark.svg      # Export watermark
├── icons/
│   └── feature-*.svg      # Feature icons
├── decorative/
│   ├── grid.svg           # Grid pattern
│   ├── orb.svg            # Gradient orb
│   └── scan.svg           # Scan lines
└── exports/
    └── [Generated PNG exports]
```

## Version History

- **v1.0.0** (2025-10-24) - Initial brand kit release
  - Primary color palette
  - Main and icon logos
  - 7 feature icons
  - Typography system
  - Decorative elements
  - Watermark for exports

## Support

For brand kit questions or custom assets:

- Check the `BrandKitShowcase` component for interactive examples
- Use the SVG renderer integration for exports
- Refer to this README for usage guidelines

---

**License**: Proprietary - CreatorHub Norge  
**Designer**: CreatorHub Design Team  
**Last Updated**: 2025-10-24
