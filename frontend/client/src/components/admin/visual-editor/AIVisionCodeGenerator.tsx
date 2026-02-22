/**
 * AI VISION CODE GENERATOR
 * Upload designs/screenshots → Generate React code
 *
 * Features: * - Image upload and preview
 * - AI Vision analysis (scene, objects, composition)
 * - GPT-4 Vision API code generation
 * - Visual debugging suggestions
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardMedia,
  Grid,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  LinearProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  PhotoCamera,
  Code,
  AutoAwesome,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { AIVisionService, PhotoAnalysis } from '@/services/ai-vision-service';

interface AIVisionCodeGeneratorProps {
  open: boolean;
  onClose: () => void;
  onCodeGenerated: (code: string) => void;
}

export default function AIVisionCodeGenerator({
  open,
  onClose,
  onCodeGenerated,
}: AIVisionCodeGeneratorProps) {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<
    'gpt-4-vision' | 'claude-4.5-sonnet' | 'gpt-5-nano'
  >('gpt-4-vision');

  /**
   * Handle image upload
   */
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setError(null);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);

    // Analyze with AI Vision
    setAnalyzing(true);
    try {
      const img = await loadImage(URL.createObjectURL(file));
      const result = await AIVisionService.analyzePhoto(img, {
        includeComposition: true,
        includeQuality: true,
      });
      setAnalysis(result);
    } catch (err) {
      console.error('Analysis failed: ', err);
      setError('Image analysis failed. The image will still be sent to GPT-4 Vision.');
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Generate code using selected AI model
   */
  const handleGenerateCode = async () => {
    if (!image) return;

    setGenerating(true);
    setError(null);

    try {
      // Build prompt
      let prompt = 'Analyze this UI design and generate React TypeScript code.\n\n';

      if (analysis) {
        prompt += `Visual Analysis:\n`;
        prompt += `- Scene: ${analysis.scene.type} (${analysis.scene.lighting} lighting)\n`;
        prompt += `- Layout: ${analysis.composition.ruleOfThirds ? 'Rule of thirds (balanced)' : 'Centered'}\n`;
        prompt += `- Detected elements: ${analysis.objects.map((o) => o.label).join(', ')}\n`;
        prompt += `- Quality: Sharpness ${Math.round(analysis.quality.sharpness * 100)}%\n\n`;
      }

      prompt += `Generate:\n`;
      prompt += `1. Functional React component (TypeScript)\n`;
      prompt += `2. Material-UI styled components\n`;
      prompt += `3. Responsive layout (flexbox/grid)\n`;
      prompt += `4. Proper TypeScript types\n`;
      prompt += `5. Component hierarchy matching the design\n`;
      prompt += `6. CSS-in-JS or sx prop styling\n\n`;
      prompt += `Return ONLY the code, no explanations.`;

      let code: string;

      // Route to appropriate API based on selected model
      if (selectedModel === 'claude-4.5-sonnet') {
        code = await callClaudeVision(prompt, image);
      } else if (selectedModel === 'gpt-5-nano') {
        code = await callGPT5Nano(prompt, image);
      } else {
        code = await callGPT4Vision(prompt, image);
      }

      // Extract code from markdown if present
      const codeMatch = code.match(/``, `(?:typescript|tsx|jsx)?\n([\s\S]*?)```/);
      const extractedCode = codeMatch ? codeMatch[1] : code;

      onCodeGenerated(extractedCode);
      onClose();
    } catch (err) {
      console.error('Code generation failed: ', err);
      setError(err instanceof Error ? err.message : 'Code generation failed');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Call GPT-4 Vision API
   */
  const callGPT4Vision = async (prompt: string, imageData: string): Promise<string> => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.REACT_APP_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.7 }),
    });

    if (!response.ok) {
      throw new Error(`GPT-4 Vision API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  /**
   * Call GPT-5 Nano with vision (via GPT-4o for now)
   */
  const callGPT5Nano = async (prompt: string, imageData: string): Promise<string> => {
    // GPT-5 Nano doesn't have vision yet, use GPT-4o as fallback
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.REACT_APP_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use GPT-4o for vision capabilities
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.7 }),
    });

    if (!response.ok) {
      throw new Error(`GPT-4o API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  /**
   * Call Claude 4.5 Sonnet Vision API
   */
  const callClaudeVision = async (prompt: string, imageData: string): Promise<string> => {
    // Convert base64 to proper format for Claude
    const base64Data = imageData.split(', ')[1];
    const mediaType = imageData.split(';')[0].split(':')[1];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json','x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY ||
          import.meta.env.REACT_APP_ANTHROPIC_API_KEY || '', 'anthropic-version' : '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude Vision API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  };

  /**
   * Reset state
   */
  const handleReset = () => {
    setImage(null);
    setImageFile(null);
    setAnalysis(null);
    setError(null);
  };

  /**
   * Load image helper
   */
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  /**
   * Get quality indicator color
   */
  const getQualityColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 0.7) return 'success';
    if (score >= 0.4) return 'warning';
    return 'error';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <PhotoCamera />
            AI Vision Code Generator
          </Box>

          {/* AI Model Selector */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>AI Model</InputLabel>
            <Select
              value={selectedModel}
              label="AI Model"
              onChange={(e) => setSelectedModel(e.target.value as 'gpt-4-vision' | 'claude-4.5-sonnet' | 'gpt-5-nano')}
            >
              <MenuItem value="gpt-4-vision">
                <Box display="flex" alignItems="center" gap={1}>
                  GPT-4 Vision
                  <Chip label="OpenAI" size="small" color="primary" />
                </Box>
              </MenuItem>
              <MenuItem value="gpt-5-nano">
                <Box display="flex" alignItems="center" gap={1}>
                  GPT-5 Nano (4o)
                  <Chip label="Latest" size="small" color="success" />
                </Box>
              </MenuItem>
              <MenuItem value="claude-4.5-sonnet">
                <Box display="flex" alignItems="center" gap={1}>
                  Claude 4.5 Sonnet
                  <Chip label="Anthropic" size="small" color="secondary" />
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogTitle>

      <DialogContent>
        {analyzing && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Analyzing image with AI Vision...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Left: Image Upload */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              {image ? (
                <>
                  <CardMedia
                    component="img"
                    image={image}
                    alt="Uploaded design"
                    sx={{
                      maxHeight: 500,
                      objectFit: 'contain',
                      bgcolor: '#f5f5f5'}} />
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Button size="small" onClick={handleReset} variant="outlined">
                      Upload Different Image
                    </Button>
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    height: 500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f5f5f5',
                    border: '2px dashed #ccc',
                    borderRadius: 1,
                    p: 3,
                    textAlign: 'center'}}>
                  <PhotoCamera sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Upload UI Design
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Upload a screenshot, mockup, or design file to generate React code
                  </Typography>
                  <Button component="label" variant="contained" startIcon={<PhotoCamera />}>
                    Choose Image
                    <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                    Supported: PNG, JPG, SVG, WebP
                  </Typography>
                </Box>
              )}
            </Card>
          </Grid>

          {/* Right: Analysis Results */}
          <Grid item xs={12} md={6}>
            {!image && !analysis && (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  p: 3}}>
                <Box>
                  <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Upload an image to see AI analysis
                  </Typography>
                </Box>
              </Box>
            )}

            {analysis && (
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesome color="primary" />
                  Visual Analysis
                </Typography>

                {/* Scene Info */}
                <Card sx={{ p: 2, bgcolor: '#f9f9f9' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Scene Detection
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip label={analysis.scene.type} size="small" color="primary" />
                    <Chip label={analysis.scene.lighting} size="small" />
                    {analysis.scene.hasPeople && (
                      <Chip label="Has People" size="small" color="secondary" />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {Math.round(analysis.scene.confidence * 100)}%
                  </Typography>
                </Card>

                {/* Detected Objects */}
                <Card sx={{ p: 2, bgcolor: '#f9f9f9' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Detected UI Elements
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                    {analysis.objects.slice(0, 12).map((obj, idx) => (
                      <Chip
                        key={idx}
                        label={`${obj.label} (${Math.round(obj.confidence * 100)}%)`}
                        size="small"
                        variant="outlined"
                        sx={{ mb: 1 }} />
                    ))}
                  </Stack>
                  {analysis.objects.length > 12 && (
                    <Typography variant="caption" color="text.secondary">
                      +{analysis.objects.length - 12} more elements
                    </Typography>
                  )}
                </Card>

                {/* Composition */}
                <Card sx={{ p: 2, bgcolor: '#f9f9f9' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Composition Analysis
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {analysis.composition.ruleOfThirds ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : (
                        <Warning color="warning" fontSize="small" />
                      )}
                      <Typography variant="body2">
                        Rule of thirds: {analysis.composition.ruleOfThirds ? 'Yes' : 'No'}
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      Symmetry: {Math.round(analysis.composition.symmetry * 100)}%
                    </Typography>
                    <Typography variant="body2">
                      Depth: {Math.round(analysis.composition.depth * 100)}%
                    </Typography>
                  </Stack>
                </Card>

                {/* Quality */}
                <Card sx={{ p: 2, bgcolor: '#f9f9f9' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Image Quality
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Sharpness
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={analysis.quality.sharpness * 100}
                        color={getQualityColor(analysis.quality.sharpness)}
                        sx={{ height: 6, borderRadius: 1, mt: 0.5 }} />
                    </Box>
                    <Typography variant="body2">
                      Exposure: {analysis.quality.exposure > 0 ? '+' : ','}
                      {Math.round(analysis.quality.exposure * 100)}%
                    </Typography>
                    <Chip
                      label={`Color: ${analysis.quality.colorBalance}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Card>

                {/* Suggestions */}
                {analysis.suggestions.length > 0 && (
                  <Card sx={{ p: 2, bgcolor: '#fff3e0' }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                      AI Suggestions
                    </Typography>
                    <Stack spacing={0.5}>
                      {analysis.suggestions.map((suggestion, idx) => (
                        <Typography key={idx} variant="body2" sx={{ pl: 2 }}>
                          • {suggestion}
                        </Typography>
                      ))}
                    </Stack>
                  </Card>
                )}

                <Divider />

                <Alert severity="success" icon={<Code />}>
                  Ready to generate React code from this design!
                </Alert>
              </Stack>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleGenerateCode}
          disabled={!image || generating}
          startIcon={generating ? <CircularProgress size={20} /> : <Code />}
        >
          {generating
            ? `Generating with ${selectedModel === 'claude-4.5-sonnet' ? 'Claude' : selectedModel === 'gpt-5-nano' ? 'GPT-5 Nano' : 'GPT-4 Vision'}...`
            : `Generate Code (${selectedModel === 'claude-4.5-sonnet' ? 'Claude' : selectedModel === 'gpt-5-nano' ? 'GPT-5 Nano' : 'GPT-4 Vision'})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
