import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface PricingOptions {
  basePrice: number;
  quantity?: number;
  discountPercent?: number;
  taxPercent?: number;
  currency?: string;
}

interface PricingResult {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  currency: string;
}

interface FeatureFlag {
  id: string;
  enabled: boolean;
  description?: string;
}

interface PaymentIntentResult {
  clientSecret?: string;
  paymentIntentId?: string;
  [key: string]: unknown;
}

interface ProjectUpdateResult {
  success: boolean;
  provider?: string;
  message?: string;
}

interface GeneratedArtifact {
  type: 'component' | 'service' | 'api' | 'test' | 'schema';
  name: string;
  code: string;
}

interface GeneratorResponse {
  summary: string;
  artifacts: GeneratedArtifact[];
  suggestions: string[];
}

interface LocalGenerationSettings {
  profession: string;
  framework: 'react' | 'nextjs' | 'node';
  strictTypes: boolean;
  includeTests: boolean;
  generateApi: boolean;
}

interface ApiDiscovery {
  name: string;
  category: string;
  description: string;
  documentation?: string;
  authentication?: string;
  pricing?: string;
  norwegianSupport?: boolean;
}

const GENERATOR_TABS = ['Build', 'Output', 'Integrations'] as const;

const getSafeNumber = (value: number | undefined, fallback = 0): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return value;
};

export async function calculateDynamicPrice(options: PricingOptions): Promise<PricingResult> {
  const basePrice = getSafeNumber(options.basePrice);
  const quantity = Math.max(1, getSafeNumber(options.quantity, 1));
  const discountPercent = Math.max(0, getSafeNumber(options.discountPercent));
  const taxPercent = Math.max(0, getSafeNumber(options.taxPercent));

  const subtotal = basePrice * quantity;
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * taxPercent) / 100;
  const total = taxableAmount + taxAmount;

  try {
    const remote = await apiRequest('/api/pricing/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (remote && typeof remote === 'object') {
      const maybeResult = remote as Partial<PricingResult>;
      if (
        typeof maybeResult.subtotal === 'number' &&
        typeof maybeResult.discountAmount === 'number' &&
        typeof maybeResult.taxAmount === 'number' &&
        typeof maybeResult.total === 'number'
      ) {
        return {
          subtotal: maybeResult.subtotal,
          discountAmount: maybeResult.discountAmount,
          taxAmount: maybeResult.taxAmount,
          total: maybeResult.total,
          currency: maybeResult.currency ?? options.currency ?? 'NOK',
        };
      }
    }
  } catch {
    // Fall back to local deterministic calculation.
  }

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
    currency: options.currency ?? 'NOK',
  };
}

export async function checkFeatureEnabled(featureId: string, userId?: string): Promise<boolean> {
  try {
    const response = await apiRequest(`/api/features/${encodeURIComponent(featureId)}/access`, {
      method: 'GET',
      headers: userId ? { 'X-User-ID': userId } : undefined,
    });

    if (typeof response?.enabled === 'boolean') {
      return response.enabled;
    }
    if (typeof response?.hasAccess === 'boolean') {
      return response.hasAccess;
    }
  } catch {
    // Return false when remote lookup is unavailable.
  }

  return false;
}

export class FeatureManager {
  private flags = new Map<string, FeatureFlag>();

