/**
 * Contextual AI Tooltip Guide for Complex Integrations
 * Provides intelligent, context-aware guidance for API integrations
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Tooltip,
  Paper,
  Typography,
  Chip,
  IconButton,
  Fade,
  Alert,
  Button,
  Stack,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress
} from '@mui/material';
import {
  Psychology as AiIcon,
  Help as HelpIcon,
  Lightbulb as TipIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as OptimizeIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  Code as CodeIcon,
  Close as CloseIcon,
  AutoFixHigh as MagicIcon,
  School as LearnIcon,
  Build as ToolIcon
} from '@mui/icons-material';

interface AIGuidance {
  type: 'tip' | 'warning' | 'optimization' | 'security' | 'performance' | 'learning';
  title: string;
  description: string;
  actionable?: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  code?: string;
  links?: Array<{ label: string; url: string }>;
  suggestedActions?: string[];
}

interface ContextualAITooltipProps {
  context: {
    type: 'endpoint' | 'integration' | 'error' | 'performance' | 'security';
    data: any;
    currentState?: any;
    userActivity?: any;
};
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  showAIBadge?: boolean
}

export function ContextualAITooltip({
  context,
  children,
  placement = 'top',
  trigger = 'hover',
  showAIBadge = true
}: ContextualAITooltipProps) {
  const [guidance, setGuidance] = useState<AIGuidance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Generate AI guidance based on context
  const generateGuidance = async (contextData: any) => {
    setIsLoading(true);
    
    try {
      // Simulate AI analysis - in real implementation, this would call your AI service
      const aiGuidance = await analyzeContext(contextData);
      setGuidance(aiGuidance);
  } catch (error) {
      console.error('AI guidance generation failed: ', error);
      setGuidance([{
        type: 'warning',
        title: 'AI-veiledning utilgjengelig',
        description: 'Kunne ikke generere kontekstuell hjelp for øyeblikket.',
        priority: 'low'
  }]);
  } finally {
      setIsLoading(false);
  }
};

  // Analyze context and return relevant guidance
  const analyzeContext = async (contextData: any): Promise<AIGuidance[]> => {
    const { type, data, currentState, userActivity } = contextData;
    const guidanceList: AIGuidance[] = [];

    switch (type) {
      case 'endpoint':
        guidanceList.push(...generateEndpointGuidance(data, currentState));
        break;
      case 'integration':
        guidanceList.push(...generateIntegrationGuidance(data, currentState));
        break;
      case 'error':
        guidanceList.push(...generateErrorGuidance(data, currentState));
        break;
      case 'performance':
        guidanceList.push(...generatePerformanceGuidance(data, currentState));
        break;
      case 'security':
        guidanceList.push(...generateSecurityGuidance(data, currentState));
        break;
      default: guidanceList.push(getDefaultGuidance());
}

    // Add user activity-based suggestions
    if (userActivity) {
      guidanceList.push(...generateActivityBasedGuidance(userActivity));
  }

    return guidanceList.sort((a, b) => {
      const priorityOrder = { critical:  4, high:  3, medium: 2, low:  1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
};

  // Generate endpoint-specific guidance
  const generateEndpointGuidance = (endpoint: any, state: any): AIGuidance[] => {
    const guidance: AIGuidance[] = [];

    if (endpoint.service === 'anthropic' || endpoint.service === 'openai') {
      guidance.push({
        type: 'tip',
        title: 'AI API Optimalisering',
        description: 'For beste ytelse med AI-tjenester, implementer rate limiting og caching for å redusere kostnader og forbedre responstider.',
        priority: 'medium',
        actionable: true,
        suggestedActions: [
          'Implementer eksponentiell backoff for retry-logikk','Aktiver response caching for gjentatte forespørsler','Overvåk token-bruk for kostnadskontroll'
        ],
        code: `// Eksempel: Rate limiting for AI API
const rateLimiter = {
  requests: new Map(),
  isAllowed(userId: string) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const recentRequests = userRequests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= 10) {
      return false; // Max 10 requests per minute
}
    
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    return true;
}
};`
    });
  }

    if (endpoint.service === 'vipps' || endpoint.service === 'stripe') {
      guidance.push({
        type: 'security',
        title: 'Betalingssikkerhet',
        description: 'Betalings-APIer krever ekstra sikkerhetstiltak. Sørg for korrekt validering og logging.',
        priority: 'high',
        actionable: true,
        suggestedActions: [
          'Implementer webhook signature validering','Bruk HTTPS for alle betalingsendepunkter','Logg alle betalingstransaksjoner for audit'
        ]
    });
  }

    if (!endpoint.isActive) {
      guidance.push({
        type: 'warning',
        title: 'Inaktivt Endepunkt',
        description: 'Dette endepunktet er deaktivert og vil ikke motta forespørsler. Aktiver det for testing.',
        priority: 'medium',
        actionable: true
  });
  }

    if (state?.errorRate > 10) {
      guidance.push({
        type: 'warning',
        title: 'Høy Feilrate',
        description: `Endepunktet har ${Math.round(state.errorRate)}% feilrate. Dette kan indikere konfigurasjonsproblemer.`,
        priority: 'high',
        actionable: true,
        suggestedActions: [
          'Sjekk endpoint-konfigurasjon','Valider input-parametere','Overvåk server-logger for feilmeldinger',
        ],
      });
    }

    return guidance;
  };

  // Generate integration-specific guidance
  const generateIntegrationGuidance = (integration: any, state: any): AIGuidance[] => {
    const guidance: AIGuidance[] = [];

    guidance.push({
      type: 'learning',
      title: 'Integrasjon Best Practices',
      description: 'Lær mer om hvordan du optimaliserer denne integrasjonen for produksjon.',
      priority: 'low',
      links: [
        { label: 'API Dokumentasjon', url: '#' },
        { label: 'Sikkerhet Guidelines', url: '#' },
        { label: 'Rate Limiting Guide', url: '#' }
      ]
    });

    if (integration.type === 'oauth') {
      guidance.push({
        type: 'security',
        title: 'OAuth Sikkerhet',
        description: 'OAuth-integrasjoner krever sikker håndtering av tokens og refresh-logikk.',
        priority: 'high',
        actionable: true,
        suggestedActions: [
          'Implementer automatisk token refresh','Bruk secure storage for refresh tokens','Valider scopes og permissions',
        ],
      });
    }

    return guidance;
  };

  // Generate error-specific guidance
  const generateErrorGuidance = (error: any, state: any): AIGuidance[] => {
    const guidance: AIGuidance[] = [];

    if (error.status >= 400 && error.status < 500) {
      guidance.push({
        type: 'warning',
        title: 'Client Error Detektert',
        description: `HTTP ${error.status}: Sjekk forespørsel-parametere og autentisering.`,
        priority: 'high',
        actionable: true,
        suggestedActions: [
          'Valider API-nøkler og tokens','Sjekk request body format','Kontroller required parametere',
        ],
      });
    }

    if (error.status >= 500) {
      guidance.push({
        type: 'warning',
        title: 'Server Error',
        description: `HTTP ${error.status}: Server-side problem detektert.`,
        priority: 'critical',
        actionable: true,
        suggestedActions: [
          'Sjekk tjenestestatus','Implementer retry-logikk','Kontakt API-leverandør hvis problemet vedvarer',
        ],
      });
    }

    return guidance;
  };

  // Generate performance-specific guidance
  const generatePerformanceGuidance = (performance: any, state: any): AIGuidance[] => {
    const guidance: AIGuidance[] = [];

    if (performance.responseTime > 2000) {
      guidance.push({
        type: 'performance',
        title: 'Langsom Responstid',
        description: `Gjennomsnittlig responstid er ${performance.responseTime}ms. Vurder optimalisering.`,
        priority: 'medium',
        actionable: true,
        suggestedActions: [
          'Implementer caching for statiske responser','Optimaliser database queries','Vurder CDN for statisk innhold',
        ],
      });
    }

    return guidance;
  };

  // Generate security-specific guidance
  const generateSecurityGuidance = (security: any, state: any): AIGuidance[] => {
    const guidance: AIGuidance[] = [];

    guidance.push({
      type: 'security',
      title: 'Sikkerhetskontroll',
      description: 'Sørg for at alle API-endepunkter følger sikkerhetsstandarder.',
      priority: 'high',
      actionable: true,
      suggestedActions: [
        'Implementer rate limiting','Bruk HTTPS for alle forespørsler','Valider og sanitiser all input','Implementer audit logging',
      ],
    });

    return guidance;
  };

  // Generate activity-based guidance
  const generateActivityBasedGuidance = (activity: any): AIGuidance[] => {
    const guidance: AIGuidance[] = [];

    if (activity.frequentErrors) {
      guidance.push({
        type: 'tip',
        title: 'Gjentatte Feil Detektert',
        description: 'Du har opplevd lignende feil tidligere. Her er forslag til løsninger.',
        priority: 'medium',
        actionable: true,
      });
    }

    return guidance;
  };

  // Default guidance
  const getDefaultGuidance = (): AIGuidance => ({
    type: 'tip',
    title: 'AI-Veiledning Tilgjengelig',
    description: 'Klikk for å få kontekstuell hjelp og tips for denne integrasjonen.',
    priority: 'low',
  });

  // Get icon for guidance type
  const getGuidanceIcon = (type: AIGuidance['type']) => {
    const iconMap = {
      tip: <TipIcon color="info"  />,
      warning: <WarningIcon color="warning"  />,
      optimization: <OptimizeIcon color="success"  />,
      security: <SecurityIcon color="error"  />,
      performance: <PerformanceIcon color="primary"  />,
      learning: <LearnIcon color="secondary" />
};
    return iconMap[type];
};

  // Get priority color
  const getPriorityColor = (priority: AIGuidance['priority']) => {
    const colorMap = {
      low: 'default',
      medium: 'warning',
      high: 'error',
      critical: 'error'
};
    return colorMap[priority] as any;
};

  // Handle tooltip open/close
  const handleTooltipToggle = (open: boolean) => {
    setIsOpen(open);
    if (open && !hasInteracted) {
      setHasInteracted(true);
      generateGuidance(context);
}
};

  // Tooltip content
  const tooltipContent = (
    <Paper sx={{ p: 2, maxWidth: 40, bgcolor: 'background.paper' ,  ...theming.getThemedCardSx() }}>
      {isLoading ? (
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <AiIcon color="primary" />
            <Typography variant="subtitle2">AI analyserer...</Typography>
          </Box>
          <LinearProgress />
        </Box>
      ) : (
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <AiIcon color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                AI-Veiledning
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setIsOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {guidance.length === 0 ? (
            <Alert severity="info" sx={{ mt:  1 }}>
              Ingen spesifikk veiledning tilgjengelig for denne konteksten.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {guidance.slice(0, 3).map((guide, index) => (
                <Card key={index} variant="outlined" sx={{ bgcolor: 'background.default', ...theming.getThemedCardSx() }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, ...theming.getThemedCardSx() }}>
                    <Box display="flex" alignItems="flex-start" gap={1}>
                      {getGuidanceIcon(guide.type)}
                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {guide.title}
                          </Typography>
                          <Chip
                            label={guide.priority}
                            size="small"
                            color={getPriorityColor(guide.priority)}
                            variant="outlined"
                          />
                        </Box>

                        <Typography variant="body2" color="text.secondary" mb={1}>
                          {guide.description}
                        </Typography>

                        {guide.suggestedActions && guide.suggestedActions.length > 0 && (
                          <Box mt={1}>
                            <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>
                              Foreslåtte handlinger:
                            </Typography>
                            <List dense sx={{ p: 0 }}>
                              {guide.suggestedActions.slice(0, 2).map((action, actionIndex) => (
                                <ListItem key={actionIndex} sx={{ p: 0, pl: 1 }}>
                                  <ListItemIcon sx={{ minWidth: 20 }}>
                                    <CheckCircleIcon fontSize="small" color="success" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={action}
                                    primaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        )}

                        {guide.code && (
                          <Box mt={1}>
                            <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>
                              Kodeeksempel:
                            </Typography>
                            <Paper sx={{ p: 1, bgcolor: 'grey.100', fontSize: 10, fontFamily: 'monospace', ...theming.getThemedCardSx() }}>
                              <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                                {guide.code.slice(0, 200)}...
                              </Typography>
                            </Paper>
                          </Box>
                        )}

                        {guide.links && guide.links.length > 0 && (
                          <Box mt={1}>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {guide.links.map((link, linkIndex) => (
                                <Button
                                  key={linkIndex}
                                  size="small"
                                  variant="text"
                                  startIcon={<LearnIcon />}
                                  href={link.url}
                                  target="_blank"
                                  sx={{ fontSize: '0.7rem', p: 0.5}}
                                >
                                  {link.label}
                                </Button>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}

              {guidance.length > 3 && (
                <Button
                  size="small"
                  startIcon={<MagicIcon />}
                  sx={{ alignSelf: 'center' }}
                >
                  Vis {guidance.length - 3} flere tips
                </Button>
              )}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );

  // Enhanced child element with AI badge
  const enhancedChild = showAIBadge ? React.cloneElement(children, {
    sx: {
      ...children.props.sx,
      position: 'relative','&::after': hasInteracted ? {} : {
        content: '""',
        position: 'absolute',
        top: -4,
        right: -4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.5, transform: 'scale(1.1)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
    },
  }) : children;

  if (trigger === 'click') {
    return (
      <>
        <Box onClick={() => handleTooltipToggle(!isOpen)} sx={{ cursor: 'pointer' }}>
          {enhancedChild}
        </Box>
        <Fade in={isOpen}>
          <Box
            ref={tooltipRef}
            sx={{
              position: 'absolute',
              zIndex: 150,
              mt: 1}}
          >
            {tooltipContent}
          </Box>
        </Fade>
      </>
    );
}

  return (
    <Tooltip
      title={tooltipContent}
      placement={placement}
      arrow
      open={isOpen}
      onOpen={() => handleTooltipToggle(true)}
      onClose={() => handleTooltipToggle(false)}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'transparent',
            maxWidth: 'none',
            p: 0 }
      }
    }}
    >
      {enhancedChild}
    </Tooltip>
  );
}