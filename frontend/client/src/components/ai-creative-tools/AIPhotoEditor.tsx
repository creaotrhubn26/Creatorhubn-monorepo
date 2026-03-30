// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  Typography,
} from '@mui/material';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { UniversalFileUpload } from '../universal/UniversalFileUpload';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CloudUpload,
  CloudDownload,
  AutoFixHigh,
  AutoAwesome as Sparkles,
  Bolt,
  Visibility,
  Settings,
  Palette,
  Contrast,
  Brightness4,
  FilterList,
  ContentCut,
  RotateRight,
  OpenWith,
  Crop,
  Flip,
  Flip,
  WbSunny,
  Nightlight,
  People,
  Layers,
  CenterFocusStrong,
  EmojiEvents,
  Star,
  TrendingUp,
  CameraAlt,
  Image as ImageIcon,
  Videocam,
  MusicNote,
  Edit,
  Save,
  Refresh,
  ArrowBack,
  ArrowForward,
  ZoomIn,
  ZoomOut,
  GridOn,
  OpenInFull,
} from '@mui/icons-material';

interface AIPhotoEditorProps {
  projectId?: string;
  initialImage?: string;
  mode?: 'single' | 'batch';
  className?: string;
}

interface AIOperation {
  id: string;
  name: string;
  norwegianName: string;
  icon: React.ElementType;
  category: 'enhance' | 'style' | 'repair' | 'transform';
  description: string;
  parameters: AIParameter[];
  premium: boolean
}

interface AIParameter {
  name: string;
  norwegianName: string;
  type: 'slider' | 'select' | 'toggle' | 'color';
  min?: number;
  max?: number;
  step?: number;
  defaultValue: any;
  options?: { value: string; label: string; norwegianLabel: string }[];
}

interface ProcessingResult {
  operation: string;
  operationName: string;
  description: string;
  enhancedImageData: string;
  processingTime: string;
  aiModel: string;
  parameters: Record<string, any>;
}

