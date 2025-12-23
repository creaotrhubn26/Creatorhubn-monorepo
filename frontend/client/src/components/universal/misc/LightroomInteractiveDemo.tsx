/**
 * Interactive Lightroom Integration Demo
 * Viser hvordan integrasjonen fungerer med live simulering
 */

import { useTheming } from '../../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Grid
} from '@mui/material';
import {
  PlayArrow,
  PhotoLibrary,
  Link as LinkIcon,
  CloudSync,
  Share,
  Security,
  AutoAwesome,
  CheckCircle,
  Speed,
  Public,
  Analytics,
  Google
} from '@mui/icons-material';

interface LightroomInteractiveDemoProps {
  customBranding: {
    color: string;
    darkColor?: string;
};
}

const DEMO_STEPS = [
  {
    id: 'lightroom-sync',
    title: 'Lightroom Collections',
    description: 'Organiser bilder i Lightroom collections',
    detail: 'I Lightroom: Lag collection "Emma & Jon Bryllup"',
    action: 'Synkroniser 247 bilder',
    icon: (
      <Box sx={{ 
        width: 24, height:  24, 
        background: 'linear-gradient(135deg, #001e36 0%, #31a8ff 100%)',
        borderRadius: '4px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white',
        fontSize: '10px',
        fontWeight: 7,
        fontFamily: 'Arial, sans-serif'
    }}>
        Lr
      </Box>
    )
},
  {
    id: 'showcase-generation',
    title: 'Automatisk Showcase UR',
    description: 'Collections konverteres til showcase galleries',
    detail: 'https://creatorhubn.com/showcase/photographer/emma-jon-bryllup',
    action: 'URL genereres automatisk',
    icon: <LinkIcon />
},
  {
    id: 'xmp-metadata',
    title: 'XMP Metadata Integration',
    description: 'Showcase URLs integreres i XMP sidecar filer',
    detail: '<creatorhub:showcaseUrl> feltet oppdateres',
    action: 'SEO metadata genereres',
    icon: theming.getThemedIcon('')
},
  {
    id: 'real-time-sync',
    title: 'Real-time Synkronisering',
    description: 'Endringer synkroniseres umiddelbart',
    detail: 'Lightroom ↔ CreatorHub Norge ↔ Web showcase',
    action: 'Toveis synkronisering',
    icon: <CloudSync />
}
];

const INTEGRATION_FEATURES = [
  { title: 'Google Photos Backup', icon: <Google />, status: 'active',},
  { title: 'SEO Optimalisering', icon: theming.getThemedIcon(', '), status: 'active',},
  { title: 'GDPR Compliance', icon: theming.getThemedIcon(', '), status: 'active',},
  { title: 'Responsive Design', icon: <Public />, status: 'active',}
];

