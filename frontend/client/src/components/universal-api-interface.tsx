/**
 * CreatorHub Norge - Universal API Interface
 * Manual console for validating configured API proxy services.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Check as CheckIcon, Send as SendIcon } from '@mui/icons-material';
import { useTheming } from '../utils/theming-helper';
import { API_SERVICES, useUniversalAPI } from '@/hooks/useUniversalAPI';

interface ApiCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

const SERVICE_OPTIONS = Object.values(API_SERVICES);

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function UniversalAPIInterface() {
  const theming = useTheming('photographer');
  const api = useUniversalAPI({ showErrorToast: true });

  const [selectedService, setSelectedService] = useState<string>(API_SERVICES.GEMINI);
  const [prompt, setPrompt] = useState('');
  const [configuredServices, setConfiguredServices] = useState<string[]>([]);
  const [response, setResponse] = useState<ApiCallResult | null>(null);

  const activeServiceConfigured = useMemo(() => {
    return configuredServices.includes(selectedService);
  }, [configuredServices, selectedService]);

  const refreshConfiguredServices = async () => {
    const services = await api.getConfiguredServices();
    setConfiguredServices(services);
  };

  useEffect(() => {
    void refreshConfiguredServices();
  }, []);

  const runServiceCall = async () => {
    if (!prompt.trim()) {
      return;
    }

    setResponse(null);
    let result: ApiCallResult;

    switch (selectedService) {
      case API_SERVICES.GEMINI:
        result = await api.callGemini(prompt.trim());
        break;
      case API_SERVICES.OPENAI:
        result = await api.callOpenAI(prompt.trim());
        break;
      case API_SERVICES.ANTHROPIC:
        result = await api.callAnthropic(prompt.trim());
        break;
      case API_SERVICES.BRREG:
        result = await api.call(
          API_SERVICES.BRREG,
          `/enheter?navn=${encodeURIComponent(prompt.trim())}`,
          'GET',
        );
        break;
      default:
        // Generic service ping
        result = await api.call(selectedService, '/', 'GET');
        break;
    }

    setResponse(result);
  };

  return (
    <Card elevation={3} sx={theming.getThemedCardSx()}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          Universal API Demo
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Test API-proxyen mot konfigurerte tjenester. Velg tjeneste, skriv foresporsel,
          og kjør testkall.
        </Typography>

        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            Konfigurerte tjenester ({configuredServices.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {configuredServices.map((service) => (
              <Chip
                key={service}
                label={service}
                size="small"
                color="success"
                icon={<CheckIcon />}
              />
            ))}
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="api-service-label">Velg tjeneste</InputLabel>
              <Select
                labelId="api-service-label"
                value={selectedService}
                label="Velg tjeneste"
                onChange={(event) => setSelectedService(event.target.value)}
              >
                {SERVICE_OPTIONS.map((service) => (
                  <MenuItem key={service} value={service}>
                    {service}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              value={prompt}
              label="Prompt / Query"
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void runServiceCall();
                }
              }}
              placeholder="Skriv foresporsel..."
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={api.loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            disabled={api.loading || !prompt.trim()}
            onClick={() => void runServiceCall()}
          >
            {api.loading ? 'Behandler...' : 'Kjor API-kall'}
          </Button>
          <Button variant="outlined" onClick={() => void refreshConfiguredServices()}>
            Oppdater status
          </Button>
        </Box>

        {!activeServiceConfigured ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Valgt tjeneste er ikke konfigurert ennå.
          </Alert>
        ) : null}

        {api.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {api.error}
          </Alert>
        ) : null}

        {response ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1.2 }}>
              Response
            </Typography>
            <Alert severity={response.success ? 'success' : 'error'} sx={{ mb: 1.5 }}>
              {response.success ? 'API-kall fullfort' : response.error ?? 'API-kall feilet'}
            </Alert>

            <Box
              sx={{
                bgcolor: 'background.paper',
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                maxHeight: 420,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              <pre style={{ margin: 0 }}>{safeStringify(response.data ?? response)}</pre>
            </Box>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}

