/**
 * AI Model Comparison Component
 * Compare completions from multiple AI models side-by-side
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Psychology,
  CompareArrows,
  ContentCopy,
  Check,
  Close,
  Star,
  StarBorder,
} from '@mui/icons-material';
import { AICompletion, AIContext, AICodeCompletionEngine } from './AICodeCompletionSystem';

interface ModelComparisonResult {
  model: string;
  provider: 'openai' | 'anthropic';
  completion: AICompletion;
  responseTime: number;
  tokenCount?: number;
  cost?: number;
}

interface AIModelComparisonProps {
  open: boolean;
  onClose: () => void;
  context: AIContext;
  apiKeys: {
    openai?: string;
    anthropic?: string;
  };
  onApplyCode: (code: string, model: string) => void;
}

const AVAILABLE_MODELS = [
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'openai' as const, cost: 0.15 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' as const, cost: 2.5 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' as const, cost: 10 },
  { id: 'claude-4.5-sonnet', name: 'Claude 4.5 Sonnet', provider: 'anthropic' as const, cost: 3 },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' as const, cost: 15 },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' as const, cost: 3 },
];

export default function AIModelComparison({
  open,
  onClose,
  context,
  apiKeys,
  onApplyCode,
}: AIModelComparisonProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-4o','claude-4.5-sonnet']);
  const [results, setResults] = useState<ModelComparisonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favoriteModel, setFavoriteModel] = useState<string | null>(null);

  const handleModelToggle = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
    );
  };

  const handleCompare = useCallback(async () => {
    if (selectedModels.length < 2) {
      setError('Please select at least 2 models to compare');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    const comparisonResults: ModelComparisonResult[] = [];

    for (const modelId of selectedModels) {
      const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
      if (!model) continue;

      const apiKey = model.provider === 'openai' ? apiKeys.openai : apiKeys.anthropic;
      if (!apiKey) {
        console.warn(`No API key for ${model.provider}`);
        continue;
      }

      try {
        const engine = new AICodeCompletionEngine({
          provider: model.provider,
          model: modelId,
          temperature: 0.7
          maxTokens: 1000,
          enabled: true,
          autoSuggest: false,
          debounceMs: 0,
        });

        engine.setApiKey(apiKey);

        const startTime = Date.now();
        const completions = await engine.getCompletions(context);
        const responseTime = Date.now() - startTime;

        if (completions.length > 0) {
          comparisonResults.push({
            model: model.name,
            provider: model.provider,
            completion: completions[0],
            responseTime,
            cost: model.cost,
          });
        }
      } catch (err) {
        console.error(`Error with ${model.name}:`, err);
      }
    }

    setResults(comparisonResults);
    setIsLoading(false);

    if (comparisonResults.length === 0) {
      setError('No models were able to generate completions. Check API keys.');
    }
  }, [selectedModels, context, apiKeys]);

  const handleCopy = useCallback((code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleApply = useCallback(
    (code: string, model: string) => {
      onApplyCode(code, model);
    },
    [onApplyCode],
  );

  const handleToggleFavorite = useCallback((model: string) => {
    setFavoriteModel((prev) => (prev === model ? null : model));
    // Persist server-first, fallback to local
    fetch('/api/user/kv', {
      method: 'POST', headers: { , 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'favorite_ai_model', value: model })
    }).catch((err: unknown) => console.error('Operation failed:', err));
    localStorage.setItem('favorite_ai_model', model);
  }, []);

  if (!open) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90vw',
        maxWidth: 1400,
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 150,
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
          <CompareArrows />
          <Typography variant="h6" fontWeight={600}>
            AI Model Comparison
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}, sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2, mb: 0 }}>
          {error}
        </Alert>
      )}

      {/* Model Selection */}
      <Box sx={{ p: 2, bgcolor: 'background.default' }}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Select Models to Compare: </Typography>
        <FormGroup row>
          {AVAILABLE_MODELS.map((model) => {
            const hasApiKey = model.provider === 'openai' ? !!apiKeys.openai : !!apiKeys.anthropic;
            return (
              <FormControlLabel
                key={model.id}
                control={
                  <Checkbox
                    checked={selectedModels.includes(model.id)}
                    onChange={() => handleModelToggle(model.id)}
                    disabled={!hasApiKey}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {model.name}
                    <Chip label={`$${model.cost}/M tokens`} size="small" variant="outlined" />
                    {!hasApiKey && <Chip label="No API Key" size="small" color="error" />}
                  </Box>
                }
              />
            );
          })}
        </FormGroup>
        <Button
          variant="contained"
          startIcon={<CompareArrows />}
          onClick={handleCompare}
          disabled={isLoading || selectedModels.length < 2}
          sx={{ mt: 2 }}>
          {isLoading ? 'Comparing Models...' : `Compare ${selectedModels.length} Models`}
        </Button>
      </Box>

      <Divider />

      {/* Results */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress size={60} />
              <Typography variant="body2" color="text.secondary">
                Comparing {selectedModels.length} models...
              </Typography>
            </Stack>
          </Box>
        ) : results.length > 0 ? (
          <Grid container spacing={2}>
            {results.map((result, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    borderColor: favoriteModel === result.model ? 'primary.main' : undefined,
                    borderWidth: favoriteModel === result.model ? 2 : 1}}>
                  {/* Favorite Icon */}
                  <IconButton
                    size="small"
                    onClick={() => handleToggleFavorite(result.model)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1}}>
                    {favoriteModel === result.model ? <Star color="primary" /> : <StarBorder />}
                  </IconButton>

                  <CardContent sx={{ flex: 1 }}>
                    {/* Model Header */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        {result.model}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          label={result.provider.toUpperCase()}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={`${result.responseTime}ms`}
                          size="small"
                          icon={<Psychology />}
                        />
                        <Chip
                          label={`${Math.round(result.completion.confidence * 100)}%`}
                          size="small"
                          color={result.completion.confidence > 0.8 ? 'success' : 'default'}
                        />
                        {result.cost && (
                          <Chip label={`$${result.cost}/M`} size="small" variant="outlined" />
                        )}
                      </Stack>
                    </Box>

                    {/* Description */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {result.completion.description}
                    </Typography>

                    {/* Code */}
                    <Box
                      component="pre"
                      sx={{
                        bgcolor: '#1E1E1E',
                        color: '#D4D4D4',
                        p: 1.5
                        borderRadius: 1,
                        overflow: 'auto',
                        fontSize: '11px',
                        fontFamily: 'Monaco, Consolas, monospace',
                        maxHeight: 300,
                        mb: 0}}>
                      <code>{result.completion.code}</code>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Tooltip title={copiedId === result.model ? 'Copied!' : 'Copy Code'}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(result.completion.code, result.model)}
                      >
                        {copiedId === result.model ? (
                          <Check fontSize="small" color="success" />
                        ) : (
                          <ContentCopy fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleApply(result.completion.code, result.model)}
                    >
                      Apply This
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Psychology sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Compare AI Models
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select at least 2 models above and click"Compare" to see side-by-side results
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
