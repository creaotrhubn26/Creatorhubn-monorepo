import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
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
  Fab,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Accessibility,
  Add,
  AutoFixHigh,
  Cancel,
  Chat,
  CheckCircle,
  Code,
  Delete,
  Download,
  Edit,
  Info,
  Insights,
  Lightbulb,
  Palette,
  Psychology,
  Refresh,
  Search,
  Send,
  SmartToy,
  Upload,
  Warning,
} from '@mui/icons-material';
import { useAIAssistant } from '../../../hooks/useAIAssistant';
import { useTheming } from '../../../utils/theming-helper';
import type { AICodeGeneration, AIDesignSuggestion, AIWorkflow, AISuggestionStatus } from '../../../utils/aiAssistant';

interface AIAssistanceDashboardProps {
  onSettingsClick: () => void;
  onSuggestionsClick: () => void;
  onConversationsClick: () => void;
  onCodeGenerationClick: () => void;
  onDesignSuggestionsClick: () => void;
  onWorkflowsClick: () => void;
}

type SnackbarSeverity = 'success' | 'error' | 'warning' | 'info';
type SuggestionTypeFilter = 'all' | 'design' | 'code' | 'content' | 'performance' | 'accessibility' | 'seo';
type SuggestionPriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SuggestionStatusFilter = 'all' | AISuggestionStatus;
type WorkflowFormState = {
  id: string | null;
  name: string;
  description: string;
  trigger: string;
  status: AIWorkflow['status'];
  isActive: boolean;
};

const suggestionStatusValues: AISuggestionStatus[] = ['new', 'reviewed', 'accepted', 'rejected', 'implemented'];
const suggestionTypeOptions: SuggestionTypeFilter[] = ['all', 'design', 'code', 'content', 'performance', 'accessibility', 'seo'];
const suggestionPriorityOptions: SuggestionPriorityFilter[] = ['all', 'critical', 'high', 'medium', 'low'];
const workflowStatusOptions: AIWorkflow['status'][] = ['draft', 'running', 'succeeded', 'failed'];

const defaultWorkflowForm = (): WorkflowFormState => ({
  id: null,
  name: '',
  description: '',
  trigger: 'manual',
  status: 'draft',
  isActive: true,
});

const tabCallbacks = (
  onSuggestionsClick: () => void,
  onConversationsClick: () => void,
  onCodeGenerationClick: () => void,
  onDesignSuggestionsClick: () => void,
  onWorkflowsClick: () => void,
): Record<number, () => void> => ({
  1: onSuggestionsClick,
  2: onConversationsClick,
  3: onCodeGenerationClick,
  4: onDesignSuggestionsClick,
  5: onWorkflowsClick,
});

const formatError = (value: unknown, fallback: string): string =>
  value instanceof Error && value.message ? value.message : fallback;

const isAppliedDesignSuggestion = (suggestion: AIDesignSuggestion): boolean =>
  suggestion.metadata?.applied === true || typeof suggestion.metadata?.appliedAt === 'string';

