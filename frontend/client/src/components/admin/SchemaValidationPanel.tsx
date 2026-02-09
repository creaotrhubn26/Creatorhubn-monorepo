/**
 * Schema.org Validation Panel
 * 
 * Validates structured data (JSON-LD) against schema.org
 * Integrated with SEO Bot Detection System
 */

import React, { useState } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Link,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  CheckCircle,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon,
  OpenInNew as OpenInNewIcon,
  Lightbulb as LightbulbIcon,
  AutoAwesome,
  TrendingUp,
  Search as SearchIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  School as TutorialIcon,
} from '@mui/icons-material';

interface SchemaValidationPanelProps {
  initialUrl?: string;
  initialJsonLd?: any;
}

export default function SchemaValidationPanel({ initialUrl, initialJsonLd }: SchemaValidationPanelProps) {
  const [url, setUrl] = useState(initialUrl || ',');
  const [jsonLd, setJsonLd] = useState(initialJsonLd ? JSON.stringify(initialJsonLd, null, 2) : '');
  const [validationMode, setValidationMode] = useState<'url' | 'json'>('url');
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<any>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [aggressiveness, setAggressiveness] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [autoFixOptions, setAutoFixOptions] = useState({
    addStarRatings: true,
    addImages: true,
    addSocialProfiles: true,
    addRichResultsFields: true,
    generatePlaceholders: true,
  });
  const [industryResearch, setIndustryResearch] = useState<any>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [googleBusinessData, setGoogleBusinessData] = useState<any>(null);
  const [isExtractingGoogle, setIsExtractingGoogle] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });

  const handleValidateUrl = async () => {
    if (!url) return;
    
    setIsValidating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/schema/validate-url', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setValidation(data.customValidation);
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate URL');
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidateJson = async () => {
    if (!jsonLd) return;
    
    setIsValidating(true);
    setError(null);
    setAutoFixResult(null);
    
    try {
      const parsedJson = JSON.parse(jsonLd);
      
      const response = await fetch('/api/schema/validate-json', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ jsonLd: parsedJson }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setValidation(data.validation);
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid JSON');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAutoFix = async () => {
    if (!validation) return;
    
    setIsAutoFixing(true);
    setError(null);
    
    try {
      const parsedJson = validationMode === 'json' ? JSON.parse(jsonLd) : null;
      const endpoint = validationMode === 'url' ? '/api/schema/auto-fix-url' : '/api/schema/auto-fix';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          ...(validationMode === 'url' ? { url } : { jsonLd: parsedJson, url }),
          aggressiveness,
          extractFromPage: true,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAutoFixResult(data);
        setValidation(data.validation);
        // Update JSON-LD textarea with fixed version
        if (validationMode === 'json') {
          setJsonLd(JSON.stringify(data.fixedSchema, null, 2));
        }
      } else {
        setError(data.error || 'Auto-fix failed');
      }
    } catch (err: any) {
      setError(err.message || 'Auto-fix failed');
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleAutoFixAll = async () => {
    if (!validation) return;
    
    setIsAutoFixing(true);
    setError(null);
    
    try {
      const parsedJson = validationMode === 'json' ? JSON.parse(jsonLd) : null;
      
      const response = await fetch('/api/schema/auto-fix-all', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          jsonLd: parsedJson || validation.detectedSchemas[0]?.data,
          url: url || ', ',
          ...autoFixOptions,
          researchIndustry: true,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAutoFixResult(data);
        setValidation(data.validation);
        if (data.industryResearch) {
          setIndustryResearch(data.industryResearch);
        }
        // Update JSON-LD textarea with fixed version
        if (validationMode === 'json') {
          setJsonLd(JSON.stringify(data.fixedSchema, null, 2));
        }
      } else {
        setError(data.error || 'Auto-fix failed');
      }
    } catch (err: any) {
      setError(err.message || 'Auto-fix failed');
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleResearchBestPractices = async () => {
    if (!validation || !validation.schemaType || validation.schemaType.length === 0) return;
    
    setIsResearching(true);
    setError(null);
    
    try {
      const schemaType = validation.schemaType[0];
      const industry = url.includes('.no') ? 'norwegian' : undefined;
      
      const response = await fetch('/api/schema/research-best-practices', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ schemaType, industry }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIndustryResearch(data.research);
      } else {
        setError(data.error || 'Research failed');
      }
    } catch (err: any) {
      setError(err.message || 'Research failed');
    } finally {
      setIsResearching(false);
    }
  };

  const handleExtractGoogleBusiness = async () => {
    if (!businessName) {
      setError('Please enter a business name');
      return;
    }
    
    setIsExtractingGoogle(true);
    setError(null);
    
    try {
      const response = await fetch('/api/schema/extract-google-business', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ 
          businessName, 
          location: url.includes('.no') ? 'Norge' : 'Norway',
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGoogleBusinessData(data.businessData);
        setSnackbar({ open: true, message: '✅ Google Business data extracted! Check the results below.', severity: 'success' });
      } else {
        setError(data.error || 'Extraction failed');
      }
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
    } finally {
      setIsExtractingGoogle(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const tutorialSteps = [
    {
      label: 'Enter Business Name',
      description: 'Type your business name in the "Business Name" field below',
      example: 'Norwegian Wedding Film',
    },
    {
      label: 'Extract from Google',
      description: 'Click "Extract from Google" to automatically get address, phone, reviews, and coordinates from Google Business Profile',
    },
    {
      label: 'View Extracted Data',
      description: 'See your business data organized in 4, cards: Address, Coordinates, Contact Info, and Reviews',
    },
    {
      label: 'Validate Your Website (Optional)',
      description: 'Enter your website URL and click "Validate" to check your current schema score',
    },
    {
      label: 'Auto-Fix Issues',
      description: 'Click "Auto-Fix ALL Issues" to combine Google data + website data for perfect SEO (98/100 score!)',
    },
    {
      label: 'Copy & Deploy',
      description: 'Click "Copy Schema with Google Data" and paste the result into your website <head> section. Done! 🎉',
    },
  ];

  const handleTutorialClose = () => {
    setShowTutorial(false);
    localStorage.setItem('seoTutorialCompleted', 'true');
  };

  const handleTutorialReset = () => {
    setShowTutorial(true);
    setTutorialStep(0);
    localStorage.removeItem('seoTutorialCompleted');
  };

  // Check if tutorial was completed
  React.useEffect(() => {
    const completed = localStorage.getItem('seoTutorialCompleted');
    if (completed) {
      setShowTutorial(false);
    }
  }, []);

  return (
    <Box>
      {/* Tutorial Dialog */}
      <Dialog 
        open={showTutorial} 
        onClose={handleTutorialClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TutorialIcon color="primary" />
          SEO Schema Optimization Tutorial
          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" onClick={handleTutorialClose}>
            <CloseIcon />
          </Button>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight="bold">
              🚀 Transform your SEO from 45/100 to 98/100 in 6 easy steps!
            </Typography>
            <Typography variant="caption">
              Get address, phone, reviews automatically from Google - no manual data entry!
            </Typography>
          </Alert>

          <Stepper activeStep={tutorialStep} orientation="vertical">
            {tutorialSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>
                  {step.example && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="caption">
                        💡 Example: <strong>{step.example}</strong>
                      </Typography>
                    </Alert>
                  )}
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setTutorialStep(index + 1)}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      {index === tutorialSteps.length - 1 ? 'Finish' : 'Continue'}
                    </Button>
                    <Button
                      onClick={() => setTutorialStep(index - 1)}
                      sx={{ mt: 1, mr: 1 }}
                      disabled={index === 0}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {tutorialStep === tutorialSteps.length && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold">
                ✅ Tutorial Complete!
              </Typography>
              <Typography variant="caption">
                You're ready to optimize your SEO! Close this and start with step 1.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTutorialClose}>
            Close Tutorial
          </Button>
          <Button 
            variant="contained" 
            onClick={handleTutorialClose}
            startIcon={<PlayIcon />}
          >
            Start Optimizing!
          </Button>
        </DialogActions>
      </Dialog>

      <Card>
        <CardContent>
          {/* Tutorial Reset Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssessmentIcon />
              <Box>
                <Typography variant="h5">
                  Schema.org Validator
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Validate structured data (JSON-LD) against schema.org standards
                </Typography>
              </Box>
            </Box>
            <Button 
              variant="outlined" 
              size="small"
              startIcon={<TutorialIcon />}
              onClick={handleTutorialReset}
            >
              Show Tutorial
            </Button>
          </Box>

          {/* Mode Selection */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 2 }}>
            <Button
              variant={validationMode === 'url' ? 'contained' : 'outlined'}
              onClick={() => setValidationMode('url')}
            >
              Validate URL
            </Button>
            <Button
              variant={validationMode === 'json' ? 'contained' : 'outlined'}
              onClick={() => setValidationMode('json')}
            >
              Validate JSON-LD
            </Button>
          </Box>

          {/* Google Business Extraction */}
          <Card sx={{ mb: 2, bgcolor: 'primary.light' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SearchIcon />
                🔍 Extract Data from Google Business
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Automatically extract address, phone, reviews, hours, and coordinates from Google!
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Business Name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Norwegian Wedding Film"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleExtractGoogleBusiness}
                    disabled={!businessName || isExtractingGoogle}
                    sx={{ height: '56px' }}
                    startIcon={<SearchIcon />}
                  >
                    {isExtractingGoogle ? 'Extracting...' : 'Extract from Google'}
                  </Button>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                💡 This will search Google and extract: address, coordinates, phone, reviews, hours
              </Typography>
            </CardContent>
          </Card>

          {/* URL Validation */}
          {validationMode === 'url' && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={9}>
                  <TextField
                    fullWidth
                    label="URL to Validate"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleValidateUrl}
                    disabled={!url || isValidating}
                    sx={{ height: '56px' }}
                  >
                    {isValidating ? 'Validating...' : 'Validate'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* JSON-LD Validation */}
          {validationMode === 'json' && (
            <Box>
              <TextField
                fullWidth
                multiline
                rows={10}
                label="JSON-LD Code"
                value={jsonLd}
                onChange={(e) => setJsonLd(e.target.value)}
                placeholder={`{
  "@context":"https://schema.org","@type":"Organization","name":"Your Organization""url" : "https://example.com"
}`}
                sx={{ mb: 2, fontFamily: 'monospace' }}
              />
              <Button
                variant="contained"
                onClick={handleValidateJson}
                disabled={!jsonLd || isValidating}
              >
                {isValidating ? 'Validating...' : 'Validate JSON-LD'}
              </Button>
            </Box>
          )}

          {isValidating && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                Validating structured data...
              </Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Auto-Fix Controls */}
          {validation && !isValidating && (
            <Card sx={{ mt: 2, bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesome />
                  🤖 AI Auto-Fix - Automatically Solve ALL Issues
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Let AI automatically fix ALL contextual issues to maximize your SEO!
                  The system extracts data from your page and intelligently fills in missing properties.
                </Typography>

                {/* What Will Be Fixed */}
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>✨ What Auto-Fix Solves:</strong>
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoFixOptions.addRichResultsFields}
                            onChange={(e) => setAutoFixOptions({ ...autoFixOptions, addRichResultsFields: e.target.checked })}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">🔴 Required Fields</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Critical fields required by schema.org
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoFixOptions.addRichResultsFields}
                            onChange={(e) => setAutoFixOptions({ ...autoFixOptions, addRichResultsFields: e.target.checked })}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">🟡 Rich Results Fields</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Recommended by Google for enhanced SERP
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoFixOptions.addSocialProfiles}
                            onChange={(e) => setAutoFixOptions({ ...autoFixOptions, addSocialProfiles: e.target.checked })}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">📱 Social Profiles</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Establishes brand authority and trust
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoFixOptions.addStarRatings}
                            onChange={(e) => setAutoFixOptions({ ...autoFixOptions, addStarRatings: e.target.checked })}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">⭐ Star Ratings</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Ratings appear in search results
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoFixOptions.addImages}
                            onChange={(e) => setAutoFixOptions({ ...autoFixOptions, addImages: e.target.checked })}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">🖼️ Images</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Makes results more eye-catching
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={autoFixOptions.generatePlaceholders}
                            onChange={(e) => setAutoFixOptions({ ...autoFixOptions, generatePlaceholders: e.target.checked })}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">🔧 Generate Placeholders</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Create templates for missing data
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  </Grid>
                </Alert>
                
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Fix Aggressiveness</InputLabel>
                      <Select
                        value={aggressiveness}
                        label="Fix Aggressiveness"
                        onChange={(e: SelectChangeEvent<'conservative' | 'moderate' | 'aggressive'>) => setAggressiveness(e.target.value as 'conservative' | 'moderate' | 'aggressive')}
                      >
                        <MenuItem value="conservative">
                          Conservative - Only high-confidence
                        </MenuItem>
                        <MenuItem value="moderate">
                          Moderate - Balanced (Recommended)
                        </MenuItem>
                        <MenuItem value="aggressive">
                          Aggressive - Add all fields
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      size="large"
                      onClick={handleAutoFixAll}
                      disabled={isAutoFixing}
                      startIcon={<AutoAwesome />}
                      sx={{ height: '56px' }}
                    >
                      {isAutoFixing ? 'Auto-Fixing...' : '✨ Auto-Fix ALL Issues'}
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="success"
                      size="large"
                      onClick={handleAutoFix}
                      disabled={isAutoFixing}
                      sx={{ height: '56px' }}
                    >
                      {isAutoFixing ? 'Fixing...' : 'Quick Fix'}
                    </Button>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                  <Button
                    variant="outlined"
                    color="info"
                    onClick={handleResearchBestPractices}
                    disabled={isResearching}
                    startIcon={<SearchIcon />}
                  >
                    {isResearching ? 'Researching...' : '🔬 Research Top Brands'}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Analyze Amazon, Google, Microsoft, Finn.no, VG.no
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="🔴 Fixes required fields" size="small" />
                  <Chip label="🟡 Adds rich results fields" size="small" />
                  <Chip label="📱 Adds social profiles" size="small" />
                  <Chip label="⭐ Adds star ratings" size="small" />
                  <Chip label="🖼️ Adds eye-catching images" size="small" />
                  <Chip label="🔬 Learns from top brands" size="small" color="info" />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Google Business Data Results */}
          {googleBusinessData && (
            <Card sx={{ mt: 2, bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon />
                  ✅ Google Business Data Extracted!
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Real data from Google - ready to use in your schema
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>📍 Address</Typography>
                      <Typography variant="body2">
                        {googleBusinessData.address?.streetAddress || 'N/A'}<br />
                        {googleBusinessData.address?.postalCode} {googleBusinessData.address?.addressLocality}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>🌍 Coordinates</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        Lat: {googleBusinessData.geo?.latitude || 'N/A'}<br />
                        Lng: {googleBusinessData.geo?.longitude || 'N/A'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>📞 Contact</Typography>
                      <Typography variant="body2">
                        Phone: {googleBusinessData.telephone || 'N/A'}<br />
                        Email: {googleBusinessData.email || 'Not found'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>⭐ Reviews</Typography>
                      <Typography variant="body2">
                        Rating: {googleBusinessData.aggregateRating?.ratingValue || 'N/A'} / 5<br />
                        Count: {googleBusinessData.aggregateRating?.reviewCount || '0'} reviews
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Chip label="✅ Address extracted" size="small" color="success" />
                  <Chip label="✅ Coordinates extracted" size="small" color="success" />
                  <Chip label="✅ Phone extracted" size="small" color="success" />
                  <Chip label="✅ Reviews extracted" size="small" color="success" />
                </Box>

                <Button
                  variant="contained"
                  color="success"
                  sx={{ mt: 2 }}
                  onClick={() => {
                    const schemaWithGoogleData = {
                      ...validation.detectedSchemas[0]?.data,
                      address: googleBusinessData.address,
                      geo: googleBusinessData.geo,
                      telephone: googleBusinessData.telephone,
                      aggregateRating: {
                        '@type' : 'AggregateRating',
                        ...googleBusinessData.aggregateRating,
                        bestRating: '5',
                        worstRating: '1',
                      },
                    };
                    navigator.clipboard.writeText(JSON.stringify(schemaWithGoogleData, null, 2));
                    setSnackbar({ open: true, message: '✅ Schema with Google data copied to clipboard!', severity: 'success' });
                  }}
                >
                  Copy Schema with Google Data
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Industry Research Results */}
          {industryResearch && (
            <Card sx={{ mt: 2, bgcolor: 'info.light', border: '2px solid', borderColor: 'info.main' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SearchIcon />
                  🔬 Industry Research from Top Brands
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Analyzed {industryResearch.totalBrandsAnalyzed} leading brands
                </Typography>

                {industryResearch.industryComparison && (
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="caption">Your Fields</Typography>
                        <Typography variant="h5">{industryResearch.industryComparison.yourFields}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="caption">Industry Avg</Typography>
                        <Typography variant="h5">{industryResearch.industryComparison.industryAverage}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="caption">Top Brand</Typography>
                        <Typography variant="h5">{industryResearch.industryComparison.topBrandFields}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: industryResearch.industryComparison.gap > 0 ? 'warning.light' : 'success.light' }}>
                        <Typography variant="caption">Gap</Typography>
                        <Typography variant="h5">{industryResearch.industryComparison.gap}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                )}

                {industryResearch.bestPractices && industryResearch.bestPractices.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Best Practices:</Typography>
                    <Box component="ul" sx={{ pl: 2 }}>
                      {industryResearch.bestPractices.map((practice: string, index: number) => (
                        <li key={index}>
                          <Typography variant="body2">{practice}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Box>
                )}

                {industryResearch.missingBestPractices && industryResearch.missingBestPractices.length > 0 && (
                  <Alert severity="warning">
                    <Typography variant="subtitle2" gutterBottom>What You're Missing:</Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                      {industryResearch.missingBestPractices.map((practice: string, index: number) => (
                        <li key={index}>
                          <Typography variant="body2">{practice}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Auto-Fix Results */}
          {autoFixResult && (
            <Card sx={{ mt: 2, bgcolor: 'info.light' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" />
                  Auto-Fix Complete!
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2">Original Score:</Typography>
                    <Typography variant="h4" color="error.main">{validation.validationScore}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                      <Box>
                        <Typography variant="subtitle2">Score Improvement:</Typography>
                        <Typography variant="h4" color="success.main">
                          +{autoFixResult.newValidationScore - validation.validationScore}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2">New Score:</Typography>
                    <Typography variant="h4" color="success.main">{autoFixResult.newValidationScore}</Typography>
                    <Chip 
                      label={`+${autoFixResult.newValidationScore - validation.validationScore} points`}
                      color="success"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" gutterBottom>
                  Applied Fixes ({autoFixResult.appliedFixes.length}):
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell>Confidence</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {autoFixResult.appliedFixes.map((fix: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell><code>{fix.field}</code></TableCell>
                          <TableCell>
                            <Chip 
                              label={fix.action}
                              color={fix.action === 'added' ? 'success' : 'info'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {typeof fix.newValue === 'object' 
                                ? JSON.stringify(fix.newValue).substring(0, 50) + '...'
                                : fix.newValue}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={fix.confidence}
                              color={
                                fix.confidence === 'high' ? 'success' :
                                fix.confidence === 'medium' ? 'warning' : 'default'
                              }
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="subtitle2" gutterBottom>
                  Improvements:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  {autoFixResult.improvements.map((improvement: string, index: number) => (
                    <li key={index}>
                      <Typography variant="body2">{improvement}</Typography>
                    </li>
                  ))}
                </Box>

                <Button
                  variant="contained"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(autoFixResult.fixedSchema, null, 2));
                    setSnackbar({ open: true, message: 'Fixed schema copied to clipboard!', severity: 'success' });
                  }}
                  startIcon={<CodeIcon />}
                  sx={{ mt: 2 }}
                >
                  Copy Fixed Schema
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Validation Results */}
          {validation && (
            <Box sx={{ mt: 3 }}>
              {/* What This Validation Checks */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>What This Validation Checks:</strong>
                </Typography>
                <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                  <li>✅ <strong>Schema.org Compliance:</strong> Validates your structured data against official schema.org standards</li>
                  <li>🔍 <strong>Required Fields:</strong> Checks if all mandatory properties are present for your schema type</li>
                  <li>⚠️ <strong>Recommended Fields:</strong> Identifies missing optional fields that improve SEO</li>
                  <li>🎯 <strong>Rich Results Eligibility:</strong> Determines if your schema qualifies for Google Rich Results (enhanced SERP display)</li>
                  <li>📊 <strong>Data Quality:</strong> Validates field types, formats, and values</li>
                  <li>🔗 <strong>Cross-Reference:</strong> Checks relationships between nested schema objects</li>
                </Box>
              </Alert>

              {/* Validation Score */}
              <Card sx={{ mb: 2, bgcolor: 'background.default' }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        Validation Score
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h3" color={`${getScoreColor(validation.validationScore)}.main`}>
                          {validation.validationScore}
                        </Typography>
                        <Typography variant="h5" color="text.secondary">
                          / 100
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={validation.validationScore}
                        color={getScoreColor(validation.validationScore)}
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {validation.validationScore >= 90 && '🎉 Excellent! Your schema is well-optimized.'}
                        {validation.validationScore >= 70 && validation.validationScore < 90 && '👍 Good! Fix warnings for better results.'}
                        {validation.validationScore < 70 && '⚠️ Needs improvement. Address critical errors first.'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Chip
                          icon={validation.isValid ? <CheckIcon /> : <ErrorIcon />}
                          label={validation.isValid ? 'Valid Schema' : 'Invalid Schema'}
                          color={validation.isValid ? 'success' : 'error'}
                        />
                        <Chip
                          icon={validation.richResultsEligible ? <CheckIcon /> : <WarningIcon />}
                          label={validation.richResultsEligible ? 'Rich Results Eligible' : 'Not Eligible for Rich Results'}
                          color={validation.richResultsEligible ? 'success' : 'warning'}
                        />
                        {validation.richResultsEligible && (
                          <Typography variant="caption" color="success.main">
                            💎 Your schema may appear as rich results in Google search!
                          </Typography>
                        )}
                        {!validation.richResultsEligible && (
                          <Typography variant="caption" color="warning.main">
                            Add Article, Product, Event, or Recipe schema for rich results
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Detected Schemas */}
              {validation.detectedSchemas && validation.detectedSchemas.length > 0 && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">
                      Detected Schemas ({validation.detectedSchemas.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {validation.detectedSchemas.map((schema: any, index: number) => (
                        <Chip
                          key={index}
                          icon={schema.isValid ? <CheckIcon /> : <ErrorIcon />}
                          label={schema.type}
                          color={schema.isValid ? 'success' : 'error'}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Errors */}
              {validation.errors && validation.errors.length > 0 && (
                <Accordion defaultExpanded={validation.errors.length > 0}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" color="error">
                      ❌ Errors ({validation.errors.length}) - Fix These First!
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        <strong>What Are Errors?</strong>
                      </Typography>
                      <Typography variant="body2">
                        Errors are <strong>critical issues</strong> that prevent your schema from working correctly. 
                        Google and other search engines may ignore invalid schema, causing you to miss out on rich results.
                        <br /><br />
                        <strong>How to Fix:</strong> Copy the suggested fix code and add it to your JSON-LD. Critical errors must be fixed for schema to work.
                      </Typography>
                    </Alert>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell width="50px"></TableCell>
                            <TableCell width="150px">Field</TableCell>
                            <TableCell>What's Wrong</TableCell>
                            <TableCell width="200px">How to Fix</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {validation.errors.map((error: any, index: number) => (
                            <TableRow key={index} sx={{ bgcolor: error.severity === 'critical' ? 'error.light' : 'inherit' }}>
                              <TableCell>{getSeverityIcon(error.severity)}</TableCell>
                              <TableCell>
                                <code style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{error.field}</code>
                                {error.severity === 'critical' && (
                                  <Chip label="CRITICAL" color="error" size="small" sx={{ ml: 1 }} />
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{error.message}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                  {error.type === 'missing_required_field' && '🔴 This field is required by schema.org and must be present'}
                                  {error.type === 'invalid_value' && '🔴 The value format is incorrect or invalid'}
                                  {error.type === 'invalid_type' && '🔴 The data type doesn\'t match schema.org requirements'}
                                  {error.type === 'syntax_error' && '🔴 JSON syntax error - check for missing commas, brackets, or quotes'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {error.fix ? (
                                  <Box>
                                    <Tooltip title="Click to copy fix code">
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => {
                                          navigator.clipboard.writeText(error.fix);
                                          setSnackbar({ open: true, message: 'Fix code copied to clipboard!', severity: 'success' });
                                        }}
                                        startIcon={<CodeIcon />}
                                        sx={{ mb: 1 }}
                                      >
                                        Copy Fix
                                      </Button>
                                    </Tooltip>
                                    <Typography variant="caption" component="div" sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, fontFamily: 'monospace' }}>
                                      {error.fix}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    See schema.org documentation
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Warnings */}
              {validation.warnings && validation.warnings.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" color="warning.main">
                      ⚠️ Warnings ({validation.warnings.length}) - Recommended Improvements
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        <strong>What Are Warnings?</strong>
                      </Typography>
                      <Typography variant="body2">
                        Warnings indicate <strong>missing recommended fields</strong> that aren't required but significantly improve your SEO. 
                        Adding these fields can help you qualify for rich results and provide better information to search engines.
                        <br /><br />
                        <strong>Impact:</strong> Your schema will work without these, but you'll miss opportunities for enhanced search visibility.
                      </Typography>
                    </Alert>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell width="50px"></TableCell>
                            <TableCell width="150px">Field</TableCell>
                            <TableCell>Why It Matters</TableCell>
                            <TableCell>How to Add It</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {validation.warnings.map((warning: any, index: number) => (
                            <TableRow key={index} sx={{ bgcolor: 'warning.light', opacity: 0.3 }}>
                              <TableCell><WarningIcon color="warning" /></TableCell>
                              <TableCell>
                                <code style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{warning.field}</code>
                                <Chip label="OPTIONAL" color="warning" size="small" sx={{ ml: 1 }} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{warning.message}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                  {warning.type === 'missing_recommended_field' && '🟡 Recommended by Google for better rich results'}
                                  {warning.type === 'deprecated_property' && '🟡 This property is outdated - use the recommended alternative'}
                                  {warning.type === 'suboptimal_value' && '🟡 Value works but could be improved for better results'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ bgcolor: 'white', p: 1, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                  {warning.recommendation}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Suggestions */}
              {validation.suggestions && validation.suggestions.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LightbulbIcon color="info" />
                      💡 SEO Optimization Tips ({validation.suggestions.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        <strong>What Are Suggestions?</strong>
                      </Typography>
                      <Typography variant="body2">
                        Suggestions are <strong>best practice recommendations</strong> to maximize your SEO impact. 
                        These aren't required for valid schema, but implementing them can significantly improve your search visibility and click-through rates.
                        <br /><br />
                        <strong>Benefit:</strong> Stand out in search results with enhanced features like star ratings, images, prices, and more.
                      </Typography>
                    </Alert>
                    <Box component="ul" sx={{ pl: 2, '& li': { mb: 2 } }}>
                      {validation.suggestions.map((suggestion: string, index: number) => (
                        <li key={index}>
                          <Typography variant="body2" sx={{ fontWeight: 500}}>
                            {suggestion}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {suggestion.includes('social media') && '📱 Helps establish brand authority and trust'}
                            {suggestion.includes('SearchAction') && '🔍 Enables Google Sitelinks Search Box in results'}
                            {suggestion.includes('reviews') && '⭐ Star ratings appear in search results'}
                            {suggestion.includes('image') && '🖼️ Images make your results more eye-catching'}
                            {suggestion.includes('opening hours') && '🕐 Shows business hours directly in search'}
                            {suggestion.includes('geo') && '📍 Improves local search and map visibility'}
                            {suggestion.includes('ticket') && '🎟️ Shows event pricing and availability'}
                            {suggestion.includes('jobTitle') && '👤 Enhances professional profile visibility'}
                          </Typography>
                        </li>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* External Validation Links */}
              <Card sx={{ mt: 2, bgcolor: 'info.light' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    External Validation Tools
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {url && (
                      <>
                        <Link
                          href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                          Google Rich Results Test <OpenInNewIcon fontSize="small" />
                        </Link>
                        <Link
                          href={`https://validator.schema.org/#url=${encodeURIComponent(url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                          Schema.org Validator <OpenInNewIcon fontSize="small" />
                        </Link>
                      </>
                    )}
                    <Link
                      href="https://schema.org/docs/schemas.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      Schema.org Documentation <OpenInNewIcon fontSize="small" />
                    </Link>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Snackbar for notifications */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </CardContent>
      </Card>
    </Box>
  );
}

