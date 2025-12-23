/**
 * Object Extraction Panel
 * 
 * Extract objects from photos using SAM 2 for 3D scene composition
 * Objects can be segmented and placed in Virtual Studio 3D scenes
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Close,
  Image as ImageIcon,
  AutoAwesome,
  Upload,
  Delete,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { sam2Service, type SAM2SegmentationResult } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface ExtractedObject {
  id: string;
  name: string;
  mask: string; // Base64 mask
  bbox: [number, number, number, number];
  confidence: number;
  imageUrl: string;
}

interface ObjectExtractionPanelProps {
  open: boolean;
  onClose: () => void;
  onObjectsExtracted?: (objects: ExtractedObject[]) => void;
}

export function ObjectExtractionPanel({
  open,
  onClose,
  onObjectsExtracted,
}: ObjectExtractionPanelProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extractedObjects, setExtractedObjects] = useState<ExtractedObject[]>([]);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setExtractedObjects([]);
    }
  };

  const segmentImageMutation = useMutation({
    mutationFn: async (prompt?: { points?: Array<[number, number]>; box?: [number, number, number, number] }) => {
      if (!imageFile) {
        throw new Error('No image file selected');
      }
      
      setIsSegmenting(true);
      try {
        const result = await sam2Service.segmentImage(
          imageFile,
          prompt,
          prompt ? (prompt.points ? 'point' : 'box') : 'auto','small');
        
        // Convert segmentation results to extracted objects
        const objects: ExtractedObject[] = result.masks.map((mask, idx) => ({
          id: `object_${Date.now()}_${idx}`,
          name: `Object ${idx + 1}`,
          mask: mask.mask,
          bbox: mask.bbox,
          confidence: mask.confidence,
          imageUrl: imageUrl || ', ',
        }));
        
        setExtractedObjects(objects);
        return objects;
      } finally {
        setIsSegmenting(false);
      }
    },
    onSuccess: (objects) => {
      console.log(`✅ Extracted ${objects.length} object(s)`);
    },
    onError: (error: any) => {
      console.error('Object extraction failed: ', error);
    },
  });

  const handleAutoExtract = () => {
    segmentImageMutation.mutate();
  };

  const handleExtractAtPoint = (x: number, y: number) => {
    if (!imageUrl) return;
    
    // Get image dimensions
    const img = new Image();
    img.onload = () => {
      const normalizedX = (x / img.width) * (imageFile ? 1 : 1); // Adjust based on actual image size
      const normalizedY = (y / img.height) * (imageFile ? 1 : 1);
      segmentImageMutation.mutate({ points: [[normalizedX, normalizedY]] });
    };
    img.src = imageUrl;
  };

  const handleDeleteObject = (objectId: string) => {
    setExtractedObjects(prev => prev.filter(obj => obj.id !== objectId));
    if (selectedObject === objectId) {
      setSelectedObject(null);
    }
  };

  const handlePlaceInScene = () => {
    if (extractedObjects.length > 0) {
      onObjectsExtracted?.(extractedObjects);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Extract Objects for 3D Scene</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            Upload a photo and use SAM 2 to extract objects. Extracted objects can be placed in your 3D scene.
          </Alert>

          {/* Image Upload */}
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
            >
              Upload Image
            </Button>
          </Box>

          {/* Image Preview */}
          {imageUrl && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <img
                  src={imageUrl}
                  alt="Source image"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  onClick={(e) => {
                    if (!isSegmenting) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      handleExtractAtPoint(x, y);
                    }
                  }}
                  style={{ cursor: isSegmenting ? 'wait' : 'crosshair' }}
                />
                {isSegmenting && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.5)'}}
                  >
                    <CircularProgress />
                  </Box>
                )}
              </Box>
            </Paper>
          )}

          {/* Extraction Controls */}
          {imageUrl && (
            <Box>
              <Button
                variant="contained"
                startIcon={<AutoAwesome />}
                onClick={handleAutoExtract}
                disabled={isSegmenting}
                fullWidth
              >
                {isSegmenting ? 'Extracting Objects...' : 'Auto-Extract All Objects'}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Or click on an object in the image to extract it
              </Typography>
            </Box>
          )}

          {/* Extracted Objects */}
          {extractedObjects.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Extracted Objects ({extractedObjects.length})
              </Typography>
              <Grid container spacing={2}>
                {extractedObjects.map((obj) => (
                  <Grid item xs={12} sm={6} md={4} key={obj.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        border: selectedObject === obj.id ? 2 : 1,
                        borderColor: selectedObject === obj.id ? 'primary.main' : 'divider'}}
                      onClick={() => setSelectedObject(obj.id)}
                    >
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {obj.name}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteObject(obj.id);
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Chip
                          label={`${(obj.confidence * 100).toFixed(0)}% confidence`}
                          size="small"
                          color={obj.confidence > 0.8 ? 'success' : 'default'}
                        />
                        <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                          <img
                            src={`data:image/png;base64,${obj.mask}`}
                            alt={obj.name}
                            style={{ width: '100%', height: 'auto', display:'block' }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {extractedObjects.length > 0 && (
          <Button
            variant="contained"
            onClick={handlePlaceInScene}
            startIcon={<ImageIcon />}
          >
            Place {extractedObjects.length} Object(s) in Scene
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
