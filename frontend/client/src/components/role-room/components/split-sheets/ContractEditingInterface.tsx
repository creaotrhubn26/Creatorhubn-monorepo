/**
 * Contract Editing Interface
 * Full-featured contract editor with integration to legal suggestions and references
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Description as ContractIcon,
  Gavel as LegalIcon,
  Lightbulb as SuggestionIcon,
  Link as LinkIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberListIcon,
  Title as HeadingIcon,
  HorizontalRule as DividerLineIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import type { SplitSheet, Contract, ContractParty, ContractObligation, PaymentTerm } from './types';
import { RichTextEditor } from '../RichTextEditor';

interface ContractEditingInterfaceProps {
  splitSheetId: string;
  projectId?: string;
  splitSheetData?: SplitSheet | null;
  contractId?: string;
  onSave: (contract: Contract) => void;
  onCancel: () => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  onApplySuggestion?: (suggestionId: string) => void;
  onAddReference?: (referenceId: string) => void;
}

export default function ContractEditingInterface({
  splitSheetId,
  projectId,
  splitSheetData,
  contractId,
  onSave,
  onCancel,
  profession = 'music_producer',
  onApplySuggestion,
  onAddReference,
}: ContractEditingInterfaceProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const brandColor = theme.palette.primary.main;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [parties, setParties] = useState<ContractParty[]>([]);
  const [obligations, setObligations] = useState<ContractObligation[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [legalReferences, setLegalReferences] = useState<string[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<Contract['status']>('draft');
  const [expandedSection, setExpandedSection] = useState<string | false>('parties');

  // Fetch existing contract if contractId is provided
  const { data: contractData, isLoading: isLoadingContract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const response = await apiRequest(`/api/contracts/${contractId}`);
      return response;
    },
    enabled: !!contractId,
  });

  // Fetch legal suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['split-sheet-legal-suggestions', splitSheetId],
    queryFn: async () => {
      const response = await apiRequest(`/api/norwegian-laws/split-sheets/${splitSheetId}/legal-suggestions`);
      return response;
    },
    enabled: !!splitSheetId,
  });

  // Fetch legal references
  const { data: referencesData } = useQuery({
    queryKey: ['split-sheet-legal-references', splitSheetId],
    queryFn: async () => {
      const response = await apiRequest(`/api/norwegian-laws/split-sheets/${splitSheetId}/legal-references`);
      return response;
    },
    enabled: !!splitSheetId,
  });

  const suggestions = suggestionsData?.data || [];
  const references = referencesData?.data || [];
  const acceptedSuggestions = suggestions.filter((s: any) => s.status === 'accepted');
  const availableReferences = references;

  // Initialize contract data
  useEffect(() => {
    if (contractData?.data) {
      const contract = contractData.data;
      setTitle(contract.title || '');
      setContent(contract.content || '');
      setParties(contract.parties || []);
      setObligations(contract.obligations || []);
      setPaymentTerms(contract.payment_terms || []);
      setLegalReferences(contract.legal_references || []);
      setAppliedSuggestions(contract.applied_suggestions || []);
      setStatus(contract.status || 'draft');
    } else if (splitSheetData) {
      // Auto-populate from split sheet
      const autoParties: ContractParty[] = (splitSheetData.contributors || []).map((contributor) => ({
        name: contributor.name,
        email: contributor.email || '',
        role: contributor.role,
      }));
      setParties(autoParties);
      setTitle(`${splitSheetData.title || 'Split Sheet'} - Kontrakt`);
    }
  }, [contractData, splitSheetData]);

  // Auto-apply accepted suggestions
  useEffect(() => {
    if (acceptedSuggestions.length > 0 && content) {
      // Add accepted suggestions to applied list if not already applied
      const newSuggestions = acceptedSuggestions
        .filter((s: any) => !appliedSuggestions.includes(s.id))
        .map((s: any) => s.id);
      if (newSuggestions.length > 0) {
        setAppliedSuggestions((prev) => [...prev, ...newSuggestions]);
        // Optionally append suggestion content to contract
        const suggestionsText = acceptedSuggestions
          .filter((s: any) => newSuggestions.includes(s.id))
          .map((s: any) => `\n\n${s.title}\n${s.description}`)
          .join('\n');
        if (suggestionsText) {
          setContent((prev) => prev + suggestionsText);
        }
      }
    }
  }, [acceptedSuggestions, appliedSuggestions, content]);

  const handleAddParty = () => {
    setParties([...parties, { name: '', email: '', role: '' }]);
  };

  const handleUpdateParty = (index: number, field: keyof ContractParty, value: string) => {
    const updated = [...parties];
    updated[index] = { ...updated[index], [field]: value };
    setParties(updated);
  };

  const handleRemoveParty = (index: number) => {
    setParties(parties.filter((_, i) => i !== index));
  };

  const handleAddObligation = () => {
    setObligations([...obligations, { description: '', completed: false }]);
  };

  const handleUpdateObligation = (index: number, field: keyof ContractObligation, value: any) => {
    const updated = [...obligations];
    updated[index] = { ...updated[index], [field]: value };
    setObligations(updated);
  };

  const handleRemoveObligation = (index: number) => {
    setObligations(obligations.filter((_, i) => i !== index));
  };

  const handleAddPaymentTerm = () => {
    setPaymentTerms([...paymentTerms, { amount: 0, currency: 'NOK' }]);
  };

  const handleUpdatePaymentTerm = (index: number, field: keyof PaymentTerm, value: any) => {
    const updated = [...paymentTerms];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentTerms(updated);
  };

  const handleRemovePaymentTerm = (index: number) => {
    setPaymentTerms(paymentTerms.filter((_, i) => i !== index));
  };

  const handleApplySuggestion = (suggestionId: string) => {
    const suggestion = suggestions.find((s: any) => s.id === suggestionId);
    if (suggestion && !appliedSuggestions.includes(suggestionId)) {
      setAppliedSuggestions([...appliedSuggestions, suggestionId]);
      const suggestionText = `\n\n${suggestion.title}\n${suggestion.description}`;
      setContent((prev) => prev + suggestionText);
      if (onApplySuggestion) {
        onApplySuggestion(suggestionId);
      }
    }
  };

  const handleAddReference = (referenceId: string) => {
    if (!legalReferences.includes(referenceId)) {
      setLegalReferences([...legalReferences, referenceId]);
      if (onAddReference) {
        onAddReference(referenceId);
      }
    }
  };

  const handleSave = () => {
    const contract: Contract = {
      id: contractId,
      project_id: projectId,
      split_sheet_id: splitSheetId,
      title,
      content,
      parties,
      obligations,
      payment_terms: paymentTerms,
      legal_references: legalReferences,
      applied_suggestions: appliedSuggestions,
      status,
    };
    onSave(contract);
  };

  if (isLoadingContract) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' },
            mb: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
            color: brandColor,
          }}
        >
          <ContractIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
          {contractId ? 'Rediger Kontrakt' : 'Opprett Kontrakt'}
        </Typography>
      </Box>

      {/* Title */}
      <Card sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <TextField
            label="Kontraktstittel"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
              },
              '& .MuiInputLabel-root': {
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Content Editor */}
      <Card sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
              mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            }}
          >
            Kontraktinnhold
          </Typography>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Skriv kontraktinnhold her..."
            minHeight={{ xs: 300, sm: 400, md: 500, lg: 600, xl: 700 }}
            accentColor={brandColor}
          />
        </CardContent>
      </Card>

      {/* Parties Section */}
      <Accordion
        expanded={expandedSection === 'parties'}
        onChange={(_, isExpanded) => setExpandedSection(isExpanded ? 'parties' : false)}
        sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
            <PersonIcon sx={{ color: brandColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
              }}
            >
              Partene ({parties.length})
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
            {parties.map((party, index) => (
              <Card key={index} sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                      }}
                    >
                      Part {index + 1}
                    </Typography>
                    <IconButton
                      onClick={() => handleRemoveParty(index)}
                      size="small"
                      sx={{
                        color: 'error.main',
                        minWidth: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                        minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
                    <TextField
                      label="Navn"
                      fullWidth
                      value={party.name}
                      onChange={(e) => handleUpdateParty(index, 'name', e.target.value)}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                    />
                    <TextField
                      label="E-post"
                      fullWidth
                      type="email"
                      value={party.email || ''}
                      onChange={(e) => handleUpdateParty(index, 'email', e.target.value)}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                    />
                    <TextField
                      label="Rolle"
                      fullWidth
                      value={party.role || ''}
                      onChange={(e) => handleUpdateParty(index, 'role', e.target.value)}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddParty}
              sx={{
                borderColor: brandColor,
                color: brandColor,
                minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              }}
            >
              Legg til part
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Obligations Section */}
      <Accordion
        expanded={expandedSection === 'obligations'}
        onChange={(_, isExpanded) => setExpandedSection(isExpanded ? 'obligations' : false)}
        sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
            <CheckIcon sx={{ color: brandColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
              }}
            >
              Forpliktelser ({obligations.length})
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
            {obligations.map((obligation, index) => (
              <Card key={index} sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                      }}
                    >
                      Forpliktelse {index + 1}
                    </Typography>
                    <IconButton
                      onClick={() => handleRemoveObligation(index)}
                      size="small"
                      sx={{
                        color: 'error.main',
                        minWidth: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                        minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
                    <TextField
                      label="Beskrivelse"
                      fullWidth
                      multiline
                      rows={3}
                      value={obligation.description}
                      onChange={(e) => handleUpdateObligation(index, 'description', e.target.value)}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                    />
                    <TextField
                      label="Frist (valgfritt)"
                      fullWidth
                      type="date"
                      value={obligation.deadline || ''}
                      onChange={(e) => handleUpdateObligation(index, 'deadline', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddObligation}
              sx={{
                borderColor: brandColor,
                color: brandColor,
                minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              }}
            >
              Legg til forpliktelse
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Payment Terms Section */}
      <Accordion
        expanded={expandedSection === 'payments'}
        onChange={(_, isExpanded) => setExpandedSection(isExpanded ? 'payments' : false)}
        sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
            <MoneyIcon sx={{ color: brandColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
              }}
            >
              Betalingsbetingelser ({paymentTerms.length})
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
            {paymentTerms.map((term, index) => (
              <Card key={index} sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                      }}
                    >
                      Betalingsbetingelse {index + 1}
                    </Typography>
                    <IconButton
                      onClick={() => handleRemovePaymentTerm(index)}
                      size="small"
                      sx={{
                        color: 'error.main',
                        minWidth: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                        minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Beløp"
                        fullWidth
                        type="number"
                        value={term.amount}
                        onChange={(e) => handleUpdatePaymentTerm(index, 'amount', parseFloat(e.target.value) || 0)}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                            py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                            minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel
                          sx={{
                            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                          }}
                        >
                          Valuta
                        </InputLabel>
                        <Select
                          value={term.currency}
                          label="Valuta"
                          onChange={(e) => handleUpdatePaymentTerm(index, 'currency', e.target.value)}
                          sx={{
                            minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                            fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          }}
                        >
                          <MenuItem value="NOK">NOK</MenuItem>
                          <MenuItem value="EUR">EUR</MenuItem>
                          <MenuItem value="USD">USD</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Forfallsdato (valgfritt)"
                        fullWidth
                        type="date"
                        value={term.due_date || ''}
                        onChange={(e) => handleUpdatePaymentTerm(index, 'due_date', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                            py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                            minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Prosentandel (valgfritt)"
                        fullWidth
                        type="number"
                        value={term.percentage || ''}
                        onChange={(e) => handleUpdatePaymentTerm(index, 'percentage', parseFloat(e.target.value) || undefined)}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                            py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                            minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                          },
                        }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddPaymentTerm}
              sx={{
                borderColor: brandColor,
                color: brandColor,
                minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              }}
            >
              Legg til betalingsbetingelse
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Legal Suggestions Section */}
      {suggestions.length > 0 && (
        <Accordion
          expanded={expandedSection === 'suggestions'}
          onChange={(_, isExpanded) => setExpandedSection(isExpanded ? 'suggestions' : false)}
          sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
              <SuggestionIcon sx={{ color: brandColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                }}
              >
                Juridiske forslag ({suggestions.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
              {suggestions.map((suggestion: any) => (
                <Card key={suggestion.id} sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                            mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 },
                          }}
                        >
                          {suggestion.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                          }}
                        >
                          {suggestion.description}
                        </Typography>
                      </Box>
                      {appliedSuggestions.includes(suggestion.id) ? (
                        <Chip
                          label="Anvendt"
                          color="success"
                          size="small"
                          sx={{
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                            height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 },
                          }}
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleApplySuggestion(suggestion.id)}
                          sx={{
                            borderColor: brandColor,
                            color: brandColor,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                            minHeight: { xs: 32, sm: 34, md: 36, lg: 38, xl: 40 },
                          }}
                        >
                          Anvend
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Legal References Section */}
      {references.length > 0 && (
        <Accordion
          expanded={expandedSection === 'references'}
          onChange={(_, isExpanded) => setExpandedSection(isExpanded ? 'references' : false)}
          sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
              <LegalIcon sx={{ color: brandColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                }}
              >
                Juridiske referanser ({references.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
              {references.map((reference: any) => (
                <Card key={reference.id} sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                            mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 },
                          }}
                        >
                          {reference.law_name}
                          {reference.chapter && reference.paragraph && ` - ${reference.chapter} ${reference.paragraph}`}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                          }}
                        >
                          {reference.content.substring(0, 200)}...
                        </Typography>
                      </Box>
                      {legalReferences.includes(reference.id) ? (
                        <Chip
                          label="Lagt til"
                          color="success"
                          size="small"
                          sx={{
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                            height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 },
                          }}
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<LinkIcon />}
                          onClick={() => handleAddReference(reference.id)}
                          sx={{
                            borderColor: brandColor,
                            color: brandColor,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                            minHeight: { xs: 32, sm: 34, md: 36, lg: 38, xl: 40 },
                          }}
                        >
                          Legg til
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Actions */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
          justifyContent: { xs: 'stretch', sm: 'flex-end' },
          flexDirection: { xs: 'column', sm: 'row' },
          mt: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
        }}
      >
        <Button
          variant="outlined"
          onClick={onCancel}
          startIcon={<CancelIcon />}
          fullWidth={isMobile}
          sx={{
            minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
          }}
        >
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          startIcon={<SaveIcon />}
          fullWidth={isMobile}
          disabled={!title.trim()}
          sx={{
            bgcolor: brandColor,
            '&:hover': { bgcolor: brandColor },
            minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
            fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
          }}
        >
          {contractId ? 'Oppdater' : 'Opprett'} Kontrakt
        </Button>
      </Box>
    </Box>
  );
}

