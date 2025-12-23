import * as React from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('AIModelGenerator');
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { MeshyService } from '@/services/MeshyService';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

interface AIModelGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onModelGenerated: (modelUrl: string, prompt: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const examplePrompts = [
  'En moderne trestol med armlener','Et realistisk potteplante med grønne blader','Et vintage kamera på et trestativ','En liten moderne bygning med store vinduer','En stilisert tegneseriefigur med store øyne',
];

export default function AIModelGeneratorDialog({
  open,
  onClose,
  onModelGenerated,
}: AIModelGeneratorDialogProps) {
  const [tabValue, setTabValue] = React.useState(0);
  const [prompt, setPrompt] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [artStyle, setArtStyle] = React.useState('realistic');
  const [resolution, setResolution] = React.useState('2048');
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState('');
  const [modelUrl, setModelUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [model3D, setModel3D] = React.useState<any>(null);
  const [saveToLibrary, setSaveToLibrary] = React.useState(true);
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null);

  // Generate thumbnail from 3D model
  const generateThumbnail = React.useCallback(async (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        // Create offscreen renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(256, 256);
        renderer.setClearColor(0x1a1a1a);
        
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(2, 2, 2);
        camera.lookAt(0, 0, 0);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);
        
        // Load model
        const loader = new GLTFLoader();
        loader.load(
          url,
          (gltf) => {
            scene.add(gltf.scene);
            
            // Center and scale model
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              gltf.scene.scale.multiplyScalar(1.5 / maxDim);
            }
            const center = box.getCenter(new THREE.Vector3());
            gltf.scene.position.sub(center.multiplyScalar(1.5 / maxDim));
            
            // Render
            renderer.render(scene, camera);
            const dataUrl = renderer.domElement.toDataURL('image/png');
            
            // Cleanup
            renderer.dispose();
            
            resolve(dataUrl);
          },
          undefined,
          () => {
            renderer.dispose();
            resolve(null);
          }
        );
      } catch (error) {
        log.error('Failed to generate thumbnail: ', error);
        resolve(null);
      }
    });
  }, []);
  const [assetCategory, setAssetCategory] = React.useState('prop');
  const [assetSubcategory, setAssetSubcategory] = React.useState('');
  const [assetTags, setAssetTags] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const meshyService = React.useMemo(() => new MeshyService(), []);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setStatus('Starter generering...');
    setError(null);
    setModelUrl(null);
    setModel3D(null);

    try {
      let task;
      if (tabValue === 0) {
        // Text to 3D
        if (!prompt.trim()) {
          setError('Vennligst skriv inn en beskrivelse');
          setGenerating(false);
          return;
        }
        setStatus('Genererer 3D-modell fra tekst...');
        task = await meshyService.textTo3D({
          prompt: prompt.trim(),
          art_style: artStyle,
          resolution,
          enable_pbr: true,
        });
      } else {
        // Image to 3D
        if (!imageUrl.trim()) {
          setError('Vennligst skriv inn en bilde-URL');
          setGenerating(false);
          return;
        }
        setStatus('Genererer 3D-modell fra bilde...');
        task = await meshyService.imageTo3D({
          image_url: imageUrl.trim(),
          enable_pbr: true,
        });
      }

      setStatus('Behandler... Dette kan ta 1-3 minutter');

      // Wait for completion with progress updates
      await meshyService.waitForCompletion(
        task.id,
        (progressValue) => {
          setProgress(progressValue);
          setStatus(`Behandler... ${progressValue}%`);
        },
        300000 // 5 minutes timeout
      );

      // Get final result
      const finalTask = await meshyService.getTask(task.id);
      if (finalTask.status === 'SUCCEEDED' && finalTask.model_url) {
        setModelUrl(finalTask.model_url);
        setStatus('Ferdig! Genererer miniatyrbilde...');
        setProgress(95);
        
        // Generate thumbnail
        const thumb = await generateThumbnail(finalTask.model_url);
        setThumbnailUrl(thumb);
        
        setStatus('Ferdig! Modell generert');
        setProgress(100);
        
        // Load the 3D model for preview
        loadModel(finalTask.model_url);
      } else {
        throw new Error(finalTask.error || 'Generering feilet');
      }
    } catch (err: any) {
      log.error('Generation error:', err);
      setError(err.message || 'Noe gikk galt under generering');
      setStatus('Feil');
    } finally {
      setGenerating(false);
    }
  };

  const loadModel = async (url: string) => {
    try {
      // Dynamic import of GLTFLoader
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
      const loader = new GLTFLoader();

      loader.load(
        url,
        (gltf) => {
          setModel3D(gltf.scene);
        },
        undefined,
        (error) => {
          log.error('Model load error:', error);
        }
      );
    } catch (err) {
      log.error('Failed to load model:', err);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!modelUrl) return;

    setSaving(true);
    setError(null);

    try {
      const description = tabValue === 0 ? prompt : `Generated from image: ${imageUrl}`;
      const name = description.substring(0, 50);

      const response = await fetch('/api/assets/library', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          category: assetCategory,
          subcategory: assetSubcategory || null,
          model_url: modelUrl,
          thumbnail_url: thumbnailUrl,
          tags: assetTags,
          metadata: {
            aiPrompt: tabValue === 0 ? prompt : null,
            imageUrl: tabValue === 1 ? imageUrl : null,
            artStyle: tabValue === 0 ? artStyle : null,
            resolution,
            generatedAt: new Date().toISOString(),
          },
          is_public: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save asset to library');
      }

      setStatus('Lagret i biblioteket!');
      // Auto-add to scene after saving
      handleAddToScene();
    } catch (err: any) {
      log.error('Save to library error:', err);
      setError(err.message || 'Kunne ikke lagre til biblioteket');
    } finally {
      setSaving(false);
    }
  };

  const handleAddToScene = () => {
    if (modelUrl) {
      if (saveToLibrary && !saving) {
        // Save to library first, then add to scene
        handleSaveToLibrary();
      } else {
        // Just add to scene
        onModelGenerated(modelUrl, tabValue === 0 ? prompt : imageUrl);
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setPrompt(', ');
    setImageUrl('');
    setGenerating(false);
    setProgress(0);
    setStatus('');
    setModelUrl(null);
    setError(null);
    setModel3D(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToyIcon color="primary" />
            <Typography variant="h6">AI Modellgenerator</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab icon={<TextFieldsIcon />} label="Tekst til 3D" />
          <Tab icon={<ImageIcon />} label="Bilde til 3D" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Beskrivelse"
            placeholder="Beskriv 3D-modellen du vil generere..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
            sx={{ mb: 2 }}
          />

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Kunststil</InputLabel>
              <Select
                value={artStyle}
                label="Kunststil"
                onChange={(e) => setArtStyle(e.target.value)}
                disabled={generating}
              >
                <MenuItem value="realistic">Realistisk</MenuItem>
                <MenuItem value="cartoon">Tegneserie</MenuItem>
                <MenuItem value="low-poly">Low-Poly</MenuItem>
                <MenuItem value="sculpture">Skulptur</MenuItem>
                <MenuItem value="pbr">PBR</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Oppløsning</InputLabel>
              <Select
                value={resolution}
                label="Oppløsning"
                onChange={(e) => setResolution(e.target.value)}
                disabled={generating}
              >
                <MenuItem value="1024">1024</MenuItem>
                <MenuItem value="2048">2048 (Anbefalt)</MenuItem>
                <MenuItem value="4096">4096 (Høy kvalitet)</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              <AutoAwesomeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              Eksempler:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {examplePrompts.map((example, idx) => (
                <Chip
                  key={idx}
                  label={example}
                  size="small"
                  onClick={() => setPrompt(example)}
                  disabled={generating}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TextField
            fullWidth
            label="Bilde-URL"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={generating}
            sx={{ mb: 2 }}
            helperText="Lim inn URL til et bilde du vil konvertere til 3D"
          />
        </TabPanel>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {generating && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {modelUrl && (
          <>
            {/* Save to Library Options */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={saveToLibrary}
                    onChange={(e) => setSaveToLibrary(e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SaveIcon fontSize="small" />
                    <Typography variant="body2">Lagre til bibliotek</Typography>
                  </Box>
                }
              />

              {saveToLibrary && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Kategori</InputLabel>
                    <Select
                      value={assetCategory}
                      label="Kategori"
                      onChange={(e) => setAssetCategory(e.target.value)}
                    >
                      <MenuItem value="light">Lys</MenuItem>
                      <MenuItem value="light_shaper">Lysformer</MenuItem>
                      <MenuItem value="accessory">Tilbehør</MenuItem>
                      <MenuItem value="prop">Rekvisitter</MenuItem>
                      <MenuItem value="furniture">Møbler</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    size="small"
                    label="Underkategori (valgfritt)"
                    value={assetSubcategory}
                    onChange={(e) => setAssetSubcategory(e.target.value)}
                    placeholder="f.eks. stol, plante, lampe"
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="Tags (kommaseparert)"
                    placeholder="moderne, minimalistisk, tre"
                    onChange={(e) => setAssetTags(e.target.value.split(', ').map(t => t.trim()).filter(Boolean))}
                    helperText="Legg til søkeord for å finne modellen senere"
                  />
                </Stack>
              )}
            </Box>

            {/* 3D Preview */}
            {model3D && (
              <Box
                sx={{
                  height: 300,
                  bgcolor: '#000',
                  borderRadius: 1,
                  overflow: 'hidden',
                  mb: 2}}
              >
                <Canvas>
                  <PerspectiveCamera makeDefault position={[2, 2, 2]} />
                  <OrbitControls />
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[10, 10, 5]} intensity={1} />
                  <primitive object={model3D} />
                </Canvas>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={generating || saving}>
          Avbryt
        </Button>
        {!modelUrl ? (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={generating || (tabValue === 0 ? !prompt.trim() : !imageUrl.trim())}
            startIcon={<SmartToyIcon />}
          >
            {generating ? 'Genererer...' : 'Generer 3D-modell'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleAddToScene}
            disabled={saving}
            startIcon={saveToLibrary ? <SaveIcon /> : <SmartToyIcon />}
          >
            {saving ? 'Lagrer...' : saveToLibrary ? 'Lagre og legg til i scene' : 'Legg til i scene'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

