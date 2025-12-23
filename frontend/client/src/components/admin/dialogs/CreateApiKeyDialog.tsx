/**
 * CreatorHub Norge - Create API Key Dialog
 * Enhanced dialog with React Hook Form + Zod validation
 * Connects to .env and .env.locale for secure key storage
 */

import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { useEnhancedMasterIntegration } from '../../../integration/EnhancedMasterIntegrationProvider';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Key as KeyIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/queryClient';

const createApiKeySchema = z.object({
  name: z
    .string()
    .min(3 'Navn må være minst 3 tegn, ')
    .max(50, 'Navn kan ikke være lengre enn 50 tegn')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/'Kun bokstaver, tall, mellomrom, bindestrek og understrek tillatt',
    ),
  service: z.string().min(1, 'Velg en tjeneste'),
  keyType: z.string().min(1, 'Velg nøkkeltype'),
  permissions: z.array(z.string()).min(1'Velg minst én tillatelse'),
  environment: z.enum(['development','staging','production']),
  autoRotate: z.boolean(),
  rotationDays: z.number().optional(),
  apiKeyValue: z.string().min(1'API-nøkkel verdi er påkrevd'),
  frontendComponents: z.array(z.string()).optional(),
  autoGenerateIntegration: z.boolean().optional(),
});

type CreateApiKeyForm = z.infer<typeof createApiKeySchema>;

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

const services = [
  {
    value: 'openai',
    label: 'OpenAI',
    permissions: ['chat','completion','embedding'],
    envKey: 'OPENAI_API_KEY',
},
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    permissions: ['chat','completion'],
    envKey: 'ANTHROPIC_API_KEY',
},
  {
    value: 'google-gemini',
    label: 'Google Gemini',
    permissions: ['chat','completion','vision'],
    envKey: 'GOOGLE_GEMINI_API_KEY',
},
  {
    value: 'stripe',
    label: 'Stripe',
    permissions: ['payment','subscription','webhook'],
    envKey: 'STRIPE_SECRET_KEY',
},
  {
    value: 'pexels',
    label: 'Pexels',
    permissions: ['search','download','curated'],
    envKey: 'PEXELS_API_KEY',
},
  {
    value: 'unsplash',
    label: 'Unsplash',
    permissions: ['search','download','stats'],
    envKey: 'UNSPLASH_ACCESS_KEY',
},
];

const keyTypes = [
  { value: 'api_key', label: 'API Key' },
  { value: 'bearer_token', label: 'Bearer Token' },
  { value: 'oauth_token', label: 'OAuth Token' },
];

const environments = [
  { value: 'development', label: 'Utvikling', color: 'info' as const },
  { value: 'staging', label: 'Test', color: 'warning' as const },
  { value: 'production', label: 'Produksjon', color: 'error' as const },
];