  async loadFeatures(): Promise<FeatureFlag[]> {
    try {
      const response = await apiRequest('/api/features', { method: 'GET' });
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.features)
          ? response.features
          : [];

      const normalized = list
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const value = item as Partial<FeatureFlag>;
          if (!value.id || typeof value.enabled !== 'boolean') {
            return null;
          }
          return {
            id: String(value.id),
            enabled: value.enabled,
            description: value.description,
          };
        })
        .filter((item): item is FeatureFlag => item !== null);

      this.flags = new Map(normalized.map((flag) => [flag.id, flag]));
      return normalized;
    } catch {
      return Array.from(this.flags.values());
    }
  }

  async toggleFeature(id: string, enabled: boolean): Promise<FeatureFlag> {
    await apiRequest(`/api/features/${encodeURIComponent(id)}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    const next: FeatureFlag = {
      id,
      enabled,
      description: this.flags.get(id)?.description,
    };
    this.flags.set(id, next);
    return next;
  }

  isEnabled(id: string): boolean {
    return this.flags.get(id)?.enabled ?? false;
  }

  getAll(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }
}

export async function createPaymentIntent(amount: number): Promise<PaymentIntentResult> {
  const response = await apiRequest('/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'NOK' }),
  });

  if (response && typeof response === 'object') {
    return response as PaymentIntentResult;
  }

  return {};
}

export async function sendProjectUpdate(to: string, projectName: string): Promise<ProjectUpdateResult> {
  try {
    await apiRequest('/api/notifications/project-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, projectName }),
    });

    return { success: true, provider: 'api', message: 'Update sent' };
  } catch {
    return { success: false, provider: 'api', message: 'Unable to send project update' };
  }
}

const localGenerate = (requirements: string, settings: LocalGenerationSettings): GeneratorResponse => {
  const normalizedName = requirements
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim() || 'Feature';

  const componentName = normalizedName
    .split(' ')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join('');

  const componentCode = `import React from 'react';\n\nexport function ${componentName}() {\n  return <div>${componentName} ready.</div>;\n}`;
  const apiCode = `export async function fetch${componentName}() {\n  const response = await fetch('/api/${componentName.toLowerCase()}');\n  return response.json();\n}`;
  const testCode = `import { render, screen } from '@testing-library/react';\nimport { ${componentName} } from './${componentName}';\n\ntest('renders component', () => {\n  render(<${componentName} />);\n  expect(screen.getByText(/ready/i)).toBeInTheDocument();\n});`;

  const artifacts: GeneratedArtifact[] = [
    { type: 'component', name: `${componentName}.tsx`, code: componentCode },
  ];

  if (settings.generateApi) {
    artifacts.push({ type: 'api', name: `${componentName}.api.ts`, code: apiCode });
  }

  if (settings.includeTests) {
    artifacts.push({ type: 'test', name: `${componentName}.test.tsx`, code: testCode });
  }

  return {
    summary: `Generated ${artifacts.length} artifacts for ${componentName}.`,
    artifacts,
    suggestions: [
      'Connect artifacts to route-level lazy loading.',
      'Add domain validation before persisting data.',
      `Use ${settings.framework} patterns for deployment parity.`,
    ],
  };
};

export default function EnhancedCodeGenerator() {
  const theming = useTheming('photographer');

  const [activeTab, setActiveTab] = useState<(typeof GENERATOR_TABS)[number]>('Build');
  const [requirements, setRequirements] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('video editing api norway');
  const [settings, setSettings] = useState<LocalGenerationSettings>({
    profession: 'videographer',
    framework: 'react',
    strictTypes: true,
    includeTests: true,
    generateApi: true,
  });
  const [generated, setGenerated] = useState<GeneratorResponse | null>(null);
  const [discoveredApis, setDiscoveredApis] = useState<ApiDiscovery[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/code-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements, problemDescription, settings }),
      });

      if (response && typeof response === 'object') {
        const maybe = response as Partial<GeneratorResponse>;
        if (Array.isArray(maybe.artifacts) && Array.isArray(maybe.suggestions) && maybe.summary) {
          return maybe as GeneratorResponse;
        }
      }

      return localGenerate(requirements, settings);
    },
    onSuccess: (result) => {
      setGenerated(result);
      setActiveTab('Output');
      setErrorMessage(null);
    },
    onError: () => {
      setGenerated(localGenerate(requirements, settings));
      setActiveTab('Output');
      setErrorMessage('Fell back to local generator because the API request failed.');
    },
  });

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/code-generator/discover-apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, requirements, profession: settings.profession }),
      });

      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
          ? response.results
          : [];

      const normalized = list
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const value = item as Partial<ApiDiscovery>;
          if (!value.name || !value.category || !value.description) {
            return null;
          }
          return {
            name: String(value.name),
            category: String(value.category),
            description: String(value.description),
            documentation: value.documentation,
            authentication: value.authentication,
            pricing: value.pricing,
            norwegianSupport: Boolean(value.norwegianSupport),
          };
        })
        .filter((item): item is ApiDiscovery => item !== null);

      if (normalized.length > 0) {
        return normalized;
      }

      return [
        {
          name: 'Brreg Open Data',
          category: 'Business Registry',
          description: 'Lookup and verify Norwegian company information.',
          documentation: 'https://data.brreg.no/enhetsregisteret/api/docs/index.html',
          authentication: 'none',
          pricing: 'free',
          norwegianSupport: true,
        },
        {
          name: 'Vipps eCom API',
          category: 'Payments',
          description: 'Norwegian payment processing for checkout and subscriptions.',
          documentation: 'https://developer.vippsmobilepay.com/',
          authentication: 'oauth2',
          pricing: 'paid',
          norwegianSupport: true,
        },
      ];
    },
    onSuccess: (list) => {
      setDiscoveredApis(list);
      setActiveTab('Integrations');
    },
  });

  const canGenerate = requirements.trim().length >= 12;

  const progress = useMemo(() => {
    if (generateMutation.isPending) {
      return 40;
    }
    if (discoverMutation.isPending) {
      return 25;
    }
    if (generated) {
      return 100;
    }
    return 0;
  }, [discoverMutation.isPending, generateMutation.isPending, generated]);

  return (
    <Box sx={{ p: 2.5 }}>
      <Typography variant="h5" sx={{ mb: 1, color: theming.colors.primary }}>
        AI Code Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Create production-ready component, API and test scaffolds with integration suggestions.
      </Typography>

      {progress > 0 && progress < 100 && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />}

      {errorMessage && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Tabs
        value={GENERATOR_TABS.indexOf(activeTab)}
        onChange={(_event, next) => setActiveTab(GENERATOR_TABS[next] ?? 'Build')}
        sx={{ mb: 2 }}
      >
        {GENERATOR_TABS.map((tabName) => (
          <Tab key={tabName} label={tabName} />
        ))}
      </Tabs>

      {activeTab === 'Build' && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack spacing={1.5}>
                  <TextField
                    label="Requirements"
                    multiline
                    minRows={4}
                    value={requirements}
                    onChange={(event) => setRequirements(event.target.value)}
                    placeholder="Describe what should be generated and expected behavior..."
                  />

                  <TextField
                    label="Problem to solve"
                    multiline
                    minRows={2}
                    value={problemDescription}
                    onChange={(event) => setProblemDescription(event.target.value)}
                    placeholder="Optional context about user pain points or constraints"
                  />

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        fullWidth
                        label="Profession"
                        value={settings.profession}
                        onChange={(event) =>
                          setSettings((previous) => ({ ...previous, profession: event.target.value }))
                        }
                      >
                        <MenuItem value="photographer">Photographer</MenuItem>
                        <MenuItem value="videographer">Videographer</MenuItem>
                        <MenuItem value="music-producer">Music Producer</MenuItem>
                        <MenuItem value="agency">Agency</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        fullWidth
                        label="Framework"
                        value={settings.framework}
                        onChange={(event) =>
                          setSettings((previous) => ({
                            ...previous,
                            framework: event.target.value as LocalGenerationSettings['framework'],
                          }))
                        }
                      >
                        <MenuItem value="react">React</MenuItem>
                        <MenuItem value="nextjs">Next.js</MenuItem>
                        <MenuItem value="node">Node</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`Strict Types: ${settings.strictTypes ? 'On' : 'Off'}`}
                      color={settings.strictTypes ? 'success' : 'default'}
                      onClick={() => setSettings((previous) => ({ ...previous, strictTypes: !previous.strictTypes }))}
                    />
                    <Chip
                      label={`Generate API: ${settings.generateApi ? 'On' : 'Off'}`}
                      color={settings.generateApi ? 'success' : 'default'}
                      onClick={() => setSettings((previous) => ({ ...previous, generateApi: !previous.generateApi }))}
                    />
                    <Chip
                      label={`Include Tests: ${settings.includeTests ? 'On' : 'Off'}`}
                      color={settings.includeTests ? 'success' : 'default'}
                      onClick={() => setSettings((previous) => ({ ...previous, includeTests: !previous.includeTests }))}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      disabled={!canGenerate || generateMutation.isPending}
                      onClick={() => generateMutation.mutate()}
                    >
                      {generateMutation.isPending ? 'Generating...' : 'Generate Code'}
                    </Button>

                    <Button
                      variant="outlined"
                      disabled={discoverMutation.isPending}
                      onClick={() => discoverMutation.mutate()}
                    >
                      {discoverMutation.isPending ? 'Discovering...' : 'Discover APIs'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Integration Search
                </Typography>
                <TextField
                  fullWidth
                  label="Search query"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Search query is used for external API recommendation discovery.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 'Output' && (
        <Card variant="outlined" sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            {!generated ? (
              <Alert severity="info">Generate code to see artifacts and suggestions.</Alert>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">{generated.summary}</Typography>
                <Divider />
                {generated.artifacts.map((artifact) => (
                  <Card key={`${artifact.type}-${artifact.name}`} variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Chip size="small" label={artifact.type.toUpperCase()} color="primary" variant="outlined" />
                        <Typography variant="subtitle2">{artifact.name}</Typography>
                      </Stack>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          p: 1,
                          backgroundColor: 'rgba(0,0,0,0.08)',
                          borderRadius: 1,
                          fontSize: 12,
                          overflowX: 'auto',
                        }}
                      >
                        {artifact.code}
                      </Box>
                    </CardContent>
                  </Card>
                ))}

                <Divider />
                <Typography variant="subtitle2">Implementation Suggestions</Typography>
                <List dense>
                  {generated.suggestions.map((suggestion, index) => (
                    <ListItem key={`suggestion-${index}`}>
                      <ListItemText primary={suggestion} />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'Integrations' && (
        <Card variant="outlined" sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            {discoveredApis.length === 0 ? (
              <Alert severity="info">Run API discovery to see integration suggestions.</Alert>
            ) : (
              <List>
                {discoveredApis.map((api, index) => (
                  <ListItem key={`${api.name}-${index}`} divider={index < discoveredApis.length - 1}>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{api.name}</Typography>
                          <Chip size="small" label={api.category} variant="outlined" />
                          {api.norwegianSupport && <Chip size="small" color="success" label="NO" />}
                        </Stack>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {api.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {api.authentication ? `Auth: ${api.authentication}` : 'Auth: unspecified'} ·{' '}
                            {api.pricing ? `Pricing: ${api.pricing}` : 'Pricing: unspecified'}
                          </Typography>
                          {api.documentation && (
                            <Typography variant="caption" display="block">
                              {api.documentation}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