export function AIPhotoEditor({ projectId, initialImage, mode = 'single', className }: AIPhotoEditorProps) {
  const [currentImage, setCurrentImage] = useState<string>(initialImage || '');
  const [originalImage, setOriginalImage] = useState<string>(initialImage || ', ');
  const [selectedOperation, setSelectedOperation] = useState<AIOperation | null>(null);
  const [operationParameters, setOperationParameters] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);


  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Norwegian Intelligent operations with professional photography focus
  const aiOperations: AIOperation[] = [
    {
      id: 'auto_enhance',
      name: 'Auto Enhance',
      norwegianName: 'Automatisk Forbedring',
      icon: Sparkles,
      category: 'enhance',
      description: 'Intelligent-drevet automatisk forbedring av eksponering, kontrast og skarphet',
      premium: false,
      parameters: [
        {
          name: 'intensity',
          norwegianName: 'Intensitet',
          type: 'slider',
          min:  0,
          max: 10,
          step:  5,
          defaultValue: 70
    },
        {
          name: 'preserveOriginal',
          norwegianName: 'Bevar Original Karakter',
          type: 'toggle',
          defaultValue: true
    }
      ]
  },
    {
      id: 'face_enhance',
      name: 'Face Enhancement', 
      norwegianName: 'Ansiktsforbedring',
      icon: Users,
      category: 'enhance',
      description: 'Intelligent-teknologi for naturlig ansiktsforbedring og hudtone',
      premium: false,
      parameters: [
        {
          name: 'skinSmoothing',
          norwegianName: 'Hudglatting',
          type: 'slider',
          min:  0,
          max: 10,
          step:  5,
          defaultValue: 30
    },
        {
          name: 'eyeEnhancement',
          norwegianName: 'Øyeforbedring',
          type: 'slider',
          min:  0,
          max: 10,
          step:  5,
          defaultValue: 50
    },
        {
          name: 'teethWhitening',
          norwegianName: 'Tannbleking',
          type: 'slider',
          min:  0,
          max: 10,
          step:  5,
          defaultValue: 20
    }
      ]
  },
    {
      id: 'noise_reduction',
      name: 'Noise Reduction',
      norwegianName: 'Støyreduksjon',
      icon: Filter,
      category: 'repair',
      description: 'Intelligent støyreduksjon som bevarer detaljer',
      premium: false,
      parameters: [
        {
          name: 'strength',
          norwegianName: 'Styrke',
          type: 'slider',
          min:  0,
          max: 10,
          step:  5,
          defaultValue: 60
    },
        {
          name: 'preserveDetails',
          norwegianName: 'Bevar Detaljer',
          type: 'toggle',
          defaultValue: true
    }
      ]
  },
    {
      id: 'color_correction',
      name: 'Color Correction',
      norwegianName: 'Fargekorreksjon',
      icon: Palette,
      category: 'enhance',
      description: 'Profesjonell fargekorreksjon og balansering',
      premium: false,
      parameters: [
        {
          name: 'saturation',
          norwegianName: 'Metning',
          type: 'slider',
          min: -10,
          max: 10,
          step:  5,
          defaultValue: 10
    },
        {
          name: 'vibrance',
          norwegianName: 'Livlighet',
          type: 'slider',
          min: -10,
          max: 10,
          step:  5,
          defaultValue: 15
    },
        {
          name: 'temperature',
          norwegianName: 'Temperatur',
          type: 'slider',
          min: -10,
          max: 10,
          step:  5,
          defaultValue: 0
    }
      ]
  },
    {
      id: 'style_transfer',
      name: 'Style Transfer',
      norwegianName: 'Stiloverføring',
      icon: Palette,
      category: 'style',
      description: 'Anvend kunstneriske stiler med Intelligent-teknologi',
      premium: true,
      parameters: [
        {
          name: 'style',
          norwegianName: 'Stil',
          type: 'select',
          defaultValue: 'cinematic',
          options: [
            { value: 'cinematic', label: 'Cinematic', norwegianLabel: 'Filmisk',},
            { value: 'vintage', label: 'Vintage', norwegianLabel: 'Vintage',},
            { value: 'modern', label: 'Modern', norwegianLabel: 'Moderne',},
            { value: 'artistic', label: 'Artistic', norwegianLabel: 'Kunstnerisk',}
          ]
      },
        {
          name: 'intensity',
          norwegianName: 'Intensitet',
          type: 'slider',
          min:  0,
          max: 10,
          step:  5,
          defaultValue: 60
    }
      ]
  },
    {
      id: 'background_removal',
      name: 'Background Removal',
      norwegianName: 'Bakgrunnsfjerning',
      icon: Scissors,
      category: 'transform',
      description: 'Intelligent-drevet presis bakgrunnsfjerning',
      premium: true,
      parameters: [
        {
          name: 'precision',
          norwegianName: 'Presisjon',
          type: 'select',
          defaultValue: 'high',
          options: [
            { value: 'high', label: 'High', norwegianLabel: 'Høy',},
            { value: 'medium', label: 'Medium', norwegianLabel: 'Medium',},
            { value: 'fast', label: 'Fast', norwegianLabel: 'Rask',}
          ]
      },
        {
          name: 'softEdges',
          norwegianName: 'Mykere Kanter',
          type: 'toggle',
          defaultValue: true
    }
      ]
  }
  ];

  // Apply Intelligent enhancement mutation
  const enhanceMutation = useMutation({
    mutationFn: async (enhanceData: {
      imageData: string;
      operation: string;
      parameters: Record<string, any>;
      projectId?: string;
  }) => {
      setIsProcessing(true);
      setProcessingProgress(0);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
    }, 200);

      const response = await fetch('/api/ai-creative/enhance-photo,', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(enhanceData)
  });

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) throw new Error('Failed to enhance photo');
      return response.json();
  },
    onSuccess: (data) => {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingResult(data);
      
      // Add to history
      setHistory(prev => [...prev.slice, (historyIndex + 1), currentImage]);
      setHistoryIndex(prev => prev + 1);
      
      // Update current image
      setCurrentImage(data.enhancedImageData);
      
      console.log(`Intelligent enhancement completed: ${data.operationName} in ${data.processingTime}`);
  },
    onError: () => {
      setIsProcessing(false);
      setProcessingProgress(0);
}
});

  // Handle operation selection and parameter initialization
  const handleOperationSelect = useCallback((operation: AIOperation) => {
    setSelectedOperation(operation);
    
    // Initialize parameters with default values
    const defaultParams = {};
    operation.parameters.forEach(param => {
      defaultParams[param.name] = param.defaultValue;
  });
    setOperationParameters(defaultParams);
}, []);

  // Handle parameter changes
  const handleParameterChange = useCallback((paramName: string, value: any) => {
    setOperationParameters(prev => ({
      ...prev,
      [paramName]: value
  }));
}, []);

  // Apply Intelligent operation
  const handleApplyOperation = useCallback(() => {
    if (!selectedOperation || !currentImage) return;

    enhanceMutation.mutate({
      imageData: currentImage,
      operation: selectedOperation.d,
      parameters: operationParameters,
      projectId
  });
}, [selectedOperation, currentImage, operationParameters, projectId]);

  const handleFilesSelected = (files: File[]) => {
    console.log('🎨 Bilde valgt for intelligent forbedring, :', files);
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCurrentImage(imageData);
        setOriginalImage(imageData);
        setHistory([imageData]);
        setHistoryIndex(0);
    };
      reader.readAsDataURL(file);
  }
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Bilde opplasting fullført for intelligent forbedring, :', results);
};

  // Undo/Redo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setCurrentImage(history[historyIndex - 1]);
  }
}, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setCurrentImage(history[historyIndex + 1]);
  }
}, [history, historyIndex]);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${className}`}>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CreatorHub Photo Enhancer</h1>
              <p className="text-gray-600">Intelligent-drevet bildebehandling for profesjonelle</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div style={{ width: '200px'}}>
              <UniversalFileUpload
                onFilesSelected={handleFilesSelected}
                onUploadComplete={handleUploadComplete}
                allowedTypes="images"
                maxFiles={1}
                maxFileSizeMB={10}
                enableBackgroundUpload={true}
                maxRetries={3}
                profession="photographer"
                showFormatInfo={false}
                uploadEndpoint="/api/ai-creative/upload-image"
                profession="photographer"
              />
            </div>
            
            {currentImage && (
              <Button
                variant="outline"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Angre</span>
              </Button>
            )}
            
            {currentImage && (
              <Button
                variant="outline"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="flex items-center space-x-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Gjør om</span>
              </Button>
            )}
          </div>
        </div>



        {/* Main Content */}
        <div className="grid grid-cols-1 lg: grid-cols-3 gap-6">
          {/* Image Preview , *, /}
          <div className="lg: col-span-2">
            <MuiCard className="h-full">
              <CardHeader sx={theming.getThemedCardSx()}>
                <CardTitle className="flex items-center justify-between" sx={theming.getThemedCardSx()}>
                  <span>Bildeforhåndsvisning</span>
                  {currentImage && originalImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                    >
                      {showBeforeAfter ? 'Skjul sammenligning' : 'Vis før/etter'}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                {!currentImage ? (
                  <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
                    <ImageIcon className="w-16 h-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">Last opp et bilde for å starte</h3>
                    <p className="text-gray-500 text-center mb-4">
                      Støtter JPG, PNG, WEBP og andre vanlige formater
                    </p>
                    <div style={{ maxWidth: '300px', margin: '0 auto'}}>
                      <UniversalFileUpload
                        onFilesSelected={handleFilesSelected}
                        onUploadComplete={handleUploadComplete}
                        allowedTypes="images"
                        maxFiles={1}
                        maxFileSizeMB={10}
                        enableBackgroundUpload={true}
                        maxRetries={3}
                        profession="photographer"
                        showFormatInfo={true}
                        uploadEndpoint="/api/ai-creative/upload-image"
                        profession="photographer"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {showBeforeAfter && originalImage ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-2">Før</p>
                          <img
                            src={originalImage}
                            alt="Original"
                            className="w-full h-auto rounded-lg shadow-md"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-2">Etter</p>
                          <img
                            src={currentImage}
                            alt="Enhanced"
                            className="w-full h-auto rounded-lg shadow-md"
                          />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={currentImage}
                        alt="Current image"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="bg-white p-6 rounded-lg text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-gray-700 mb-2">Behandler bilde...</p>
                          <Progress value={processingProgress} className="w-48" />
                          <p className="text-sm text-gray-500 mt-2">{processingProgress}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </MuiCard>
          </div>

          {/* Intelligent Operations Panel */}
          <div className="space-y-6">
            <MuiCard>
              <CardHeader sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Intelligent-operasjoner</Typography>
              </CardHeader>
              <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
                <Tabs defaultValue="enhance" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="enhance">Forbedre</TabsTrigger>
                    <TabsTrigger value="style">Stil</TabsTrigger>
                    <TabsTrigger value="repair">Reparere</TabsTrigger>
                    <TabsTrigger value="transform">Endre</TabsTrigger>
                  </TabsList>
                  
                  {['enhance','style', 'repair', 'transform'].map(category => (
                    <TabsContent key={category} value={category} className="space-y-3">
                      {aiOperations
                        .filter(op => op.category === category)
                        .map(operation => (
                          <div
                            key={operation.id}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedOperation?.id === operation.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover: border-gray-300'
                        }`}
                            onClick={() => handleOperationSelect(operation)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <operation.icon className="w-5 h-5 text-gray-600" />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {operation.norwegianName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {operation.description}
                                  </p>
                                </div>
                              </div>
                              {operation.premium && (
                                <Badge variant="secondary" className="text-xs">
                                  Premium
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </MuiCard>

            {/* Parameters Panel */}
            {selectedOperation && (
              <MuiCard>
                <CardHeader sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Parametere</Typography>
                </CardHeader>
                <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
                  {selectedOperation.parameters.map(param => (
                    <div key={param.name} className="space-y-2">
                      <Label className="text-sm font-medium">
                        {param.norwegianName}
                      </Label>
                      
                      {param.type === 'slider' && (
                        <div className="space-y-2">
                          <Slider
                            value={[operationParameters[param.name] || param.defaultValue]}
                            onValueChange={(value) => handleParameterChange(param.name, value[0])}
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{param.min}</span>
                            <span>{operationParameters[param.name] || param.defaultValue}</span>
                            <span>{param.max}</span>
                          </div>
                        </div>
                      )}
                      
                      {param.type === 'select' && param.options && (
                        <select
                          value={operationParameters[param.name] || param.defaultValue}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          {param.options.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.norwegianLabel}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {param.type === 'toggle' && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={operationParameters[param.name] ?? param.defaultValue}
                            onChange={(e) => handleParameterChange(param.name, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">
                            {operationParameters[param.name] ?? param.defaultValue ? 'På' : 'Av'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    onClick={handleApplyOperation}
                    disabled={!currentImage || isProcessing}
                    className="w-full mt-4"
                  >
                    {isProcessing ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Behandler...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Wand2 className="w-4 h-4" />
                        <span>Anvend {selectedOperation.norwegianName}</span>
                      </div>
                    )}
                  </Button>
                </CardContent>
              </MuiCard>
            )}

            {/* Processing Result */}
            {processingResult && (
              <MuiCard>
                <CardHeader sx={theming.getThemedCardSx()}>
                  <CardTitle className="flex items-center space-x-2" sx={theming.getThemedCardSx()}>
                    <Award className="w-5 h-5 text-green-600" />
                    <span>Behandlingsresultat</span>
                  </CardTitle>
                </CardHeader>
                <CardContent sx={theming.getThemedCardSx()}>
                  <div className="space-y-2 text-sm">
                    <p><strong>Operasjon: </strong> {processingResult.operationName}</p>
                    <p><strong>Behandlingstid: </strong> {processingResult.processingTime}</p>
                    <p><strong>Intelligent-modell: </strong> {processingResult.aiModel}</p>
                    <p><strong>Beskrivelse: </strong> {processingResult.description}</p>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = currentImage;
                      link.download = `enhanced-${Date.now()}.png`;
                      link.click();
                  }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Last ned forbedret bilde
                  </Button>
                </CardContent>
              </MuiCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
