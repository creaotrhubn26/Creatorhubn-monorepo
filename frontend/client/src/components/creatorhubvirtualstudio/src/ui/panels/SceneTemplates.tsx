import React, { useState } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('SceneTemplates, ');
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Divider,
} from '@mui/material';
import { ViewInAr, Portrait, Inventory2, Checkroom, FavoriteBorder } from '@mui/icons-material';

interface SceneTemplate {
  id: string;
  name: string;
  category: 'portrait' | 'product' | 'fashion' | 'wedding';
  thumbnail: string;
  description: string;
  lights: Array<{
    type: string;
    power: number;
    position: [number, number, number];
    angle: number;
  }>;
  camera: {
    focalLength: number;
    aperture: number;
    iso: number;
  };
  hdri?: string;
}

// SVG data URI generator for lighting diagram thumbnails
const createLightingDiagramSVG = (template: string) => {
  const diagrams: Record<string, string> = {
    '3point': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#1a1a1a" width="200" height="200"/><circle cx="100" cy="120" r="25" fill="#444" stroke="#666" stroke-width="2"/><circle cx="150" cy="60" r="12" fill="#ffd93d" opacity="0.9"/><line x1="150" y1="60" x2="110" y2="100" stroke="#ffd93d" stroke-width="2" opacity="0.5"/><text x="150" y="85" fill="#fff" font-size="10" text-anchor="middle">KEY</text><circle cx="50" cy="80" r="10" fill="#88c8ff" opacity="0.7"/><line x1="50" y1="80" x2="85" y2="105" stroke="#88c8ff" stroke-width="2" opacity="0.4"/><text x="50" y="100" fill="#fff" font-size="10" text-anchor="middle">FILL</text><circle cx="100" cy="180" r="8" fill="#ff8844" opacity="0.7"/><line x1="100" y1="172" x2="100" y2="145" stroke="#ff8844" stroke-width="2" opacity="0.4"/><text x="100" y="195" fill="#fff" font-size="10" text-anchor="middle">RIM</text></svg>`,
    dramatic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#0a0a0a" width="200" height="200"/><circle cx="100" cy="120" r="25" fill="#222" stroke="#444" stroke-width="2"/><circle cx="160" cy="50" r="15" fill="#ffd93d"/><line x1="160" y1="50" x2="110" y2="100" stroke="#ffd93d" stroke-width="3" opacity="0.6"/><path d="M85 95 Q100 80 115 95 L115 145 Q100 160 85 145 Z" fill="#333" opacity="0.5"/><text x="160" y="75" fill="#fff" font-size="10" text-anchor="middle">KEY</text><text x="100" y="170" fill="#888" font-size="9" text-anchor="middle">Hard Shadow</text></svg>`,
    product: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#fff" width="200" height="200"/><rect x="75" y="100" width="50" height="60" fill="#ddd" stroke="#bbb"/><circle cx="100" cy="40" r="10" fill="#ffd93d"/><line x1="100" y1="50" x2="100" y2="95" stroke="#ffd93d" stroke-width="2" opacity="0.4"/><circle cx="40" cy="100" r="8" fill="#88c8ff"/><line x1="48" y1="100" x2="70" y2="120" stroke="#88c8ff" stroke-width="2" opacity="0.3"/><circle cx="160" cy="100" r="8" fill="#88c8ff"/><line x1="152" y1="100" x2="130" y2="120" stroke="#88c8ff" stroke-width="2" opacity="0.3"/><rect x="60" y="170" width="80" height="15" fill="#f5f5f5" stroke="#ddd"/><text x="100" y="182" fill="#999" font-size="8" text-anchor="middle">WHITE SWEEP</text></svg>`,
    jewelry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#111" width="200" height="200"/><ellipse cx="100" cy="120" rx="30" ry="15" fill="#333"/><circle cx="100" cy="105" r="12" fill="none" stroke="#ffd700" stroke-width="3"/><circle cx="100" cy="95" r="5" fill="#fff" opacity="0.9"/><circle cx="130" cy="60" r="8" fill="#fff" opacity="0.8"/><circle cx="70" cy="60" r="8" fill="#88c8ff" opacity="0.6"/><path d="M95 95 L130 60" stroke="#fff" stroke-width="1" opacity="0.3"/><path d="M105 95 L70 60" stroke="#88c8ff" stroke-width="1" opacity="0.3"/><text x="100" y="180" fill="#666" font-size="10" text-anchor="middle">MACRO LIGHTING</text></svg>`,
    fashion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#1a1a1a" width="200" height="200"/><ellipse cx="100" cy="150" rx="40" ry="8" fill="#111"/><path d="M85 60 Q100 50 115 60 L120 140 Q100 150 80 140 Z" fill="#333"/><circle cx="100" cy="45" r="15" fill="#444"/><circle cx="160" cy="40" r="12" fill="#ffd93d"/><line x1="160" y1="52" x2="115" y2="80" stroke="#ffd93d" stroke-width="3" opacity="0.5"/><circle cx="40" cy="160" r="10" fill="#ff8844" opacity="0.8"/><line x1="40" y1="150" x2="75" y2="120" stroke="#ff8844" stroke-width="2" opacity="0.4"/><text x="160" y="60" fill="#fff" font-size="9" text-anchor="middle">KEY</text><text x="40" y="175" fill="#fff" font-size="9" text-anchor="middle">RIM</text></svg>`,
    editorial: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#222" width="200" height="200"/><path d="M85 55 Q100 45 115 55 L118 145 Q100 155 82 145 Z" fill="#444"/><circle cx="100" cy="40" r="12" fill="#555"/><circle cx="150" cy="50" r="10" fill="#ffd93d"/><circle cx="50" cy="70" r="8" fill="#88c8ff" opacity="0.7"/><circle cx="100" cy="20" r="6" fill="#ff8844" opacity="0.8"/><line x1="150" y1="60" x2="110" y2="80" stroke="#ffd93d" stroke-width="2" opacity="0.4"/><line x1="50" y1="78" x2="85" y2="100" stroke="#88c8ff" stroke-width="2" opacity="0.3"/><line x1="100" y1="26" x2="100" y2="55" stroke="#ff8844" stroke-width="2" opacity="0.3"/><text x="150" y="70" fill="#fff" font-size="8" text-anchor="middle">MAIN</text><text x="50" y="88" fill="#fff" font-size="8" text-anchor="middle">FILL</text><text x="100" y="14" fill="#fff" font-size="8" text-anchor="middle">HAIR</text></svg>`,
    wedding: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="sunset" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#ff9966"/><stop offset="100%" style="stop-color:#ff5e62"/></linearGradient></defs><rect fill="url(#sunset)" width="200" height="200" opacity="0.3"/><rect fill="#2a1a1a" width="200" height="200" opacity="0.7"/><ellipse cx="80" cy="150" rx="25" ry="6" fill="#111"/><ellipse cx="120" cy="150" rx="25" ry="6" fill="#111"/><path d="M68 70 Q80 60 92 70 L95 145 Q80 155 65 145 Z" fill="#f5f5f5"/><path d="M108 65 Q120 55 132 65 L135 145 Q120 155 105 145 Z" fill="#333"/><circle cx="80" cy="55" r="10" fill="#ddd"/><circle cx="120" cy="52" r="11" fill="#444"/><circle cx="150" cy="60" r="10" fill="#ffeedd" opacity="0.8"/><circle cx="50" cy="80" r="8" fill="#ffddcc" opacity="0.6"/><text x="100" y="180" fill="#fff" font-size="10" text-anchor="middle">ROMANTIC</text></svg>`,
  };
  return `data:image/svg+xml,${encodeURIComponent(diagrams[template] || diagrams['3point,'])}`;
};

