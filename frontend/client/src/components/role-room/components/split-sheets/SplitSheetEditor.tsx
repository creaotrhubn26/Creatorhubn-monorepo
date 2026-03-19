import React, { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Box, Typography, TextField, Button, Stack, Card, CardContent, IconButton, Alert, FormControl, InputLabel, Select, MenuItem, Grid2 as Grid, Accordion, AccordionSummary, AccordionDetails, alpha, Avatar, Chip, Divider, InputAdornment, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle, DialogContent } from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon, Cancel as CancelIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon, ExpandMore as ExpandMoreIcon, Person as PersonIcon, Email as EmailIcon, Percent as PercentIcon, Language as LanguageIcon, OpenInNew as OpenInNewIcon, AttachMoney as AttachMoneyIcon, Visibility as VisibilityIcon, AccountBalance as PortalIcon, Gavel as GavelIcon, TheaterComedy as TheaterComedyIcon, Movie as MovieIcon, Payments as PaymentsIcon } from "@mui/icons-material";
import { LocationsIcon as LocationOnIcon } from "../icons/CastingIcons";
import { useDynamicProfessions } from "../../hooks/useDynamicProfessions";
import getProfessionIcon from "@/utils/profession-icons";
import { ROLE_DISPLAY_NAMES as ROLE_NAMES, DEFAULT_UNION_AGREEMENT_SETTINGS, PRODUCTION_TYPE_LABELS, PARTICIPANT_TYPE_LABELS, UNION_MEMBERSHIP_LABELS, NSF_AGREEMENT_LABELS, NFF_AGREEMENT_LABELS, RIGHTS_MANAGEMENT_LABELS, UNION_LEGAL_REFERENCES, checkTariffApplicability, NSF_WAGE_REFERENCES, NFF_WAGE_REFERENCES, WAGE_INFO_RESOURCES, getWageReferenceUrl, getRelevantWageReferences, type SplitSheet, type SplitSheetContributor, type CreateSplitSheetRequest, type UpdateSplitSheetRequest, type ContributorRole, type UnionAgreementSettings, type ProductionType, type ParticipantType, type UnionMembershipType, type NSFAgreementType, type NFFAgreementType, type RightsManagementType } from "./types";
import SplitSheetSongFlowIntegration from "./SplitSheetSongFlowIntegration";
import SplitSheetPortalView from "./SplitSheetPortalView";
import PricingSelector from "../shared/PricingSelector";
import GlobalMentionHelper from "../shared/GlobalMentionHelper";