const AIAssistanceDashboard: React.FC<AIAssistanceDashboardProps> = ({
  onSettingsClick,
  onSuggestionsClick,
  onConversationsClick,
  onCodeGenerationClick,
  onDesignSuggestionsClick,
  onWorkflowsClick,
}) => {
  const theming = useTheming('prototype_tester');

  const [activeTab, setActiveTab] = useState(0);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [codePrompt, setCodePrompt] = useState('');
  const [codeProjectType, setCodeProjectType] = useState('react-ui');
  const [codeFramework, setCodeFramework] = useState('material-ui');
  const [codeLanguage, setCodeLanguage] = useState('typescript');
  const [codeRequirements, setCodeRequirements] = useState('responsive, accessible, production-ready');
  const [designElementId, setDesignElementId] = useState('hero-title');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [suggestionTypeFilter, setSuggestionTypeFilter] = useState<SuggestionTypeFilter>('all');
  const [suggestionPriorityFilter, setSuggestionPriorityFilter] = useState<SuggestionPriorityFilter>('all');
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<SuggestionStatusFilter>('all');
  const [showCodeGenerationDialog, setShowCodeGenerationDialog] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [showConversationTitleDialog, setShowConversationTitleDialog] = useState(false);
  const [conversationTitleDraft, setConversationTitleDraft] = useState('');
  const [conversationBeingEdited, setConversationBeingEdited] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>(defaultWorkflowForm);
  const [selectedCodeGenerationId, setSelectedCodeGenerationId] = useState<string | null>(null);
  const [selectedDesignSuggestionId, setSelectedDesignSuggestionId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: SnackbarSeverity }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [errorDismissed, setErrorDismissed] = useState(false);

  const {
    suggestions,
    conversations,
    codeGenerations,
    designSuggestions,
    workflows,
    isLoading,
    error,
    generateSuggestions,
    updateSuggestionStatus,
    createConversation,
    renameConversation,
    deleteConversation,
    addMessage,
    generateAIResponse,
    generateCode,
    deleteCodeGeneration,
    generateDesignSuggestions,
    applyDesignSuggestion,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    refreshData,
    exportData,
    importData,
  } = useAIAssistant();

  const callbackByTab = useMemo(
    () =>
      tabCallbacks(
        onSuggestionsClick,
        onConversationsClick,
        onCodeGenerationClick,
        onDesignSuggestionsClick,
        onWorkflowsClick,
      ),
    [
      onCodeGenerationClick,
      onConversationsClick,
      onDesignSuggestionsClick,
      onSuggestionsClick,
      onWorkflowsClick,
    ],
  );

  const showToast = (message: string, severity: SnackbarSeverity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const openTab = (tabIndex: number) => {
    setActiveTab(tabIndex);
    callbackByTab[tabIndex]?.();
  };

  useEffect(() => {
    if (error) {
      setErrorDismissed(false);
    }
  }, [error]);

  useEffect(() => {
    if (!selectedConversation && conversations[0]) {
      setSelectedConversation(conversations[0].id);
      return;
    }

    if (selectedConversation && !conversations.some((conversation) => conversation.id === selectedConversation)) {
      setSelectedConversation(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversation]);

  const currentConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversation) ?? null,
    [conversations, selectedConversation],
  );

  const selectedCodeGeneration = useMemo(
    () => codeGenerations.find((generation) => generation.id === selectedCodeGenerationId) ?? null,
    [codeGenerations, selectedCodeGenerationId],
  );

  const selectedDesignSuggestion = useMemo(
    () => designSuggestions.find((suggestion) => suggestion.id === selectedDesignSuggestionId) ?? null,
    [designSuggestions, selectedDesignSuggestionId],
  );

  const filteredSuggestions = useMemo(() => {
    const search = workspaceSearch.trim().toLowerCase();

    return suggestions.filter((suggestion) => {
      const matchesSearch =
        !search ||
        suggestion.title.toLowerCase().includes(search) ||
        suggestion.description.toLowerCase().includes(search) ||
        suggestion.category.toLowerCase().includes(search) ||
        suggestion.type.toLowerCase().includes(search);

      const matchesType = suggestionTypeFilter === 'all' || suggestion.type === suggestionTypeFilter;
      const matchesPriority = suggestionPriorityFilter === 'all' || suggestion.priority === suggestionPriorityFilter;
      const matchesStatus = suggestionStatusFilter === 'all' || suggestion.status === suggestionStatusFilter;

      return matchesSearch && matchesType && matchesPriority && matchesStatus;
    });
  }, [workspaceSearch, suggestions, suggestionTypeFilter, suggestionPriorityFilter, suggestionStatusFilter]);

  const filteredConversations = useMemo(() => {
    const search = workspaceSearch.trim().toLowerCase();
    if (!search) return conversations;

    return conversations.filter((conversation) => {
      const matchesTitle = conversation.title.toLowerCase().includes(search);
      const matchesMessages = conversation.messages.some((message) => message.content.toLowerCase().includes(search));
      return matchesTitle || matchesMessages;
    });
  }, [conversations, workspaceSearch]);

  const filteredCodeGenerations = useMemo(() => {
    const search = workspaceSearch.trim().toLowerCase();
    if (!search) return codeGenerations;

    return codeGenerations.filter((generation) => {
      return (
        generation.prompt.toLowerCase().includes(search) ||
        generation.context.framework.toLowerCase().includes(search) ||
        generation.context.projectType.toLowerCase().includes(search)
      );
    });
  }, [codeGenerations, workspaceSearch]);

  const filteredDesignSuggestions = useMemo(() => {
    const search = workspaceSearch.trim().toLowerCase();
    if (!search) return designSuggestions;

    return designSuggestions.filter((suggestion) => {
      return (
        suggestion.elementId.toLowerCase().includes(search) ||
        suggestion.title.toLowerCase().includes(search) ||
        suggestion.description.toLowerCase().includes(search)
      );
    });
  }, [designSuggestions, workspaceSearch]);

  const filteredWorkflows = useMemo(() => {
    const search = workspaceSearch.trim().toLowerCase();
    if (!search) return workflows;

    return workflows.filter((workflow) => {
      return (
        workflow.name.toLowerCase().includes(search) ||
        workflow.description?.toLowerCase().includes(search) === true ||
        workflow.triggers.some((trigger) => trigger.toLowerCase().includes(search))
      );
    });
  }, [workflows, workspaceSearch]);

  const suggestionCounts = useMemo(
    () => ({
      fresh: suggestions.filter((suggestion) => suggestion.status === 'new').length,
      critical: suggestions.filter((suggestion) => suggestion.priority === 'critical').length,
      implemented: suggestions.filter((suggestion) => suggestion.status === 'implemented').length,
      rejected: suggestions.filter((suggestion) => suggestion.status === 'rejected').length,
    }),
    [suggestions],
  );

  const appliedDesignSuggestionCount = useMemo(
    () => designSuggestions.filter((suggestion) => isAppliedDesignSuggestion(suggestion)).length,
    [designSuggestions],
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }

    openTab(newValue);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      addMessage(selectedConversation, 'user', newMessage.trim());
      await generateAIResponse(selectedConversation, newMessage.trim());
      setNewMessage('');
    } catch (value) {
      showToast(formatError(value, 'Failed to send message'), 'error');
    }
  };

  const handleCreateConversation = () => {
    try {
      const conversation = createConversation(`AI Conversation ${conversations.length + 1}`, {
        projectId: 'current-project',
        currentView: 'ai-assistance',
        userIntent: 'editor-assistance',
      });
      setSelectedConversation(conversation.id);
      openTab(2);
      showToast('New conversation created');
    } catch (value) {
      showToast(formatError(value, 'Failed to create conversation'), 'error');
    }
  };

  const handleStartConversationRename = (conversationId: string, currentTitle: string) => {
    setConversationBeingEdited(conversationId);
    setConversationTitleDraft(currentTitle);
    setShowConversationTitleDialog(true);
  };

  const handleSaveConversationTitle = () => {
    if (!conversationBeingEdited || !conversationTitleDraft.trim()) {
      showToast('Add a conversation title before saving', 'warning');
      return;
    }

    try {
      renameConversation(conversationBeingEdited, conversationTitleDraft.trim());
      setShowConversationTitleDialog(false);
      setConversationBeingEdited(null);
      setConversationTitleDraft('');
      showToast('Conversation renamed');
    } catch (value) {
      showToast(formatError(value, 'Failed to rename conversation'), 'error');
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    const shouldDelete = window.confirm('Delete this conversation? This action cannot be undone.');
    if (!shouldDelete) return;

    try {
      deleteConversation(conversationId);
      showToast('Conversation deleted');
    } catch (value) {
      showToast(formatError(value, 'Failed to delete conversation'), 'error');
    }
  };

  const handleGenerateWorkspaceSuggestions = () => {
    try {
      const generated = generateSuggestions({
        currentView: 'ai-assistance',
        activeTab,
        workspaceSearch,
        metrics: {
          suggestions: suggestions.length,
          conversations: conversations.length,
          codeGenerations: codeGenerations.length,
          designSuggestions: designSuggestions.length,
          workflows: workflows.length,
        },
      });

      openTab(1);
      showToast(`${generated.length} AI suggestion${generated.length === 1 ? '' : 's'} generated`);
    } catch (value) {
      showToast(formatError(value, 'Failed to generate workspace suggestions'), 'error');
    }
  };

  const handleGenerateDesignPass = () => {
    if (!designElementId.trim()) {
      showToast('Enter an element id before running a design pass', 'warning');
      return;
    }

    try {
      const suggestion = generateDesignSuggestions(designElementId.trim(), {
        currentView: 'ai-assistance',
        theme: 'creatorhub-studio',
        requestedAt: new Date().toISOString(),
      });

      setSelectedDesignSuggestionId(suggestion.id);
      openTab(4);
      showToast(`Design pass created for ${designElementId.trim()}`);
    } catch (value) {
      showToast(formatError(value, 'Failed to generate design suggestions'), 'error');
    }
  };

  const handleGenerateCode = () => {
    if (!codePrompt.trim()) {
      showToast('Describe what you want to generate before continuing', 'warning');
      return;
    }

    const requirements = codeRequirements
      .split(',')
      .map((requirement) => requirement.trim())
      .filter(Boolean);

    try {
      const generation = generateCode(codePrompt.trim(), {
        projectType: codeProjectType,
        framework: codeFramework,
        language: codeLanguage,
        requirements: requirements.length > 0 ? requirements : ['responsive', 'accessible'],
      });

      setSelectedCodeGenerationId(generation.id);
      setShowCodeGenerationDialog(false);
      openTab(3);
      showToast('Code generated successfully');
    } catch (value) {
      showToast(formatError(value, 'Failed to generate code'), 'error');
    }
  };

  const downloadCodeSnippet = (generation: AICodeGeneration) => {
    const blob = new Blob([generation.snippet], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generation.id}.tsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Generated snippet downloaded');
  };

  const copyCodeSnippet = async (generation: AICodeGeneration) => {
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(generation.snippet);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = generation.snippet;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showToast('Code copied to clipboard');
    } catch (value) {
      showToast(formatError(value, 'Failed to copy code to clipboard'), 'error');
    }
  };

  const handleDeleteCodeGeneration = (generationId: string) => {
    const shouldDelete = window.confirm('Delete this generated snippet?');
    if (!shouldDelete) return;

    try {
      deleteCodeGeneration(generationId);
      if (selectedCodeGenerationId === generationId) {
        setSelectedCodeGenerationId(null);
      }
      showToast('Generated snippet deleted');
    } catch (value) {
      showToast(formatError(value, 'Failed to delete generated code'), 'error');
    }
  };

  const handleApplyDesignSuggestion = (suggestionId: string) => {
    try {
      applyDesignSuggestion(suggestionId);
      showToast('Design suggestion marked as applied');
    } catch (value) {
      showToast(formatError(value, 'Failed to apply design suggestion'), 'error');
    }
  };

  const handleUpdateSuggestion = (suggestionId: string, nextStatus: string) => {
    const status = suggestionStatusValues.find((value) => value === nextStatus);
    if (!status) return;

    try {
      updateSuggestionStatus(suggestionId, status);
      showToast('Suggestion status updated');
    } catch (value) {
      showToast(formatError(value, 'Failed to update suggestion status'), 'error');
    }
  };

  const resetWorkflowDialog = () => {
    setWorkflowForm(defaultWorkflowForm());
    setShowWorkflowDialog(false);
  };

  const handleSaveWorkflow = () => {
    if (!workflowForm.name.trim()) {
      showToast('Workflow name is required', 'warning');
      return;
    }

    try {
      if (workflowForm.id) {
        updateWorkflow(workflowForm.id, {
          name: workflowForm.name.trim(),
          description: workflowForm.description.trim(),
          triggers: [workflowForm.trigger.trim() || 'manual'],
          isActive: workflowForm.isActive,
          status: workflowForm.status,
        });
        showToast('Workflow updated');
      } else {
        createWorkflow({
          name: workflowForm.name.trim(),
          description: workflowForm.description.trim(),
          triggers: [workflowForm.trigger.trim() || 'manual'],
          isActive: workflowForm.isActive,
          status: workflowForm.status,
          steps: [
            {
              id: 'step-analysis',
              name: 'Analyze current canvas state',
              type: 'analysis',
              parameters: { source: 'ai-assistance-dashboard' },
              dependencies: [],
              output: {},
            },
            {
              id: 'step-generation',
              name: 'Generate implementation guidance',
              type: 'generation',
              prompt: 'Produce actionable next steps for the Visual CMS workspace.',
              parameters: { search: workspaceSearch },
              dependencies: ['step-analysis'],
              output: {},
            },
          ],
          metadata: {
            createdFrom: 'AIAssistanceDashboard',
            tab: activeTab,
          },
        });
        showToast('Workflow created');
      }

      resetWorkflowDialog();
      openTab(5);
    } catch (value) {
      showToast(formatError(value, 'Failed to save workflow'), 'error');
    }
  };

  const handleEditWorkflow = (workflow: AIWorkflow) => {
    setWorkflowForm({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? '',
      trigger: workflow.triggers[0] ?? 'manual',
      status: workflow.status,
      isActive: workflow.isActive,
    });
    setShowWorkflowDialog(true);
  };

  const handleToggleWorkflow = (workflow: AIWorkflow) => {
    try {
      updateWorkflow(workflow.id, {
        isActive: !workflow.isActive,
        status: workflow.isActive ? 'draft' : 'running',
      });
      showToast(`Workflow ${workflow.isActive ? 'paused' : 'activated'}`);
    } catch (value) {
      showToast(formatError(value, 'Failed to toggle workflow'), 'error');
    }
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    const shouldDelete = window.confirm('Delete this workflow?');
    if (!shouldDelete) return;

    try {
      deleteWorkflow(workflowId);
      showToast('Workflow deleted');
    } catch (value) {
      showToast(formatError(value, 'Failed to delete workflow'), 'error');
    }
  };

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-assistance-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('AI assistance data exported');
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result !== 'string') {
        showToast('Unable to read the selected file', 'error');
        return;
      }

      try {
        const data = JSON.parse(result) as Record<string, unknown>;
        importData(data);
        showToast('Data imported successfully');
      } catch (value) {
        showToast(formatError(value, 'Failed to import data'), 'error');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const getPriorityColor = (priority: string): ChipProps['color'] => {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'design':
        return <Palette fontSize="small" />;
      case 'code':
        return <Code fontSize="small" />;
      case 'performance':
        return <Insights fontSize="small" />;
      case 'accessibility':
        return <Accessibility fontSize="small" />;
      case 'seo':
        return <Search fontSize="small" />;
      default:
        return <Lightbulb fontSize="small" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          alignItems: { md: 'center' },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
            <Psychology color="primary" />
            AI Assistance Dashboard
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Production-grade AI workflows for suggestions, chat, code generation, and design critique.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={refreshData}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExportData}>
            Export
          </Button>
          <Button variant="outlined" startIcon={<Upload />} component="label">
            Import
            <input type="file" hidden accept=".json" onChange={handleImportData} />
          </Button>
          <Button variant="contained" startIcon={<Insights />} onClick={onSettingsClick} sx={theming.getThemedButtonSx()}>
            Settings
          </Button>
        </Box>
      </Box>

      {isLoading && <LinearProgress sx={{ borderRadius: 999, mb: 2 }} />}

      {error && !errorDismissed && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorDismissed(true)}>
          {error}
        </Alert>
      )}

      <Paper
        sx={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,248,255,0.95))',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 4,
          mb: 3,
          p: 2.5,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search AI workspace"
              value={workspaceSearch}
              onChange={(event) => setWorkspaceSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button startIcon={<Insights />} onClick={() => openTab(0)}>
                Overview
              </Button>
              <Button startIcon={<Lightbulb />} onClick={handleGenerateWorkspaceSuggestions}>
                Generate Suggestions
              </Button>
              <Button startIcon={<SmartToy />} onClick={() => openTab(2)}>
                Open Chat
              </Button>
              <Button
                startIcon={<Code />}
                onClick={() => {
                  openTab(3);
                  setShowCodeGenerationDialog(true);
                }}
              >
                Code Assist
              </Button>
              <Button startIcon={<AutoFixHigh />} onClick={handleGenerateDesignPass}>
                Design Pass
              </Button>
              <Button
                startIcon={<Add />}
                onClick={() => {
                  setWorkflowForm(defaultWorkflowForm());
                  setShowWorkflowDialog(true);
                  openTab(5);
                }}
              >
                New Workflow
              </Button>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip icon={<Info />} label={`${suggestionCounts.fresh} new suggestions`} color="info" />
          <Chip
            icon={<Warning />}
            label={`${suggestionCounts.critical} critical suggestions`}
            color={suggestionCounts.critical > 0 ? 'error' : 'default'}
            variant={suggestionCounts.critical > 0 ? 'filled' : 'outlined'}
          />
          <Chip icon={<CheckCircle />} label={`${suggestionCounts.implemented} implemented`} color="success" />
          <Chip icon={<Cancel />} label={`${suggestionCounts.rejected} rejected`} variant="outlined" />
          <Chip icon={<AutoFixHigh />} label={`${appliedDesignSuggestionCount} design passes applied`} color="secondary" />
        </Box>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" />
          <Tab label="Suggestions" />
          <Tab label="Conversations" />
          <Tab label="Code Generation" />
          <Tab label="Design Suggestions" />
          <Tab label="Workflows" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Lightbulb color="warning" />
                <Typography color="text.secondary">AI Suggestions</Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {suggestions.length}
                </Typography>
                <Typography color="text.secondary">{suggestionCounts.fresh} ready for review</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Chat color="primary" />
                <Typography color="text.secondary">Conversations</Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {conversations.length}
                </Typography>
                <Typography color="text.secondary">
                  {conversations.filter((conversation) => conversation.messages.length > 0).length} active threads
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Code color="success" />
                <Typography color="text.secondary">Generated Snippets</Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {codeGenerations.length}
                </Typography>
                <Typography color="text.secondary">Stored and ready to inspect</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <AutoFixHigh color="secondary" />
                <Typography color="text.secondary">Design Passes</Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {designSuggestions.length}
                </Typography>
                <Typography color="text.secondary">{appliedDesignSuggestionCount} already applied</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 2.5 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Recent Suggestions
                </Typography>
                <Button startIcon={<Insights />} onClick={() => openTab(1)}>
                  Open Suggestions
                </Button>
              </Box>
              <List dense>
                {filteredSuggestions.slice(0, 5).map((suggestion) => (
                  <ListItem key={suggestion.id} secondaryAction={<Chip label={suggestion.priority} size="small" color={getPriorityColor(suggestion.priority)} />}>
                    <ListItemIcon>{getTypeIcon(suggestion.type)}</ListItemIcon>
                    <ListItemText primary={suggestion.title} secondary={suggestion.description} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 2.5 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Recent Conversations
                </Typography>
                <Button startIcon={<SmartToy />} onClick={handleCreateConversation}>
                  New Conversation
                </Button>
              </Box>
              <List dense>
                {filteredConversations.slice(0, 5).map((conversation) => (
                  <ListItem key={conversation.id} disablePadding>
                    <ListItemButton
                      onClick={() => {
                        setSelectedConversation(conversation.id);
                        openTab(2);
                      }}
                    >
                      <ListItemIcon>
                        <Badge badgeContent={conversation.messages.length} color="primary">
                          <SmartToy fontSize="small" />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={conversation.title}
                        secondary={`${conversation.messages.length} messages`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 2.5 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search suggestions"
                    value={workspaceSearch}
                    onChange={(event) => setWorkspaceSearch(event.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="ai-suggestion-type-label">Type</InputLabel>
                    <Select
                      labelId="ai-suggestion-type-label"
                      label="Type"
                      value={suggestionTypeFilter}
                      onChange={(event) => setSuggestionTypeFilter(event.target.value as SuggestionTypeFilter)}
                    >
                      {suggestionTypeOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option === 'all' ? 'All types' : option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="ai-suggestion-priority-label">Priority</InputLabel>
                    <Select
                      labelId="ai-suggestion-priority-label"
                      label="Priority"
                      value={suggestionPriorityFilter}
                      onChange={(event) => setSuggestionPriorityFilter(event.target.value as SuggestionPriorityFilter)}
                    >
                      {suggestionPriorityOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option === 'all' ? 'All priorities' : option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="ai-suggestion-status-label">Status</InputLabel>
                    <Select
                      labelId="ai-suggestion-status-label"
                      label="Status"
                      value={suggestionStatusFilter}
                      onChange={(event) => setSuggestionStatusFilter(event.target.value as SuggestionStatusFilter)}
                    >
                      <MenuItem value="all">All statuses</MenuItem>
                      {suggestionStatusValues.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mt: 2.5 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Suggestions ({filteredSuggestions.length})
                </Typography>
                <Button startIcon={<AutoFixHigh />} onClick={handleGenerateWorkspaceSuggestions}>
                  Analyze Workspace
                </Button>
              </Box>

              <TableContainer sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Confidence</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Update</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSuggestions.map((suggestion) => (
                      <TableRow key={suggestion.id}>
                        <TableCell>
                          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                            {getTypeIcon(suggestion.type)}
                            <Typography variant="body2">{suggestion.type}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">{suggestion.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {suggestion.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={suggestion.priority} size="small" color={getPriorityColor(suggestion.priority)} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                            <Typography variant="body2">{(suggestion.confidence * 100).toFixed(0)}%</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={suggestion.confidence * 100}
                              sx={{ width: 80 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={suggestion.status}
                            size="small"
                            color={suggestion.status === 'implemented' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={suggestion.status}
                            onChange={(event) => handleUpdateSuggestion(suggestion.id, event.target.value)}
                            sx={{ minWidth: 140 }}
                          >
                            {suggestionStatusValues.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, height: '100%', p: 2.5 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Conversations
                </Typography>
                <Button startIcon={<Add />} onClick={handleCreateConversation} sx={theming.getThemedButtonSx()}>
                  New Chat
                </Button>
              </Box>
              <List>
                {filteredConversations.map((conversation) => (
                  <ListItem
                    key={conversation.id}
                    disablePadding
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Rename conversation">
                          <IconButton
                            size="small"
                            onClick={() => handleStartConversationRename(conversation.id, conversation.title)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete conversation">
                          <IconButton size="small" color="error" onClick={() => handleDeleteConversation(conversation.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemButton
                      selected={selectedConversation === conversation.id}
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <ListItemIcon>
                        <Badge badgeContent={conversation.messages.length} color="primary">
                          <Chat fontSize="small" />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={conversation.title}
                        secondary={`${conversation.messages.length} messages`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, display: 'flex', flexDirection: 'column', minHeight: 620 }}>
              <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', p: 2.5 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  {currentConversation ? currentConversation.title : 'AI Chat'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
                {currentConversation ? (
                  <List>
                    {currentConversation.messages.map((message) => (
                      <ListItem key={message.id} alignItems="flex-start">
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main', height: 32, width: 32 }}>
                            {message.role === 'user' ? 'U' : <SmartToy fontSize="small" />}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box>
                              <Typography variant="body1">{message.content}</Typography>
                              {Array.isArray(message.metadata?.suggestions) && message.metadata.suggestions.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                  {message.metadata.suggestions.map((suggestion, index) => {
                                    const title = typeof suggestion === 'object' && suggestion && 'title' in suggestion
                                      ? String(suggestion.title)
                                      : `Suggestion ${index + 1}`;

                                    return <Chip key={`${message.id}-${index}`} label={title} size="small" />;
                                  })}
                                </Box>
                              )}
                            </Box>
                          }
                          secondary={new Date(message.createdAt).toLocaleTimeString()}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ alignItems: 'center', color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 1.5, py: 8 }}>
                    <SmartToy sx={{ fontSize: 56 }} />
                    <Typography variant="h6">Select a conversation to start chatting</Typography>
                    <Typography variant="body2">Use AI chat for design rationale, implementation help, and workflow guidance.</Typography>
                  </Box>
                )}
              </Box>
              {currentConversation && (
                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2.5 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => void handleSendMessage()}
                      disabled={!newMessage.trim()}
                      sx={theming.getThemedButtonSx()}
                    >
                      <Send />
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 2.5 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Code Generation
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowCodeGenerationDialog(true)}
                  sx={theming.getThemedButtonSx()}
                >
                  Generate Code
                </Button>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Prompt</TableCell>
                      <TableCell>Framework</TableCell>
                      <TableCell>Quality</TableCell>
                      <TableCell>Generated</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCodeGenerations.map((generation) => (
                      <TableRow key={generation.id}>
                        <TableCell>
                          <Typography variant="body2">{generation.prompt}</Typography>
                        </TableCell>
                        <TableCell>{generation.context.framework}</TableCell>
                        <TableCell>
                          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                            <Typography variant="body2">{(generation.quality.score * 100).toFixed(0)}%</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={generation.quality.score * 100}
                              sx={{ width: 80 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>{new Date(generation.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Tooltip title="View code">
                            <IconButton size="small" onClick={() => setSelectedCodeGenerationId(generation.id)}>
                              <Code fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download snippet">
                            <IconButton size="small" onClick={() => downloadCodeSnippet(generation)}>
                              <Download fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete snippet">
                            <IconButton size="small" color="error" onClick={() => handleDeleteCodeGeneration(generation.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 2.5 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    label="Element id"
                    value={designElementId}
                    onChange={(event) => setDesignElementId(event.target.value)}
                    helperText="Run an AI design pass for a specific canvas element."
                  />
                </Grid>
                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                    <Button startIcon={<Palette />} onClick={() => openTab(4)}>
                      Inspect
                    </Button>
                    <Button startIcon={<AutoFixHigh />} variant="contained" onClick={handleGenerateDesignPass} sx={theming.getThemedButtonSx()}>
                      Generate Design Suggestions
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              <TableContainer sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Element</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Suggestions</TableCell>
                      <TableCell>Alternatives</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDesignSuggestions.map((suggestion) => (
                      <TableRow key={suggestion.id}>
                        <TableCell>{suggestion.elementId}</TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">{suggestion.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {suggestion.description}
                          </Typography>
                        </TableCell>
                        <TableCell>{suggestion.suggestions.length}</TableCell>
                        <TableCell>{suggestion.alternatives.length}</TableCell>
                        <TableCell>
                          <Chip
                            label={isAppliedDesignSuggestion(suggestion) ? 'Applied' : 'Pending'}
                            color={isAppliedDesignSuggestion(suggestion) ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View details">
                            <IconButton size="small" onClick={() => setSelectedDesignSuggestionId(suggestion.id)}>
                              <Palette fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Apply suggestion">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleApplyDesignSuggestion(suggestion.id)}
                            >
                              <AutoFixHigh fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 2.5 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    AI Workflows
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {filteredWorkflows.length} workflows currently loaded
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setWorkflowForm(defaultWorkflowForm());
                    setShowWorkflowDialog(true);
                  }}
                  sx={theming.getThemedButtonSx()}
                >
                  New Workflow
                </Button>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Steps</TableCell>
                      <TableCell>Triggers</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredWorkflows.map((workflow) => (
                      <TableRow key={workflow.id}>
                        <TableCell>{workflow.name}</TableCell>
                        <TableCell>{workflow.description}</TableCell>
                        <TableCell>{workflow.steps.length}</TableCell>
                        <TableCell>{workflow.triggers.join(', ')}</TableCell>
                        <TableCell>
                          <Chip
                            label={workflow.isActive ? workflow.status : 'paused'}
                            color={workflow.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Edit workflow">
                            <IconButton size="small" onClick={() => handleEditWorkflow(workflow)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={workflow.isActive ? 'Pause workflow' : 'Activate workflow'}>
                            <IconButton size="small" color={workflow.isActive ? 'warning' : 'success'} onClick={() => handleToggleWorkflow(workflow)}>
                              {workflow.isActive ? <Cancel fontSize="small" /> : <CheckCircle fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete workflow">
                            <IconButton size="small" color="error" onClick={() => handleDeleteWorkflow(workflow.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog open={showCodeGenerationDialog} onClose={() => setShowCodeGenerationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generate Code</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            fullWidth
            multiline
            minRows={4}
            label="Describe what you want to generate"
            value={codePrompt}
            onChange={(event) => setCodePrompt(event.target.value)}
            placeholder="Create a polished hero section with primary CTA, secondary CTA and trust badges."
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="code-project-type-label">Project Type</InputLabel>
                <Select
                  labelId="code-project-type-label"
                  label="Project Type"
                  value={codeProjectType}
                  onChange={(event) => setCodeProjectType(event.target.value)}
                >
                  <MenuItem value="react-ui">React UI</MenuItem>
                  <MenuItem value="landing-page">Landing Page</MenuItem>
                  <MenuItem value="admin-dashboard">Admin Dashboard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="code-framework-label">Framework</InputLabel>
                <Select
                  labelId="code-framework-label"
                  label="Framework"
                  value={codeFramework}
                  onChange={(event) => setCodeFramework(event.target.value)}
                >
                  <MenuItem value="material-ui">Material UI</MenuItem>
                  <MenuItem value="tailwind">Tailwind</MenuItem>
                  <MenuItem value="plain-react">Plain React</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="code-language-label">Language</InputLabel>
                <Select
                  labelId="code-language-label"
                  label="Language"
                  value={codeLanguage}
                  onChange={(event) => setCodeLanguage(event.target.value)}
                >
                  <MenuItem value="typescript">TypeScript</MenuItem>
                  <MenuItem value="javascript">JavaScript</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            fullWidth
            label="Requirements"
            helperText="Comma-separated requirements that affect the generated snippet quality score."
            value={codeRequirements}
            onChange={(event) => setCodeRequirements(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCodeGenerationDialog(false)}>Cancel</Button>
          <Button onClick={handleGenerateCode} variant="contained" sx={theming.getThemedButtonSx()}>
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedCodeGeneration)} onClose={() => setSelectedCodeGenerationId(null)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedCodeGeneration?.prompt ?? 'Generated Code'}</DialogTitle>
        <DialogContent>
          {selectedCodeGeneration && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Alert severity="info">{selectedCodeGeneration.quality.rationale}</Alert>
              <Paper
                component="pre"
                sx={{
                  backgroundColor: '#0f172a',
                  borderRadius: 3,
                  color: '#e2e8f0',
                  m: 0,
                  overflowX: 'auto',
                  p: 2,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedCodeGeneration.snippet}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCodeGenerationId(null)}>Close</Button>
          {selectedCodeGeneration && (
            <>
              <Button onClick={() => void copyCodeSnippet(selectedCodeGeneration)}>Copy</Button>
              <Button onClick={() => downloadCodeSnippet(selectedCodeGeneration)} startIcon={<Download />}>
                Download
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedDesignSuggestion)} onClose={() => setSelectedDesignSuggestionId(null)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedDesignSuggestion?.title ?? 'Design Suggestion'}</DialogTitle>
        <DialogContent>
          {selectedDesignSuggestion && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Alert severity={isAppliedDesignSuggestion(selectedDesignSuggestion) ? 'success' : 'info'}>
                {selectedDesignSuggestion.description}
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Suggestions
                </Typography>
                <List dense>
                  {selectedDesignSuggestion.suggestions.map((entry) => (
                    <ListItem key={entry}>
                      <ListItemIcon>
                        <AutoFixHigh fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={entry} />
                    </ListItem>
                  ))}
                </List>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Alternatives
                </Typography>
                <List dense>
                  {selectedDesignSuggestion.alternatives.map((entry) => (
                    <ListItem key={entry}>
                      <ListItemIcon>
                        <Palette fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={entry} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedDesignSuggestionId(null)}>Close</Button>
          {selectedDesignSuggestion && (
            <Button
              onClick={() => handleApplyDesignSuggestion(selectedDesignSuggestion.id)}
              startIcon={<AutoFixHigh />}
              variant="contained"
              sx={theming.getThemedButtonSx()}
            >
              Apply
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={showWorkflowDialog} onClose={resetWorkflowDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{workflowForm.id ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            fullWidth
            label="Workflow name"
            value={workflowForm.name}
            onChange={(event) => setWorkflowForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Description"
            value={workflowForm.description}
            onChange={(event) => setWorkflowForm((current) => ({ ...current, description: event.target.value }))}
          />
          <TextField
            fullWidth
            label="Primary trigger"
            value={workflowForm.trigger}
            onChange={(event) => setWorkflowForm((current) => ({ ...current, trigger: event.target.value }))}
            helperText="Examples: manual, publish, nightly-review"
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="workflow-status-label">Status</InputLabel>
                <Select
                  labelId="workflow-status-label"
                  label="Status"
                  value={workflowForm.status}
                  onChange={(event) =>
                    setWorkflowForm((current) => ({
                      ...current,
                      status: workflowStatusOptions.find((value) => value === event.target.value) ?? current.status,
                    }))
                  }
                >
                  {workflowStatusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="workflow-active-label">Active</InputLabel>
                <Select
                  labelId="workflow-active-label"
                  label="Active"
                  value={workflowForm.isActive ? 'active' : 'inactive'}
                  onChange={(event) =>
                    setWorkflowForm((current) => ({
                      ...current,
                      isActive: event.target.value === 'active',
                    }))
                  }
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetWorkflowDialog}>Cancel</Button>
          <Button onClick={handleSaveWorkflow} variant="contained" sx={theming.getThemedButtonSx()}>
            Save Workflow
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showConversationTitleDialog} onClose={() => setShowConversationTitleDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Conversation title"
            value={conversationTitleDraft}
            onChange={(event) => setConversationTitleDraft(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConversationTitleDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveConversationTitle} variant="contained" sx={theming.getThemedButtonSx()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Fab
        color="primary"
        onClick={() => {
          if (!conversations.length) {
            handleCreateConversation();
            return;
          }

          openTab(2);
        }}
        sx={{ bottom: 24, position: 'fixed', right: 24 }}
      >
        <SmartToy />
      </Fab>
    </Box>
  );
};

export default AIAssistanceDashboard;