const SCENE_TEMPLATES: SceneTemplate[] = [
  // Portrait Templates
  {
    id: 'portrait_3point',
    name: '3-Point Portrait',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('3point'),
    description: 'Classic 3-point lighting for portraits',
    lights: [
      { type: 'key', power: 500, position: [2, 2, 2], angle: 45 },
      { type: 'fill', power: 250, position: [-2, 1.5, 2], angle: 60 },
      { type: 'rim', power: 300, position: [0, 2, -2], angle: 30 },
    ],
    camera: { focalLength: 85, aperture: 2.8, iso: 100 },
  },
  {
    id: 'portrait_dramatic',
    name: 'Dramatic Portrait',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('dramatic'),
    description: 'Single key light for dramatic shadows',
    lights: [{ type: 'key', power: 800, position: [3, 2, 1], angle: 30 }],
    camera: { focalLength: 85, aperture: 1.8, iso: 200 },
  },
  {
    id: 'portrait_butterfly',
    name: 'Butterfly/Paramount',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('3point'),
    description: 'Classic glamour lighting with butterfly shadow',
    lights: [
      { type: 'key', power: 600, position: [0, 2.5, 2], angle: 45 },
      { type: 'fill', power: 200, position: [0, 0, 2], angle: 0 },
    ],
    camera: { focalLength: 85, aperture: 4, iso: 100 },
  },
  {
    id: 'portrait_rembrandt',
    name: 'Rembrandt Lighting',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('dramatic'),
    description: 'Classic Rembrandt triangle shadow pattern',
    lights: [
      { type: 'key', power: 600, position: [2.5, 2, 1.5], angle: 45 },
      { type: 'fill', power: 150, position: [-2, 1, 2], angle: 60 },
    ],
    camera: { focalLength: 85, aperture: 2.8, iso: 100 },
  },
  {
    id: 'portrait_split',
    name: 'Split Lighting',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('dramatic'),
    description: 'Half face in shadow for dramatic effect',
    lights: [{ type: 'key', power: 700, position: [3, 1.8, 0], angle: 90 }],
    camera: { focalLength: 85, aperture: 2.8, iso: 200 },
  },
  {
    id: 'portrait_loop',
    name: 'Loop Lighting',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('3point'),
    description: 'Small shadow loops under nose',
    lights: [
      { type: 'key', power: 500, position: [1.5, 2.2, 2], angle: 35 },
      { type: 'fill', power: 200, position: [-1.5, 1.5, 2], angle: 50 },
    ],
    camera: { focalLength: 85, aperture: 4, iso: 100 },
  },
  {
    id: 'portrait_clamshell',
    name: 'Clamshell Beauty',
    category: 'portrait',
    thumbnail: createLightingDiagramSVG('3point'),
    description: 'Beauty/glamour with fill from below',
    lights: [
      { type: 'key', power: 500, position: [0, 2.5, 2], angle: 45 },
      { type: 'fill', power: 350, position: [0, 0.5, 2], angle: 30 },
    ],
    camera: { focalLength: 100, aperture: 5.6, iso: 100 },
  },

  // Product Templates
  {
    id: 'product_clean_white',
    name: 'Clean White Background',
    category: 'product',
    thumbnail: createLightingDiagramSVG('product'),
    description: 'Professional e-commerce product photography',
    lights: [
      { type: 'overhead', power: 400, position: [0, 3, 0], angle: 90 },
      { type: 'left', power: 300, position: [-2, 1, 1], angle: 45 },
      { type: 'right', power: 300, position: [2, 1, 1], angle: 45 },
      { type: 'background', power: 600, position: [0, 1, -2], angle: 0 },
    ],
    camera: { focalLength: 100, aperture: 11, iso: 100 },
  },
  {
    id: 'product_jewelry',
    name: 'Jewelry Close-up',
    category: 'product',
    thumbnail: createLightingDiagramSVG('jewelry'),
    description: 'High-detail macro lighting for jewelry',
    lights: [
      { type: 'main', power: 250, position: [1, 1.5, 1], angle: 45 },
      { type: 'fill', power: 150, position: [-1, 1.5, 1], angle: 45 },
      { type: 'accent', power: 200, position: [0, 0.5, -1], angle: 60 },
    ],
    camera: { focalLength: 100, aperture: 16, iso: 100 },
  },
  {
    id: 'product_bottle',
    name: 'Bottle/Glass',
    category: 'product',
    thumbnail: createLightingDiagramSVG('product'),
    description: 'Transparent objects with edge lighting',
    lights: [
      { type: 'strip_left', power: 400, position: [-2, 1.5, 0], angle: 90 },
      { type: 'strip_right', power: 400, position: [2, 1.5, 0], angle: 90 },
      { type: 'background', power: 300, position: [0, 1, -2], angle: 0 },
    ],
    camera: { focalLength: 100, aperture: 11, iso: 100 },
  },
  {
    id: 'product_food',
    name: 'Food Photography',
    category: 'product',
    thumbnail: createLightingDiagramSVG('product'),
    description: 'Appetizing food with backlight',
    lights: [
      { type: 'key', power: 500, position: [0, 2, -1.5], angle: 120 },
      { type: 'fill', power: 200, position: [-1.5, 1.5, 1.5], angle: 45 },
      { type: 'accent', power: 150, position: [2, 1, 0], angle: 60 },
    ],
    camera: { focalLength: 85, aperture: 4, iso: 100 },
  },
  {
    id: 'product_electronics',
    name: 'Electronics/Tech',
    category: 'product',
    thumbnail: createLightingDiagramSVG('product'),
    description: 'Clean lighting for tech products',
    lights: [
      { type: 'main', power: 400, position: [1.5, 2.5, 2], angle: 45 },
      { type: 'fill', power: 250, position: [-1.5, 2, 1], angle: 50 },
      { type: 'rim', power: 200, position: [0, 1.5, -1.5], angle: 30 },
      { type: 'background', power: 500, position: [0, 1, -2.5], angle: 0 },
    ],
    camera: { focalLength: 70, aperture: 8, iso: 100 },
  },
  {
    id: 'product_360',
    name: 'Product 360 Spin',
    category: 'product',
    thumbnail: createLightingDiagramSVG('product'),
    description: 'Even lighting for 360 product rotation',
    lights: [
      { type: 'overhead', power: 400, position: [0, 3, 0], angle: 90 },
      { type: 'front_left', power: 300, position: [-1.5, 1.5, 2], angle: 45 },
      { type: 'front_right', power: 300, position: [1.5, 1.5, 2], angle: 45 },
      { type: 'back_left', power: 250, position: [-1.5, 1.5, -2], angle: 135 },
      { type: 'back_right', power: 250, position: [1.5, 1.5, -2], angle: 135 },
    ],
    camera: { focalLength: 100, aperture: 11, iso: 100 },
  },

  // Fashion Templates
  {
    id: 'fashion_dramatic',
    name: 'Dramatic Fashion',
    category: 'fashion',
    thumbnail: createLightingDiagramSVG('fashion'),
    description: 'High contrast fashion photography',
    lights: [
      { type: 'key', power: 800, position: [3, 2, 2], angle: 30 },
      { type: 'rim', power: 600, position: [-2, 2, -1], angle: 45 },
    ],
    camera: { focalLength: 70, aperture: 4, iso: 200 },
    hdri: 'studio_small_09',
  },
  {
    id: 'fashion_editorial',
    name: 'Editorial Fashion',
    category: 'fashion',
    thumbnail: createLightingDiagramSVG('editorial'),
    description: 'Editorial magazine style lighting',
    lights: [
      { type: 'main', power: 600, position: [2, 2.5, 3], angle: 45 },
      { type: 'fill', power: 300, position: [-1.5, 1.5, 2], angle: 60 },
      { type: 'hair', power: 400, position: [0, 3, -1], angle: 40 },
    ],
    camera: { focalLength: 85, aperture: 2.8, iso: 200 },
  },
  {
    id: 'fashion_runway',
    name: 'Runway Style',
    category: 'fashion',
    thumbnail: createLightingDiagramSVG('fashion'),
    description: 'Bright even lighting for full-body shots',
    lights: [
      { type: 'key', power: 600, position: [0, 3, 3], angle: 45 },
      { type: 'fill_left', power: 350, position: [-2.5, 2, 2], angle: 50 },
      { type: 'fill_right', power: 350, position: [2.5, 2, 2], angle: 50 },
      { type: 'rim', power: 400, position: [0, 2.5, -2], angle: 30 },
    ],
    camera: { focalLength: 50, aperture: 5.6, iso: 200 },
  },
  {
    id: 'fashion_beauty',
    name: 'Beauty Close-up',
    category: 'fashion',
    thumbnail: createLightingDiagramSVG('3point'),
    description: 'Soft beauty lighting for makeup/skincare',
    lights: [
      { type: 'beauty_dish', power: 500, position: [0, 2.5, 2], angle: 45 },
      { type: 'fill', power: 300, position: [0, 0.5, 2], angle: 20 },
      { type: 'rim_left', power: 200, position: [-2, 1.5, -0.5], angle: 45 },
      { type: 'rim_right', power: 200, position: [2, 1.5, -0.5], angle: 45 },
    ],
    camera: { focalLength: 100, aperture: 8, iso: 100 },
  },

  // Wedding Templates
  {
    id: 'wedding_soft_romantic',
    name: 'Soft Romantic',
    category: 'wedding',
    thumbnail: createLightingDiagramSVG('wedding'),
    description: 'Soft dreamy lighting for weddings',
    lights: [
      { type: 'main', power: 350, position: [2, 2.5, 3], angle: 60 },
      { type: 'fill', power: 200, position: [-1.5, 1.5, 2], angle: 75 },
      { type: 'hair', power: 250, position: [0, 2.5, -1], angle: 45 },
    ],
    camera: { focalLength: 85, aperture: 1.8, iso: 200 },
    hdri: 'sunset_chalk_quarry',
  },
  {
    id: 'wedding_ceremony',
    name: 'Ceremony Setup',
    category: 'wedding',
    thumbnail: createLightingDiagramSVG('wedding'),
    description: 'Church/venue ceremony lighting',
    lights: [
      { type: 'key', power: 400, position: [2, 3, 3], angle: 45 },
      { type: 'fill', power: 250, position: [-2, 2, 3], angle: 50 },
      { type: 'ambient', power: 150, position: [0, 4, 0], angle: 90 },
    ],
    camera: { focalLength: 70, aperture: 2.8, iso: 400 },
  },
  {
    id: 'wedding_first_dance',
    name: 'First Dance',
    category: 'wedding',
    thumbnail: createLightingDiagramSVG('wedding'),
    description: 'Romantic first dance lighting',
    lights: [
      { type: 'spot', power: 600, position: [0, 4, 2], angle: 30 },
      { type: 'rim_left', power: 300, position: [-3, 2, -1], angle: 45 },
      { type: 'rim_right', power: 300, position: [3, 2, -1], angle: 45 },
    ],
    camera: { focalLength: 85, aperture: 1.8, iso: 800 },
  },
];

