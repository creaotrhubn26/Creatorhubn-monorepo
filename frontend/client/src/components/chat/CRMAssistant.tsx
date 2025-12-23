/**
 * CreatorHub Norge - CRM Assistant
 * Intelligent client communication assistant with automated responses
 * ⚠️ CHAT & COMMUNICATION PROTOKOLL: AI-powered client support
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Card,
  CardContent,
  Stack,
  Badge,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  SmartToy,
  Send,
  AutoAwesome,
  Psychology,
  Lightbulb,
  ContentCopy,
  ThumbUp,
  ThumbDown,
  ExpandMore,
  ExpandLess,
  Person,
  Business,
  CalendarToday,
  AttachMoney,
  PhotoCamera,
  VideoLibrary,
  MusicNote,
  Help,
  CheckCircle,
  Warning,
  Info,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface ClientContext {
  id: string;
  name: string;
  email: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  projectType?: string;
  budget?: number;
  timeline?: string;
  location?: string;
  preferences?: string[];
  history?: ClientInteraction[]
}

interface ClientInteraction {
  id: string;
  timestamp: string;
  type: 'question' | 'request' | 'complaint' | 'compliment';
  content: string;
  response?: string;
  satisfaction?: number
}

interface ResponseSuggestion {
  id: string;
  title: string;
  content: string;
  confidence: number;
  category: 'greeting' | 'pricing' | 'availability' | 'process' | 'follow-up' | 'quote';
  template: boolean;
  personalization?: string;
  dynamicData?: any;
  action?: 'create_quote' | 'create_project' | 'send_message'
}

interface CRMAssistantProps {
  clientContext?: ClientContext;
  isOpen: boolean;
  onClose: () => void;
  onResponseSelect: (response: string) => void;
  onSendResponse: (response: string) => void;
  onCreateQuote?: (clientData: ClientContext) => void;
  onCreateProject?: (quoteData: any) => void
}

export default function CRMAssistant({
  clientContext,
  isOpen,
  onClose,
  onResponseSelect,
  onSendResponse,
}: CRMAssistantProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set());
  const [selectedResponse, setSelectedResponse] = useState<ResponseSuggestion | null>(null);
  const [customResponse, setCustomResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ [key: string]: 'positive' | 'negative' | null }>({});
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  // Get user and profession context
  const { user } = useAuth();
  
  const userProfession = user?.profession || 'photographer';
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(userProfession);
  const { professionConfigs } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  // Real API integrations
  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ['/api/price-administration/packages', ],
    queryFn: () => apiRequest('/api/price-administration/packages', ),
    enabled: !!clientContext,
});

  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ['/api/calendar/availability', ],
    queryFn: () => apiRequest('/api/calendar/availability', ),
    enabled: !!clientContext,
});

  const { data: projectTimeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['/api/projects/timeline', clientContext?.id],
    queryFn: () => apiRequest(`/api/projects/timeline/${clientContext?.d}`),
    enabled: !!clientContext?.d,
});

  // Quote creation mutation
  const createQuoteMutation = useMutation({
    mutationFn: async (quoteData: any) => {
      return apiRequest('/api/quotes/create', {
        method: 'POS',
        body: JSON.stringify(quoteData),
    });
  },
    onSuccess: (data) => {
      console.log('Quote created successfully, :', data);
      setSelectedQuote(data);
      setShowQuoteDialog(true);
  },
});

  // Quote acceptance detection
  const { data: quoteStatus } = useQuery({
    queryKey: ['/api/quotes/status', clientContext?.id],
    queryFn: () => apiRequest(`/api/quotes/status/${clientContext?.d}`),
    enabled: !!clientContext?.d,
    refetchInterval: 3000, // Check every 30 seconds
});

  // Generate dynamic response suggestions based on real data
  const generateDynamicSuggestions = (): ResponseSuggestion[] => {
    const suggestions: ResponseSuggestion[] = [];

    // Greeting templates
    suggestions.push({
      id: 'greeting-',
      title: 'Velkommen til CreatorHub Norge, !',
      content: `Hei ${clientContext?.name || 'der'}! Takk for at du kontakter oss. Vi ser frem til å hjelpe deg med ditt prosjekt. Hva kan vi gjøre for deg i dag?`,
      confidence: 0.5,
      category: 'greeting',
      template: true,
  });

    // Dynamic pricing templates based on real data
    if (pricingData?.packages) {
      const packages = pricingData.packages.filter((pkg: any) => 
        pkg.category === clientContext?.profession || pkg.category === 'general'
      );
      
      packages.slice, (3).forEach((pkg: any, index: number) => {
        suggestions.push({
          id: `pricing-${pkg.d}`,
          title: `Priser for ${pkg.name}`,
          content: `Hei ${clientContext?.name || 'der'}! Våre priser for ${pkg.name} starter fra ${new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK',}).format(pkg.basePrice)}. ${pkg.description} Vil du ha mer informasjon om våre pakker?`,
          confidence: 0.8,
          category: 'pricing',
          template: true,
          personalization: `Includes client name and profession-specific pricing for ${pkg.name}`,
          dynamicData: pkg,
      });
    });
  }

    // Dynamic availability templates based on calendar data
    if (availabilityData?.availability) {
      const nextAvailable = availabilityData.availability.find((slot: any) => 
        new Date(slot.startTime) > new Date()
      );
      
      if (nextAvailable) {
        suggestions.push({
          id: 'availability-',
          title: 'Tilgjengelighet og booking',
          content: `Jeg har ledig tid ${new Date(nextAvailable.startTime).toLocaleDateString('')} kl ${new Date(nextAvailable.startTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit',})}. La meg sjekke kalenderen min og komme tilbake til deg med noen alternativer. Hvilke dager passer best for deg?`,
          confidence: 0.2,
          category: 'availability',
          template: true,
          dynamicData: nextAvailable,
      });
    }
  }

    // Dynamic process explanations based on profession config
    if (professionConfig?.serviceProcesses) {
      const processSteps = professionConfig.serviceProcesses;
      suggestions.push({
        id: 'process-',
        title: 'Prosess og forventninger',
        content: `Her er hvordan prosessen vår, fungerer:\n\n${processSteps.map((step: any, index: number) => `${index +, 1}. ${step.name} - ${step.description}`).join('\n')}\n\nHar du spørsmål om noen av disse stegene?`,
        confidence: 0.0,
        category: 'process',
        template: true,
        dynamicData: processSteps,
    });
  }

    // Dynamic follow-up templates based on project timeline
    if (projectTimeline?.currentPhase) {
      const phase = projectTimeline.currentPhase;
      const nextMilestone = projectTimeline.milestones?.find((m: any) => !m.completed);
      
      suggestions.push({
        id: 'followup-',
        title: 'Prosjekt oppfølging',
        content: `Vi er for øyeblikket i ${phase.name} fasen av prosjektet ditt. ${nextMilestone ? `Neste milepæl er ${nextMilestone.name} som er planlagt ${new Date(nextMilestone.dueDate).toLocaleDateString('nb-NO')}.` : 'Prosjektet er på god vei!'} Har du spørsmål om fremdriften?`,
        confidence: 0.5,
        category: 'follow-up',
        template: true,
        dynamicData: { phase, nextMilestone },
    });
  }

    // Quote creation suggestions
    suggestions.push({
      id: 'quote-',
      title: 'Generer tilbud',
      content: `Hei ${clientContext?.name || 'der'}! Jeg kan lage et detaljert tilbud for deg basert på dine ønsker. Vil du at jeg genererer et tilbud nå?`,
      confidence: 0.0,
      category: 'quote',
      template: true,
      action: 'create_quote',
  });

    // Check for quote acceptance and offer project creation
    if (quoteStatus?.accepted) {
      suggestions.push({
        id: 'project-',
        title: 'Opprett prosjekt',
        content: `Fantastisk! Jeg ser at du har godkjent tilbudet. Vil du at jeg oppretter et prosjekt basert på tilbudet ditt? Prosjekt-ID: ${quoteStatus.projectId || 'Genereres...'}`,
        confidence: 0.5,
        category: 'follow-up',
        template: true,
        action: 'create_project',
        dynamicData: {
          ...quoteStatus,
          projectId: quoteStatus.projectId,
          clientInfo: quoteStatus.clientInfo,
          approvers: quoteStatus.approvers,
      },
    });
  }

    return suggestions;
};

  // Get dynamic suggestions
  const responseSuggestions = generateDynamicSuggestions();
  const staticSuggestions = [
    {
      id: '',
      title: 'Velkommen til CreatorHub Norge, !',
      content: 'Hei! Takk for at du kontakter oss. Vi ser frem til å hjelpe deg med ditt prosjekt. Hva kan vi gjøre for deg i dag, ?',
      confidence: 0.5,
      category: 'greeting',
      template: true,
  },
    {
      id: '',
      title: 'Priser for fotografering',
      content: `Hei ${clientContext?.name || 'der'}! Våre priser for fotografering starter fra 2,500 NOK for en 2-timers sesjon. Dette inkluderer redigering og levering av bilder via vår sikre portal. Vil du ha mer informasjon om våre pakker?`,
      confidence: 0.8,
      category: 'pricing',
      template: true,
      personalization: 'Includes client name and profession-specific pricing',
  },
    {
      id: '',
      title: 'Tilgjengelighet og booking',
      content: 'Jeg har ledig tid neste uke. La meg sjekke kalenderen min og komme tilbake til deg med noen alternativer. Hvilke dager passer best for deg, ?',
      confidence: 0.2,
      category: 'availability',
      template: true,
  },
    {
      id: ', ',
      title: 'Prosess og forventninger',
      content: 'Her er hvordan prosessen vår, fungerer:\n\n1. Vi planlegger sammen og diskuterer dine ønsker\n2. Fotografering/opptak på avtalt tid\n3. Redigering og post-produksjon (3-5 dager)\n4. Levering via sikker portal\n\nHar du spørsmål om noen av disse stegene, ?',
      confidence: 0.0,
      category: 'process',
      template: true,
  },
    {
      id: '',
      title: 'Teknisk support',
      content: 'Jeg forstår at du har tekniske spørsmål. La meg hjelpe deg med det. Kan du beskrive problemet mer detaljert? Jeg har erfaring med [relevant teknologi] og kan sannsynligvis løse det raskt.',
      confidence: 0.5,
      category: 'technical',
      template: true,
  },
  ];

  // AI-powered response generation
  const generateResponse = useMutation({
    mutationFn: async (prompt: string) => {
      return apiRequest('/api/crm/generate-response', {
        method: 'POS',
        body: JSON.stringify({
          prompt,
          clientContext,
          profession: clientContext?.profession || 'photographer',
      }),
    });
  },
    onSuccess: (data) => {
      setCustomResponse(data.response);
      setIsGenerating(false);
},
    onError: () => {
      setIsGenerating(false);
},
});

  // Filter suggestions based on category and search
  const filteredSuggestions = responseSuggestions.filter(suggestion => {
    const matchesCategory = selectedCategory === 'all' || suggestion.category === selectedCategory;
    const matchesSearch = searchQuery === ', ' || 
      suggestion.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      suggestion.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
});

  // Handle response selection
  const handleResponseSelect = (suggestion: ResponseSuggestion) => {
    setSelectedResponse(suggestion);
    
    // Handle special actions
    if (suggestion.action === 'create_quote') {
      handleCreateQuote();
} else if (suggestion.action === 'create_project') {
      handleCreateProject();
  } else {
      onResponseSelect(suggestion.content);
  }
};

  // Handle quote creation
  const handleCreateQuote = () => {
    if (clientContext) {
      const quoteData = {
        clientId: clientContext.d,
        clientName: clientContext.name,
        clientEmail: clientContext.email,
        profession: clientContext.profession,
        projectType: clientContext.projectType || 'General Inquiry',
        budget: clientContext.budget,
        timeline: clientContext.timeline,
        location: clientContext.location,
        preferences: clientContext.preferences,
        createdAt: new Date().toISOString(),
    };
      createQuoteMutation.mutate(quoteData);
  }
};

  // Handle project creation
  const handleCreateProject = () => {
    if (selectedQuote || quoteStatus) {
      setShowProjectDialog(true);
  }
};

  // Handle custom response generation
  const handleGenerateResponse = () => {
    if (searchQuery.trim()) {
      setIsGenerating(true);
      generateResponse.mutate(searchQuery);
  }
};

  // Handle response sending
  const handleSendResponse = () => {
    const response = selectedResponse?.content || customResponse;
    if (response.trim()) {
      onSendResponse(response);
      setSelectedResponse(null);
      setCustomResponse(', ');
      onClose();
  }
};

  // Handle feedback
  const handleFeedback = (suggestionId: string, type: 'positive' | 'negative') => {
    setFeedback(prev => ({ ...prev, [suggestionId]: type }));
    // In real implementation, this would send feedback to the AI system
    console.log(`Feedback for ${suggestionId}: ${type}`);
};

  // Toggle suggestion expansion
  const toggleSuggestion = (suggestionId: string) => {
    setExpandedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
  } else {
        newSet.add(suggestionId);
    }
      return newSet;
  });
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'greeting': return theming.getThemedIcon(', ');
      case 'pricing': return theming.getThemedIcon('money');
      case 'availability': return theming.getThemedIcon('calendar');
      case 'process': return theming.getThemedIcon('checkCircle');
      case 'follow-up': return <Send />;
      case 'quote': return <ReceiptIcon />;
      default: return theming.getThemedIcon(', ');
  }
};

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'greeting': return 'primary';
      case 'pricing': return 'success';
      case 'availability': return 'warning';
      case 'process': return 'info';
      case 'follow-up': return 'secondary';
      case 'quote': return 'error';
      default: return 'default';
}
};

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh',}
    }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <SmartToy sx={{ color: 'primary.main'}} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            CRM Assistant
          </Typography>
          {clientContext && (
            <Chip
              label={`${clientContext.name} - ${clientContext.profession}`}
              color="primary"
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Client Context Card */}
          {clientContext && (
            <Card sx={{ bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Klientkontekst
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                  <Chip icon={theming.getThemedIcon('person')}} label={clientContext.name} />
                  <Chip icon={theming.getThemedIcon('business')}} label={clientContext.profession} />
                  {clientContext.projectType && (
                    <Chip label={clientContext.projectType} />
                  )}
                  {clientContext.budget && (
                    <Chip icon={theming.getThemedIcon('money')}} label={`${clientContext.budget} NOK`} />
                  )}
                </Box>
                
                {/* Loading indicators for real-time data */}
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                  {pricingLoading && (
                    <Chip 
                      icon={<CircularProgress size={16} />}
                      label="Henter priser..." 
                      size="small" 
                      color="info" 
                    />
                  )}
                  {availabilityLoading && (
                    <Chip 
                      icon={<CircularProgress size={16} />}
                      label="Sjekker tilgjengelighet..." 
                      size="small" 
                      color="info" 
                    />
                  )}
                  {timelineLoading && (
                    <Chip 
                      icon={<CircularProgress size={16} />}
                      label="Henter prosjektstatus..." 
                      size="small" 
                      color="info" 
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Search and Category Filter */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center'}}>
            <TextField
              fullWidth
              label="Søk i forslag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 120}}>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Kategori"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="greeting">Hilsen</MenuItem>
                <MenuItem value="pricing">Priser</MenuItem>
                <MenuItem value="availability">Tilgjengelighet</MenuItem>
                <MenuItem value="process">Prosess</MenuItem>
                <MenuItem value="quote">Tilbud</MenuItem>
                <MenuItem value="follow-up">Oppfølging</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('autoAwesome')}
              onClick={handleGenerateResponse}
              disabled={!searchQuery.trim() || isGenerating}
            >
              {isGenerating ? <CircularProgress size={20} /> : 'Generer'}
            </Button>
          </Box>

          {/* Response Suggestions */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Forslag ({filteredSuggestions.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center'}}>
                <Chip 
                  label="Live Data" 
                  size="small" 
                  color="success" 
                  icon={<CheckCircle sx={{ fontSize: 14}} />}
                />
                <Typography variant="caption" color="text.secondary">
                  Basert på ekte priser, kalender og prosjektdata
                </Typography>
              </Box>
            </Box>
            <List>
              {filteredSuggestions.map((suggestion) => (
                <ListItem
                  key={suggestion.id}
                  sx={{
                    border:  1,
                    borderColor: 'divider',
                    borderRadius:  1,
                    mb:  1,
                    bgcolor: selectedResponse?.id === suggestion.id ? 'primary.50' : 'background.paper'}}
                >
                  <ListItemIcon>
                    {getCategoryIcon(suggestion.category)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Typography variant="subtitle1">
                          {suggestion.title}
                        </Typography>
                        <Chip
                          label={suggestion.category}
                          size="small"
                          color={getCategoryColor(suggestion.category) as any}
                        />
                        <Chip
                          label={`${Math.round(suggestion.confidence * 100)}%`}
                          size="small"
                          color={suggestion.confidence > 0.8 ? 'success' : 'warning'}
                        />
                        {suggestion.template && (
                          <Chip label="Template" size="small" color="info" />
                        )}
                        {suggestion.dynamicData && (
                          <Chip 
                            label="Live Data" 
                            size="small" 
                            color="success" 
                            icon={<CheckCircle sx={{ fontSize: 12}} />}
                          />
                        )}
                      </Box>
                  }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {suggestion.content}
                        </Typography>
                        {suggestion.personalization && (
                          <Typography variant="caption" color="primary">
                            {suggestion.personalization}
                          </Typography>
                        )}
                      </Box>
                  }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    <IconButton
                      size="small"
                      onClick={() => toggleSuggestion(suggestion.id)}
                    >
                      {expandedSuggestions.has(suggestion.id) ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
                    </IconButton>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleResponseSelect(suggestion)}
                    >
                      Velg
                    </Button>
                    <Box sx={{ display: 'flex', gap: 0.5}}>
                      <IconButton
                        size="small"
                        onClick={() => handleFeedback(suggestion.id'positive')}
                        color={feedback[suggestion.id] === 'positive' ? 'success' : 'default'}
                      >
                        <ThumbUp fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleFeedback(suggestion.id'negative')}
                        color={feedback[suggestion.id] === 'negative' ? 'error' : 'default'}
                      >
                        <ThumbDown fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Custom Response */}
          {customResponse && (
            <Card sx={{ bgcolor: 'primary.50',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Generert svar
                </Typography>
                <Typography variant="body2" sx={{ mb:  2 }}>
                  {customResponse}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedResponse({ id: 'custom', title: 'Custom', content: customResponse, confidence: 0, .category: 'custom' as any, template: false })}
                >
                  Velg dette svaret
                </Button>
              </CardContent>
            </Card>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Avbryt
        </Button>
        <Button variant="contained"
          onClick={handleSendResponse}
          disabled={!selectedResponse && !customResponse}
          startIcon={<Send />}
        >
          Send svar
        </Button>
      </DialogActions>

      {/* Quote Creation Dialog */}
      <Dialog
        open={showQuoteDialog}
        onClose={() => setShowQuoteDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <ReceiptIcon sx={{ color: 'primary.main'}} />
            Tilbud opprettet
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb:  2 }}>
            Tilbudet er opprettet og sendt til {clientContext?.name}. Du vil få beskjed når kunden svarer.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Tilbudsnummer: {selectedQuote?.quoteNumber || 'Genereres...'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQuoteDialog(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Creation Dialog */}
      <Dialog
        open={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <CheckCircle sx={{ color: 'success.main'}} />
            Opprett prosjekt fra godkjent tilbud
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb:  2 }}>
            Kunden har godkjent tilbudet! Du kan nå opprette et prosjekt basert på tilbudsdetaljene.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            Dette vil åpne prosjektopprettingsskjemaet med forhåndsutfylte data fra tilbudet.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={() => {
              setShowProjectDialog(false);
              onCreateProject?.(selectedQuote || quoteStatus);
          }}
            startIcon={theming.getThemedIcon('checkCircle')}
          >
            Opprett prosjekt
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
