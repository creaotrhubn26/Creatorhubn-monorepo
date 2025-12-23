import * as React from 'react';
import { Box, Divider, Grid, Slider, Stack, TextField, Typography, Button, Tooltip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useActions, useScene } from '@/state/selectors';
import { colors, spacing, shadows } from '@/styles/designTokens';
import { NumberInput } from '@/ui/components/NumberInput';
import { EnhancedTextField } from '@/ui/components/EnhancedTextField';

export default function RightInspector() {
  const scene = useScene();
  const { updateNode, deleteNode } = useActions();
  const id = scene.selection[0];
  const node = scene.nodes.find((n) => n.id === id);
  if (!node)
    return (
      <Box sx={{ p: spacing.md, bgcolor: colors.background.panel, color: colors.text.primary, height: '100%' }}>
        <Typography color={colors.text.disabled} fontSize={13}>No object selected.</Typography>
      </Box>
    );

  const setNum = (k: 'x' | 'y' | 'z', v: number) => {
    const [x, y, z] = node.transform.position;
    const next = k === 'x' ? [v, y, z] : k === 'y' ? [x, v, z] : [x, y, v];
    updateNode(node.id, { transform: { ...node.transform, position: next as any } });
  };

  return (
    <Box sx={{ p: spacing.md, bgcolor: colors.background.panel, color: colors.text.primary, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Selection Panel */}
      <Box sx={{ mb: 3 }}>
        <Typography fontWeight={600} fontSize={14} color={colors.text.primary} gutterBottom>
          Selection
        </Typography>
        <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 2 }}>
          {node.name || `${node.type} (${node.id.slice(0, 8)})`}
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
            Position
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={4}>
              <NumberInput
                value={node.transform.position[0]}
                onChange={(v) => setNum('x', v)}
                size="small"
                step={0.1}
                precision={2}
              />
            </Grid>
            <Grid item xs={4}>
              <NumberInput
                value={node.transform.position[1]}
                onChange={(v) => setNum('y', v)}
                size="small"
                step={0.1}
                precision={2}
              />
            </Grid>
            <Grid item xs={4}>
              <NumberInput
                value={node.transform.position[2]}
                onChange={(v) => setNum('z', v)}
                size="small"
                step={0.1}
                precision={2}
              />
            </Grid>
          </Grid>
        </Box>
        
        <Box>
          <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
            Rotation
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={4}>
              <NumberInput
                value={node.transform.rotation[0]}
                onChange={(v) => {
                  const [x, y, z] = node.transform.rotation;
                  updateNode(node.id, { transform: { ...node.transform, rotation: [v, y, z] as any } });
                }}
                size="small"
                step={0.1}
                precision={2}
              />
            </Grid>
            <Grid item xs={4}>
              <NumberInput
                value={node.transform.rotation[1]}
                onChange={(v) => {
                  const [x, y, z] = node.transform.rotation;
                  updateNode(node.id, { transform: { ...node.transform, rotation: [x, v, z] as any } });
                }}
                size="small"
                step={0.1}
                precision={2}
              />
            </Grid>
            <Grid item xs={4}>
              <NumberInput
                value={node.transform.rotation[2]}
                onChange={(v) => {
                  const [x, y, z] = node.transform.rotation;
                  updateNode(node.id, { transform: { ...node.transform, rotation: [x, y, v] as any } });
                }}
                size="small"
                step={0.1}
                precision={2}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>
      
      <Divider sx={{ borderColor: colors.border.divider, my: 2 }} />
      
      {/* Camera Panel */}
      {node.camera && (
        <Box>
          <Typography fontWeight={600} fontSize={14} color={colors.text.primary} gutterBottom>
            Camera
          </Typography>

      {node.light && (
        <Box sx={{ mb: 3 }}>
          <Typography fontWeight={600} fontSize={14} color={colors.text.primary} gutterBottom>
            Light Settings
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                CCT
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  defaultValue="Tungsten"
                  sx={{
                    bgcolor: colors.background.card,
                    color: colors.text.primary,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.default },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.hover },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.focus },
                    '& .MuiSvgIcon-root': { color: colors.text.primary }
                  }}
                >
                  <MenuItem value="Tungsten">Tungsten</MenuItem>
                  <MenuItem value="Daylight">Daylight</MenuItem>
                  <MenuItem value="Cool">Cool</MenuItem>
                  <MenuItem value="Warm">Warm</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                Modifier
              </Typography>
              <EnhancedTextField
                size="small"
                value={node.light.modifier || 'Softbox'}
                fullWidth
              />
            </Box>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                Size
              </Typography>
              <Slider
                size="small"
                value={node.light.power * 100}
                min={0}
                max={100}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                onChange={(_, v) =>
                  updateNode(node.id, { light: { ...node.light!, power: (v as number) / 100 } })
                }
                sx={{
                  '& .MuiSlider-thumb': { color: colors.text.primary },
                  '& .MuiSlider-track': { color: colors.primary },
                  '& .MuiSlider-rail': { color: colors.border.default }
                }}
              />
            </Box>
          </Stack>
        </Box>
      )}

          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                Aperture
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={node.camera.aperture}
                  onChange={(e) =>
                    updateNode(node.id, {
                      camera: { ...node.camera!, aperture: parseFloat(e.target.value as string || '2.8') },
                    })
                  }
                  sx={{
                    bgcolor: colors.background.card,
                    color: colors.text.primary,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.default },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.hover },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.border.focus },
                    '& .MuiSvgIcon-root': { color: colors.text.primary }
                  }}
                >
                  <MenuItem value={1.4}>f/1.4</MenuItem>
                  <MenuItem value={2.0}>f/2.0</MenuItem>
                  <MenuItem value={2.8}>f/2.8</MenuItem>
                  <MenuItem value={4.0}>f/4.0</MenuItem>
                  <MenuItem value={5.6}>f/5.6</MenuItem>
                  <MenuItem value={8.0}>f/8.0</MenuItem>
                  <MenuItem value={11}>f/11</MenuItem>
                  <MenuItem value={16}>f/16</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                Shutter
              </Typography>
              <Slider
                size="small"
                value={1/node.camera.shutter}
                min={30}
                max={8000}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `1/${value}s`}
                onChange={(_, v) =>
                  updateNode(node.id, {
                    camera: { ...node.camera!, shutter: 1/(v as number) },
                  })
                }
                sx={{
                  '& .MuiSlider-thumb': { color: colors.text.primary },
                  '& .MuiSlider-track': { color: colors.primary },
                  '& .MuiSlider-rail': { color: colors.border.default }
                }}
              />
            </Box>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                ISO
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={node.camera.iso === 100 ? 'contained' : 'outlined'}
                  onClick={() => updateNode(node.id, { camera: { ...node.camera!, iso: 100 } })}
                  sx={{
                    flex: 1,
                    bgcolor: node.camera.iso === 100 ? colors.text.primary : 'transparent',
                    color: node.camera.iso === 100 ? colors.background.base : colors.text.primary,
                    borderColor: colors.border.default,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: node.camera.iso === 100 ? colors.text.secondary : colors.background.elevated,
                      borderColor: colors.border.hover,
                      transform: 'translateY(-1px)',
                      boxShadow: shadows.md
                    },
                    '&:active': {
                      transform: 'translateY(0)'
                    }
                  }}
                >
                  100
                </Button>
                <Button
                  size="small"
                  variant={node.camera.iso === 200 ? 'contained' : 'outlined'}
                  onClick={() => updateNode(node.id, { camera: { ...node.camera!, iso: 200 } })}
                  sx={{
                    flex: 1,
                    bgcolor: node.camera.iso === 200 ? colors.text.primary : 'transparent',
                    color: node.camera.iso === 200 ? colors.background.base : colors.text.primary,
                    borderColor: colors.border.default,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: node.camera.iso === 200 ? colors.text.secondary : colors.background.elevated,
                      borderColor: colors.border.hover,
                      transform: 'translateY(-1px)',
                      boxShadow: shadows.md
                    },
                    '&:active': {
                      transform: 'translateY(0)'
                    }
                  }}
                >
                  200
                </Button>
                <Button
                  size="small"
                  variant={node.camera.iso === 400 ? 'contained' : 'outlined'}
                  onClick={() => updateNode(node.id, { camera: { ...node.camera!, iso: 400 } })}
                  sx={{
                    flex: 1,
                    bgcolor: node.camera.iso === 400 ? colors.text.primary : 'transparent',
                    color: node.camera.iso === 400 ? colors.background.base : colors.text.primary,
                    borderColor: colors.border.default,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: node.camera.iso === 400 ? colors.text.secondary : colors.background.elevated,
                      borderColor: colors.border.hover,
                      transform: 'translateY(-1px)',
                      boxShadow: shadows.md
                    },
                    '&:active': {
                      transform: 'translateY(0)'
                    }
                  }}
                >
                  400
                </Button>
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" color={colors.text.disabled} fontSize={11} sx={{ display: 'block', mb: 0.5 }}>
                ND
              </Typography>
              <Slider
                size="small"
                value={0}
                min={0}
                max={10}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} stops`}
                sx={{
                  '& .MuiSlider-thumb': { color: colors.text.primary },
                  '& .MuiSlider-track': { color: colors.primary },
                  '& .MuiSlider-rail': { color: colors.border.default }
                }}
              />
            </Box>
          </Stack>
        </Box>
      )}

    </Box>
  );
}
