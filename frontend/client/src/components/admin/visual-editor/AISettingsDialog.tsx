/**
 * AI Settings Dialog
 * Configure AI code completion settings and API keys
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  Alert,
  AlertTitle,
  Link,
  Divider,
  Slider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
} from '@mui/material';
import {
  Settings,
  ExpandMore,
  OpenInNew,
  Security,
  Info,
} from '@mui/icons-material';
import type { AICompletionConfig } from './AICodeCompletionSystem';

interface AISettingsDialogProps {
  open: boolean;
  onClose: () => void;
  config: AICompletionConfig;
  onSave: (config: AICompletionConfig, apiKey?: string) => void;
  isConfigured: boolean;
}

const AI_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    recommended: true,
    models: ['claude-4.5-sonnet','claude-3-opus','claude-3-sonnet','claude-3-haiku'],
    signupUrl: 'https://console.anthropic.com/',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    pricing: '$3/million input tokens',
    description: 'Best for code completion and refactoring',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    recommended: false,
    models: ['gpt-5-nano','gpt-4o','gpt-4-turbo','gpt-4','gpt-3.5-turbo'],
    signupUrl: 'https://platform.openai.com/signup',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    pricing: '$2.50/million input tokens',
    description: 'Fast and reliable code generation',
  },
];

export default function AISettingsDialog({
  open,
  onClose,
  config,
  onSave,
  isConfigured,
}: AISettingsDialogProps) {
  const [localConfig, setLocalConfig] = useState<AICompletionConfig>(config);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const selectedProvider =
    AI_PROVIDERS.find(
      (p) => p.id === (localConfig.provider === 'auto' ? 'anthropic' : localConfig.provider),
    ) || AI_PROVIDERS[0];

  const handleSave = () => {
    onSave(localConfig, apiKey || undefined);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: {}}}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings />
        AI Code Completion Settings
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Status Alert */}
          {!isConfigured && (
            <Alert severity="warning" icon={<Security />}>
              <AlertTitle>API Key Required</AlertTitle>
              Enter your API key below to enable AI-powered code completion
            </Alert>
          )}

          {isConfigured && (
            <Alert severity="success">
              <AlertTitle>AI Configured</AlertTitle>
              Code completion is active and ready to use
            </Alert>
          )}

          {/* API Provider Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
              AI Provider
            </Typography>
            <FormControl fullWidth>
              <Select
                value={localConfig.provider}
                onChange={(e) => {
                  const provider = e.target.value as 'openai' | 'anthropic' | 'auto';
                  const providerInfo =
                    AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];
                  setLocalConfig({
                    ...localConfig,
                    provider,
                    model: providerInfo.models[0],
                  });
                }}
              >
                <MenuItem value="auto">Auto-detect (Recommended)</MenuItem>
                <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
                <MenuItem value="openai">OpenAI (GPT)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Model Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
              Model
            </Typography>
            <FormControl fullWidth>
              <Select
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
              >
                {selectedProvider.models.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                    {(model === 'claude-4.5-sonnet' || model === 'gpt-5-nano') && (
                      <Chip label="Latest" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* API Key Input */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
              API Key
            </Typography>
            <TextField
              fullWidth
              type={showApiKey ? 'text' : 'password'}
              placeholder={isConfigured ? '••••••••••••••••••' : 'Enter your API key'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              helperText={
                <Box component="span">
                  {!isConfigured && 'Your API key is stored securely in browser storage'}
                  {isConfigured && 'Leave empty to keep existing key'}
                </Box>
              }
              InputProps={{
                endAdornment: (
                  <Button size="small" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? 'Hide' : 'Show'}
                  </Button>
                )}}
            />
          </Box>

          {/* Get API Key Instructions */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Info color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                  How to Get an API Key
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {AI_PROVIDERS.map((provider) => (
                  <Box key={provider.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {provider.name}
                      </Typography>
                      {provider.recommended && (
                        <Chip label="Recommended" size="small" color="primary" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {provider.description}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                      <Link
                        href={provider.signupUrl}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        1. Sign up at {provider.name}
                        <OpenInNew fontSize="small" />
                      </Link>
                      <Link
                        href={provider.apiKeyUrl}
                        target="_blank"
                        rel="noopener"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        2. Get your API key
                        <OpenInNew fontSize="small" />
                      </Link>
                      <Typography variant="caption" color="text.secondary">
                        Pricing: {provider.pricing}
                      </Typography>
                    </Box>
                    {provider !== AI_PROVIDERS[AI_PROVIDERS.length - 1] && (
                      <Divider sx={{ mt: 2 }} />
                    )}
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Divider />

          {/* Advanced Settings */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                Advanced Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={3}>
                {/* Temperature */}
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Temperature: {localConfig.temperature}
                  </Typography>
                  <Slider
                    value={localConfig.temperature}
                    onChange={(_, value) =>
                      setLocalConfig({ ...localConfig, temperature: value as number })
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    marks
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Lower = more focused, Higher = more creative
                  </Typography>
                </Box>

                {/* Max Tokens */}
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Max Tokens: {localConfig.maxTokens}
                  </Typography>
                  <Slider
                    value={localConfig.maxTokens}
                    onChange={(_, value) =>
                      setLocalConfig({ ...localConfig, maxTokens: value as number })
                    }
                    min={100}
                    max={4000}
                    step={100}
                    marks={[
                      { value: 100, label: '100' },
                      { value: 1000, label: '1K' },
                      { value: 2000, label: '2K' },
                      { value: 4000, label: '4K' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Maximum length of AI responses
                  </Typography>
                </Box>

                {/* Auto Suggest */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={localConfig.autoSuggest}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, autoSuggest: e.target.checked })
                      }
                    />
                  }
                  label="Auto-suggest while typing"
                />

                {/* Debounce */}
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Debounce: {localConfig.debounceMs}ms
                  </Typography>
                  <Slider
                    value={localConfig.debounceMs}
                    onChange={(_, value) =>
                      setLocalConfig({ ...localConfig, debounceMs: value as number })
                    }
                    min={200}
                    max={3000}
                    step={100}
                    marks={[
                      { value: 200, label: '200ms' },
                      { value: 1000, label: '1s' },
                      { value: 3000, label: '3s' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Delay before triggering auto-suggestions
                  </Typography>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Security Notice */}
          <Alert severity="info" icon={<Security />}>
            <Typography variant="caption">
              Your API key is stored locally in your browser and never sent to our servers. All AI
              requests go directly from your browser to the AI provider.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!isConfigured && !apiKey}>
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
