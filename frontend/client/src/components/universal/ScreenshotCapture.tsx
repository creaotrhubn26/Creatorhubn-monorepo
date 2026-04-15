// @ts-nocheck
/**
 * Screenshot Capture Tool - Innebygd skjermbildeverktøy
 * Bruker Screen Capture API for å ta skjermbilder direkte i browseren
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  Screenshot as ScreenshotIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Refresh as RetakeIcon,
  Monitor as ScreenIcon,
  Tab as TabIcon,
  CropFree as SelectIcon,
  AutoAwesome as SmartIcon,
  Visibility as DetectionIcon,
  Code as CodeIcon,
  BugReport as BugIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
// Import Tesseract dynamically
const Tesseract = await import('tesseract.js');

interface ScreenshotCaptureProps {
  open: boolean;
  onClose: () => void;
  onScreenshotTaken: (file: File) => void;
  maxWidth?: number;
  maxHeight?: number
}

interface CodeError {
  type: 'syntax' | 'logic' | 'import' | 'type' | 'security' | 'performance';
  line?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  fix?: string
}

interface DetectedContent {
  text: string;
  keywords: string[];
  category: string;
  confidence: number;
  codeErrors?: CodeError[];
  hasCode?: boolean
}

interface BrowserContext {
  title: string;
  url: string;
  domain: string;
  timestamp: string
}

export const ScreenshotCapture: React.FC<ScreenshotCaptureProps> = ({
  open,
  onClose,
  onScreenshotTaken,
  maxWidth = 1920,
  maxHeight = 1080 }) => {
  const [capturing, setCapturing] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer,');
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureStep, setCaptureStep] = useState<'select' | 'capture' | 'preview'>('select');
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedContent, setDetectedContent] = useState<DetectedContent | null>(null);
  const [smartFilename, setSmartFilename] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if Screen Capture API is supported
  const isSupported = Boolean(navigator.mediaDevices?.getDisplayMedia);

  // 🧠 Intelligent Content Analysis Functions
  
  // 💻 Advanced Code Error Detection Engine
  const detectCodeErrors = useCallback((text: string): CodeError[] => {
    const errors: CodeError[] = [];
    const lines = text.split('\n,');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//, ') || trimmedLine.startsWith('/*')) return;
      
      // 🔍 SYNTAX ERRORS
      
      // Missing semicolons (JavaScript/TypeScript)
      if (/^\s*(const|let|var|return|throw|break|continue)\s+.*[^;{}]\s*$/.test(trimmedLine) && 
          !trimmedLine.includes('//') && !trimmedLine.endsWith('{')) {
        errors.push({
          type: 'syntax',
          line: lineNm,
          message: 'Manglende semikolon',
          severity: 'warning',
          fix: 'Legg til ; på slutten av linjen'
    });
    }
      
      // Unmatched brackets
      const openBrackets = (trimmedLine.match(/[{[(]/g) || []).length;
      const closeBrackets = (trimmedLine.match(/[}\])]/g) || []).length;
      if (openBrackets !== closeBrackets && !trimmedLine.includes('//')) {
        errors.push({
          type: 'syntax',
          line: lineNm,
          message: 'Ubalanserte paranteser/krøllparanteser',
          severity: 'error',
          fix: 'Sjekk at alle åpne paranteser har tilsvarende lukkede paranteser'
    });
    }
      
      // Missing quotes
      const singleQuotes = (trimmedLine.match(/'/g) || []).length;
      const doubleQuotes = (trimmedLine.match(/"/g) || []).length;
      const backticks = (trimmedLine.match(/`/g) || []).length;
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
        errors.push({
          type: 'syntax',
          line: lineNm,
          message: 'Ubalanserte anførselstegn',
          severity: 'error',
          fix: 'Sjekk at alle strings har matchende anførselstegn'
    });
    }
      
      // 🔍 LOGIC ERRORS
      
      // Infinite loops
      if (/while\s*\(\s*true\s*\)/.test(trimmedLine) && !trimmedLine.includes('break')) {
        errors.push({
          type: 'logic',
          line: lineNm,
          message: 'Mulig uendelig løkke',
          severity: 'warning',
          fix: 'Legg til en break-betingelse eller endre løkke-betingelsen'
    });
    }
      
      // Assignment vs comparison
      if (/if\s*\([^)]*=\s*[^=]/.test(trimmedLine)) {
        errors.push({
          type: 'logic',
          line: lineNm,
          message: 'Mulig, feil: assignment (=) i stedet for sammenligning (===, )',
          severity: 'warning',
          fix: 'Bruk === for sammenligning eller == hvis du vil ha type coercion'
    });
    }
      
      // 🔍 IMPORT ERRORS
      
      // Missing import statements
      if (/\b(React|useState|useEffect|Component)\b/.test(trimmedLine) && 
          !text.includes("import") && !text.includes("from 'react', ")) {
        errors.push({
          type: 'import',
          line: lineNm,
          message: 'Manglende React import',
          severity: 'error',
          fix: "Legg, til: import React, { useState, useEffect } from 'react';"
      });
    }
      
      // Unused imports (simplified detection)
      if (/^import.*from/.test(trimmedLine)) {
        const importMatch = trimmedLine.match(/import\s+[{]?([^}]+)[}]?\s+from/);
        if (importMatch) {
          const imports = importMatch[1].split('').map(i => i.trim());
          imports.forEach(imp => {
            if (!text.includes(imp.replace(/\s+as\s+\w+/, '')) && imp !== 'React') {
              errors.push({
                type: 'import',
                line: lineNm,
                message: `Ubrukt, import: ${imp}`,
                severity: 'info',
                fix: 'Fjern ubrukte imports for renere kode'
          });
          }
        });
      }
    }
      
      // 🔍 TYPE ERRORS (TypeScript)
      
      // Any type usage
      if (/:\s*any\b/.test(trimmedLine)) {
        errors.push({
          type: 'type',
          line: lineNm,
          message: 'Unngå "any" type - bruk spesifikke typer',
          severity: 'warning',
          fix: 'Definer spesifikke typer for bedre type safety'
    });
    }
      
      // Missing type annotations
      if (/function\s+\w+\s*\([^)]*\)\s*{/.test(trimmedLine) && 
          !trimmedLine.includes(':') && !trimmedLine.includes('//')) {
        errors.push({
          type: 'type',
          line: lineNm,
          message: 'Manglende type annotasjoner',
          severity: 'info',
          fix: 'Legg til parameter- og return-typer for bedre type safety'
    });
    }
      
      // 🔍 SECURITY ISSUES
      
      // eval() usage
      if (/\beval\s*\(/.test(trimmedLine)) {
        errors.push({
          type: 'security',
          line: lineNm,
          message: 'Sikkerhetsproblem: eval() er farlig',
          severity: 'error',
          fix: 'Unngå eval() - bruk JSON.parse() eller andre sikre alternativer'
    });
    }
      
      // innerHTML usage without sanitization
      if (/\.innerHTML\s*=/.test(trimmedLine) && !trimmedLine.includes('sanitize')) {
        errors.push({
          type: 'security',
          line: lineNm,
          message: 'Sikkerhetsproblem: innerHTML uten sanitisering',
          severity: 'warning',
          fix: 'Sanitiser HTML-innhold eller bruk textContent/innerText'
    });
    }
      
      // 🔍 PERFORMANCE ISSUES
      
      // Console.log in production
      if (/console\.(log|error|warn|debug|info)/.test(trimmedLine)) {
        errors.push({
          type: 'performance',
          line: lineNm,
          message: 'Console-logging kan påvirke ytelse i produksjon',
          severity: 'info',
          fix: 'Fjern eller bruk betinget logging for produksjon'
    });
    }
      
      // Inefficient DOM queries
      if (/document\.querySelector/.test(trimmedLine) && /for\s*\(/.test(text)) {
        errors.push({
          type: 'performance',
          line: lineNm,
          message: 'Mulig ineffektiv DOM-spørring i løkke',
          severity: 'warning',
          fix: 'Flytt DOM-spørringer utenfor løkker når mulig'
    });
    }
  });
    
    return errors;
}, []);
  
  // Check if text contains code
  const isCodeContent = useCallback((text: string): boolean => {
    const codePatterns = [
      /function\s+\w, +, /,           // function declarations
      /const\s+\w+\s*=/,          // const declarations
      /let\s+\w+\s*=/,           // let declarations
      /var\s+\w+\s*=/,           // var declarations
      /import\s+.*from/,         // import statements
      /export\s+(default\s+)?/,   // export statements
      /class\s+\w+/,             // class declarations
      /interface\s+\w+/,         // TypeScript interfaces
      /type\s+\w+\s*=/,          // TypeScript type aliases
      /\w+\.\w+\(/,              // method calls
      /if\s*\(/,                 // if statements
      /for\s*\(/,                // for loops
      /while\s*\(/,              // while loops
      /try\s*{/,                 // try blocks
      /catch\s*\(/,              // catch blocks
      /=>\s*[{(]/,               // arrow functions
      /console\.(log|error)/,     // console statements
      /<\w+.*>/,                 // HTML/JSX tags
      /\/\/.*|\/\*.*\*\//,       // comments
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
}, []);
  
  // Get browser context information
  const getBrowserContext = useCallback((): BrowserContext => {
    return {
      title: document.title || 'Unknown Page',
      url: window.location.href,
      domain: window.location.hostname,
      timestamp: new Date().toISOString()
};
}, []);

  // Extract keywords from text using simple NLP
  const extractKeywords = useCallback((text: string): string[] => {
    // Remove common words and extract meaningful terms
    const commonWords = ['the','and','or','but','in','on','at','to','for','of','with','by','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will', 'would', 'could','should'];
    
    const words = text.toLowerCase()
      .replace(/[^a-zA-Z0-9æøåÆØÅ\s]/g, ', ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .filter(word => word.length < 20); // Remove very long strings

    // Count frequency and return top keywords
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
  });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
}, []);

  // Categorize content based on detected text and context
  const categorizeContent = useCallback((text: string, context: BrowserContext): string => {
    const lowText = text.toLowerCase();
    const domain = context.domain.toLowerCase();
    
    // Platform-specific detection
    if (domain.includes('github')) return 'code';
    if (domain.includes('figma') || domain.includes('sketch')) return 'design';
    if (domain.includes('youtube') || domain.includes('vimeo')) return 'video';
    if (domain.includes('spotify') || domain.includes('soundcloud')) return 'musik';
    if (domain.includes('facebook') || domain.includes('instagram') || domain.includes('twitter')) return 'sosialt';
    
    // Content-based detection
    if (lowText.includes('error') || lowText.includes('feil') || lowText.includes('bug')) return 'feil';
    if (lowText.includes('dashboard') || lowText.includes('admin') || lowText.includes('panel')) return 'dashboard';
    if (lowText.includes('form') || lowText.includes('skjema') || lowText.includes('registrer')) return 'skjema';
    if (lowText.includes('menu') || lowText.includes('navigation') || lowText.includes('meny')) return 'navigasjon';
    if (lowText.includes('button') || lowText.includes('knapp') || lowText.includes('click')) return 'interface';
    if (lowText.includes('chart') || lowText.includes('graph') || lowText.includes('diagram')) return 'data';
    if (lowText.includes('table') || lowText.includes('tabell') || lowText.includes('list')) return 'tabell';
    if (lowText.includes('video') || lowText.includes('play') || lowText.includes('pause')) return 'video';
    if (lowText.includes('photo') || lowText.includes('image') || lowText.includes('bilde')) return 'foto';
    
    return 'generelt';
}, []);

  // Generate intelligent filename based on analysis
  const generateSmartFilename = useCallback((detectedContent: DetectedContent, context: BrowserContext): string => {
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '_');
    
    let filename = ', ';
    
    // Start with category
    filename += detectedContent.category;
    
    // Add top keywords (max 2 for readability)
    const topKeywords = detectedContent.keywords.slice(0, 2);
    if (topKeywords.length > 0) {
      filename += '_' + topKeywords.join('_');
  }
    
    // Add domain if relevant
    const domain = context.domain.replace(/^www\./, '').split('.')[0];
    if (domain && domain.length < 15 && !filename.includes(domain)) {
      filename += '_' + domain;
  }
    
    // Add timestamp
    filename += '_' + timestamp;
    
    // Clean up filename
    filename = filename
      .toLowerCase()
      .replace(/[^a-z0-9æøå_]/g, ', ')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, ', ')
      .slice(0, 50); // Keep reasonable length
    
    return filename + '.png';
}, []);

  // 🔍 OCR Analysis Function
  const analyzeScreenshotContent = useCallback(async (canvas: HTMLCanvasElement): Promise<DetectedContent> => {
    setAnalyzing(true);
    
    try {
      console.log('🔍 Starting OCR analysis...');
      
      // Run OCR on the canvas
      const { data: { text } } = await Tesseract.recognize(
        canvas, 'eng+nor', // English and Norwegian
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`📖 OCR Progress: ${Math.round(m.progress * 10)}%`);
          }
        }
      }
      );
      
      console.log('✅ OCR completed. Detected text: ', text.slice(0, 200) + '...');
      
      // Extract keywords and categorize
      const keywords = extractKeywords(text);
      const context = getBrowserContext();
      const category = categorizeContent(text, context);
      
      // 💻 Advanced Code Analysis
      const hasCode = isCodeContent(text);
      let codeErrors: CodeError[] = [];
      
      if (hasCode) {
        console.log('🔍 Code detected! Running code error analysis...');
        codeErrors = detectCodeErrors(text);
        console.log(`🐛 Found ${codeErrors.length} potential code issues:`, 
          codeErrors.map(e => `${e.severity}: ${e.message}`));
    }
      
      const detectedContent: DetectedContent = {
        text: text.trim(),
        keywords,
        category: hasCode ? 'code' : category,
        confidence: text.length > 10 ? 0.8 : 0.3,
        hasCode,
        codeErrors: codeErrors.length > 0 ? codeErrors : undefined
  };
      
      console.log('🧠 Analysis result:', {
        category,
        keywords: keywords.slice(0, 3),
        textLength: text.length,
        confidence: detectedContent.confidence
  });
      
      return detectedContent;
      
  } catch (error) {
      console.error('❌ OCR analysis failed:', error);
      
      // Fallback analysis using context only
      const context = getBrowserContext();
      return {
        text: ', ',
        keywords: [context.domain.split('.')[0]],
        category: 'screenshot',
        confidence: 0.1 };
  } finally {
      setAnalyzing(false);
  }
}, [extractKeywords, categorizeContent, getBrowserContext]);

  // Define stopCapture first to avoid initialization errors
  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
  }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
  }
}, []);

  const startCapture = useCallback(async () => {
    if (!isSupported) {
      setError('Screen capture støttes ikke i denne browseren. Prøv Chrome, Firefox eller Edge.');
      return;
  }

    setCapturing(true);
    setError(null);
    setCaptureStep('capture');

    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: maxWidth },
          height: { ideal: maxHeight }
      },
        audio: false
  });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
    }

      // Listen for stream end (user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopCapture();
        setCaptureStep('select');
    });

  } catch (err: any) {
      console.error('Screenshot capture error, :', err);
      if (err.name === 'NotAllowedError') {
        setError('Du må gi tillatelse til å dele skjermen for å ta screenshot.');
    } else if (err.name === 'NotSupportedError') {
        setError('Screen capture støttes ikke i denne browseren.');
    } else {
        setError('Kunne ikke starte screen capture. Prøv igjen.');
    }
      setCaptureStep('select');
  } finally {
      setCapturing(false);
  }
}, [isSupported, maxWidth, maxHeight, stopCapture]);

  const takeScreenshot = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video0, canvas.width, canvas.height);

    setHasScreenshot(true);
    setCaptureStep('preview');

    // 🧠 START INTELLIGENT ANALYSIS
    console.log('🧠 Starting intelligent screenshot analysis...');
    
    try {
      // Analyze screenshot content
      const analysis = await analyzeScreenshotContent(canvas);
      setDetectedContent(analysis);
      
      // Generate smart filename
      const context = getBrowserContext();
      const smartName = generateSmartFilename(analysis, context);
      setSmartFilename(smartName);
      
      console.log('✅ Smart filename generated:', smartName);
      console.log('📊 Analysis summary:', {
        category: analysis.category,
        keywords: analysis.keywords.slice(0, 3),
        confidence: analysis.confidence,
        textLength: analysis.text.length
      });
      
      // Convert to blob and create file with smart filename
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], smartName, { type: 'image/png',});
          
          console.log('📸 Intelligent Screenshot captured:', {
            filename: smartName,
            size: file.size,
            dimensions: `${canvas.width}x${canvas.height}`,
            category: analysis.category,
            keywords: analysis.keywords.slice(0, 3)
          });
          
          onScreenshotTaken(file);
      }
    }, 'image/png', 0.9);
      
  } catch (error) {
      console.error('❌ Analysis failed, using fallback:', error);
      
      // Fallback to timestamp-based naming
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fallbackName = `screenshot-${timestamp}.png`;
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], fallbackName, { type: 'image/png',});
          onScreenshotTaken(file);
      }
    }, 'image/png', 0.9);
  }

    // Stop capture after taking screenshot
    stopCapture();
}, [onScreenshotTaken, analyzeScreenshotContent, getBrowserContext, generateSmartFilename, stopCapture]);

  const handleClose = useCallback(() => {
    stopCapture();
    setHasScreenshot(false);
    setError(null);
    setCaptureStep('select');
    onClose();
}, [onClose, stopCapture]);

  const retakeScreenshot = useCallback(() => {
    setHasScreenshot(false);
    setError(null);
    setCaptureStep('select');
}, []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(255,107,53,0.1) 0%, rgba(78,205,196,0.1) 100%)',
          backdropFilter: 'blur(10px)'
    }
    }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <ScreenshotIcon sx={{ color: '#ff6b35'}} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Screenshot Verktøy</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ minHeight: 400}}>
        {error && (
          <Alert severity="error" sx={{ mb:  2 }}>
            {error}
          </Alert>
        )}

        {!isSupported && (
          <Alert severity="warning" sx={{ mb:  2 }}>
            Screen capture API støttes ikke i denne browseren. Prøv Chrome, Firefox eller Edge.
          </Alert>
        )}

        {captureStep === 'select' && (
          <Box sx={{ textAlign: 'center', py:  4 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Velg hva du vil ta screenshot av
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  4 }}>
              Du kan velge å dele hele skjermen, ett vindu, eller en browser-tab
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb:  4 }}>
              <Paper sx={{ p: 2, textAlign: 'center', width: 150,  ...theming.getThemedCardSx() }}>
                <ScreenIcon sx={{ fontSize:  48, color: '#4ECDC0', mb:  1 }} />
                <Typography variant="subtitle2">Hele skjermen</Typography>
              </Paper>
              <Paper sx={{ p: 2, textAlign: 'center', width: 150,  ...theming.getThemedCardSx() }}>
                <SelectIcon sx={{ fontSize:  48, color: '#45B7D0', mb:  1 }} />
                <Typography variant="subtitle2">Velg vindu</Typography>
              </Paper>
              <Paper sx={{ p: 2, textAlign: 'center', width: 150,  ...theming.getThemedCardSx() }}>
                <TabIcon sx={{ fontSize:  48, color: '#96CEB0', mb:  1 }} />
                <Typography variant="subtitle2">Browser-tab</Typography>
              </Paper>
            </Box>

            <Button variant="contained"
              startIcon={capturing ? <CircularProgress size={16} sx={theming.getThemedButtonSx()} /> : <ScreenshotIcon />}
              onClick={startCapture}
              disabled={!isSupported || capturing}
              sx={{
                background: 'linear-gradient(45deg, #ff6b35, #4ECDC4)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #e55a2b, #3db5a6)'
                }
              }}
            >
              {capturing ? 'Starter...' : 'Start Screenshot'}
            </Button>
          </Box>
        )}

        {captureStep === 'capture' && (
          <Box sx={{ textAlign: 'center'}}>
            <Alert severity="info" sx={{ mb:  2 }}>
              <Typography variant="body2">
                Du deler nå skjermen. Klikk "Ta Screenshot" når du ser det du vil fange.
              </Typography>
            </Alert>

            <video
              ref={videoRef}
              autoPlay
              muted
              style={{
                width: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                border: '2px solid #ff6b35'
          }}
            />

            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center'}}>
              <Button variant="contained"
                startIcon={<SaveIcon />}
                onClick={takeScreenshot}
                sx={{
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)','&:hover': {
                    background: 'linear-gradient(45deg, #43A047, #3d8b40)'
                }
              }}
              >
                Ta Screenshot
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  stopCapture();
                  setCaptureStep('select');
              }}
              >
                Avbryt
              </Button>
            </Box>
          </Box>
        )}

        {captureStep === 'preview' && hasScreenshot && (
          <Box sx={{ textAlign: 'center'}}>
            <Alert severity="success" sx={{ mb:  2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <SmartIcon />
                Screenshot analysert og klar! {smartFilename && `Intelligent navn: ${smartFilename}`}
              </Box>
            </Alert>

            {/* Analysis Status */}
            {analyzing && (
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap:  1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Analyserer screenshot innhold...
                </Typography>
              </Box>
            )}

            {/* Analysis Results */}
            {detectedContent && !analyzing && (
              <Box sx={{ mb:  2 }}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb:  2 }}>
                  <Chip 
                    icon={<DetectionIcon />}
                    label={`Kategori: ${detectedContent.category}`}
                    color="primary" 
                    size="small" 
                  />
                  {detectedContent.keywords.slice(0, 3).map((keyword, idx) => (
                    <Chip 
                      key={idx}
                      label={keyword}
                      color="secondary" 
                      size="small" 
                    />
                  ))}
                  <Chip 
                    label={`${Math.round(detectedContent.confidence * 100)}% sikkerhet`}
                    color={detectedContent.confidence > 0.7 ? "success" : "default"}
                    size="small" 
                  />
                  {detectedContent.hasCode && (
                    <Chip 
                      icon={<CodeIcon />}
                      label="Kode detektert" 
                      color="info" 
                      size="small" 
                    />
                  )}
                </Box>

                {/* 💻 Code Error Analysis Results */}
                {detectedContent.hasCode && detectedContent.codeErrors && detectedContent.codeErrors.length > 0 && (
                  <Accordion>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        backgroundColor: 'rgba(25, 1520.1)',
                        borderRadius: 1, '&:hover': {
                          backgroundColor: 'rgba(25, 1520.2)'
                      }
                    }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <BugIcon color="warning" />
                        <Typography variant="subtitle2">
                          🐛 Kode-analyse: {detectedContent.codeErrors.length} potensielle problemer funnet
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ maxHeight: 20, overflow: 'auto'}}>
                      {detectedContent.codeErrors.map((error, idx) => {
                        const getErrorIcon = () => {
                          switch (error.type) {
                            case 'syntax': return <ErrorIcon color="error" />;
                            case 'logic': return <WarningIcon color="warning" />;
                            case 'security': return <SecurityIcon color="error" />;
                            case 'performance': return <SpeedIcon color="info" />;
                            case 'type': return <InfoIcon color="info" />;
                            case 'import': return <InfoIcon color="secondary" />;
                            default: return <BugIcon />;
                      }
                      };

                        const getErrorColor = () => {
                          switch (error.severity) {
                            case 'error': return 'error';
                            case 'warning': return 'warning';
                            case 'info': return 'info';
                            default: return 'default';
                      }
                      };

                        return (
                          <Box key={idx} sx={{ mb:  2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                              {getErrorIcon()}
                              <Box sx={{ flex:  1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {error.line && `Linje ${error.line}: `},{error.message}
                                </Typography>
                                <Chip 
                                  label={error.type.toUpperCase()}
                                  size="small" 
                                  color={getErrorColor()}
                                  sx={{ mr:  1 }}
                                />
                                <Chip 
                                  label={error.severity.toUpperCase()}
                                  size="small" 
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                            {error.fix && (
                              <Alert severity="info" sx={{ mt:  1 }}>
                                <Typography variant="caption">
                                  💡 <strong>Forslag: </strong> {error.fix}
                                </Typography>
                              </Alert>
                            )}
                            {idx < detectedContent.codeErrors!.length - 1 && <Divider sx={{ mt:  1 }} />}
                          </Box>
                        );
                    })}
                    </AccordionDetails>
                  </Accordion>
                )}

                {/* No Code Errors Found */}
                {detectedContent.hasCode && (!detectedContent.codeErrors || detectedContent.codeErrors.length === 0) && (
                  <Alert severity="success" sx={{ mt:  1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <CodeIcon />
                      <Typography variant="body2">
                        ✅ Kode analysert - ingen åpenbare problemer funnet!
                      </Typography>
                    </Box>
                  </Alert>
                )}
              </Box>
            )}

            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                border: '2px solid #4CAF50'
          }}
            />

            {/* Smart Filename Display */}
            {smartFilename && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt:  1 }}>
                📄 Smart filnavn: {smartFilename}
              </Typography>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center'}}>
              <Button variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleClose}
                disabled={analyzing}
                sx={{
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)','&:hover': {
                    background:'linear-gradient(45deg, #43A047, #3d8b40)'
                }
              }}
              >
                Bruk Screenshot
              </Button>
              <Button
                variant="outlined"
                startIcon={<RetakeIcon />}
                onClick={retakeScreenshot}
                disabled={analyzing}
              >
                Ta nytt
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};