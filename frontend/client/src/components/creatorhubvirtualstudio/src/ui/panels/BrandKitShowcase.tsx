import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('BrandKitShowcase');
import {
  Box,
  Paper,
  Typography,
  Grid,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ContentCopy, Download, Palette, Image as ImageIcon, Code } from '@mui/icons-material';
import { brandKit, brandColors, brandTypography, featureIcons } from '../../assets/brandkit';
import { integrationService } from '../../services/integrations';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index} style={{ padding: '20px 0' }}>
      {value === index && children}
    </div>
  );
}

export const BrandKitShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadSVG = async (svg: string, filename: string) => {
    try {
      // Use SVG renderer to convert to PNG
      const blob = await integrationService.svgRenderer.renderToBlob(svg, {
        width: 1200,
        height: 630,
        format: 'png',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      log.error('Failed to download SVG: ', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 700}}>
        🎨 CreatorHub Virtual Studio Brand Kit
      </Typography>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Colors" icon={<Palette />} />
        <Tab label="Logos" icon={<ImageIcon />} />
        <Tab label="Icons" icon={<Code />} />
        <Tab label="Typography" />
      </Tabs>

      {/* COLORS TAB */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {/* Primary Colors */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Primary Palette
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(brandColors.primary).map(([name, color]) => (
                <Grid item xs={12} sm={6} md={3} key={name}>
                  <Card
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleCopy(color, `primary-${name}`)}
                  >
                    <Box
                      sx={{
                        height: 100,
                        background: color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'}}
                    >
                      {name === 'main' && (
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700}}>
                          VS
                        </Typography>
                      )}
                    </Box>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                        {name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {color}
                      </Typography>
                      {copied === `primary-${name}` && (
                        <Chip label="Copied!" size="small" color="success" sx={{ mt: 1 }} />
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Accent Colors */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Accent Palette
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(brandColors.accent).map(([name, color]) => (
                <Grid item xs={12} sm={6} md={3} key={name}>
                  <Card
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleCopy(color, `accent-${name}`)}
                  >
                    <Box sx={{ height: 80, background: color }} />
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                        {name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {color}
                      </Typography>
                      {copied === `accent-${name}` && (
                        <Chip label="Copied!" size="small" color="success" sx={{ mt: 1 }} />
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Functional Colors */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Functional Colors
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(brandColors.functional).map(([name, color]) => (
                <Grid item xs={12} sm={6} md={3} key={name}>
                  <Card
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleCopy(color, `func-${name}`)}
                  >
                    <Box sx={{ height: 60, background: color }} />
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                        {name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {color}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </TabPanel>

      {/* LOGOS TAB */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={4}>
          {/* Main Logo */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 4, backgroundColor: '#0A0A0A' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
                Main Logo
              </Typography>
              <Box sx={{ mb: 2 }} dangerouslySetInnerHTML={{ __html: brandKit.logos.main }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={() => handleCopy(brandKit.logos.main, 'logo-main')}
                >
                  {copied === 'logo-main' ? 'Copied!' : 'Copy SVG'}
                </Button>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={() => handleDownloadSVG(brandKit.logos.main, 'virtual-studio-logo')}
                >
                  Export PNG
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Icon Logo */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 4, backgroundColor: '#1A1A1A' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
                Icon Logo
              </Typography>
              <Box sx={{ mb: 2 }} dangerouslySetInnerHTML={{ __html: brandKit.logos.icon }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={() => handleCopy(brandKit.logos.icon'logo-icon')}
                >
                  {copied === 'logo-icon' ? 'Copied!' : 'Copy SVG'}
                </Button>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={() => handleDownloadSVG(brandKit.logos.icon'virtual-studio-icon')}
                >
                  Export PNG
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Watermark */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 4, backgroundColor: '#3F3F46' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
                Export Watermark
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Use this watermark on exported videos and renders
              </Typography>
              <Box sx={{ mb: 2 }} dangerouslySetInnerHTML={{ __html: brandKit.watermark }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={() => handleCopy(brandKit.watermark'watermark')}
                >
                  {copied === 'watermark' ? 'Copied!' : 'Copy SVG'}
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ICONS TAB */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          {Object.entries(featureIcons).map(([name, svg]) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={name}>
              <Card
                sx={{
                  cursor: 'pointer', '&:hover': { transform: 'scale(1.05)', transition: '0.2s' }}}
                onClick={() => handleCopy(svg, `icon-${name}`)}
              >
                <Box
                  sx={{
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1A1A1A',
                    color: brandColors.primary.main}}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <CardContent>
                  <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                    {name}
                  </Typography>
                  {copied === `icon-${name}` && (
                    <Chip label="✓" size="small" color="success" sx={{ ml: 1 }} />
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Decorative Elements */}
        <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
          Decorative Elements
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, backgroundColor: '#0A0A0A' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>
                Grid Pattern
              </Typography>
              <Box dangerouslySetInnerHTML={{ __html: brandKit.decorative.gridPattern }} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, backgroundColor: '#0A0A0A' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>
                Gradient Orb
              </Typography>
              <Box dangerouslySetInnerHTML={{ __html: brandKit.decorative.gradientOrb }} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, backgroundColor: '#0A0A0A' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>
                Loading Spinner
              </Typography>
              <Box dangerouslySetInnerHTML={{ __html: brandKit.loadingSpinner }} />
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* TYPOGRAPHY TAB */}
      <TabPanel value={activeTab} index={3}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Font Families
          </Typography>
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="body1"
              gutterBottom
              sx={{ fontFamily: brandTypography.fontFamily.display }}
            >
              <strong>Display/Body:</strong> {brandTypography.fontFamily.display}
            </Typography>
            <Typography variant="body1" sx={{ fontFamily: brandTypography.fontFamily.mono }}>
              <strong>Monospace:</strong> {brandTypography.fontFamily.mono}
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Font Sizes
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(brandTypography.fontSize).map(([name, size]) => (
              <Box key={name}>
                <Typography variant="caption" color="text.secondary">
                  {name} - {size}
                </Typography>
                <Typography style={{ fontSize: size }}>
                  The quick brown fox jumps over the lazy dog
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Font Weights
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(brandTypography.fontWeight).map(([name, weight]) => (
              <Typography key={name} style={{ fontWeight: eight }}>
                {name} ({weight}) - CreatorHub Virtual Studio
              </Typography>
            ))}
          </Box>
        </Paper>
      </TabPanel>
    </Box>
  );
};