export const SceneTemplates: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);

  const categories = ['all','portrait','product','fashion','wedding'];

  const filteredTemplates =
    selectedCategory === 'all'
      ? SCENE_TEMPLATES
      : SCENE_TEMPLATES.filter((t) => t.category === selectedCategory);

  const loadTemplate = (template: SceneTemplate) => {
    setSelectedTemplate(template);

    log.info(`Template selected: ${template.name}`, {
      lights: template.lights.length,
      camera: `${template.camera.focalLength}mm f/${template.camera.aperture}`,
      hdri: template.hdri || 'none',
    });
    if (template.hdri) {
      // HDRI logged above
    }

    // Implement: Clear scene and add lights/camera
    // clearScene();
    // template.lights.forEach(light => addLightNode(light);
    // setCameraSettings(template.camera);
    // if (template.hdri) loadHDRI(template.hdri);
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1a1a1a', color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ViewInAr color="primary" />
        <Typography variant="h6">Scene Templates</Typography>
        <Chip
          label={`${SCENE_TEMPLATES.length} templates`}
          size="small"
          color="primary"
          sx={{ ml: 'auto' }}
        />
      </Box>

      {/* Category Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Category
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'contained' : 'outlined'}
              size="small"
              startIcon={
                cat === 'portrait' ? (
                  <Portrait />
                ) : cat === 'product' ? (
                  <Inventory2 />
                ) : cat === 'fashion' ? (
                  <Checkroom />
                ) : cat === 'wedding' ? (
                  <FavoriteBorder />
                ) : null
              }
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Template Grid */}
      <Box sx={{ maxHeight: 450, overflowY: 'auto' }}>
        <Grid container spacing={2}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border:
                    selectedTemplate?.id === template.id ? '2px solid #2196f3' : '1px solid #333',
                  backgroundColor: '#222','&:hover': { borderColor: '#2196f3' }}}
                onClick={() => loadTemplate(template)}
              >
                <CardMedia
                  component="img"
                  height="150"
                  image={template.thumbnail}
                  alt={template.name}
                />
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    {template.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                    <Chip
                      label={`${template.lights.length} lights`}
                      size="small"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={`${template.camera.focalLength}mm`}
                      size="small"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    {template.hdri && (
                      <Chip label="HDRI" size="small" color="primary" sx={{ fontSize: '0.7rem' }} />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {selectedTemplate && (
        <>
          <Divider sx={{ my: 2, borderColor: '#333' }} />
          <Box sx={{ p: 2, backgroundColor: '#222', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              {selectedTemplate.name}
            </Typography>
            <Typography variant="caption" display="block" gutterBottom>
              {selectedTemplate.description}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              <strong>Camera:</strong> {selectedTemplate.camera.focalLength}mm • f/
              {selectedTemplate.camera.aperture} • ISO {selectedTemplate.camera.iso}
            </Typography>
            <Typography variant="caption" display="block">
              <strong>Lights:</strong> {selectedTemplate.lights.map((l) => l.type).join(', ')}
            </Typography>
            {selectedTemplate.hdri && (
              <Typography variant="caption" display="block">
                <strong>HDRI:</strong> {selectedTemplate.hdri}
              </Typography>
            )}
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => loadTemplate(selectedTemplate)}
            >
              Load Template
            </Button>
          </Box>
        </>
      )}

      {/* Instructions */}
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          backgroundColor: '#222',
          borderRadius: 1,
          borderLeft: '3px solid #2196f3'}}
      >
        <Typography variant="caption">
          <strong>One-Click Setup:</strong>
          <br />
          Templates include professional lighting, camera settings, and optional HDRI environments.
        </Typography>
      </Box>
    </Paper>
  );
};
