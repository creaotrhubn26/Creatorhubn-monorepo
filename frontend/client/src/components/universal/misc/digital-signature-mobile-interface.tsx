import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Alert, 
  CircularProgress,
  IconButton,
  Paper,
  Grid,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { 
  Edit, 
  Clear, 
  Save, 
  Download, 
  Close,
  TouchApp,
  PhoneAndroid
} from '@mui/icons-material';

interface DigitalSignatureMobileInterfaceProps {
  open: boolean;
  onClose: () => void;
  onSignatureComplete?: (signatureData: string) => void;
  documentTitle?: string;
  signerName?: string;
  signerEmail?: string
}

export default function DigitalSignatureMobileInterface({ 
  open, 
  onClose, 
  onSignatureComplete,
  documentTitle = "Mobile Signature",
  signerName = "",
  signerEmail = ""
}: DigitalSignatureMobileInterfaceProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [touchPoints, setTouchPoints] = useState<Array<{x: number, y: number}>>([]);

  // Save signature mutation
  const saveSignature = useMutation({
    mutationFn: async (signatureData: { 
      signature: string; 
      documentTitle: string; 
      signerName: string; 
      signerEmail: string;
      timestamp: string;
      deviceType: string;
    }) => {
      return apiRequest('/api/signatures/save-mobile', {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify(signatureData)
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signatures", ],});
      onSignatureComplete?.(data.signature);
      onClose();
      setError('');
  },
    onError: (error: any) => {
      setError(error.message || 'Failed to save signature');
}
});

  const getTouchPoint = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y:  0 };

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
};
}, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasSignature(true);
    setError('');

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let point;
    if ('touches' in e) {
      point = getTouchPoint(e);
} else {
      const rect = canvas.getBoundingClientRect();
      point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
  };
  }

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setTouchPoints([point]);
}, [getTouchPoint]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let point;
    if ('touches' in e) {
      point = getTouchPoint(e);
} else {
      const rect = canvas.getBoundingClientRect();
      point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
  };
  }

    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);

    setTouchPoints(prev => [...prev, point]);
}, [isDrawing, isMobile, getTouchPoint]);

  const stopDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
}, []);

  const clearSignature = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setTouchPoints([]);
}, []);

  const saveSignatureData = useCallback(async () => {
    if (!canvasRef.current || !hasSignature) return;

    setIsSaving(true);
    setError('');

    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      
      await saveSignature.mutateAsync({
        signature: signatureData,
        documentTitle,
        signerName: signerName || user?.name || '',
        signerEmail: signerEmail || user?.email || '',
        timestamp: new Date().toISOString(),
        deviceType: isMobile ? 'mobile' : 'tablet'
  });
  } catch (error) {
      // Error is handled in onError callback
  } finally {
      setIsSaving(false);
  }
}, [hasSignature, documentTitle, signerName, signerEmail, user, saveSignature, isMobile]);

  const downloadSignature = useCallback(() => {
    if (!canvasRef.current || !hasSignature) return;

    const link = document.createElement('a');
    link.download = `mobile-signature-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
}, [hasSignature]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on device
    const width = isMobile ? window.innerWidth - 40 : 600;
    const height = isMobile ? 250 : 200;
    
    canvas.width = width;
    canvas.height = height;

    // Set drawing properties
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.lineCap = 'round';
}, [open, isMobile]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: isMobile ? 1 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <PhoneAndroid color="primary" />
          <Typography variant={isMobile ? "h6" : "h5"}>
            Mobile Signature - {documentTitle}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          {theming.getThemedIcon('close')}
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: isMobile ? 2 : 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Alert 
              severity="info" 
              sx={{ mb:  2 }}
              icon={theming.getThemedIcon('touch')}
            >
              {isMobile 
                ? "Touch and drag to sign below. Your signature will be legally binding." : "Use your finger or stylus to sign below. Your signature will be legally binding."
            }
            </Alert>
          </Grid>
          
          <Grid item xs={12}>
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ p: isMobile ? 1 : 2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" gutterBottom>
                  Signature Pad
                </Typography>
                <Paper 
                  elevation={1}
                  sx={{ 
                    border: '2px dashed #ccc',
                    borderRadius:  1,
                    p:  1,
                    backgroundColor: '#fafafa',
                    touchAction: 'none' // Prevent scrolling on touch
              }}
                 sx={theming.getThemedCardSx()}>
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      cursor: 'crosshair',
                      width: '100%',
                      height: isMobile ? '250px' : '200px',
                      border: 'none',
                      touchAction: 'none'
                }}
                  />
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Alert severity="error">
                {error}
              </Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box sx={{ 
              display: 'flex', 
              gap: 1, flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-start'
        }}>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('clear')}
                onClick={clearSignature}
                disabled={!hasSignature || isSaving}
                size={isMobile ? "small" : "medium"}
              >
                Clear
              </Button>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('download')}
                onClick={downloadSignature}
                disabled={!hasSignature || isSaving}
                size={isMobile ? "small" : "medium"}
              >
                Download
              </Button>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ p: isMobile ? 2 : 3 }}>
        <Button 
          onClick={onClose}
          disabled={isSaving}
          size={isMobile ? "large" : "medium"}
        >
          Cancel
        </Button>
        <Button variant="contained"
          startIcon={isSaving ? <CircularProgress size={20} sx={theming.getThemedButtonSx()} /> : theming.getThemedIcon('save')}
          onClick={saveSignatureData}
          disabled={!hasSignature || isSaving}
          size={isMobile ? "large" : "medium"}
        >
          {isSaving ? 'Saving...' : 'Save Signature'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