export default function CreateApiKeyDialog({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateApiKeyDialogProps) {
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();
  const [activeStep, setActiveStep] = React.useState(0);
  const [dryRunResult, setDryRunResult] = React.useState<any>(null);
  const [envUpdateStatus, setEnvUpdateStatus] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    reset,
    getValues,
} = useForm<CreateApiKeyForm>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: ', ',
      service: ', ',
      keyType: 'api_key',
      permissions: [],
      environment: 'development',
      autoRotate: false,
      rotationDays: 30,
      apiKeyValue: ', ',
      frontendComponents: [],
      autoGenerateIntegration: true,
  },
    mode: 'onChange',
});

  const watchedValues = watch();
  const selectedService = services.find((s) => s.value === watchedValues.service);

  const steps = [
    'Grunnleggende informasjon','Tillatelser og sikkerhet','Auto-generering og komponenter','Forhåndsvisning og bekreftelse',
  ];

  const availableComponents = [
    { value: 'chat', label: 'Chat Interface', description: 'AI chat component' },
    { value: 'search', label: 'Search Interface', description: 'Photo search component' },
    { value: 'payment', label: 'Payment Form', description: 'Stripe payment component' },
    { value: 'dashboard', label: 'Analytics Dashboard', description: 'Usage analytics' },
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
};

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
};

  const handleDryRun = async () => {
    const formData = getValues();
    // Simulate dry run
    setDryRunResult({
      estimatedQuota: 10000,
      estimatedCost: '$10/month',
      securityScore: 85,
      recommendations: [
        'Aktiver automatisk rotasjon for økt sikkerhet','Overvåk bruk månedlig for kostnadsoptimalisering',
      ],
  });
};

  const handleFormSubmit = async (data: CreateApiKeyForm) => {
    try {
      // Save to .env / .env.locale via backend API
      const envFile = data.environment === 'development' ? '.env.locale' : '.env';
      const envKey = selectedService?.envKey || `${data.service.toUpperCase()}_API_KEY`;

      setEnvUpdateStatus('Lagrer til .env...');

      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/env-secrets', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: envKey,
          value: data.apiKeyValue,
          environment: data.environment,
          file: envFile,
          metadata: {
            name: data.name,
            service: data.service,
            keyType: data.keyType,
            permissions: data.permissions,
            autoRotate: data.autoRotate,
            rotationDays: data.rotationDays,
            frontendComponents: data.frontendComponents || [],
            autoGenerateIntegration: data.autoGenerateIntegration,
            createdAt: new Date().toISOString(),
        },
      }),
    });

      if (response.success) {
        let statusMessage = `✅ Lagret til ${envFile}`;
        
        // Show what was auto-generated
        if (response.generated) {
          statusMessage += '\n🎨 Auto-generert: ';
          if (response.generated.service) statusMessage += '\n  ✅ Service wrapper';
          if (response.generated.routes) statusMessage += '\n  ✅ API routes';
          if (response.generated.hook) statusMessage += '\n  ✅ Frontend hook';
          if (response.generated.components?.length > 0) {
            statusMessage += `\n  ✅ ${response.generated.components.length} komponenter`;
        }
      }
        
        setEnvUpdateStatus(statusMessage);
        
        // Call parent onSubmit
        onSubmit({
          ...data,
          envKey,
          envFile,
          generated: response.generated,
      });
        
        // Close dialog after showing results
        setTimeout(() => {
          handleDialogClose();
      }, 3000);
    } else {
        throw new Error(response.error || 'Feil ved lagring');
    }
  } catch (error: any) {
      setEnvUpdateStatus(`❌ Feil: ${error.message}`);
  }
};

  const handleDialogClose = () => {
    reset();
    setActiveStep(0);
    setDryRunResult(null);
    setEnvUpdateStatus(null);
    onClose();
};

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Opprett ny API-nøkkel
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {envUpdateStatus && (
          <Alert 
            severity={envUpdateStatus.includes('✅') ? 'success' : envUpdateStatus.includes('❌') ? 'error' : 'info'} 
            sx={{ mb: 2 }}
          >
            {envUpdateStatus}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Basic Information */}
          <Step>
            <StepLabel>Grunnleggende informasjon</StepLabel>
            <StepContent>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Navn på API-nøkkel"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Controller
                  name="service"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Tjeneste</InputLabel>
                      <Select {...field} error={!!errors.service} label="Tjeneste">
                        {services.map((service) => (
                          <MenuItem key={service.value} value={service.value}>
                            <Box>
                              <Typography>{service.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Lagres som: {service.envKey}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="keyType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Nøkkeltype</InputLabel>
                      <Select {...field} error={!!errors.keyType} label="Nøkkeltype">
                        {keyTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="apiKeyValue"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="API-nøkkel verdi"
                      type="password"
                      error={!!errors.apiKeyValue}
                      helperText={errors.apiKeyValue?.message || 'Skriv inn den faktiske API-nøkkelen'}
                      sx={{ mb: 2 }}
                    />
                  )}
                />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!watchedValues.name || !watchedValues.service || !watchedValues.apiKeyValue}
                >
                  Neste
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: Permissions and Security */}
          <Step>
            <StepLabel>Tillatelser og sikkerhet</StepLabel>
            <StepContent>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Controller
                  name="environment"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Miljø</InputLabel>
                      <Select {...field} label="Miljø">
                        {environments.map((env) => (
                          <MenuItem key={env.value} value={env.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={env.label} size="small" color={env.color} />
                              <Typography variant="caption" color="text.secondary">
                                ({env.value === 'development' ? '.env.locale' : '.env'})
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                {selectedService && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tilgjengelige tillatelser for {selectedService.label}:
                    </Typography>
                    <Controller
                      name="permissions"
                      control={control}
                      render={({ field }) => (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {selectedService.permissions.map((permission) => (
                            <Chip
                              key={permission}
                              label={permission}
                              clickable
                              color={field.value.includes(permission) ? 'primary' : 'default'}
                              onClick={() => {
                                const newPermissions = field.value.includes(permission)
                                  ? field.value.filter((p) => p !== permission)
                                  : [...field.value, permission];
                                field.onChange(newPermissions);
                            }}
                            />
                          ))}
                        </Box>
                      )}
                    />
                    {errors.permissions && (
                      <Typography variant="caption" color="error">
                        {errors.permissions.message}
                      </Typography>
                    )}
                  </Box>
                )}

                <Controller
                  name="autoRotate"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Automatisk rotasjon av nøkkel"
                    />
                  )}
                />

                {watchedValues.autoRotate && (
                  <Controller
                    name="rotationDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        label="Rotasjon hver X dager"
                        inputProps={{ min: 7, max: 365 }}
                        sx={{ mt: 1, width: 200 }}
                      />
                    )}
                  />
                )}
              </Box>
              <Box sx={{ mb: 1 }}>
                <Button onClick={handleBack}, sx={{ mr: 1 }}>
                  Tilbake
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={watchedValues.permissions.length === 0}
                >
                  Neste
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Auto-generation and Components */}
          <Step>
            <StepLabel>Auto-generering og komponenter</StepLabel>
            <StepContent>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    🎨 Automatisk integrasjon!
                  </Typography>
                  <Typography variant="body2">
                    Systemet vil automatisk generere:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                    <li>Service wrapper (server/services/{selectedService?.value}-service.ts)</li>
                    <li>API routes (server/routes/{selectedService?.value}-api-routes.ts)</li>
                    <li>Frontend hook (client/src/hooks/use{selectedService?.label.replace(/\s/g, '')}Api.ts)</li>
                    <li>Auto-registration i server/index.ts</li>
                  </Box>
                </Alert>

                <Controller
                  name="autoGenerateIntegration"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Generer automatisk service, routes og hooks"
                    />
                  )}
                />

                {watchedValues.autoGenerateIntegration && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Velg frontend-komponenter å generere (valgfritt):
                    </Typography>
                    <Controller
                      name="frontendComponents"
                      control={control}
                      render={({ field }) => (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {availableComponents.map((component) => (
                            <Card
                              key={component.value}
                              sx={{
                                p: 1,
                                cursor: 'pointer',
                                border: 2,
                                borderColor: (field.value || []).includes(component.value) ? 'primary.main' : 'divider',
                                bgcolor: (field.value || []).includes(component.value) ? 'rgba(25, 118, 210, 0.08)' : 'transparent', '&:hover': {
                                  borderColor: 'primary.main',
                              }}}
                              onClick={() => {
                                const current = field.value || [];
                                const newValue = current.includes(component.value)
                                  ? current.filter((c: string) => c !== component.value)
                                  : [...current, component.value];
                                field.onChange(newValue);
                            }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {component.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {component.description}
                              </Typography>
                            </Card>
                          ))}
                        </Box>
                      )}
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ mb: 1 }}>
                <Button onClick={handleBack}, sx={{ mr: 1 }}>
                  Tilbake
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                >
                  Neste
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 4: Preview and Confirmation */}
          <Step>
            <StepLabel>Forhåndsvisning og bekreftelse</StepLabel>
            <StepContent>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      <PreviewIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Konfigurasjonssammendrag
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <KeyIcon />
                        </ListItemIcon>
                        <ListItemText primary="Navn" secondary={watchedValues.name} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <SecurityIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Tjeneste" 
                          secondary={`${selectedService?.label} (${selectedService?.envKey})`} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <SecurityIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Miljø fil" 
                          secondary={watchedValues.environment === 'development' ? '.env.locale' : '.env'} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <ScheduleIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Automatisk rotasjon"
                          secondary={
                            watchedValues.autoRotate
                              ? `Hver ${watchedValues.rotationDays} dager`
                              : 'Deaktivert'
                        }
                        />
                      </ListItem>
                    </List>

                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                      Tillatelser:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      {watchedValues.permissions.map((permission) => (
                        <Chip key={permission} label={permission} size="small" color="primary" />
                      ))}
                    </Box>

                    {watchedValues.autoGenerateIntegration && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.main' }}>
                          🎨 Auto-generering aktivert:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                          <li>✅ Service wrapper blir opprettet</li>
                          <li>✅ API routes blir opprettet</li>
                          <li>✅ Frontend hook blir opprettet</li>
                          <li>✅ Auto-registrert i server</li>
                          {(watchedValues.frontendComponents || []).length > 0 && (
                            <li>✅ {(watchedValues.frontendComponents || []).length} komponenter blir opprettet</li>
                          )}
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Button
                  variant="outlined"
                  onClick={handleDryRun}
                  sx={{ mb: 2 }}
                  startIcon={<PreviewIcon />}
                >
                  Kjør tørrkjøring
                </Button>

                {dryRunResult && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Tørrkjøring-resultater:</Typography>
                    <Typography variant="body2">
                      Estimert kvote: {dryRunResult.estimatedQuota} kall/måned
                      <br />
                      Estimert kostnad: {dryRunResult.estimatedCost}
                      <br />
                      Sikkerhetspoeng: {dryRunResult.securityScore}/100
                    </Typography>
                  </Alert>
                )}
              </Box>
              <Box sx={{ mb: 1 }}>
                <Button onClick={handleBack}, sx={{ mr: 1 }}>
                  Tilbake
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit(handleFormSubmit)}
                  disabled={!isValid || isLoading}
                >
                  {isLoading ? 'Oppretter...' : 'Opprett og lagre til .env'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDialogClose}>Avbryt</Button>
      </DialogActions>
    </Dialog>
  );
}
