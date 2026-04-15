// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../utils/theming-helper';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogContentText,
  Button,
  Chip,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Settings,
  Warning,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';

interface GoogleOAuthSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void
}

interface ApiTestResult {
  name: string;
  success: boolean;
  icon: string;
  description: string
}

declare global {
  interface Window {
    google: any;
}
}

const REQUIRED_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/photoslibrary',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly'
];

export function GoogleOAuthSetup({ open, onOpenChange }: GoogleOAuthSetupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [apiTests, setApiTests] = useState<ApiTestResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'setup' | 'authorize' | 'testing' | 'complete'>('setup');
  const { toast } = useToast();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Initialize Google Identity Services
  useEffect(() => {
    if (!open) return;

    const initGoogleIdentity = async () => {
      try {
        // Load Google Identity Services script if not already loaded
        if (!window.google?.accounts) {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.onload = () => {
            setIsGapiReady(true);
      };
          document.head.appendChild(script);
      } else {
          setIsGapiReady(true);
      }
    } catch (error) {
        console.error('Failed to load Google Identity Services: ', error);
        toast({
          title: "API Lastingsfeil",
          description: "Kunne ikke laste Google Identity Services. Prøv igjen.",
          variant: "destructive",
      });
    }
  };

    initGoogleIdentity();
}, [open, toast]);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    if (!open) return;

    componentRegistry.registerComponent('GoogleOAuthSetup', {
      type: 'oauth-service',
      capabilities: ['google-oauth', 'authentication','api-testing'],
      dataFlow: {
        sources: ['oauth-status', 'api-tests','auth-result'],
        destinations: ['admin-dashboard','user-interface'],
        processors: ['oauth-processing','api-testing']
    }
  });

    // Set up data flow nodes
    dataFlow.registerNode('oauth-status', {
      type: 'source',
      data: { isGapiReady, isLoading, currentStep },
      metadata: { component: 'GoogleOAuthSetup', type: 'oauth-status',}
  });

    dataFlow.registerNode('api-tests', {
      type: 'source',
      data: apiTests,
      metadata: { component: 'GoogleOAuthSetup', type: 'api-tests',}
  });

    dataFlow.registerNode('auth-result', {
      type: 'source',
      data: authResult,
      metadata: { component: 'GoogleOAuthSetup', type: 'auth-result',}
  });

    // Listen for Google OAuth events
    communication.subscribe('google-oauth: init', () => {
      if (isGapiReady) {
        handleGoogleLogin();
    }
  });

    communication.subscribe('google-oauth: test-apis', () => {
      if (authResult) {
        testGoogleAPIs();
    }
  });

    communication.subscribe('google-oauth: reset', () => {
      setCurrentStep('setup');
      setAuthResult(null);
      setApiTests([]);
  });

    return () => {
      componentRegistry.unregisterComponent('GoogleOAuthSetup');
      dataFlow.unregisterNode('oauth-status');
      dataFlow.unregisterNode('api-tests');
      dataFlow.unregisterNode('auth-result');
  };
}, [open, isGapiReady, isLoading, currentStep, apiTests, authResult, componentRegistry, dataFlow, communication]);

  const handleGoogleLogin = async () => {
    if (!isGapiReady) {
      toast({
        title: "API Ikke Klar",
        description: "Google Identity Services laster fortsatt. Vent et øyeblikk.",
        variant: "destructive",
    });
      return;
  }

    setIsLoading(true);
    setCurrentStep('authorize');

    try {
      // Initialize Google OAuth client with new Identity Services
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: '256648631702-7s92vtepjrmv68eb9iick95npivkgs3j.apps.googleusercontent.com',
        scope: REQUIRED_SCOPES.join('', ),
        callback: async (response: any) => {
          if (response.error) {
            throw new Error(response.error_description || response.error);
      }

          const accessToken = response.access_token;
          setAuthResult(response);
          
          console.log('🎉 GOOGLE OAUTH SUCCESS - NEW IDENTITY SERVICES: ');
          console.log('Access Token, :', accessToken.substring(0, 30) + '...');
          console.log('Expires In: ', response.expires_in);
          console.log('Scope:', response.scope);

          setCurrentStep('testing');
          await testGoogleAPIs(accessToken);

          toast({
            title: "OAuth Suksess, !",
            description: "Alle Google-integrasjoner er nå aktivert.",
        });

          setCurrentStep('complete');
          setIsLoading(false);
      },
    });

      // Request access token
      client.requestAccessToken({
        prompt: 'consent'
  });

  } catch (error: any) {
      console.error('Google OAuth error, :', error);
      toast({
        title: "OAuth Feil",
        description: error.message || "En feil oppstod under autorisering. Prøv igjen.",
        variant: "destructive",
    });
      setCurrentStep('setup');
      setIsLoading(false);
  }
};

  const testGoogleAPIs = async (accessToken: string) => {
    const tests: ApiTestResult[] = [
      {
        name: 'Google Contacts',
        success: false,
        icon: '�, �',
        description: 'CRM og kundeintegrasjon'
  },
      {
        name: 'Google Drive',
        success: false,
        icon: '�, �',
        description: 'Prosjektfiler og backup'
  },
      {
        name: 'Google Calendar',
        success: false,
        icon: '�, �',
        description: 'Møteplanning og timebestilling'
  },
      {
        name: 'Google Tasks',
        success: false,
        icon: '�, �',
        description: 'Worklog sync system'
  },
      {
        name: 'Gmail AP',
        success: false,
        icon: '�, �',
        description: 'E-post integrasjon'
  }
    ];

    // Test Google Drive API
    try {
      const driveResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
        }
      }
      );
      if (driveResponse.ok) {
        tests[1].success = true;
        console.log('✅ Google Drive API test successful!');
    }
  } catch (e) {
      console.log('⚠️ Drive API test failed:', e);
  }

    // Test Google People API (Contacts)
    try {
      const peopleResponse = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?pageSize=1&personFields=names',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
        }
      }
      );
      if (peopleResponse.ok) {
        tests[0].success = true;
        console.log('✅ Google Contacts API test successful!');
    }
  } catch (e) {
      console.log('⚠️ Contacts API test failed:', e);
  }

    // Test Google Calendar API
    try {
      const calendarResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
        }
      }
      );
      if (calendarResponse.ok) {
        tests[2].success = true;
        console.log('✅ Google Calendar API test successful!');
    }
  } catch (e) {
      console.log('⚠️ Calendar API test failed:', e);
  }

    // Test Google Tasks API
    try {
      const tasksResponse = await fetch(
        'https://www.googleapis.com/tasks/v1/users/@me/lists',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
        }
      }
      );
      if (tasksResponse.ok) {
        tests[3].success = true;
        console.log('✅ Google Tasks API test successful!');
    }
  } catch (e) {
      console.log('⚠️ Tasks API test failed:', e);
  }

    // Test Gmail API
    try {
      const gmailResponse = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/labels',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
        }
      }
      );
      if (gmailResponse.ok) {
        tests[4].success = true;
        console.log('✅ Gmail API test successful!');
    }
  } catch (e) {
      console.log('⚠️ Gmail API test failed:', e);
  }

    setApiTests(tests);

    // Send tokens to server for storage
    try {
      await fetch('/api/oauth/store-tokens', {
        headers: {
          ...auth,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          accessToken,
          scopes: REQUIRED_SCOPES,
          source: 'client-side-oauth'
        })
      });
      console.log('✅ Tokens stored on server successfully');
  } catch (e) {
      console.log('⚠️ Failed to store tokens on server:', e);
  }
};

  const getStepIcon = () => {
    switch (currentStep) {
      case 'setup': return <Settings sx={{ fontSize: 24}} />;
      case 'authorize': return <CircularProgress sx={{ fontSize: 24}} />;
      case 'testing': return <CircularProgress sx={{ fontSize: 24}} />;
      case 'complete': return <CheckCircle sx={{ fontSize:  24, color: 'green'}} />;
      default: return <Settings sx={{ fontSize: 24}} />;
  }
};

  const getStepDescription = () => {
    switch (currentStep) {
      case 'setup': return 'Klar for å koble til Google-tjenester';
      case 'authorize': return 'Autoriserer tilgang til Google...';
      case 'testing': return 'Tester alle API-tilganger...';
      case 'complete': return 'Alle Google-integrasjoner aktivert!';
      default: return ', ';
}
};

  const successfulTests = apiTests.filter(test => test.success).length;
  const totalTests = apiTests.length;

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth="md" fullWidth>
      <DialogContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {getStepIcon()}
          <DialogTitle sx={{ p:  0 }}>Google OAuth Setup - CreatorHub Norge</DialogTitle>
        </Box>
        <DialogContentText sx={{ mb:  3 }}>
          {getStepDescription()}
        </DialogContentText>

        <div className="space-y-6">
          {currentStep === 'setup' && (
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" className="text-lg" sx={{ color: theming.colors.primary }}>Aktiver Google Integrasjoner</Typography>
                <Typography variant="body2" color="text.secondary">
                  Koble CreatorHub Norge til Google-tjenestene dine for full funksjonalitet.
                  Dette er en sikker, klientside OAuth-prosess som unngår SSL-problemer.
                </Typography>
              </CardHeader>
              <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
                <div>
                  <h4 className="font-semibold mb-2">Aktiveres automatisk: </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Chip label="📇 Google Contacts" variant="outlined" size="small" />
                    <Chip label="📁 Google Drive" variant="outlined" size="small" />
                    <Chip label="📧 Gmail" variant="outlined" size="small" />
                    <Chip label="📅 Google Calendar" variant="outlined" size="small" />
                    <Chip label="📋 Google Tasks" variant="outlined" size="small" />
                    <Chip label="📊 Analytics" variant="outlined" size="small" />
                  </div>
                </div>

                <Button 
                  onClick={handleGoogleLogin}
                  disabled={isLoading || !isGapiReady}
                  className="w-full"
                  size="lg"
                >
                  {isLoading && <CircularProgress sx={{ fontSize:  16, marginRight:  1 }} />}
                  {isGapiReady ? 'Koble til Google' : 'Laster Google Identity Services...'}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 'testing' && (
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>Tester API-tilganger...</Typography>
              </CardHeader>
              <CardContent sx={theming.getThemedCardSx()}>
                <div className="space-y-3">
                  {apiTests.map((test) => (
                    <div key={test.name} className="flex items-center gap-3">
                      <span className="text-lg">{test.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{test.name}</div>
                        <div className="text-sm text-muted-foreground">{test.description}</div>
                      </div>
                      {test.success ? (
                        <CheckCircle sx={{ fontSize:  20, color: 'green'}} />
                      ) : (
                        <CircularProgress sx={{ fontSize: 20}} />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'complete' && (
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  color: 'success.main' }}>🎉 Setup Fullført!</Typography>
                <Typography variant="body2" color="text.secondary">
                  Google-integrasjonene er nå aktivert og klare til bruk.
                </Typography>
              </CardHeader>
              <CardContent className="space-y-4" sx={theming.getThemedCardSx()}>
                <div>
                  <h4 className="font-semibold mb-2">
                    API Test Resultater ({successfulTests}/{totalTests}):
                  </h4>
                  <div className="space-y-2">
                    {apiTests.map((test) => (
                      <div key={test.name} className="flex items-center gap-3">
                        <span className="text-lg">{test.icon}</span>
                        <div className="flex-1">
                          <div className="font-medium">{test.name}</div>
                          <div className="text-sm text-muted-foreground">{test.description}</div>
                        </div>
                        {test.success ? (
                          <CheckCircle sx={{ fontSize:  20, color: 'green'}} />
                        ) : (
                          <Cancel sx={{ fontSize:  20, color: 'red'}} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Aktiverte Funksjoner: </h4>
                  <ul className="space-y-1 text-sm text-green-700">
                    <li>• CRM-integrasjon med Google Contacts</li>
                    <li>• Automatisk Google Drive prosjektmapper</li>
                    <li>• Gmail integrasjon for kunde-kommunikasjon</li>
                    <li>• Calendar sync for timebestilling</li>
                    <li>• Worklog sync med Google Tasks</li>
                    <li>• Business intelligence og rapportering</li>
                  </ul>
                </div>

                <Button 
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                  size="lg"
                >
                  Lukk og Start Utforsking
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 'authorize' && (
            <div className="text-center py-8">
              <CircularProgress sx={{ fontSize:  32, margin:'auto', marginBottom:  2 }} />
              <p className="text-lg font-medium">Autoriserer tilgang til Google...</p>
              <p className="text-sm text-muted-foreground mt-2">
                En ny fane åpnes for sikker innlogging
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
