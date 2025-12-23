/**
 * AI Completion Panel
 * Floating panel showing AI suggestions, refactoring, and generation
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  TextField,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Close,
  AutoAwesome,
  Lightbulb,
  Code,
  Psychology,
  ContentCopy,
  Check,
  ErrorOutline,
  Refresh,
  Add,
} from '@mui/icons-material';
import { AICompletion, AIContext } from './AICodeCompletionSystem';

interface AICompletionPanelProps {
  open: boolean;
  onClose: () => void;
  currentCode: string;
  language: string;
  cursor: { line: number; column: number };
  selectedText?: string;
  elements?: unknown[];
  onApplyCode: (code: string) => void;
  onGetCompletions: (context: AIContext) => Promise<AICompletion[]>;
  onGenerateComponent: (description: string, context: AIContext) => Promise<AICompletion | null>;
  onSuggestRefactoring: (context: AIContext) => Promise<AICompletion[]>;
  onExplainCode: (context: AIContext) => Promise<AICompletion | null>;
  isLoading: boolean;
  error: string | null;
}

export default function AICompletionPanel({
  open,
  onClose,
  currentCode,
  language,
  cursor,
  selectedText,
  elements,
  onApplyCode,
  onGetCompletions,
  onGenerateComponent,
  onSuggestRefactoring,
  onExplainCode,
  isLoading,
  error,
}: AICompletionPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [suggestions, setSuggestions] = useState<AICompletion[]>([]);
  const [componentDescription, setComponentDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const context: AIContext = {
    currentCode,
    language,
    cursor,
    selectedText,
    elements,
  };

  const handleGetSuggestions = useCallback(async () => {
    const results = await onGetCompletions(context);
    setSuggestions(results);
  }, [context, onGetCompletions]);

  const handleGenerateComponent = useCallback(async () => {
    if (!componentDescription.trim() return;

    const result = await onGenerateComponent(componentDescription, context);
    if (result) {
      setSuggestions([result]);
      setComponentDescription(', ');
    }
  }, [componentDescription, context, onGenerateComponent]);

  const handleGetRefactoring = useCallback(async () => {
    const results = await onSuggestRefactoring(context);
    setSuggestions(results);
  }, [context, onSuggestRefactoring]);

  const handleExplainCode = useCallback(async () => {
    const result = await onExplainCode(context);
    if (result) {
      setSuggestions([result]);
    }
  }, [context, onExplainCode]);

  const handleCopy = useCallback((code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleApply = useCallback(
    (code: string) => {
      onApplyCode(code);
    },
    [onApplyCode],
  );

  if (!open) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        top: 100,
        width: 400,
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 140,
        borderRadius: 2,
        overflow: 'hidden'}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'primary.main',
          color: 'white'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology />
          <Typography variant="h6" fontWeight={600}>
            AI Assistant
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}, sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2, mb: 0 } icon={<ErrorOutline />}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<AutoAwesome fontSize="small" />} label="Complete" />
        <Tab icon={<Add fontSize="small" />} label="Generate" />
        <Tab icon={<Lightbulb fontSize="small" />} label="Refactor" />
        <Tab icon={<Code fontSize="small" />} label="Explain" />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Complete Tab */}
        {activeTab === 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Get AI-powered code completion suggestions based on your current code.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AutoAwesome />}
              onClick={handleGetSuggestions}
              disabled={isLoading}
              fullWidth
            >
              {isLoading ? 'Generating...' : 'Get Completions'}
            </Button>
            {renderSuggestions()}
          </Stack>
        )}

        {/* Generate Tab */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Describe a component and AI will generate it for you.
            </Typography>
            <TextField
              multiline
              rows={4}
              fullWidth
              placeholder="E.g., A responsive card with an image, title, description, and action button..."
              value={componentDescription}
              onChange={(e) => setComponentDescription(e.target.value)}
              variant="outlined"
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleGenerateComponent}
              disabled={isLoading || !componentDescription.trim()}
              fullWidth
            >
              {isLoading ? 'Generating...' : 'Generate Component'}
            </Button>
            {renderSuggestions()}
          </Stack>
        )}

        {/* Refactor Tab */}
        {activeTab === 2 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {selectedText
                ? 'Get refactoring suggestions for selected code'
                : 'Select code in the editor to get refactoring suggestions'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Lightbulb />}
              onClick={handleGetRefactoring}
              disabled={isLoading || !selectedText}
              fullWidth
            >
              {isLoading ? 'Analyzing...' : 'Suggest Refactoring'}
            </Button>
            {renderSuggestions()}
          </Stack>
        )}

        {/* Explain Tab */}
        {activeTab === 3 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {selectedText
                ? 'Get an explanation of the selected code'
                : 'Select code in the editor to get an explanation'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Code />}
              onClick={handleExplainCode}
              disabled={isLoading || !selectedText}
              fullWidth
            >
              {isLoading ? 'Analyzing...' : 'Explain Code'}
            </Button>
            {renderSuggestions()}
          </Stack>
        )}
      </Box>
    </Paper>
  );

  function renderSuggestions() {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (suggestions.length === 0) {
      return null;
    }

    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {suggestions.map((suggestion) => (
          <Paper key={suggestion.id} variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
            <ListItem
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                p: 2}}>
              {/* Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  mb: 1}}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getTypeIcon(suggestion.type)}
                  <Typography variant="subtitle2" fontWeight={600}>
                    {suggestion.suggestion}
                  </Typography>
                </Box>
                <Chip
                  label={`${Math.round(suggestion.confidence * 100)}%`}
                  size="small"
                  color={suggestion.confidence > 0.8 ? 'success' : 'default'}
                />
              </Box>

              {/* Description */}
              {suggestion.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, width: '100%' }}>
                  {suggestion.description}
                </Typography>
              )}

              {/* Code */}
              {suggestion.code && (
                <Box
                  component="pre"
                  sx={{
                    bgcolor: '#1E1E1E',
                    color: '#D4D4D4',
                    p: 1.5
                    borderRadius: 1,
                    overflow: 'auto',
                    fontSize: '12px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    width: '100%',
                    maxHeight: 200,
                    mb: 1}}>
                  <code>{suggestion.code}</code>
                </Box>
              )}

              {/* Actions */}
              {suggestion.type !== 'explain' && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    width: '100%',
                    justifyContent: 'flex-end'}}>
                  <Tooltip title={copiedId === suggestion.id ? 'Copied!' : 'Copy'}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(suggestion.code, suggestion.id)}
                    >
                      {copiedId === suggestion.id ? (
                        <Check fontSize="small" color="success" />
                      ) : (
                        <ContentCopy fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleApply(suggestion.code)}
                  >
                    Apply
                  </Button>
                </Box>
              )}
            </ListItem>
          </Paper>
        ))}
      </List>
    );
  }

  function getTypeIcon(type: AICompletion['type']) {
    switch (type) {
      case 'completion': return <AutoAwesome fontSize="small" color="primary" />;
      case 'generate': return <Add fontSize="small" color="success" />;
      case 'refactor': return <Lightbulb fontSize="small" color="warning" />;
      case'explain': return <Code fontSize="small" color="info" />;
      default: return <Psychology fontSize="small" />;
    }
  }
}