export const LightroomInteractiveDemo: React.FC<LightroomInteractiveDemoProps> = ({ 
  customBranding, 
}) => {
  const [activeStep, setActiveStep] = useState(false);
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const startDemo = async () => {
    setIsRunning(true);
    setCompletedSteps([]);
    
    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setActiveStep(i);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCompletedSteps(prev => [...prev, i]);
  }
    
    setActiveStep(-1);
    setIsRunning(false);
    setShowDetails(true);
};

  return (
    <Box sx={{ mt:  3 }}>
      {/* Demo Header */}
      <Card sx={{ 
        background: `linear-gradient(135deg, ${customBranding.color}10 0%, ${customBranding.color}05 100%)`,
        border: `2px solid ${customBranding.color}20`,
        borderRadius:  3,
        overflow: 'hidden'
  ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              {/* CreatorHub Norge Logo */}
              <Box
                component="img"
                src="/creatorhub-logo-amber.svg"
                alt="CreatorHub Norge"
                sx={{
                  height:  40,
                  width: 'auto',
                  filter: `hue-rotate(${customBranding.color === '#FF6B35' ? '0deg' : '15deg'})`,
                  opacity: 0.9 }}
              />
              <Box>
                <Typography variant="h6" sx={{  color: customBranding.color, fontWeight: 7, mb:  1  }}>
                  🎬 Interaktiv Demo: Slik fungerer integrasjonen
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Se live hvordan Lightroom collections automatisk blir til profesjonelle showcase galleries
                </Typography>
              </Box>
            </Box>
            
            <Button variant="contained"
              startIcon={theming.getThemedIcon(', ')}
              disabled={isRunning}
              onClick={startDemo}
              sx={{
                background: `linear-gradient(135deg, ${customBranding.color} 0%, #1976d2 100%)`,
                color: 'white',
                fontWeight: 60
                minWidth: 10, '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 25px ${customBranding.color}40`
              }, '&:disabled': {
                  background: 'rgba(0,0,0,0.12)'
              }
            }}
             sx={theming.getThemedButtonSx()}>
              {isRunning ? 'Kjører Demo...' : 'Start Demo'}
            </Button>
          </Box>

          {/* Integration Flow Visualization */}
          <Grid container spacing={3}>
            {DEMO_STEPS.map((step, index) => (
              <Grid size={{ xs: 12 }} md={6} key={step.id}>
                <Card sx={{ 
                  height: '100%',
                  border: activeStep === index ? `3px solid ${customBranding.color}` : '1px solid rgba(0,0,0,0.12)',
                  transform: activeStep === index ? 'scale(1.02)' : 'scale(1, )',
                  transition: 'all 0.3s ease',
                  background: completedSteps.includes(index) ? `${customBranding.color}05` : 'white'
              ,  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap:  2 }}>
                      <Box sx={{ 
                        p: 1, borderRadius: 2
                       , bgcolor: activeStep === index ? customBranding.color : 'rgba(0,0,0,0.1)',
                        color: activeStep === index ? 'white' : 'inherit',
                        transition: 'all 0.3s ease'
                  }}>
                        {completedSteps.includes(index) ? theming.getThemedIcon('checkCircle') : step.icon}
                      </Box>
                      
                      <Box sx={{ flex:  1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                          {step.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          {step.description}
                        </Typography>
                        
                        {activeStep === index && (
                          <Box sx={{ mb:  2 }}>
                            <LinearProgress 
                              sx={{ 
                                borderRadius: 1, '& .MuiLinearProgress-bar': {
                                  backgroundColor: customBranding.color
                            }
                            }}
                            />
                            <Typography variant="caption" color={customBranding.color} sx={{ fontWeight: 600, mt:  1 }}>
                              {step.action}...
                            </Typography>
                          </Box>
                        )}
                        
                        <Box sx={{ 
                          p: 2, bgcolor: 'rgba(0,0,0,0.03)', 
                          borderRadius:  1,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem'
                    }}>
                          {step.detail}
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Integration Features */}
          <Box sx={{ mt:  3, pt:  3, borderTop: `1px solid ${customBranding.color}20` }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: customBranding.color }}>
              🚀 Inkluderte Integrasjoner & Funksjoner
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
              {INTEGRATION_FEATURES.map((feature, index) => (
                <Chip
                  key={index}
                  icon={feature.icon}
                  label={feature.title}
                  size="small"
                  sx={{
                    bgcolor: `${customBranding.color}10`,
                    color: customBranding.color,
                    fontWeight: 50& .MuiChip-icon': {
                      color: customBranding.color
                }
                }}
                />
              ))}
            </Box>
          </Box>

          {/* Performance Metrics */}
          <Box sx={{ mt:  3, display: 'flex', justifyContent: 'space-around', textAlign: 'center'}}>
            <Box>
              <Typography variant="h4" sx={{  color: customBranding.color, fontWeight: 70 }}>
                2 min
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Installasjon
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" sx={{  color: customBranding.color, fontWeight: 70 }}>
                100%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Automatisert
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" sx={{  color: customBranding.color, fontWeight: 70 }}>
                SEO
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Optimalisert
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" sx={{  color: customBranding.color, fontWeight: 70 }}>
                GDPR
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Compliant
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Detailed Information Dialog */}
      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: `${customBranding.color}10`, color: customBranding.color }}>
          🎯 Detaljert Informasjon: Lightroom Integrering
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Showcase Presentasjon */}
            <Grid size={{ xs: 12 }} md={6}>
              <Typography variant="h6" sx={{  mb: 2, color: customBranding.color  }}>
                📸 Showcase Presentasjon
              </Typography>
              <Box component="ul" sx={{ pl: 2, '& li': { mb:  1 } }}>
                <li><Typography variant="body2"><strong>SEO metadata: </strong> Automatisk generering av meta-beskrivelser</Typography></li>
                <li><Typography variant="body2"><strong>Bildekomprimering:</strong> Optimalisert for web uten kvalitetstap</Typography></li>
                <li><Typography variant="body2"><strong>Responsive design:</strong> Tilpasses alle skjermstørrelser</Typography></li>
                <li><Typography variant="body2"><strong>Branding:</strong> Ditt logo og farger på hver side</Typography></li>
              </Box>
            </Grid>

            {/* Integrasjoner & Sync , *, /}
            <Grid size={{ xs: 12 }} md={6}>
              <Typography variant="h6" sx={{  mb: 2, color: customBranding.color  }}>
                🔄 Integrasjoner & Sync
              </Typography>
              <Box component="ul" sx={{ pl: 2, '& li': { mb:  1 } }}>
                <li><Typography variant="body2"><strong>Google Photos: </strong> Automatisk backup og deling</Typography></li>
                <li><Typography variant="body2"><strong>Google Drive:</strong> Prosjektmapper med full filstruktur</Typography></li>
                <li><Typography variant="body2"><strong>Kalender:</strong> Fotografering datoer og leveranse frister</Typography></li>
                <li><Typography variant="body2"><strong>Email:</strong> Automatiske varsler til kunde om nye bilder</Typography></li>
              </Box>
            </Grid>

            {/* Datasikkerhet , *, /}
            <Grid size={{ xs: 12 }} md={6}>
              <Typography variant="h6" sx={{  mb: 2, color: customBranding.color  }}>
                🛡️ Datasikkerhet
              </Typography>
              <Box component="ul" sx={{ pl: 2'& li': { mb:  1 } }}>
                <li><Typography variant="body2">All informasjon krypteres under transport og i hvile</Typography></li>
                <li><Typography variant="body2">GDPR-compliant lagring og behandling</Typography></li>
                <li><Typography variant="body2">Automatisk backup til flere lokasjoner</Typography></li>
                <li><Typography variant="body2">Brukerkontrollert data sletting</Typography></li>
              </Box>
            </Grid>

            {/* Real-time Synkronisering */}
            <Grid size={{ xs: 12 }} md={6}>
              <Typography variant="h6" sx={{  mb: 2, color: customBranding.color  }}>
                ⚡ Real-time Synkronisering
              </Typography>
              <Box component="ul" sx={{ pl: 2'& li': { mb:  1 } }}>
                <li><Typography variant="body2">Endringer i Lightroom → Umiddelbar oppdatering på web</Typography></li>
                <li><Typography variant="body2">Kunde kommentarer → Varsling til fotograf</Typography></li>
                <li><Typography variant="body2">Prosjekt oppdateringer → Alle parter varsles</Typography></li>
                <li><Typography variant="body2">Collection endringer → Automatisk showcase sync</Typography></li>
              </Box>
            </Grid>
          </Grid>
          
          <Divider sx={{ my:  3 }} />
          
          {/* Detailed Installation Guide */}
          <Typography variant="h6" sx={{  mb: 2, color: customBranding.color  }}>
            📥 Detaljert Installasjonsveiledning
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap:  3, mb:  4 }}>
            {/* Step 1 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width:  28, height:  28, borderRadius: '50, %', 
                  bgcolor: customBranding.color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700}}>1</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                  Last ned CreatorHub Norge Lightroom Plugin
                </Typography>
              </Box>
              <Box sx={{ pl:  5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Klikk på "Last ned Lightroom Plugin" knappen i innstillinger
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Filen vil bli lastet ned som "CreatorHub-Norge-Lightroom-Plugin.lrplugin"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Ikke pakk ut filen - .lrplugin er et komplett plugin-paket
                </Typography>
              </Box>
            </Box>

            {/* Step 2 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width:  28, height:  28, borderRadius: '50, %', 
                  bgcolor: customBranding.color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700}}>2</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1 }}>
                  <Box sx={{ 
                    width:  24, height:  24, 
                    background: 'linear-gradient(135deg, #001e36 0%, #31a8ff 100%)',
                    borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 7,
                    fontFamily: 'Arial, sans-serif'
                }}>
                    Lr
                  </Box>
                  Åpne Adobe Lightroom Plugin Manager
                </Typography>
              </Box>
              <Box sx={{ pl:  5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                  • Start 
                  <Box sx={{ 
                    width:  18, height:  18, 
                    background: 'linear-gradient(135deg, #001e36 0%, #31a8ff 100%)',
                    borderRadius: '3px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                    fontSize: '8px',
                    fontWeight: 7,
                    fontFamily: 'Arial, sans-serif'
                }}>
                    Lr
                  </Box>
                  Adobe Lightroom (CC 2019 eller nyere)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Gå til <strong>File</strong> → <strong>Plug-in Manager</strong> i toppmenyen
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Plugin Manager vinduet åpnes
                </Typography>
              </Box>
            </Box>

            {/* Step 3 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width:  28, height:  28, borderRadius: '50, %', 
                  bgcolor: customBranding.color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700}}>3</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                  Installer Plugin
                </Typography>
              </Box>
              <Box sx={{ pl:  5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Klikk på <strong>"Add"</strong> knappen i Plugin Manager
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Naviger til den nedlastede .lrplugin-filen
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Velg filen og klikk <strong>"Select Folder"</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Plugin installeres automatisk
                </Typography>
              </Box>
            </Box>

            {/* Step 4 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width:  28, height:  28, borderRadius: '50, %', 
                  bgcolor: customBranding.color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700}}>4</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                  Aktiver Plugin
                </Typography>
              </Box>
              <Box sx={{ pl:  5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Finn "CreatorHub Norge" i plugin-listen
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Sørg for at status er satt til <strong>"Enabled"</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Klikk <strong>"Done"</strong> for å lukke Plugin Manager
                </Typography>
              </Box>
            </Box>

            {/* Step 5 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width:  28, height:  28, borderRadius: '50, %', 
                  bgcolor: customBranding.color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700}}>5</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                  Start Synkronisering
                </Typography>
              </Box>
              <Box sx={{ pl:  5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                  • I 
                  <Box sx={{ 
                    width:  16, height:  16, 
                    background: 'linear-gradient(135deg, #001e36 0%, #31a8ff 100%)',
                    borderRadius: '2px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                    fontSize: '7px',
                    fontWeight: 7,
                    fontFamily: 'Arial, sans-serif'
                }}>
                    Lr
                  </Box>
                  gå til <strong>File</strong> → <strong>Plug-in Extras</strong> → <strong>"CreatorHub Norge"</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Plugin-panelet åpnes for første gang
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  • Logg inn med din CreatorHub Norge konto
                </Typography>
                <Typography variant="body2" sx={{ color: customBranding.color, fontWeight: 600}>
                  🎉 Klar! Collections synkroniseres automatisk til showcase
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Troubleshooting Tips */}
          <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: customBranding.color, fontWeight: 600}>
              💡 Feilsøking & Tips
            </Typography>
            <Box sx={{ pl:  2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                • <strong>Plugin vises ikke: </strong> Start 
                <Box sx={{ 
                  width: 16, height:  16, 
                  background: 'linear-gradient(135deg, #001e36 0%, #31a8ff 100%)',
                  borderRadius: '2px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white',
                  fontSize: '7px',
                  fontWeight: 7,
                  fontFamily: 'Arial, sans-serif'
              }}>
                  Lr
                </Box>
                på nytt etter installasjon
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                • <strong>Kan ikke finne .lrplugin fil: </strong> Sjekk nedlastingsmappen
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • <strong>Kompatibilitet: </strong> Krever Adobe Lightroom CC 2019+ eller Lightroom Classic
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • <strong>Første synkronisering:</strong> Kan ta 2-3 minutter for store collections
              </Typography>
            </Box>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          {/* Practical Usage Example */}
          <Typography variant="h6" sx={{  mb: 2, color: customBranding.color  }}>
            💡 Praktisk Bruk: Emma & Jon Bryllup
          </Typography>
          <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
            <Box component="ol" sx={{ pl: 2'& li': { mb: 1.5,} }}>
              <li><Typography variant="body2"><strong>I Lightroom: </strong> Organiser 247 bilder i "Emma & Jon Bryllup" collection</Typography></li>
              <li><Typography variant="body2"><strong>Sync til CreatorHub:</strong> Plugin sender collection og metadata automatisk</Typography></li>
              <li><Typography variant="body2"><strong>Automatisk Showcase:</strong> Collection blir til offentlig gallery på web</Typography></li>
              <li><Typography variant="body2"><strong>SEO URL:</strong> https://creatorhubn.com/showcase/photographer/emma-jon-bryllup</Typography></li>
              <li><Typography variant="body2"><strong>Portfolio visning:</strong> Kunder kan se arbeid direkte på web med ditt branding</Typography></li>
            </Box>
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center'}}>
            <Button
              variant="outlined"
              onClick={() => setShowDetails(false)}
              sx={{ borderColor: customBranding.color, color: customBranding.color }}
            >
              Lukk Detaljvisning
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};