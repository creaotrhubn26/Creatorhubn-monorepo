import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Card as MuiCard,
  CardContent,
  Divider,
} from '@mui/material';
import {
  AutoFixHigh,
  CompareArrows,
  ContentCopy,
  CheckCircle,
  Psychology,
  TuneRounded,
  SpellcheckRounded,
} from '@mui/icons-material';

interface QuillBotEnhancerProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  onTextEnhanced: (enhancedText: string) => void;
  profession: string
}

export function QuillBotEnhancer({ 
  open, 
  onClose, 
  originalText, 
  onTextEnhanced, 
  profession 
}: QuillBotEnhancerProps) {
  const [enhancementType, setEnhancementType] = useState<string>('professional');
  const [enhancedText, setEnhancedText] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementStats, setEnhancementStats] = useState({
    wordsChanged:  0,
    readabilityScore:  0,
    originalLength:  0,
    enhancedLength: 0 });

  // Mock data removed - using database connection

  const handleEnhance = async () => {
    if (!originalText.trim()) return;
    
    setIsEnhancing(true);
    
    try {
      const response = await fetch('/api/meeting-notes/enhance-text', {
        headers: {
          ...auth'Content-Type' : 'application/json'
      },
        method: 'POS',
        body: JSON.stringify({
          text: originalText,
          enhancementType,
          profession,
          targetAudience: 'client'
    })
    });
      
      const data = await response.json();
      if (data.success) {
        setEnhancedText(data.enhancedText);
        setEnhancementStats({
          wordsChanged: Math.abs(data.wordsChanged || 0),
          readabilityScore: data.readabilityScore || 75,
          originalLength: originalText.length,
          enhancedLength: data.enhancedText.length
    });
    }
  } catch (error) {
      console.error('Enhancement failed: ', error);
  } finally {
      setIsEnhancing(false);
  }
};

  const handleAcceptEnhancement = () => {
    if (enhancedText) {
      onTextEnhanced(enhancedText);
      onClose();
  }
};

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

  return (
    <Dialog 
      open={open}
      onClose={onClose}
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '80vh',
          borderRadius:  2,
          background: 'linear-gradient(135deg, rgba(25,118,210,0.05) 0%, rgba(1, 5, 6,39,176,0.05) 100%)'
      }
    }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <AutoFixHigh color="primary" />
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            Intelligent Tekstforbedring (QuillBot-stil)
          </Typography>
          <Chip 
            label={profession}
            color="secondary" 
            variant="outlined" 
            size="small"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Enhancement Options */}
          <Grid size={{ xs: 12 }} md={4}>
            <Paper elevation={1} sx={{ p: 2, height: 'fit-content' ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                <TuneRounded sx={{ mr: 1, verticalAlign: 'middle' }} />
                Forbedringsstil
              </Typography>
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Velg stil</InputLabel>
                <Select
                  value={enhancementType}
                  onChange={(e) => setEnhancementType(e.target.value)}
                  label="Velg stil"
                >
                  {enhancementOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box>
                        <Typography variant="body1">{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button fullWidth
                variant="contained"
                onClick={handleEnhance}
                disabled={isEnhancing || !originalText.trim()}
                startIcon={<Psychology />}
                sx={{ mt:  2 }}
              >
                {isEnhancing ? 'Forbedrer...' : 'Forbedre Tekst'}
              </Button>

              {/* Enhancement Stats */}
              {enhancedText && (
                <MuiCard sx={{ mt:  2 }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      <SpellcheckRounded sx={{ mr: 1, fontSize: '1rem' }} />
                      Statistikk
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption">Ord endret: </Typography>
                        <Chip label={enhancementStats.wordsChanged} size="small" />
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption">Lesbarhet: </Typography>
                        <Chip 
                          label={`${enhancementStats.readabilityScore}/100`}
                          size="small" 
                          color={enhancementStats.readabilityScore > 80 ? 'success' : 'warning'}
                        />
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption">Lengde: </Typography>
                        <Typography variant="caption">
                          {enhancementStats.originalLength} → {enhancementStats.enhancedLength}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </MuiCard>
              )}
            </Paper>
          </Grid>

          {/* Text Comparison */}
          <Grid size={{ xs: 12 }} md={8}>
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CompareArrows color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Sammenligning
                </Typography>
              </Box>

              {isEnhancing && (
                <Box sx={{ mb:  2 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary" align="center" display="block" mt={1}>
                    Intelligent arbeider med tekstforbedring...
                  </Typography>
                </Box>
              )}

              <Grid container spacing={2}>
                {/* Original Text */}
                <Grid size={{ xs: 12 }} md={6}>
                  <Paper elevation={1} sx={{ p: 2, height: '400px' ,  ...theming.getThemedCardSx() }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1" color="text.secondary">
                        Original Tekst
                      </Typography>
                      <Button
                        size="small"
                        startIcon={theming.getThemedIcon('contentCopy')}
                        onClick={() => copyToClipboard(originalText)}
                      >
                        Kopier
                      </Button>
                    </Box>
                    <Divider sx={{ mb:  2 }} />
                    <TextField
                      multiline
                      fullWidth
                      rows={12}
                      value={originalText}
                      variant="outlined"
                      InputProps={{ readOnly: true }}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '13px',
                          backgroundColor: 'rgba(0,0,0,0.02)'
                      }
                    }}
                    />
                  </Paper>
                </Grid>

                {/* Enhanced Text */}
                <Grid size={{ xs: 12 }} md={6}>
                  <Paper elevation={1} sx={{ p: 2, height: '400px' ,  ...theming.getThemedCardSx() }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1" color="primary">
                        Forbedret Tekst
                      </Typography>
                      <Button
                        size="small"
                        startIcon={theming.getThemedIcon('contentCopy')}
                        onClick={() => copyToClipboard(enhancedText)}
                        disabled={!enhancedText}
                      >
                        Kopier
                      </Button>
                    </Box>
                    <Divider sx={{ mb:  2 }} />
                    {enhancedText ? (
                      <TextField
                        multiline
                        fullWidth
                        rows={12}
                        value={enhancedText}
                        variant="outlined"
                        InputProps={{ readOnly: true }}
                        sx={{
                          '& .MuiInputBase-root': {
                            fontSize: '13px',
                            backgroundColor: 'rgba(5,118,210,0.05)',
                            border: '2px solid',
                            borderColor:'primary.200'
                      }
                      }}
                      />
                    ) : (
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        justifyContent="center" 
                        height="300px"
                        bgcolor="rgba(0,0,0,0.02)"
                        borderRadius={1}
                      >
                        <Typography variant="body2" color="text.secondary" align="center">
                          Forbedret tekst vil vises her<br/>
                          Klikk"Forbedre Tekst" for å starte
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p:  3, gap:  1 }}>
        <Button onClick={onClose} variant="outlined">
          Avbryt
        </Button>
        <Button variant="contained"
          onClick={handleAcceptEnhancement}
          disabled={!enhancedText}
          startIcon={theming.getThemedIcon('checkCircle')}
          color="primary"
         sx={theming.getThemedButtonSx()}>
          Bruk Forbedret Tekst
        </Button>
      </DialogActions>
    </Dialog>
  );
}