interface SplitSheetEditorProps {
  splitSheet?: SplitSheet | null;
  projectId?: string;
  trackId?: string;
  initialContributors?: SplitSheetContributor[];
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  projectName?: string;
  agreementLabel?: string;
  onSave: (splitSheet: SplitSheet) => void;
  onCancel: () => void;
  onSaveProject?: () => Promise<boolean>; // Called before saving split sheet to ensure project exists
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

export default function SplitSheetEditor({
  splitSheet,
  projectId,
  trackId,
  initialContributors,
  profession = 'music_producer',
  projectName,
  agreementLabel = 'Split Sheet',
  onSave,
  onCancel,
  onSaveProject
}: SplitSheetEditorProps) {
  const [title, setTitle] = useState(splitSheet?.title || (projectName ? `${projectName} - ${agreementLabel}` : ''));
  const [description, setDescription] = useState(splitSheet?.description || '');
  const [totalBudget, setTotalBudget] = useState<number>(splitSheet?.metadata?.total_budget || 0);
  const [calculationMethod, setCalculationMethod] = useState<'budget' | 'percentage'>(() => {
    // Check if calculation_method is explicitly set
    if (splitSheet?.metadata?.calculation_method) {
      return splitSheet.metadata.calculation_method;
    }
    // Check if there are any contributors with dagsats
    const hasDagsatsContributors = splitSheet?.contributors?.some(c => 
      c.custom_fields?.dagsats && Number(c.custom_fields.dagsats) > 0
    );
    // If there are dagsats contributors or total_budget is set, default to budget
    if (splitSheet?.metadata?.total_budget || hasDagsatsContributors) {
      return 'budget';
    }
    return 'percentage';
  });
  const [contributors, setContributors] = useState<Omit<SplitSheetContributor, 'id' | 'split_sheet_id' | 'created_at' | 'updated_at'>[]>(
    splitSheet?.contributors?.map(c => ({
      name: c.name,
      email: c.email || '',
      role: c.role,
      percentage: c.percentage,
      user_id: c.user_id || undefined,
      order_index: c.order_index || 0,
      custom_fields: {
        ...c.custom_fields,
        payment_type: c.custom_fields?.payment_type || (c.custom_fields?.dagsats ? 'dagsats' : 'percentage')
      }
    })) || initialContributors?.map(c => ({
      name: c.name,
      email: c.email || '',
      role: c.role,
      percentage: c.percentage,
      user_id: c.user_id || undefined,
      order_index: c.order_index || 0,
      custom_fields: {
        ...c.custom_fields,
        payment_type: c.custom_fields?.payment_type || (c.custom_fields?.dagsats ? 'dagsats' : 'percentage')
      }
    })) || []
  );
  const [expandedContributor, setExpandedContributor] = useState<number | null>(null);
  const [showPortalView, setShowPortalView] = useState(false);
  const [showUnionSettings, setShowUnionSettings] = useState(false);
  
  // Union agreement settings state
  const [unionSettings, setUnionSettings] = useState<UnionAgreementSettings>(() => {
    const saved = splitSheet?.metadata?.union_settings;
    return saved ? { ...DEFAULT_UNION_AGREEMENT_SETTINGS, ...saved } : DEFAULT_UNION_AGREEMENT_SETTINGS;
  });
  
  // Update title when projectName changes (sync with project name)
  useEffect(() => {
    if (projectName) {
      const expectedTitle = `${projectName} - ${agreementLabel}`;
      // Only update if title is empty or matches the auto-generated pattern
      if (!title || (title.endsWith(` - ${agreementLabel}`) && !splitSheet?.title)) {
        setTitle(expectedTitle);
      }
    }
  }, [agreementLabel, projectName, splitSheet?.title, title]);
  
  // Get profession-specific styling
  const { getProfessionColor, getProfessionDisplayName } = useDynamicProfessions();
  const professionColor = getProfessionColor(profession);
  const professionDisplayName = getProfessionDisplayName(profession);
  const professionIcon = getProfessionIcon(profession);
  const mentionCandidates = useMemo(() => {
    const pool = new Set<string>();
    contributors.forEach((contributor) => {
      if (typeof contributor.name === 'string' && contributor.name.trim()) pool.add(contributor.name.trim());
      if (typeof contributor.role === 'string' && contributor.role.trim()) pool.add(contributor.role.trim());
    });
    if (projectName?.trim()) pool.add(projectName.trim());
    return Array.from(pool);
  }, [contributors, projectName]);
  
  // Get profession-specific terminology for labels
  const getProfessionLabels = () => {
    switch (profession) {
      case 'music_producer':
        return {
          titlePlaceholder: 'F.eks. "Summer Vibes - Single"',
          descriptionPlaceholder: 'Beskrivelse av låten eller prosjektet...',
          contributorLabel: 'Bidragsyter',
          contributorsLabel: 'Bidragsytere',
          addContributorLabel: 'Legg til bidragsyter',
        };
      case 'photographer':
        return {
          titlePlaceholder: 'F.eks. "Bryllup Hansen/Olsen 2024"',
          descriptionPlaceholder: 'Beskrivelse av fotoprosjektet...',
          contributorLabel: 'Samarbeidspartner',
          contributorsLabel: 'Samarbeidspartnere',
          addContributorLabel: 'Legg til samarbeidspartner',
        };
      case 'videographer':
        return {
          titlePlaceholder: 'F.eks. "Bedriftsvideo - Firma AS"',
          descriptionPlaceholder: 'Beskrivelse av videoproduksjonen...',
          contributorLabel: 'Crew-medlem',
          contributorsLabel: 'Crew-medlemmer',
          addContributorLabel: 'Legg til crew-medlem',
        };
      default:
        return {
          titlePlaceholder: `Tittel på ${agreementLabel.toLowerCase()}`,
          descriptionPlaceholder: 'Beskrivelse av prosjektet...',
          contributorLabel: 'Bidragsyter',
          contributorsLabel: 'Bidragsytere',
          addContributorLabel: 'Legg til bidragsyter',
        };
    }
  };
  
  const labels = getProfessionLabels();
  const selectedRightsManagers = unionSettings.rightsManagement ?? [];
  const activeTariffReferences = useMemo(() => {
    const references: Array<(typeof NSF_WAGE_REFERENCES)[keyof typeof NSF_WAGE_REFERENCES] | (typeof NFF_WAGE_REFERENCES)[keyof typeof NFF_WAGE_REFERENCES]> = [];

    const nsfReferenceMap: Partial<Record<NSFAgreementType, (typeof NSF_WAGE_REFERENCES)[keyof typeof NSF_WAGE_REFERENCES]>> = {
      filmavtalen: NSF_WAGE_REFERENCES.filmavtalen,
      tv_drama: NSF_WAGE_REFERENCES.tv_drama,
      reklamefilm: NSF_WAGE_REFERENCES.reklamefilm,
      strommeplattform: NSF_WAGE_REFERENCES.streaming,
      voice: NSF_WAGE_REFERENCES.voice,
    };

    const nffReferenceMap: Partial<Record<NFFAgreementType, (typeof NFF_WAGE_REFERENCES)[keyof typeof NFF_WAGE_REFERENCES]>> = {
      spillefilm: NFF_WAGE_REFERENCES.spillefilm,
      tv_drama: NFF_WAGE_REFERENCES.tv_drama,
      tv_entertainment: NFF_WAGE_REFERENCES.tv_entertainment,
      reklame: NFF_WAGE_REFERENCES.reklame,
      dubbing: NFF_WAGE_REFERENCES.dubbing,
    };

    if (unionSettings.nsfAgreementApplies && unionSettings.nsfAgreementType && unionSettings.nsfAgreementType !== 'none') {
      const reference = nsfReferenceMap[unionSettings.nsfAgreementType];
      if (reference) references.push(reference);
    }

    if (unionSettings.nffAgreementApplies && unionSettings.nffAgreementType && unionSettings.nffAgreementType !== 'none') {
      const reference = nffReferenceMap[unionSettings.nffAgreementType];
      if (reference) references.push(reference);
    }

    return references;
  }, [unionSettings.nffAgreementApplies, unionSettings.nffAgreementType, unionSettings.nsfAgreementApplies, unionSettings.nsfAgreementType]);

  const toggleRightsManagement = (type: RightsManagementType) => {
    const rightsManagement = selectedRightsManagers.includes(type)
      ? selectedRightsManagers.filter((entry) => entry !== type)
      : [...selectedRightsManagers, type];

    setUnionSettings({
      ...unionSettings,
      rightsManagement,
      forRightsManagement: rightsManagement.includes('for_filmforbundet'),
    });
  };

  // Get available roles based on profession
  const getAvailableRoles = (prof: string): ContributorRole[] => {
    switch(prof) {
      case 'music_producer':
        return [
          'producer','artist','songwriter','composer','lyricist','vocalist','instrumentalist','mix_engineer','mastering_engineer','arranger','featured_artist','backing_vocalist','session_musician','publisher','label','collaborator','other'
        ];
      case 'photographer':
        return [
          'second_shooter','photo_editor','retoucher','assistant','stylist','makeup_artist','collaborator','other'
        ];
      case 'videographer':
        return [
          'director',
          'producer',
          'cinematographer',
          'camera_operator',
          'drone_pilot',
          'video_editor',
          'colorist',
          'sound_engineer',
          'audio_mixer',
          'grip',
          'gaffer',
          'production_assistant',
          'script_supervisor',
          'location_manager',
          'production_designer',
          'vfx_artist',
          'motion_graphics',
          'collaborator',
          'other'
        ];
      default:
        return ['collaborator','other'];
    }
  };

  const availableRoles = useMemo(() => getAvailableRoles(profession), [profession]);

  // Helper functions for number formatting with thousand separators
  const formatNumberWithSpaces = (value: number | string): string => {
    if (!value && value !== 0) return '';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '')) : value;
    if (isNaN(numValue)) return '';
    return numValue.toLocaleString('no-NO', { maximumFractionDigits: 0 }).replace(/,/g, ' ');
  };

  const parseFormattedNumber = (value: string): number => {
    // Remove all spaces and parse as number
    const cleaned = value.replace(/\s/g, '').replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  // Calculate total percentage (only for contributors using percentage payment type)
  const totalPercentage = useMemo(() => {
    return contributors
      .filter(c => !c.custom_fields?.payment_type || c.custom_fields?.payment_type === 'percentage')
      .reduce((sum, c) => sum + (c.percentage || 0), 0);
  }, [contributors]);

  // Calculate total dagsats for budget method
  const totalDagsats = useMemo(() => {
    return contributors.reduce((sum, c) => {
      const dagsats = Number(c.custom_fields?.dagsats) || 0;
      return sum + dagsats;
    }, 0);
  }, [contributors]);

  // Calculate remaining budget
  const remainingBudget = useMemo(() => {
    return totalBudget - totalDagsats;
  }, [totalBudget, totalDagsats]);

  // MVA rate (25% in Norway)
  const MVA_RATE = 0.25;

  // Calculate amounts including MVA
  const totalBudgetInklMVA = useMemo(() => {
    const budget = Number(totalBudget) || 0;
    return budget * (1 + MVA_RATE);
  }, [totalBudget]);

  const totalDagsatsInklMVA = useMemo(() => {
    const dagsats = Number(totalDagsats) || 0;
    return dagsats * (1 + MVA_RATE);
  }, [totalDagsats]);

  const remainingBudgetInklMVA = useMemo(() => {
    const remaining = Number(remainingBudget) || 0;
    return remaining * (1 + MVA_RATE);
  }, [remainingBudget]);

  const isValid = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (calculationMethod === 'budget') {
      // For budget method: must have total budget and all contributors must have dagsats
      return title.trim().length > 0 && 
             totalBudget > 0 &&
             contributors.length > 0 &&
             contributors.every(c => {
               const hasName = c.name.trim().length > 0;
               const hasEmail = c.email && c.email.trim().length > 0 && emailRegex.test(c.email.trim());
               const hasDagsats = c.custom_fields?.dagsats && Number(c.custom_fields.dagsats) > 0;
               return hasName && hasEmail && hasDagsats;
             });
    } else {
      // For percentage method: must total 100%
      const percentageContributors = contributors.filter(c => !c.custom_fields?.payment_type || c.custom_fields?.payment_type === 'percentage');
      
      return title.trim().length > 0 && 
             contributors.length > 0 &&
             (percentageContributors.length === 0 || Math.abs(totalPercentage - 100) < 0.01) &&
             contributors.every(c => {
               const hasName = c.name.trim().length > 0;
               const hasEmail = c.email && c.email.trim().length > 0 && emailRegex.test(c.email.trim());
               const hasValidPercentage = c.percentage > 0 && c.percentage <= 100;
               return hasName && hasEmail && hasValidPercentage;
             });
    }
  }, [title, totalPercentage, contributors, calculationMethod, totalBudget]);

  // Create/Update mutation - Database persistent
  const saveMutation = useMutation({
    mutationFn: async (data: CreateSplitSheetRequest | UpdateSplitSheetRequest) => {
      try {
        let response;
        
        // Check if split sheet exists in database before trying to update
        if (splitSheet?.id) {
          try {
            // Try to fetch the split sheet to see if it exists
            const existingResponse = await apiRequest(`/api/split-sheets/${splitSheet.id}`);
            if (existingResponse?.success !== false && existingResponse?.data) {
              // Split sheet exists, update it
              response = await apiRequest(`/api/split-sheets/${splitSheet.id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
              });
            } else {
              // Split sheet doesn't exist, create it
              response = await apiRequest('/api/split-sheets', {
                method: 'POST',
                body: JSON.stringify({
                  ...data,
                  id: splitSheet.id, // Include the ID in the create request
                })
              });
            }
          } catch (fetchError: unknown) {
            // If fetch fails (404 or other), the split sheet doesn't exist, so create it
            const fetchErrMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            if (fetchErrMsg.includes('404') || fetchErrMsg.includes('API error: 404')) {
              response = await apiRequest('/api/split-sheets', {
                method: 'POST',
                body: JSON.stringify({
                  ...data,
                  id: splitSheet.id, // Include the ID in the create request
                })
              });
            } else {
              throw fetchError;
            }
          }
        } else {
          // Create new split sheet in database
          response = await apiRequest('/api/split-sheets', {
            method: 'POST',
            body: JSON.stringify(data)
          });
        }
        
        // Ensure we return the split sheet data from the response
        // Handle both response formats: { success: true, data: {...} } or direct data
        if (response?.success !== false) {
          return response?.data || response;
        }
        throw new Error(response?.error || 'Failed to save split sheet to database');
      } catch (error: unknown) {
        // Enhance error message with backend details
        if (error instanceof Error) {
          const errWithResponse = error as Error & { response?: { data?: { error?: string } } };
          if (errWithResponse.response?.data) {
            throw new Error(errWithResponse.response.data.error || error.message);
          }
          throw error;
        }
        throw new Error(typeof error === 'string' ? error : 'Failed to save split sheet to database');
      }
    },
    onSuccess: (response) => {
      // Handle both response formats: { data: ... } or direct data
      const splitSheetData = response?.data || response;
      if (splitSheetData) {
        onSave(splitSheetData);
      }
    },
    onError: (error: unknown) => {
      console.error('Error saving split sheet:', error);
      // Error is already handled in the UI via saveMutation.isError
    }
  });

  const handleAddContributor = () => {
    setContributors([
      ...contributors,
      {
        name: '',
        email: '',
        role: 'collaborator',
        percentage: 0,
        order_index: contributors.length,
        custom_fields: {
          payment_type: calculationMethod === 'budget' ? 'dagsats' : 'percentage'
        }
      }
    ]);
    setExpandedContributor(contributors.length);
  };

  const handleRemoveContributor = (index: number) => {
    setContributors(contributors.filter((_, i) => i !== index));
  };

  const handleContributorChange = (index: number, field: keyof SplitSheetContributor, value: any) => {
    const updated = [...contributors];
    updated[index] = { ...updated[index], [field]: value };
    setContributors(updated);
  };

  const handleCustomFieldChange = (index: number, field: string, value: any) => {
    const updated = [...contributors];
    const customFields = updated[index].custom_fields || {};
    
    // If dagsats is changed, calculate percentage based on total budget
    if (field === 'dagsats' && totalBudget > 0) {
      const dagsatsValue = parseFloat(value) || 0;
      const calculatedPercentage = (dagsatsValue / totalBudget) * 100;
      updated[index] = {
        ...updated[index],
        percentage: calculatedPercentage,
        custom_fields: { ...customFields, [field]: value }
      };
    } else {
      updated[index] = {
        ...updated[index],
        custom_fields: { ...customFields, [field]: value }
      };
    }
    setContributors(updated);
  };

  const handleAutoFixPercentages = async () => {
    if (totalPercentage === 0) return;
    
    // If split sheet exists, use backend validation
    if (splitSheet?.id) {
      try {
        const response = await apiRequest(`/api/split-sheets/${splitSheet.id}/validate-percentages`, {
          method: 'POST',
          body: JSON.stringify({ auto_fix: true })
        });
        
        if (response.success) {
          // Refresh contributors from backend
          const updatedResponse = await apiRequest(`/api/split-sheets/${splitSheet.id}`);
          if (updatedResponse.success && updatedResponse.data.contributors) {
            setContributors(updatedResponse.data.contributors.map((c: any) => ({
              name: c.name,
              email: c.email || '',
              role: c.role,
              percentage: c.percentage,
              user_id: c.user_id || undefined,
              order_index: c.order_index || 0,
              custom_fields: c.custom_fields || {}
            })));
          }
        }
      } catch (error) {
        console.error('Error auto-fixing percentages: ', error);
      }
    } else {
      // Frontend-only fix for new split sheets
      const adjustmentFactor = 100 / totalPercentage;
      const updated = contributors.map(c => ({
        ...c,
        percentage: Math.round((c.percentage * adjustmentFactor) * 100) / 100
      }));
      setContributors(updated);
    }
  };

  const handleDistributeEvenly = () => {
    if (contributors.length === 0) return;
    const evenPercentage = 100 / contributors.length;
    setContributors(contributors.map(c => ({ ...c, percentage: evenPercentage })));
  };

  const handleAutoDistribute = () => {
    // Simple auto-distribution: producer gets 50%, rest split evenly
    if (contributors.length === 0) return;
    
    const producerIndex = contributors.findIndex(c => c.role === 'producer');
    const updated = [...contributors];
    
    if (producerIndex >= 0 && contributors.length > 1) {
      updated[producerIndex] = { ...updated[producerIndex], percentage: 50 };
      const remaining = 50 / (contributors.length - 1);
      updated.forEach((c, i) => {
        if (i !== producerIndex) {
          updated[i] = { ...c, percentage: remaining };
        }
      });
    } else if (contributors.length === 1) {
      updated[0] = { ...updated[0], percentage: 100 };
    } else {
      const evenPercentage = 100 / contributors.length;
      updated.forEach((c, i) => {
        updated[i] = { ...c, percentage: evenPercentage };
      });
    }
    
    setContributors(updated);
  };

  const handleSave = async () => {
    if (!isValid) return;

    // If onSaveProject is provided, call it first to ensure project exists in database
    if (onSaveProject) {
      console.log('[SplitSheetEditor] Saving project first...');
      const projectSaved = await onSaveProject();
      if (!projectSaved) {
        console.error('[SplitSheetEditor] Project save failed, aborting split sheet save');
        return;
      }
      console.log('[SplitSheetEditor] Project saved successfully, proceeding with split sheet');
    }

    const data: CreateSplitSheetRequest | UpdateSplitSheetRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      project_id: projectId,
      track_id: trackId,
      metadata: {
        total_budget: calculationMethod === 'budget' ? totalBudget : undefined,
        calculation_method: calculationMethod,
        union_settings: unionSettings,
      },
      contributors: contributors.map((c, index) => {
        // Ensure custom_fields is always an object and includes all fields
        // Preserve all existing custom_fields including dagsats, payment_type, etc.
        const customFields = {
          ...(c.custom_fields || {}),
          // Explicitly include all custom fields to ensure they're saved
          address: c.custom_fields?.address || '',
          website: c.custom_fields?.website || '',
          spotify_url: c.custom_fields?.spotify_url || '',
          instagram: c.custom_fields?.instagram || '',
          twitter: c.custom_fields?.twitter || '',
          facebook: c.custom_fields?.facebook || '',
          linkedin: c.custom_fields?.linkedin || '',
          notes: c.custom_fields?.notes || '',
          // Preserve dagsats and payment_type if they exist
          ...(c.custom_fields?.dagsats !== undefined && { dagsats: c.custom_fields.dagsats }),
          ...(c.custom_fields?.payment_type && { payment_type: c.custom_fields.payment_type }),
        };
        // Remove empty strings to keep database clean, but preserve numeric values like dagsats
        Object.keys(customFields).forEach(key => {
          if (customFields[key] === '' || (customFields[key] === null && key !== 'dagsats')) {
            delete customFields[key];
          }
        });
        
        return {
          ...c,
          custom_fields: customFields,
          order_index: index
        };
      })
    };

    // Log data before saving for debugging
    console.log('Saving split sheet with contributors:', {
      contributorCount: data.contributors?.length || 0,
      contributors: data.contributors?.map(c => ({
        name: c.name,
        customFields: c.custom_fields,
      })) || []
    });

    saveMutation.mutate(data);
  };

  const percentageError = Math.abs(totalPercentage - 100) >= 0.01;
  const percentageWarning = Math.abs(totalPercentage - 100) < 0.01 && Math.abs(totalPercentage - 100) > 0;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
      <Stack spacing={{ xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 }}>
        {/* Basic Information */}
        <Card sx={{ borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, mb: 0.5 }}>
                  Grunnleggende informasjon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Navngi avtalen og beskriv hva teamet skal budsjettere, levere og signere.
                </Typography>
              </Box>
              <Chip
                icon={React.cloneElement(professionIcon, {
                  sx: {
                    fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 },
                    color: professionColor,
                  },
                })}
                label={`${professionDisplayName} · ${agreementLabel}`}
                sx={{
                  borderColor: alpha(professionColor, 0.35),
                  bgcolor: alpha(professionColor, 0.1),
                  color: professionColor,
                  fontWeight: 700,
                  '& .MuiChip-icon': {
                    color: professionColor,
                  },
                }}
                variant="outlined"
              />
            </Box>
            <Stack spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
              <TextField
                label="Tittel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                fullWidth
                placeholder={labels.titlePlaceholder}
                tabIndex={0}
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
                label="Beskrivelse (valgfritt)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder={labels.descriptionPlaceholder}
                tabIndex={0}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                  },
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Union Agreements & Rights Management - For film/TV productions */}
        {(profession === 'videographer' || profession === 'photographer') && (
          <Card sx={{ borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4, '2xl': 4.5, '3xl': 5 } }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4, '2xl': 4.5, '3xl': 5 } }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: { xs: 2, sm: 2.5, md: 3, lg: 3.25, xl: 3.5, '2xl': 3.75, '3xl': 4 },
                  cursor: 'pointer',
                }}
                onClick={() => setShowUnionSettings(!showUnionSettings)}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem', '2xl': '1.313rem', '3xl': '1.375rem' }, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                    <GavelIcon sx={{ fontSize: { xs: 20, sm: 21, md: 22, lg: 23, xl: 24, '2xl': 25, '3xl': 26 } }} /> Fagforeninger, tariff og lønn
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    NSF (Skuespillerforbundet) • NFF (Filmforbundet) • F©R rettighetsforvaltning • Lønnsatser
                  </Typography>
                </Box>
                <IconButton size="small">
                  <ExpandMoreIcon sx={{ transform: showUnionSettings ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
                </IconButton>
              </Box>

              {showUnionSettings && (
                <Stack spacing={{ xs: 2, sm: 2.25, md: 2.5, lg: 2.75, xl: 3, '2xl': 3.25, '3xl': 3.5 }}>
                  {/* Production Type */}
                  <FormControl fullWidth size="small">
                    <InputLabel>Produksjonstype</InputLabel>
                    <Select
                      value={unionSettings.productionType}
                      onChange={(e) => setUnionSettings({ ...unionSettings, productionType: e.target.value as ProductionType })}
                      label="Produksjonstype"
                      MenuProps={{ sx: { zIndex: 1400 } }}
                    >
                      {Object.entries(PRODUCTION_TYPE_LABELS).map(([key, label]) => (
                        <MenuItem key={key} value={key}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Participant Type */}
                  <FormControl fullWidth size="small">
                    <InputLabel>Hvem gjelder dette for?</InputLabel>
                    <Select
                      value={unionSettings.participantType}
                      onChange={(e) => setUnionSettings({ ...unionSettings, participantType: e.target.value as ParticipantType })}
                      label="Hvem gjelder dette for?"
                      MenuProps={{ sx: { zIndex: 1400 } }}
                    >
                      {Object.entries(PARTICIPANT_TYPE_LABELS).map(([key, label]) => (
                        <MenuItem key={key} value={key}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Union Membership */}
                  <FormControl fullWidth size="small">
                    <InputLabel>Fagforeningsmedlemskap</InputLabel>
                    <Select
                      value={unionSettings.unionMembership}
                      onChange={(e) => {
                        const val = e.target.value as UnionMembershipType;
                        setUnionSettings({
                          ...unionSettings,
                          unionMembership: val,
                          isProfessionalActor: val === 'nsf_member' || val === 'both',
                          isFilmWorker: val === 'nff_member' || val === 'both',
                        });
                      }}
                      label="Fagforeningsmedlemskap"
                      MenuProps={{ sx: { zIndex: 1400 } }}
                    >
                      {Object.entries(UNION_MEMBERSHIP_LABELS).map(([key, label]) => (
                        <MenuItem key={key} value={key}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Virke Membership */}
                  <Box sx={{ p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, bgcolor: 'rgba(245, 158, 11, 0.1)', borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <input
                        type="checkbox"
                        checked={unionSettings.virkeProducerMember}
                        onChange={(e) => setUnionSettings({ ...unionSettings, virkeProducerMember: e.target.checked })}
                        style={{ width: 18, height: 18 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>
                        Produsent er medlem av Virke Produsentforeningen
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                      Kollektive tariffavtaler gjelder kun når produsent er Virke-medlem
                    </Typography>
                  </Box>

                  {/* NSF Section */}
                  {(unionSettings.isProfessionalActor || unionSettings.unionMembership === 'nsf_member' || unionSettings.unionMembership === 'both') && (
                    <Box sx={{ p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, bgcolor: 'rgba(236, 72, 153, 0.1)', borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                      <Typography variant="subtitle2" sx={{ color: '#ec4899', fontWeight: 600, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.925rem', lg: '0.95rem', xl: '1rem', '2xl': '1.025rem', '3xl': '1.05rem' } }}>
                        <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 } }} /> Norsk Skuespillerforbund (NSF)
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 } }}>
                        <input
                          type="checkbox"
                          checked={unionSettings.nsfAgreementApplies}
                          onChange={(e) => setUnionSettings({ ...unionSettings, nsfAgreementApplies: e.target.checked })}
                          style={{ width: 16, height: 16 }}
                        />
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>NSF-tariffavtale gjelder</Typography>
                      </Box>
                      {unionSettings.nsfAgreementApplies && (
                        <FormControl fullWidth size="small">
                          <InputLabel>NSF-avtale</InputLabel>
                          <Select
                            value={unionSettings.nsfAgreementType || 'none'}
                            onChange={(e) => setUnionSettings({ ...unionSettings, nsfAgreementType: e.target.value as NSFAgreementType })}
                            label="NSF-avtale"
                            MenuProps={{ sx: { zIndex: 1400 } }}
                          >
                            {Object.entries(NSF_AGREEMENT_LABELS).map(([key, label]) => (
                              <MenuItem key={key} value={key}>{label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Box>
                  )}

                  {/* NFF Section */}
                  {(unionSettings.isFilmWorker || unionSettings.unionMembership === 'nff_member' || unionSettings.unionMembership === 'both') && (
                    <Box sx={{ p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, bgcolor: 'rgba(0, 212, 255, 0.1)', borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, border: '1px solid rgba(0, 212, 255, 0.3)' }}>
                      <Typography variant="subtitle2" sx={{ color: '#00d4ff', fontWeight: 600, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.925rem', lg: '0.95rem', xl: '1rem', '2xl': '1.025rem', '3xl': '1.05rem' } }}>
                        <MovieIcon sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 } }} /> Norsk Filmforbund (NFF)
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 } }}>
                        <input
                          type="checkbox"
                          checked={unionSettings.nffAgreementApplies}
                          onChange={(e) => setUnionSettings({ ...unionSettings, nffAgreementApplies: e.target.checked })}
                          style={{ width: 16, height: 16 }}
                        />
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>NFF-tariffavtale gjelder</Typography>
                      </Box>
                      {unionSettings.nffAgreementApplies && (
                        <>
                          <FormControl fullWidth size="small" sx={{ mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 } }}>
                            <InputLabel>NFF-avtale</InputLabel>
                            <Select
                              value={unionSettings.nffAgreementType || 'none'}
                              onChange={(e) => setUnionSettings({ ...unionSettings, nffAgreementType: e.target.value as NFFAgreementType })}
                              label="NFF-avtale"
                              MenuProps={{ sx: { zIndex: 1400 } }}
                            >
                              {Object.entries(NFF_AGREEMENT_LABELS).map(([key, label]) => (
                                <MenuItem key={key} value={key}>{label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 } }}>
                            <input
                              type="checkbox"
                              checked={unionSettings.forRightsManagement}
                              onChange={(e) => {
                                const nextValue = e.target.checked;
                                const rightsManagement = nextValue
                                  ? Array.from(new Set([...selectedRightsManagers, 'for_filmforbundet']))
                                  : selectedRightsManagers.filter((entry) => entry !== 'for_filmforbundet');

                                setUnionSettings({
                                  ...unionSettings,
                                  forRightsManagement: nextValue,
                                  rightsManagement,
                                });
                              }}
                              style={{ width: 16, height: 16 }}
                            />
                            <Box>
                              <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>F©R rettighetsforvaltning</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                                Opphavsrettsvederlag via Filmforbundet
                              </Typography>
                            </Box>
                          </Box>
                        </>
                      )}
                    </Box>
                  )}

                  <Box sx={{ p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    <Typography variant="subtitle2" sx={{ color: '#60a5fa', fontWeight: 600, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.925rem', lg: '0.95rem', xl: '1rem', '2xl': '1.025rem', '3xl': '1.05rem' } }}>
                      <LanguageIcon sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 } }} /> Rettighetsforvaltning
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25 } }}>
                      Velg hvilke forvaltere eller rettighetsløp som gjelder for denne avtalen. Valgene lagres som del av økonomigrunnlaget og kan gjenbrukes i kontrakter og klientgjennomgang.
                    </Typography>
                    <Stack direction="row" spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }} flexWrap="wrap" useFlexGap>
                      {(Object.entries(RIGHTS_MANAGEMENT_LABELS) as Array<[RightsManagementType, string]>)
                        .filter(([key]) => key !== 'none')
                        .map(([key, label]) => {
                          const selected = selectedRightsManagers.includes(key);

                          return (
                            <Chip
                              key={key}
                              label={label}
                              size="small"
                              clickable
                              color={selected ? 'primary' : 'default'}
                              variant={selected ? 'filled' : 'outlined'}
                              onClick={() => toggleRightsManagement(key)}
                              sx={{
                                cursor: 'pointer',
                                maxWidth: '100%',
                                '& .MuiChip-label': {
                                  whiteSpace: 'normal',
                                },
                              }}
                            />
                          );
                        })}
                    </Stack>
                    <Alert severity="info" sx={{ mt: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25 }, borderRadius: { xs: 1.5, sm: 1.75, md: 2 } }}>
                      Aktiv rettighetsflyt:{' '}
                      {selectedRightsManagers.length > 0
                        ? selectedRightsManagers.map((entry) => RIGHTS_MANAGEMENT_LABELS[entry]).join(', ')
                        : RIGHTS_MANAGEMENT_LABELS.none}
                    </Alert>
                  </Box>

                  {/* Compensation Settings */}
                  <Box sx={{ p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, bgcolor: 'rgba(139, 92, 246, 0.1)', borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <Typography variant="subtitle2" sx={{ color: '#8b5cf6', fontWeight: 600, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.925rem', lg: '0.95rem', xl: '1rem', '2xl': '1.025rem', '3xl': '1.05rem' } }}>
                      <PaymentsIcon sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 } }} /> Vederlag og kompensasjon
                    </Typography>
                    <Stack spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 } }}>
                        <input
                          type="checkbox"
                          checked={unionSettings.compensationAgreed}
                          onChange={(e) => setUnionSettings({ ...unionSettings, compensationAgreed: e.target.checked })}
                          style={{ width: 16, height: 16 }}
                        />
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>Honorar/lønn er avtalt separat</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 } }}>
                        <input
                          type="checkbox"
                          checked={unionSettings.rightsPaymentSeparate}
                          onChange={(e) => setUnionSettings({ ...unionSettings, rightsPaymentSeparate: e.target.checked })}
                          style={{ width: 16, height: 16 }}
                        />
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>Rettighetsvederlag adskilt fra lønn</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                            Ref. EU/Stortinget: Krav om "rimelig vederlag"
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Tariff Applicability Check */}
                  {(unionSettings.nsfAgreementApplies || unionSettings.nffAgreementApplies) && (
                    <Alert 
                      severity={unionSettings.virkeProducerMember ? 'success' : 'warning'}
                      sx={{ borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 } }}
                    >
                      {checkTariffApplicability(unionSettings).reason}
                    </Alert>
                  )}

                  {/* Legal References */}
                  <Box sx={{ pt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75, '2xl': 2, '3xl': 2.25 } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                      Juridiske kilder:
                    </Typography>
                    <Stack direction="row" spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }} flexWrap="wrap" useFlexGap>
                      <Chip 
                        label="skuespillerforbund.no" 
                        size="small" 
                        onClick={() => window.open(UNION_LEGAL_REFERENCES.nsf.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        label="filmforbundet.no" 
                        size="small" 
                        onClick={() => window.open(UNION_LEGAL_REFERENCES.nff.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        label="F©R rettigheter" 
                        size="small" 
                        onClick={() => window.open(UNION_LEGAL_REFERENCES.for.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        label="Åndsverkloven" 
                        size="small" 
                        onClick={() => window.open(UNION_LEGAL_REFERENCES.lovdata_aandsverkloven.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                    </Stack>
                  </Box>

                  {/* Wage/Salary References */}
                  <Box sx={{ p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, bgcolor: 'rgba(34, 197, 94, 0.1)', borderRadius: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    <Typography variant="subtitle2" sx={{ color: '#22c55e', fontWeight: 600, mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.925rem', lg: '0.95rem', xl: '1rem', '2xl': '1.025rem', '3xl': '1.05rem' } }}>
                      <AttachMoneyIcon sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20, '2xl': 21, '3xl': 22 } }} /> Lønn og satser – Referanser
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 }, fontSize: { xs: '0.8rem', sm: '0.825rem', md: '0.85rem', lg: '0.875rem', xl: '0.9rem', '2xl': '0.925rem', '3xl': '0.95rem' } }}>
                      Bruk offisielle tariffavtaler for å sikre riktig lønn til skuespillere og crew.
                    </Typography>

                    {activeTariffReferences.length > 0 && (
                      <Box sx={{ mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 } }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                          Aktive tariffreferanser:
                        </Typography>
                        <Stack direction="row" spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }} flexWrap="wrap" useFlexGap>
                          {activeTariffReferences.map((reference) => (
                            <Chip
                              key={`${reference.name}-${reference.url}`}
                              icon={<AttachMoneyIcon sx={{ fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 } }} />}
                              label={reference.name}
                              size="small"
                              variant="outlined"
                              onClick={() => window.open(reference.url, '_blank')}
                              sx={{ cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    
                    {/* Dynamic wage references based on production type */}
                    {(() => {
                      const relevantRefs = getRelevantWageReferences(
                        unionSettings.productionType,
                        [unionSettings.participantType]
                      );
                      return relevantRefs.length > 0 ? (
                        <Stack spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }} sx={{ mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 } }}>
                          {relevantRefs.map((ref, idx) => (
                            <Box 
                              key={idx}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 },
                                p: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 },
                                bgcolor: 'rgba(255,255,255,0.05)',
                                borderRadius: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 },
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                              }}
                              onClick={() => window.open(ref.url, '_blank')}
                            >
                              <AttachMoneyIcon sx={{ fontSize: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 }, color: '#22c55e' }} />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {ref.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {ref.description}
                                </Typography>
                              </Box>
                              <Chip label={ref.category} size="small" sx={{ fontSize: '0.65rem' }} />
                              <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            </Box>
                          ))}
                        </Stack>
                      ) : null;
                    })()}

                    {/* Quick links to wage overviews */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                      Generelle lønnsressurser:
                    </Typography>
                    <Stack direction="row" spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }} flexWrap="wrap" useFlexGap>
                      <Chip 
                        icon={<AttachMoneyIcon sx={{ fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 } }} />}
                        label="NSF Lønn & Tariff" 
                        size="small" 
                        color="success"
                        variant="outlined"
                        onClick={() => window.open(WAGE_INFO_RESOURCES.nsf_main.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        icon={<AttachMoneyIcon sx={{ fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 } }} />}
                        label="NFF Tariff" 
                        size="small" 
                        color="info"
                        variant="outlined"
                        onClick={() => window.open(WAGE_INFO_RESOURCES.nff_main.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        label="NFF Lønnskalkulator" 
                        size="small" 
                        variant="outlined"
                        onClick={() => window.open(WAGE_INFO_RESOURCES.nff_lonnskalkulator.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        label="Skuespillerkatalogen" 
                        size="small" 
                        variant="outlined"
                        onClick={() => window.open(WAGE_INFO_RESOURCES.skuespillerkatalogen.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                      <Chip 
                        label="NSF Rettigheter" 
                        size="small" 
                        variant="outlined"
                        onClick={() => window.open(WAGE_INFO_RESOURCES.betaling_rettigheter.url, '_blank')}
                        sx={{ fontSize: { xs: '0.65rem', sm: '0.675rem', md: '0.7rem', lg: '0.725rem', xl: '0.75rem', '2xl': '0.775rem', '3xl': '0.8rem' }, cursor: 'pointer', height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }}
                      />
                    </Stack>

                    {/* Specific agreements based on production type */}
                    {unionSettings.productionType !== 'other' && (
                      <Box sx={{ mt: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5, '2xl': 2.75, '3xl': 3 }, pt: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 }, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' } }}>
                          Spesifikke avtaler for {PRODUCTION_TYPE_LABELS[unionSettings.productionType]}:
                        </Typography>
                        <Stack direction="row" spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }} flexWrap="wrap" useFlexGap>
                          {unionSettings.participantType === 'actor' && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<OpenInNewIcon sx={{ fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 } }} />}
                              onClick={() => window.open(getWageReferenceUrl(unionSettings.productionType, 'actor'), '_blank')}
                              sx={{ fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' }, textTransform: 'none' }}
                            >
                              NSF satser for skuespillere
                            </Button>
                          )}
                          {unionSettings.participantType === 'crew' && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<OpenInNewIcon sx={{ fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 } }} />}
                              onClick={() => window.open(getWageReferenceUrl(unionSettings.productionType, 'crew'), '_blank')}
                              sx={{ fontSize: { xs: '0.7rem', sm: '0.725rem', md: '0.75rem', lg: '0.775rem', xl: '0.8rem', '2xl': '0.825rem', '3xl': '0.85rem' }, textTransform: 'none' }}
                            >
                              NFF satser for crew
                            </Button>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        )}

        {/* SongFlow Integration - Only visible for music producers */}
        {splitSheet?.id && profession === 'music_producer' && (
          <SplitSheetSongFlowIntegration
            splitSheetId={splitSheet.id}
            onLinkCreated={() => {
              // Refresh split sheet data if needed
            }}
          />
        )}

        {/* Pricing Information */}
        {projectId && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600}}>
                Prisinformasjon
              </Typography>
              <PricingSelector
                projectId={projectId}
                onSelectPackage={(pkg) => {
                  // Auto-populate title and description from package
                  if (!title) setTitle(pkg.name);
                  if (!description) setDescription(pkg.description || '');
                }}
                onSelectQuote={(quote) => {
                  // Auto-populate from quote
                  if (!title) setTitle(quote.quoteNumber || agreementLabel);
                  if (!description) setDescription(quote.description || '');
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Contributors */}
        <Card sx={{ borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' } }}>
                {labels.contributorsLabel}
              </Typography>
            </Box>
            
            {/* Calculation Method Selection */}
            <Box sx={{ mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 } }}>
              <Typography variant="body2" sx={{ mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 }, fontWeight: 600, color: 'text.primary', fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' } }}>
                Beregningsmetode *
              </Typography>
              <ToggleButtonGroup
                value={calculationMethod}
                exclusive
                onChange={(_, newValue) => {
                  if (newValue !== null) {
                    setCalculationMethod(newValue);
                    // Reset all contributors based on new method
                    const updated = contributors.map(c => {
                      if (newValue === 'budget') {
                        // Switch all to dagsats
                        return {
                          ...c,
                          custom_fields: {
                            ...c.custom_fields,
                            payment_type: 'dagsats',
                            dagsats: c.custom_fields?.dagsats || ''
                          },
                          percentage: 0
                        };
                      } else {
                        // Switch all to percentage
                        return {
                          ...c,
                          custom_fields: {
                            ...c.custom_fields,
                            payment_type: 'percentage'
                          },
                          percentage: c.percentage || 0
                        };
                      }
                    });
                    setContributors(updated);
                  }
                }}
                aria-label="beregningsmetode"
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    py: { xs: 1.25, sm: 1.5, md: 1.625, lg: 1.75, xl: 2 },
                    px: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 },
                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                    fontWeight: 600,
                    textTransform: 'none',
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'text.secondary',
                    minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                    '&:hover': {
                      bgcolor: alpha(professionColor, 0.1),
                      borderColor: professionColor,
                    },
                    '&.Mui-selected': {
                      bgcolor: alpha(professionColor, 0.2),
                      color: professionColor,
                      borderColor: professionColor,
                      '&:hover': {
                        bgcolor: alpha(professionColor, 0.3),
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="budget" aria-label="totalt budsjett" tabIndex={0}>
                  Totalt budsjett
                </ToggleButton>
                <ToggleButton value="percentage" aria-label="prosentandel" tabIndex={0}>
                  Prosentandel
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            
            {/* Total Budget - Only shown when budget method is selected */}
            {calculationMethod === 'budget' && (
              <Box sx={{ mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 } }}>
                <TextField
                  label="Totalt budsjett *"
                  type="text"
                  value={formatNumberWithSpaces(totalBudget)}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Allow empty input
                    if (inputValue === '') {
                      setTotalBudget(0);
                      return;
                    }
                    // Parse the formatted number
                    const numericValue = parseFormattedNumber(inputValue);
                    setTotalBudget(numericValue);
                    // Recalculate percentages for all dagsats contributors
                    const updated = contributors.map(c => {
                      if (c.custom_fields?.dagsats && numericValue > 0) {
                        const dagsatsValue = parseFormattedNumber(String(c.custom_fields.dagsats)) || 0;
                        const calculatedPercentage = (dagsatsValue / numericValue) * 100;
                        return {
                          ...c,
                          percentage: calculatedPercentage
                        };
                      }
                      return c;
                    });
                    setContributors(updated);
                  }}
                  required
                  fullWidth
                  size="medium"
                  tabIndex={0}
                  placeholder="0"
                  helperText="Totalt budsjett i NOK (ekskl. MVA). Brukes til å kalkulere prosentandel basert på fast honorar."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                      fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                      '& fieldset': {
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.4)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: professionColor,
                        borderWidth: 2,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                      fontWeight: 600,
                      '&.Mui-focused': {
                        color: professionColor,
                      },
                    },
                    '& .MuiFormHelperText-root': {
                      fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AttachMoneyIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          NOK
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
              <Stack direction="row" spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleDistributeEvenly}
                  disabled={contributors.length === 0}
                  tabIndex={0}
                  sx={{
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    px: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                    py: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                    minHeight: { xs: 40, sm: 42, md: 44, lg: 46, xl: 48 },
                  }}
                >
                  Del likt
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleAutoDistribute}
                  disabled={contributors.length === 0}
                  tabIndex={0}
                  sx={{
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    px: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                    py: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                    minHeight: { xs: 40, sm: 42, md: 44, lg: 46, xl: 48 },
                  }}
                >
                  Auto-fordeling
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddContributor}
                  sx={{ 
                    bgcolor: '#9f7aea',
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    px: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                    py: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                    minHeight: { xs: 40, sm: 42, md: 44, lg: 46, xl: 48 },
                  }}
                  tabIndex={0}
                >
                  {labels.addContributorLabel}
                </Button>
              </Stack>
            </Box>

            {contributors.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Legg til minst én {labels.contributorLabel.toLowerCase()} for å opprette {agreementLabel.toLowerCase()}.
              </Alert>
            ) : (
              <>
                {/* Total Display - Different for budget vs percentage method */}
                {calculationMethod === 'budget' ? (
                  <Card
                    variant="outlined"
                    sx={{
                      mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 },
                      borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                      boxShadow: remainingBudget < 0
                        ? '0 2px 8px rgba(244, 67, 54, 0.2)'
                        : remainingBudget === 0
                        ? '0 2px 8px rgba(76, 175, 80, 0.15)'
                        : 'none',
                      border: remainingBudget < 0
                        ? '2px solid rgba(244, 67, 54, 0.3)'
                        : remainingBudget === 0
                        ? '2px solid rgba(76, 175, 80, 0.3)'
                        : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: remainingBudget < 0
                        ? alpha('#f44336', 0.08)
                        : remainingBudget === 0
                        ? alpha('#4caf50', 0.08)
                        : alpha('#2196f3', 0.05),
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                      <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                          {remainingBudget < 0 ? (
                            <WarningIcon sx={{ fontSize: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 }, color: '#f44336' }} />
                          ) : remainingBudget === 0 ? (
                            <CheckCircleIcon sx={{ fontSize: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 }, color: '#4caf50' }} />
                          ) : (
                            <AttachMoneyIcon sx={{ fontSize: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 }, color: '#2196f3' }} />
                          )}
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' } }}>
                            Budsjettoversikt
                          </Typography>
                        </Box>
                        <Stack spacing={1.5}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body1" color="text.secondary">
                              Totalt budsjett (ekskl. MVA):
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {totalBudget.toLocaleString('no-NO')} NOK
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              inkl. MVA:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                              {totalBudgetInklMVA.toLocaleString('no-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NOK
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body1" color="text.secondary">
                              Totalt brukt (fast honorar, ekskl. MVA):
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {totalDagsats.toLocaleString('no-NO')} NOK
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              inkl. MVA:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                              {totalDagsatsInklMVA.toLocaleString('no-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NOK
                            </Typography>
                          </Box>
                          <Divider />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                              Gjenstående budsjett (ekskl. MVA):
                            </Typography>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: 700,
                                color: remainingBudget < 0 ? '#f44336' : remainingBudget === 0 ? '#4caf50' : 'inherit'
                              }}
                            >
                              {remainingBudget.toLocaleString('no-NO')} NOK
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                              inkl. MVA:
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                color: remainingBudget < 0 ? '#f44336' : remainingBudget === 0 ? '#4caf50' : 'text.secondary'
                              }}
                            >
                              {remainingBudgetInklMVA.toLocaleString('no-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NOK
                            </Typography>
                          </Box>
                        </Stack>
                        {remainingBudget < 0 && (
                          <Alert
                            severity="error"
                            icon={<WarningIcon />}
                            sx={{
                              mt: 1,
                              borderRadius: 2,
                              bgcolor: alpha('#f44336', 0.1),
                              border: '1px solid rgba(244, 67, 54, 0.3)',
                              '& .MuiAlert-icon': {
                                color: '#f44336',
                              },
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Du har brukt {Math.abs(remainingBudget).toLocaleString('no-NO')} NOK mer enn budsjettet
                            </Typography>
                          </Alert>
                        )}
                        {remainingBudget === 0 && (
                          <Alert
                            severity="success"
                            icon={<CheckCircleIcon />}
                            sx={{
                              mt: 1,
                              borderRadius: 2,
                              bgcolor: alpha('#4caf50', 0.1),
                              border: '1px solid rgba(76, 175, 80, 0.3)',
                              '& .MuiAlert-icon': {
                                color: '#4caf50',
                              },
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Budsjettet er fullt brukt
                            </Typography>
                          </Alert>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ) : (
                  <Card
                    variant="outlined"
                    sx={{
                      mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 },
                      borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                      boxShadow: percentageError
                        ? '0 2px 8px rgba(244, 67, 54, 0.2)'
                        : percentageWarning
                        ? '0 2px 8px rgba(147, 51, 234, 0.2)'
                        : '0 2px 8px rgba(76, 175, 80, 0.15)',
                      border: percentageError
                        ? '2px solid rgba(244, 67, 54, 0.3)'
                        : percentageWarning
                        ? '2px solid rgba(147, 51, 234, 0.3)'
                        : '2px solid rgba(76, 175, 80, 0.3)',
                      bgcolor: percentageError
                        ? alpha('#f44336', 0.08)
                        : percentageWarning
                        ? alpha('#9333ea', 0.08)
                        : alpha('#4caf50', 0.08),
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: percentageError ? { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } : 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                          {percentageError ? (
                            <WarningIcon sx={{ fontSize: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 }, color: '#f44336' }} />
                          ) : (
                            <CheckCircleIcon sx={{ fontSize: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 }, color: '#4caf50' }} />
                          )}
                          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' } }}>
                            Total prosentandel
                          </Typography>
                        </Box>
                        <Chip
                          label={`${totalPercentage.toFixed(2)}%`}
                          sx={{
                            bgcolor: percentageError
                              ? '#f44336'
                              : percentageWarning
                              ? '#9333ea'
                              : '#4caf50',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                            height: { xs: 36, sm: 38, md: 40, lg: 42, xl: 44 },
                            px: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                          }}
                        />
                      </Stack>
                    {percentageError && (
                      <Box sx={{ mt: 2 }}>
                        <Alert
                          severity="error"
                          icon={<WarningIcon />}
                          sx={{
                            mb: 2,
                            borderRadius: 2,
                            bgcolor: alpha('#f44336', 0.1),
                            border: '1px solid rgba(244, 67, 54, 0.3)',
                            '& .MuiAlert-icon': {
                              color: '#f44336',
                            },
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {totalPercentage > 100 
                              ? `Totalen er ${totalPercentage.toFixed(2)}% - må være nøyaktig 100%`
                              : `Totalen er ${totalPercentage.toFixed(2)}% - må være nøyaktig 100%`
                            }
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {totalPercentage > 100
                              ? `${(totalPercentage - 100).toFixed(2)}% for mye`
                              : `${(100 - totalPercentage).toFixed(2)}% mangler`
                            }
                          </Typography>
                        </Alert>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
                          <Button
                            variant="contained"
                            size="medium"
                            onClick={handleAutoFixPercentages}
                            startIcon={<CheckCircleIcon />}
                            tabIndex={0}
                            sx={{
                              bgcolor: professionColor,
                              color: '#fff',
                              fontWeight: 600,
                              px: 3,
                              py: 1.5,
                              '&:hover': {
                                bgcolor: professionColor,
                                opacity: 0.9,
                              },
                            }}
                          >
                            Auto-juster til 100%
                          </Button>
                          {totalPercentage > 100 && (
                            <Button
                              variant="outlined"
                              size="medium"
                              color="error"
                              onClick={() => {
                                const excess = totalPercentage - 100;
                                const updated = contributors.map(c => ({
                                  ...c,
                                  percentage: Math.max(0, c.percentage - (excess / contributors.length))
                                }));
                                setContributors(updated);
                              }}
                              sx={{
                                borderColor: '#f44336',
                                color: '#f44336',
                                fontWeight: 600,
                                px: 3,
                                py: 1.5,
                                '&:hover': {
                                  borderColor: '#f44336',
                                  bgcolor: alpha('#f44336', 0.1),
                                },
                              }}
                            >
                              Reduser med {(totalPercentage - 100).toFixed(2)}%
                            </Button>
                          )}
                          {totalPercentage < 100 && (
                            <Button
                              variant="outlined"
                              size="medium"
                              onClick={() => {
                                const missing = 100 - totalPercentage;
                                const updated = contributors.map(c => ({
                                  ...c,
                                  percentage: c.percentage + (missing / contributors.length)
                                }));
                                setContributors(updated);
                              }}
                              sx={{
                                borderColor: professionColor,
                                color: professionColor,
                                fontWeight: 600,
                                px: 3,
                                py: 1.5,
                                '&:hover': {
                                  borderColor: professionColor,
                                  bgcolor: alpha(professionColor, 0.1),
                                },
                              }}
                            >
                              Legg til {(100 - totalPercentage).toFixed(2)}%
                            </Button>
                          )}
                        </Stack>
                      </Box>
                    )}
                    {!percentageError && (
                      <Alert
                        severity="success"
                        icon={<CheckCircleIcon />}
                        sx={{
                          mt: 2,
                          borderRadius: 2,
                          bgcolor: alpha('#4caf50', 0.1),
                          border: '1px solid rgba(76, 175, 80, 0.3)',
                          '& .MuiAlert-icon': {
                            color: '#4caf50',
                          },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Prosentandel er korrekt ({totalPercentage.toFixed(2)}%)
                        </Typography>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
                )}

                {/* Contributors List */}
                <Stack spacing={{ xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 }}>
                  {contributors.map((contributor, index) => (
                    <Card 
                      key={index} 
                      variant="outlined"
                      sx={{
                        borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          transform: 'translateY(-2px)',
                        }
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                        <Stack spacing={{ xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 }}>
                          {/* Header with Avatar and Actions */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                              <Avatar
                                sx={{
                                  width: { xs: 48, sm: 52, md: 56, lg: 60, xl: 64 },
                                  height: { xs: 48, sm: 52, md: 56, lg: 60, xl: 64 },
                                  bgcolor: professionColor,
                                  fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' },
                                  fontWeight: 600,
                                }}
                              >
                                {contributor.name ? contributor.name.charAt(0).toUpperCase() : `${index + 1}`}
                              </Avatar>
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, mb: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 } }}>
                                  {contributor.name || `${labels.contributorLabel} ${index + 1}`}
                                </Typography>
                                {contributor.email && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                    <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    <Typography variant="body2" color="text.secondary">
                                      {contributor.email}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveContributor(index)}
                              tabIndex={0}
                              aria-label={`Slett ${labels.contributorLabel.toLowerCase()} ${contributor.name}`}
                              sx={{
                                '&:hover': {
                                  bgcolor: 'error.light',
                                  color: 'error.contrastText',
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <Divider />

                          {/* Main Fields Grid */}
                          <Grid container spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <TextField
                                label="Navn *"
                                value={contributor.name}
                                onChange={(e) => handleContributorChange(index, 'name', e.target.value)}
                                required
                                fullWidth
                                size="medium"
                                tabIndex={0}
                                autoComplete="name"
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                                    '& fieldset': {
                                      borderWidth: 2,
                                      borderColor: 'rgba(255,255,255,0.2)',
                                    },
                                    '&:hover fieldset': {
                                      borderColor: 'rgba(255,255,255,0.4)',
                                    },
                                    '&.Mui-focused fieldset': {
                                      borderColor: professionColor,
                                      borderWidth: 2,
                                    },
                                  },
                                  '& .MuiInputLabel-root': {
                                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                                    fontWeight: 600,
                                    '&.Mui-focused': {
                                      color: professionColor,
                                    },
                                  },
                                }}
                                InputProps={{
                                  startAdornment: (
                                    <PersonIcon sx={{ mr: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }, fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 }, color: 'text.secondary' }} />
                                  ),
                                }}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <TextField
                                label="E-post *"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={contributor.email || ''}
                                onChange={(e) => handleContributorChange(index, 'email', e.target.value)}
                                required
                                fullWidth
                                size="medium"
                                tabIndex={0}
                                error={!contributor.email || (contributor.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contributor.email))}
                                helperText={
                                  !contributor.email
                                    ? 'E-post er påkrevd'
                                    : contributor.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contributor.email)
                                    ? 'Ugyldig e-postadresse'
                                    : ''
                                }
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                                    '& fieldset': {
                                      borderWidth: 2,
                                      borderColor: 'rgba(255,255,255,0.2)',
                                    },
                                    '&:hover fieldset': {
                                      borderColor: 'rgba(255,255,255,0.4)',
                                    },
                                    '&.Mui-focused fieldset': {
                                      borderColor: professionColor,
                                      borderWidth: 2,
                                    },
                                  },
                                  '& .MuiInputLabel-root': {
                                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                                    fontWeight: 600,
                                    '&.Mui-focused': {
                                      color: professionColor,
                                    },
                                  },
                                  '& .MuiFormHelperText-root': {
                                    fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                                  },
                                }}
                                InputProps={{
                                  startAdornment: (
                                    <EmailIcon sx={{ mr: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }, fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 }, color: 'text.secondary' }} />
                                  ),
                                }}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <FormControl fullWidth size="medium">
                                <InputLabel
                                  sx={{
                                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                                    fontWeight: 600,
                                    '&.Mui-focused': {
                                      color: professionColor,
                                    },
                                  }}
                                >
                                  Rolle
                                </InputLabel>
                                <Select
                                  value={contributor.role}
                                  label="Rolle"
                                  onChange={(e) => handleContributorChange(index, 'role', e.target.value)}
                                  tabIndex={0}
                                  MenuProps={{
                                    container: document.body,
                                    sx: {
                                      zIndex: 100010,
                                    },
                                    PaperProps: {
                                      sx: {
                                        bgcolor: '#1c2128',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                        mt: 0.5,
                                        maxHeight: { xs: 250, sm: 280, md: 300, lg: 320, xl: 350 },
                                        '& .MuiMenuItem-root': {
                                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                                          minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                                          py: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                                          '&:hover': {
                                            bgcolor: 'rgba(255,255,255,0.1)',
                                          },
                                          '&.Mui-selected': {
                                            bgcolor: alpha(professionColor, 0.2),
                                            '&:hover': {
                                              bgcolor: alpha(professionColor, 0.3),
                                            },
                                          },
                                        },
                                      },
                                    },
                                  }}
                                  sx={{
                                    minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderWidth: 2,
                                      borderColor: 'rgba(255,255,255,0.2)',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'rgba(255,255,255,0.4)',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: professionColor,
                                      borderWidth: 2,
                                    },
                                  }}
                                >
                                  {availableRoles.map((role: ContributorRole) => (
                                    <MenuItem key={role} value={role}>
                                      {ROLE_NAMES[role]}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              {calculationMethod === 'budget' ? (
                                <Box>
                                  <TextField
                                    label="Fast honorar *"
                                    type="text"
                                    value={contributor.custom_fields?.dagsats 
                                      ? formatNumberWithSpaces(String(contributor.custom_fields.dagsats))
                                      : ''}
                                    onChange={(e) => {
                                      const inputValue = e.target.value;
                                      // Allow empty input
                                      if (inputValue === '') {
                                        handleCustomFieldChange(index, 'dagsats', '');
                                        return;
                                      }
                                      // Parse the formatted number
                                      const numericValue = parseFormattedNumber(inputValue);
                                      handleCustomFieldChange(index, 'dagsats', numericValue > 0 ? numericValue : '');
                                    }}
                                    required
                                    fullWidth
                                    size="medium"
                                    tabIndex={0}
                                    placeholder="0"
                                    helperText={
                                      totalBudget > 0 && contributor.custom_fields?.dagsats
                                        ? `Fast honorar i NOK ekskl. MVA (≈ ${contributor.percentage.toFixed(2)}% av budsjettet)`
                                        : totalBudget === 0
                                        ? 'Fast honorar i NOK ekskl. MVA (sett totalt budsjett for å se prosentandel)'
                                        : 'Fast honorar i NOK ekskl. MVA'
                                    }
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                                        fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                                        '& fieldset': {
                                          borderWidth: 2,
                                          borderColor: 'rgba(255,255,255,0.2)',
                                        },
                                        '&:hover fieldset': {
                                          borderColor: 'rgba(255,255,255,0.4)',
                                        },
                                        '&.Mui-focused fieldset': {
                                          borderColor: professionColor,
                                          borderWidth: 2,
                                        },
                                      },
                                      '& .MuiInputLabel-root': {
                                        fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                                        fontWeight: 600,
                                        '&.Mui-focused': {
                                          color: professionColor,
                                        },
                                      },
                                      '& .MuiFormHelperText-root': {
                                        fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                                      },
                                    }}
                                    InputProps={{
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          <AttachMoneyIcon sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 }, color: 'text.secondary' }} />
                                        </InputAdornment>
                                      ),
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                                            NOK
                                          </Typography>
                                        </InputAdornment>
                                      ),
                                    }}
                                />
                                  {totalBudget > 0 && contributor.custom_fields?.dagsats && contributor.percentage > 0 && (
                                    <Box sx={{ mt: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 } }}>
                                      <Chip
                                        label={`${contributor.percentage.toFixed(2)}% av budsjettet`}
                                        size="medium"
                                        sx={{
                                          bgcolor: alpha(professionColor, 0.15),
                                          color: professionColor,
                                          fontWeight: 700,
                                          fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                                          height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                                          px: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 },
                                          border: `1px solid ${alpha(professionColor, 0.3)}`,
                                        }}
                                      />
                                    </Box>
                                  )}
                                </Box>
                              ) : (
                                <Box>
                                  <TextField
                                    label="Prosentandel *"
                                    type="number"
                                    value={contributor.percentage}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      handleContributorChange(index, 'percentage', Math.max(0, Math.min(100, value)));
                                    }}
                                    required
                                    fullWidth
                                    size="medium"
                                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                                    tabIndex={0}
                                    error={contributor.percentage < 0 || contributor.percentage > 100}
                                    helperText={
                                      contributor.percentage < 0 || contributor.percentage > 100
                                        ? 'Må være mellom 0 og 100'
                                        : ''
                                    }
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                                        fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                                        '& fieldset': {
                                          borderWidth: 2,
                                          borderColor: 'rgba(255,255,255,0.2)',
                                        },
                                        '&:hover fieldset': {
                                          borderColor: 'rgba(255,255,255,0.4)',
                                        },
                                        '&.Mui-focused fieldset': {
                                          borderColor: professionColor,
                                          borderWidth: 2,
                                        },
                                      },
                                      '& .MuiInputLabel-root': {
                                        fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                                        fontWeight: 600,
                                        '&.Mui-focused': {
                                          color: professionColor,
                                        },
                                      },
                                      '& .MuiFormHelperText-root': {
                                        fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                                      },
                                    }}
                                    InputProps={{
                                      startAdornment: (
                                        <PercentIcon sx={{ mr: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }, fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 }, color: 'text.secondary' }} />
                                      ),
                                    }}
                                  />
                                  <Box sx={{ mt: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 } }}>
                                    <Chip
                                      label={`${contributor.percentage.toFixed(2)}%`}
                                      size="medium"
                                      sx={{
                                        bgcolor: alpha(professionColor, 0.15),
                                        color: professionColor,
                                        fontWeight: 700,
                                        fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                                        height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                                        px: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 },
                                        border: `1px solid ${alpha(professionColor, 0.3)}`,
                                      }}
                                    />
                                  </Box>
                                </Box>
                              )}
                            </Grid>
                          </Grid>

                          <Divider />

                          {/* Custom Fields Section */}
                          <Accordion 
                            expanded={expandedContributor === index}
                            onChange={() => setExpandedContributor(expandedContributor === index ? null : index)}
                            tabIndex={0}
                            sx={{
                              boxShadow: 'none',
                              '&:before': { display: 'none' },
                              bgcolor: 'transparent',
                              '&.Mui-expanded': {
                                margin: 0,
                              }
                            }}
                          >
                            <AccordionSummary 
                              expandIcon={<ExpandMoreIcon />}
                              sx={{
                                px: { xs: 1, sm: 2 },
                                py: { xs: 1.5, sm: 1 },
                                minHeight: { xs: 56, sm: 48 },
                                '&.Mui-expanded': {
                                  minHeight: { xs: 56, sm: 48 },
                                },
                                '& .MuiAccordionSummary-content': {
                                  margin: { xs: '8px 0', sm: '12px 0' },
                                  '&.Mui-expanded': {
                                    margin: { xs: '8px 0', sm: '12px 0' },
                                  }
                                },
                                backgroundColor: alpha(professionColor, 0.05),
                                borderRadius: 1,
                                '&:hover': {
                                  backgroundColor: alpha(professionColor, 0.1),
                                },
                              }}
                            >
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 600, 
                                  fontSize: { xs: '0.95rem', sm: '1rem' },
                                  color: 'text.primary',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                📝 Tilleggsfelter (valgfritt)
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: { xs: 1, sm: 2 }, pt: 3, pb: 3 }}>
                              <Stack spacing={{ xs: 3, sm: 4 }}>
                                {/* Kontaktinformasjon */}
                                <Card 
                                  variant="outlined" 
                                  sx={{ 
                                    bgcolor: alpha(professionColor, 0.03),
                                    borderColor: alpha(professionColor, 0.2),
                                    '&:hover': {
                                      borderColor: alpha(professionColor, 0.3),
                                    },
                                  }}
                                >
                                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                    <Typography 
                                      variant="subtitle1" 
                                      sx={{ 
                                        fontWeight: 600, 
                                        mb: 2.5,
                                        fontSize: { xs: '0.95rem', sm: '1rem' },
                                        color: 'text.primary',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <LocationOnIcon sx={{ fontSize: { xs: 20, sm: 18 }, color: professionColor }} />
                                      Kontaktinformasjon
                                    </Typography>
                                    <Grid container spacing={{ xs: 2, sm: 2.5 }}>
                                      <Grid size={12}>
                                        <TextField
                                          label="Adresse"
                                          value={contributor.custom_fields?.address || ''}
                                          onChange={(e) => handleCustomFieldChange(index, 'address', e.target.value)}
                                          fullWidth
                                          size="medium"
                                          multiline
                                          rows={2}
                                          tabIndex={0}
                                          InputProps={{
                                            startAdornment: <LocationOnIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary', alignSelf: 'flex-start', mt: 1.5 }} />
                                          }}
                                          sx={{
                                            '& .MuiInputBase-root': {
                                              minHeight: { xs: 56, sm: 48 },
                                            },
                                          }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 12, sm: profession === 'music_producer' ? 6 : 12 }}>
                                        <TextField
                                          label="Nettside"
                                          value={contributor.custom_fields?.website || ''}
                                          onChange={(e) => handleCustomFieldChange(index, 'website', e.target.value)}
                                          fullWidth
                                          size="medium"
                                          placeholder="https://example.com"
                                          tabIndex={0}
                                          InputProps={{
                                            startAdornment: <LanguageIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary' }} />
                                          }}
                                          helperText="Full URL til nettside eller portfolio"
                                          sx={{
                                            '& .MuiInputBase-root': {
                                              minHeight: { xs: 56, sm: 48 },
                                            },
                                          }}
                                        />
                                      </Grid>
                                      {profession === 'music_producer' && (
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                          <TextField
                                            label="Spotify Artist URL"
                                            value={contributor.custom_fields?.spotify_url || ''}
                                            onChange={(e) => handleCustomFieldChange(index, 'spotify_url', e.target.value)}
                                            fullWidth
                                            size="medium"
                                            placeholder="https://open.spotify.com/artist/..."
                                            tabIndex={0}
                                            InputProps={{
                                              startAdornment: <LanguageIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary' }} />
                                            }}
                                            helperText="Lenke til artistens Spotify-profil"
                                            sx={{
                                              '& .MuiInputBase-root': {
                                                minHeight: { xs: 56, sm: 48 },
                                              },
                                            }}
                                          />
                                        </Grid>
                                      )}
                                    </Grid>
                                  </CardContent>
                                </Card>
                                
                                {/* Sosiale medier */}
                                <Card 
                                  variant="outlined" 
                                  sx={{ 
                                    bgcolor: alpha(professionColor, 0.03),
                                    borderColor: alpha(professionColor, 0.2),
                                    '&:hover': {
                                      borderColor: alpha(professionColor, 0.3),
                                    },
                                  }}
                                >
                                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                    <Typography 
                                      variant="subtitle1" 
                                      sx={{ 
                                        fontWeight: 600, 
                                        mb: 2.5,
                                        fontSize: { xs: '0.95rem', sm: '1rem' },
                                        color: 'text.primary',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <LanguageIcon sx={{ fontSize: { xs: 20, sm: 18 }, color: professionColor }} />
                                      Sosiale medier
                                    </Typography>
                                    <Grid container spacing={{ xs: 2, sm: 2.5 }}>
                                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                          label="Instagram"
                                          value={contributor.custom_fields?.instagram || ''}
                                          onChange={(e) => handleCustomFieldChange(index, 'instagram', e.target.value)}
                                          fullWidth
                                          size="medium"
                                          placeholder="@username"
                                          tabIndex={0}
                                          InputProps={{
                                            startAdornment: <LanguageIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary' }} />
                                          }}
                                          sx={{
                                            '& .MuiInputBase-root': {
                                              minHeight: { xs: 56, sm: 48 },
                                            },
                                          }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                          label="Twitter/X"
                                          value={contributor.custom_fields?.twitter || ''}
                                          onChange={(e) => handleCustomFieldChange(index, 'twitter', e.target.value)}
                                          fullWidth
                                          size="medium"
                                          placeholder="@username"
                                          tabIndex={0}
                                          InputProps={{
                                            startAdornment: <LanguageIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary' }} />
                                          }}
                                          sx={{
                                            '& .MuiInputBase-root': {
                                              minHeight: { xs: 56, sm: 48 },
                                            },
                                          }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                          label="Facebook"
                                          value={contributor.custom_fields?.facebook || ''}
                                          onChange={(e) => handleCustomFieldChange(index, 'facebook', e.target.value)}
                                          fullWidth
                                          size="medium"
                                          placeholder="username eller URL"
                                          tabIndex={0}
                                          InputProps={{
                                            startAdornment: <LanguageIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary' }} />
                                          }}
                                          sx={{
                                            '& .MuiInputBase-root': {
                                              minHeight: { xs: 56, sm: 48 },
                                            },
                                          }}
                                        />
                                      </Grid>
                                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                          label="LinkedIn"
                                          value={contributor.custom_fields?.linkedin || ''}
                                          onChange={(e) => handleCustomFieldChange(index, 'linkedin', e.target.value)}
                                          fullWidth
                                          size="medium"
                                          placeholder="@username eller URL"
                                          tabIndex={0}
                                          InputProps={{
                                            startAdornment: <LanguageIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 18 }, color: 'text.secondary' }} />
                                          }}
                                          sx={{
                                            '& .MuiInputBase-root': {
                                              minHeight: { xs: 56, sm: 48 },
                                            },
                                          }}
                                        />
                                      </Grid>
                                    </Grid>
                                  </CardContent>
                                </Card>
                                
                                {/* Notater */}
                                <Card 
                                  variant="outlined" 
                                  sx={{ 
                                    bgcolor: alpha(professionColor, 0.03),
                                    borderColor: alpha(professionColor, 0.2),
                                    '&:hover': {
                                      borderColor: alpha(professionColor, 0.3),
                                    },
                                  }}
                                >
                                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                    <Typography 
                                      variant="subtitle1" 
                                      sx={{ 
                                        fontWeight: 600, 
                                        mb: 2.5,
                                        fontSize: { xs: '0.95rem', sm: '1rem' },
                                        color: 'text.primary',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      📝 Interne notater
                                    </Typography>
                                    <TextField
                                      label="Notater"
                                      value={contributor.custom_fields?.notes || ''}
                                      onChange={(e) => handleCustomFieldChange(index, 'notes', e.target.value)}
                                      fullWidth
                                      multiline
                                      rows={6}
                                      tabIndex={0}
                                      placeholder="Legg til notater om bidragsyteren, roller, ansvar, spesielle avtaler, eller annen relevant informasjon..."
                                      sx={{
                                        width: '100%',
                                        '& .MuiInputBase-root': {
                                          fontSize: { xs: '1rem', sm: '0.95rem' },
                                          width: '100%',
                                        },
                                        '& .MuiInputBase-input': {
                                          lineHeight: 1.6,
                                          width: '100%',
                                          padding: { xs: '14px', sm: '12px' },
                                        },
                                      }}
                                      helperText="Notater er kun synlig internt og deles ikke med bidragsyteren"
                                    />
                                    <GlobalMentionHelper
                                      text={contributor.custom_fields?.notes || ''}
                                      localCandidates={mentionCandidates}
                                      onApplySuggestion={(name) =>
                                        handleCustomFieldChange(
                                          index,
                                          'notes',
                                          applyMentionSuggestion(contributor.custom_fields?.notes, name)
                                        )
                                      }
                                      autoTagTitle="Auto-tagget i notater"
                                      suggestionTitle="Mener du?"
                                    />
                                  </CardContent>
                                </Card>
                              </Stack>
                            </AccordionDetails>
                          </Accordion>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }} justifyContent="space-between" alignItems="center" flexWrap="wrap">
          <Box>
            {splitSheet?.id && (
              <Button
                variant="outlined"
                startIcon={<VisibilityIcon />}
                onClick={() => {
                  console.log('Opening portal view, contributor email:', contributors[0]?.email);
                  setShowPortalView(true);
                }}
                disabled={saveMutation.isPending}
                sx={{
                  borderColor: professionColor,
                  color: professionColor,
                  fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                  px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                  py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                  minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                  '&:hover': {
                    borderColor: professionColor,
                    bgcolor: alpha(professionColor, 0.1),
                  },
                  '&:disabled': {
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.6)',
                  },
                }}
                tabIndex={0}
              >
                Forhåndsvis portal
              </Button>
            )}
          </Box>
          <Stack direction="row" spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={onCancel}
              disabled={saveMutation.isPending}
              tabIndex={0}
              sx={{
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
              }}
            >
              Avbryt
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!isValid || saveMutation.isPending}
              sx={{ 
                bgcolor: '#9f7aea',
                '&:hover': { bgcolor: '#8e6ed6' },
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
              }}
              tabIndex={0}
            >
              {saveMutation.isPending ? 'Lagrer...' : splitSheet?.id ? 'Oppdater' : 'Opprett'}
            </Button>
          </Stack>
        </Stack>

        {saveMutation.isError && (
          <Alert severity="error">
            {saveMutation.error instanceof Error 
              ? saveMutation.error.message 
              : `Feil ved lagring av ${agreementLabel.toLowerCase()}. Prøv igjen.`}
            {saveMutation.error && typeof saveMutation.error === 'object' &&'details' in saveMutation.error && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption">
                  {(saveMutation.error as Record<string, { message?: string }>).details?.message}
                </Typography>
              </Box>
            )}
          </Alert>
        )}
      </Stack>

      {/* Portal View Dialog */}
      <Dialog
        open={showPortalView}
        onClose={() => setShowPortalView(false)}
        maxWidth="lg"
        fullWidth
        sx={{ zIndex: 100001 }}
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            borderRadius: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            maxHeight: { xs: '100vh', sm: '90vh', md: '85vh', lg: '80vh', xl: '75vh' },
            m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            pb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            pt: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
            <PortalIcon sx={{ color: professionColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' } }}>
              Portal-visning
            </Typography>
          </Box>
          <IconButton
            onClick={() => setShowPortalView(false)}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
              height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
            }}
            aria-label="Lukk"
          >
            <CancelIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#1c2128' }}>
          <Box sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <SplitSheetPortalView
              contributorEmail={contributors[0]?.email}
              onSigned={() => {
                // Refresh split sheet data if needed
                console.log('Split sheet signed in portal view');
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

