// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
} from '@mui/material';
import {
  Photo,
  Palette,
  Brightness6,
  Contrast,
  Tune,
  Refresh,
  Download,
  Share,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface HistogramData {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
  rgb: number[]; 
}

interface ImageHistogramProps {
  imageUrl?: string;
  onAnalysisComplete?: (data: any) => void;
  onImageProcessed?: (processedImage: any) => void; 
}

export default function ImageHistogram({ 
  imageUrl, 
  onAnalysisComplete, 
  onImageProcessed 
}: ImageHistogramProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [histogramData, setHistogramData] = useState<HistogramData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [histogramType, setHistogramType] = useState<'rgb' | 'luminance' | 'red' | 'green' | 'blue'>('rgb');
  const [showGrid, setShowGrid] = useState(true);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

	  // Fetch AI analysis data
	  const { data: aiAnalysis, isLoading: analysisLoading } = useQuery({
	    queryKey: ['/api/ai/photo-analysis', imageUrl],
	    queryFn: () => apiRequest(`/api/ai/photo-analysis?imageUrl=${encodeURIComponent(imageUrl || ', ')}`),
	    enabled: !!imageUrl,
	    retry: false,
	  });

  // Mutation for updating histogram analysis
	  const updateHistogramAnalysis = useMutation({
	    mutationFn: async (data: any) =>
	      apiRequest('/api/ai/photo-analysis/update', {
	        method: 'POST',
	        body: JSON.stringify(data),
	      }),
	    onSuccess: (response) => {
	      queryClient.invalidateQueries({ queryKey: ['/api/ai/photo-analysis'] });
	      onAnalysisComplete?.(response);
	    },
	  });

  // Generate histogram data from image
  const generateHistogram = async (imageElement: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;

	    // Draw image to canvas
	    ctx.drawImage(imageElement, 0, 0);

	    // Get image data
	    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Initialize histogram arrays
    const red = new Array(256).fill(0);
    const green = new Array(256).fill(0);
    const blue = new Array(256).fill(0);
    const luminance = new Array(256).fill(0);
    const rgb = new Array(256).fill(0);

    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];

      if (alpha > 0) {
        red[r]++;
        green[g]++;
        blue[b]++;
        
        // Calculate luminance (0.299*R + 0.587*G + 0.114*B)
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        luminance[lum]++;
        
        // RGB combined
        const avg = Math.round((r + g + b) / 3);
        rgb[avg]++;
    }
  }

    return { red, green, blue, luminance, rgb };
};

  // Analyze image when loaded
  const analyzeImage = async () => {
    if (!imageUrl) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      
      image.onload = async () => {
        setImageLoaded(true);
        
        // Simulate analysis progress
        const progressInterval = setInterval(() => {
          setAnalysisProgress(prev => {
            if (prev >= 100) {
              clearInterval(progressInterval);
              return 100;
          }
            return prev + 10;
        });
      }, 100);

        // Generate histogram
        const histogram = await generateHistogram(image);
        setHistogramData(histogram);

        // Send to AI analysis
        updateHistogramAnalysis.mutate({
          imageUrl,
          histogram,
          timestamp: new Date().toISOString()
      ,});

        setIsAnalyzing(false);
    };

      image.src = imageUrl;
  } catch (error) {
      console.error('Error analyzing image: ', error);
      setIsAnalyzing(false);
  }
};

	  // Draw histogram on canvas
	  const drawHistogram = () => {
	    const canvas = canvasRef.current;
	    if (!canvas || !histogramData) return;
	
	    const ctx = canvas.getContext('2d');
	    if (!ctx) return;
	
	    const width = canvas.width;
	    const height = canvas.height;
	
	    // Clear canvas
	    ctx.clearRect(0, 0, width, height);
	
	    // Set background
	    ctx.fillStyle = '#f8f9fa';
	    ctx.fillRect(0, 0, width, height);

    // Get data for selected type
    const data = histogramData[histogramType];
    const maxValue = Math.max(...data);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
      for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
  }

    // Draw histogram bars
    const barWidth = width / 256;
    ctx.lineWidth = 1;

    for (let i = 0; i < 256; i++) {
      const barHeight = (data[i] / maxValue) * height;
      const x = i * barWidth;
      const y = height - barHeight;

      // Color based on type
      if (histogramType === 'rgb') {
        ctx.fillStyle = `rgb(${i}, ${i}, ${i})`;
    } else if (histogramType === 'red') {
        ctx.fillStyle = `rgb(${i}0)`;
    } else if (histogramType === 'green') {
        ctx.fillStyle = `rgb(0, ${i}, 0)`;
    } else if (histogramType === 'blue') {
        ctx.fillStyle = `rgb(0${i})`;
    } else {
        ctx.fillStyle = `rgb(${i}, ${i}, ${i})`;
    }

      ctx.fillRect(xybarWidth, barHeight);
  }
};

  // Redraw histogram when data or type changes
  useEffect(() => {
    if (histogramData) {
      drawHistogram();
  }
}, [histogramData, histogramType, showGrid]);

  // Auto-analyze when image URL changes
  useEffect(() => {
    if (imageUrl) {
      analyzeImage();
  }
}, [imageUrl]);

  const getHistogramStats = () => {
    if (!histogramData) return null;

    const data = histogramData[histogramType];
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data.filter(v => v > 0));
    const mean = data.reduce((sum, val, idx) => sum + (val * idx), 0) / data.reduce((sum, val) => sum + val, 0);
    const median = data.findIndex(val => val > maxValue / 2);

    return { maxValue, minValue, mean: Math.round(mean), median };
};

  const stats = getHistogramStats();

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
        {theming.getThemedIcon('palette')}
        Image Histogram Analysis
      </Typography>

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Histogram Type</InputLabel>
              <Select
                value={histogramType}
                onChange={(e) => setHistogramType(e.target.value as any)}
              >
                <MenuItem value="rgb">RGB Combined</MenuItem>
                <MenuItem value="luminance">Luminance</MenuItem>
                <MenuItem value="red">Red Channel</MenuItem>
                <MenuItem value="green">Green Channel</MenuItem>
                <MenuItem value="blue">Blue Channel</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
            }
              label="Show Grid"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('refresh')}
              onClick={analyzeImage}
              disabled={!imageUrl || isAnalyzing}
              fullWidth
            >
              {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button variant="contained"
              startIcon={theming.getThemedIcon('download')}
              disabled={!histogramData}
              fullWidth
             sx={theming.getThemedButtonSx()}>
              Export Data
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="body2" sx={{ mb:  1 }}>
            Analyzing image histogram... {analysisProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={analysisProgress} />
        </Paper>
      )}

      {/* Histogram Canvas */}
      <Paper sx={{ p: 2, mb: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: '4px'
        }}
        />
        {!imageLoaded && !isAnalyzing && (
          <Typography variant="body2" color="text.secondary" sx={{ mt:  2 }}>
            No image loaded. Please provide an image URL to analyze.
          </Typography>
        )}
      </Paper>

      {/* Statistics */}
      {stats && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  {stats.maxValue.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Peak Value
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  {stats.mean}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mean Value
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  {stats.median}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Median Value
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign:'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  {histogramType.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Channel Type
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <Paper sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            AI Analysis Results
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {aiAnalysis.tags?.map((tag: string, index: number) => (
              <Chip key={index} label={tag} size="small" color="primary" />
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}