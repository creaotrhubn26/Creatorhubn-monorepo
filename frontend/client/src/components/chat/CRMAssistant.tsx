/**
 * CreatorHub Norge - CRM Assistant
 * Intelligent client communication assistant with automated response suggestions.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  Close,
  ContentCopy,
  Psychology,
  Send,
  ThumbDown,
  ThumbUp,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor';

type SuggestionCategory =
  | 'greeting'
  | 'pricing'
  | 'availability'
  | 'process'
  | 'follow-up'
  | 'quote';

interface ClientInteraction {
  id: string;
  timestamp: string;
  type: 'question' | 'request' | 'complaint' | 'compliment';
  content: string;
  response?: string;
  satisfaction?: number;
}

interface ClientContext {
  id: string;
  name: string;
  email: string;
  profession: Profession;
  projectType?: string;
  budget?: number;
  timeline?: string;
  location?: string;
  preferences?: string[];
  history?: ClientInteraction[];
}

interface ResponseSuggestion {
  id: string;
  title: string;
  content: string;
  confidence: number;
  category: SuggestionCategory;
  template: boolean;
  personalization?: string;
  action?: 'create_quote' | 'create_project' | 'send_message';
}

interface PricingPackage {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category?: string;
}

interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

interface CRMAssistantProps {
  clientContext?: ClientContext;
  isOpen: boolean;
  onClose: () => void;
  onResponseSelect: (response: string) => void;
  onSendResponse: (response: string) => void;
  onCreateQuote?: (clientData: ClientContext) => void;
  onCreateProject?: (quoteData: { clientId: string; clientName: string; quoteSummary: string }) => void;
}

function parsePricingPackages(payload: unknown): PricingPackage[] {
  if (Array.isArray(payload)) {
    return payload as PricingPackage[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as {
      packages?: unknown;
      data?: unknown;
    };

    if (Array.isArray(objectPayload.packages)) {
      return objectPayload.packages as PricingPackage[];
    }

    if (Array.isArray(objectPayload.data)) {
      return objectPayload.data as PricingPackage[];
    }
  }

  return [];
}

function parseAvailabilitySlots(payload: unknown): AvailabilitySlot[] {
  if (Array.isArray(payload)) {
    return payload as AvailabilitySlot[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as {
      availability?: unknown;
      data?: unknown;
    };

    if (Array.isArray(objectPayload.availability)) {
      return objectPayload.availability as AvailabilitySlot[];
    }

    if (Array.isArray(objectPayload.data)) {
      return objectPayload.data as AvailabilitySlot[];
    }
  }

  return [];
}

function confidenceLabel(confidence: number): 'success' | 'warning' | 'default' {
  if (confidence >= 0.85) {
    return 'success';
  }
  if (confidence >= 0.65) {
    return 'warning';
  }
  return 'default';
}

const CATEGORY_OPTIONS: Array<{ value: SuggestionCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'greeting', label: 'Greeting' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'availability', label: 'Availability' },
  { value: 'process', label: 'Process' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'quote', label: 'Quote' },
];

export default function CRMAssistant({
  clientContext,
  isOpen,
  onClose,
  onResponseSelect,
  onSendResponse,
  onCreateQuote,
  onCreateProject,
}: CRMAssistantProps) {
  const { user } = useAuth();
  const { getProfessionDisplayName } = useDynamicProfessions();

  const [selectedCategory, setSelectedCategory] = useState<SuggestionCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<ResponseSuggestion | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [feedback, setFeedback] = useState<Record<string, 'positive' | 'negative' | null>>({});

  const { data: pricingPackages = [] } = useQuery({
    queryKey: ['/api/pricing/packages', user?.id],
    enabled: Boolean(isOpen && user?.id),
    queryFn: async () => {
      const payload = await apiRequest(`/api/pricing/packages/${user?.id}`);
      return parsePricingPackages(payload);
    },
  });

  const { data: availabilitySlots = [] } = useQuery({
    queryKey: ['/api/calendar/availability'],
    enabled: isOpen,
    queryFn: async () => {
      const payload = await apiRequest('/api/calendar/availability');
      return parseAvailabilitySlots(payload);
    },
  });

  const suggestions = useMemo<ResponseSuggestion[]>(() => {
    if (!clientContext) {
      return [];
    }

    const greeting: ResponseSuggestion = {
      id: 'greeting',
      title: 'Friendly greeting',
      content: `Hei ${clientContext.name}! Takk for meldingen. Jeg hjelper deg gjerne videre med ${getProfessionDisplayName(clientContext.profession).toLowerCase()}-prosjektet ditt.`,
      confidence: 0.9,
      category: 'greeting',
      template: true,
      action: 'send_message',
    };

    const pricingSuggestion: ResponseSuggestion = {
      id: 'pricing',
      title: 'Pricing response',
      content:
        pricingPackages.length > 0
          ? `Vi har flere aktuelle pakker. For eksempel starter ${pricingPackages[0].name} fra ${pricingPackages[0].basePrice.toLocaleString('nb-NO')} NOK. Ønsker du at jeg setter opp et konkret tilbud?`
          : 'Vi kan sette opp et konkret tilbud basert på budsjett og leveransebehov. Vil du at jeg sender et prisutkast?',
      confidence: pricingPackages.length > 0 ? 0.88 : 0.7,
      category: 'pricing',
      template: true,
      action: 'create_quote',
    };

    const availabilitySuggestion: ResponseSuggestion = {
      id: 'availability',
      title: 'Availability response',
      content:
        availabilitySlots.length > 0
          ? `Jeg har ledige tider snart, blant annet ${new Date(availabilitySlots[0].startTime).toLocaleString('nb-NO')}. Passer dette for deg?`
          : 'Jeg sjekker kalenderen nå og sender deg konkrete forslag til tidspunkter innen kort tid.',
      confidence: availabilitySlots.length > 0 ? 0.84 : 0.65,
      category: 'availability',
      template: true,
      action: 'send_message',
    };

    const processSuggestion: ResponseSuggestion = {
      id: 'process',
      title: 'Process explanation',
      content:
        'Prosessen vår er enkel: 1) avklaring av mål, 2) planlegging, 3) produksjon, 4) levering/revisjon. Vi holder deg oppdatert i hvert steg.',
      confidence: 0.78,
      category: 'process',
      template: true,
      action: 'send_message',
    };

    const followUpSuggestion: ResponseSuggestion = {
      id: 'follow-up',
      title: 'Follow-up',
      content:
        'Ville bare følge opp tråden vår. Jeg kan sende en konkret plan med tidslinje og leveranser i dag om du vil.',
      confidence: 0.75,
      category: 'follow-up',
      template: true,
      action: 'send_message',
    };

    const quoteSuggestion: ResponseSuggestion = {
      id: 'quote',
      title: 'Quote handoff',
      content:
        'Jeg kan sette opp et tilbud nå med detaljert omfang, pris og levering. Bekreft gjerne ønsket leveringsdato og hovedmål.',
      confidence: 0.86,
      category: 'quote',
      template: true,
      action: 'create_quote',
    };

    return [
      greeting,
      pricingSuggestion,
      availabilitySuggestion,
      processSuggestion,
      followUpSuggestion,
      quoteSuggestion,
    ];
  }, [availabilitySlots, clientContext, getProfessionDisplayName, pricingPackages]);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((suggestion) => {
      const matchesCategory = selectedCategory === 'all' || suggestion.category === selectedCategory;
      const matchesSearch =
        suggestion.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        suggestion.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory, suggestions]);

  const handleUseSuggestion = (suggestion: ResponseSuggestion) => {
    setSelectedSuggestion(suggestion);
    setDraftMessage(suggestion.content);
    onResponseSelect(suggestion.content);
  };

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftMessage);
    } catch {
      // Clipboard can fail in restricted browser contexts.
    }
  };

  const handleSend = () => {
    if (!draftMessage.trim()) {
      return;
    }

    onSendResponse(draftMessage.trim());

    if (selectedSuggestion?.action === 'create_quote' && clientContext && onCreateQuote) {
      onCreateQuote(clientContext);
    }

    if (selectedSuggestion?.action === 'create_project' && clientContext && onCreateProject) {
      onCreateProject({
        clientId: clientContext.id,
        clientName: clientContext.name,
        quoteSummary: draftMessage.trim(),
      });
    }
  };

  const feedbackValue = selectedSuggestion ? feedback[selectedSuggestion.id] : null;

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">CRM Assistant</Typography>
            <Typography variant="caption" color="text.secondary">
              {clientContext
                ? `${clientContext.name} • ${getProfessionDisplayName(clientContext.profession)}`
                : 'No client selected'}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        {!clientContext ? (
          <Alert severity="info">Velg en klient for å få relevante forslag.</Alert>
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                label="Search suggestions"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Category"
                  onChange={(event) =>
                    setSelectedCategory(event.target.value as SuggestionCategory | 'all')
                  }
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
              <Stack spacing={1.25}>
                {filteredSuggestions.map((suggestion) => {
                  const selected = selectedSuggestion?.id === suggestion.id;
                  return (
                    <Card
                      key={suggestion.id}
                      variant="outlined"
                      sx={{ borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1 }}
                    >
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {suggestion.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {suggestion.content}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Chip size="small" label={suggestion.category} variant="outlined" />
                              <Chip
                                size="small"
                                label={`${Math.round(suggestion.confidence * 100)}%`}
                                color={confidenceLabel(suggestion.confidence)}
                              />
                              {suggestion.template && <Chip size="small" label="Template" />}
                            </Stack>
                          </Box>

                          <Button
                            size="small"
                            variant={selected ? 'contained' : 'outlined'}
                            startIcon={<AutoAwesome fontSize="small" />}
                            onClick={() => handleUseSuggestion(suggestion)}
                          >
                            Use
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>

            <Divider />

            <TextField
              label="Draft response"
              multiline
              minRows={6}
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              fullWidth
            />

            {selectedSuggestion && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Suggestion feedback:
                </Typography>
                <Tooltip title="Useful">
                  <IconButton
                    size="small"
                    color={feedbackValue === 'positive' ? 'success' : 'default'}
                    onClick={() =>
                      setFeedback((previous) => ({
                        ...previous,
                        [selectedSuggestion.id]:
                          previous[selectedSuggestion.id] === 'positive' ? null : 'positive',
                      }))
                    }
                  >
                    <ThumbUp fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Not useful">
                  <IconButton
                    size="small"
                    color={feedbackValue === 'negative' ? 'error' : 'default'}
                    onClick={() =>
                      setFeedback((previous) => ({
                        ...previous,
                        [selectedSuggestion.id]:
                          previous[selectedSuggestion.id] === 'negative' ? null : 'negative',
                      }))
                    }
                  >
                    <ThumbDown fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}

            <Alert severity="info" icon={<Psychology fontSize="small" />}>
              Forslagene bruker klientkontekst, priser og kalenderdata for mer presise svar.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button startIcon={<ContentCopy />} onClick={handleCopyDraft} disabled={!draftMessage.trim()}>
          Copy
        </Button>
        <Button
          variant="contained"
          startIcon={<Send />}
          onClick={handleSend}
          disabled={!draftMessage.trim()}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
}
