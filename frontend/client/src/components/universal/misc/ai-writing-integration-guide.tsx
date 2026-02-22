import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  Typography,
} from '@mui/material';
import { Badge } from "@/components/material-ui"
import { Button } from "@/components/material-ui"
import {
  AutoAwesome as AutoAwesome,
  Message,
  Description,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Group,
  SettingsOutlined,
  Language,
  FlashOn,
} from '@mui/icons-material';
import { useLanguage } from '@/hooks/use-language';
interface IntegrationAreaProps { icon: React.ComponentType<{className?: string }>;
  description: string;
  features: string[];
  status: 'active' | 'coming-soon'
}
function IntegrationArea({ icon: Icon, title, description, features, status }: IntegrationAreaProps) {
  return (
    <MuiCard sx={{ 
      background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(2, 5, 1,191,36,0.2) 50%, rgba(255,255,255,0.95) 100%)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(21,191,36,0.5)',
      borderRadius: 2 }}>
      <CardHeader sx={{ pb: 1.5,  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap:  1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Icon style={{ fontSize:  20, color: '#d97706'}} />
            <Typography variant="h6" sx={{  color: theming.colors.primary }}>{title}</Typography>
          </Box>
          <Badge 
            color={status === 'active' ? 'success' : 'default'}
            sx={{ bgcolor: status === 'active' ? '#dcfce7' : '#f3f4f0', color: status === 'active' ? '#166534' : '#374151'}}
          >
            {status === 'active' ? '✅ Active' : '🚧 Coming Soon'}
          </Badge>
        </Box>
        <Typography variant="body2" sx={{ color: '#4b5560', mt:  1 }}>{description}</Typography>
      </CardHeader>
      <CardContent sx={{ pt:  0 ,  ...theming.getThemedCardSx() }}>
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m:  0 }}>
          {features.map((feature, index) => (
            <Box component="li" key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0, fontSize: '0.875rem'}}>
              <Box sx={{ width:  12, height:  12, color: '#059660', flexShrink:  0 }}>✓</Box>
              {feature}
            </Box>
          ))}
        </Box>
      </CardContent>
    </MuiCard>
  );
}
export function AIWritingIntegrationGuide() {
  const { language } = useLanguage();
  
  // Theming system
  const theming = useTheming('photographer');
  // Mock data removed - using database connection
  const keyFeatures = language === 'no' ? [
    'Tospraklig stotte (Norsk/Engelsk)',
    'Automatisk sprakkjenkjenning',
    'Kontekstspesifikk forbedring',
    'Sanntids grammatikk-kontroll',
    'Profesjonell omformulering',
    'CreatorHub Norge branding',
    'Ingen eksterne avhengigheter',
    'Integrert i alle tekstfelt'
  ] : [
    'Bilingual support (Norwegian/English)',
    'Automatic language detection',
    'Context-specific improvement',
    'Real-time grammar checking',
    'Professional paraphrasing',
    'CreatorHub Norge branding',
    'No external dependencies',
    'Integrated in all text fields'
  ];
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <MuiCard className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 text-white">
        <CardHeader sx={theming.getThemedCardSx()}>
          <Typography className="flex items-center gap-2 text-xl">
            <AutoAwesome className="w-6 h-6" />
            { language === 'no' 
              ? 'CreatorHub Norge Intelligent Skriveassistent - Fullstendig integrert' : 'CreatorHub Norge Intelligent Writing Assistant - Fully Integrated' }
          </Typography>
          <p className="text-amber-100">
            { language === 'no'
              ? 'Profesjonell Intelligent-skrivehjelp integrert i alle viktige funksjoner på plattformen' : 'Professional Intelligent writing assistance integrated into all important platform features' }
          </p>
        </CardHeader>
        <CardContent sx={theming.getThemedCardSx()}>
          <div className="flex flex-col items-center justify-center min-h-screen">
            {keyFeatures.map((feature, index) => (
              <Badge key={index} variant="secondary" className="bg-white/20 text-white border-white/30 text-center">
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>
      </MuiCard>
      <div className="flex flex-col items-center justify-center min-h-screen">
        {integrationAreas.map((area, index) => (
          <IntegrationArea key={index} {...area} />
        ))}
      </div>
      <MuiCard className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
        <CardHeader sx={theming.getThemedCardSx()}>
          <Typography className="flex items-center gap-2 text-green-800">
            <FlashOn className="w-5 h-5" />
            { language === 'no' ? 'Hvordan bruke Intelligent-assistenten' : 'How to Use the Intelligent Assistant' }
          </Typography>
        </CardHeader>
        <CardContent className="space-y-3" sx={theming.getThemedCardSx()}>
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                { language === 'no' ? '🚀 Komme i gang' : '🚀 Getting Started' }
              </h4>
              <ul className="space-y-1 text-gray-600">
                <li>{ language === 'no' ? '• Skriv tekst i hvilket som helst tekstfelt' : '• Write text in any text field' }</li>
                <li>{ language === 'no' ? '• Klikk på Sparkles-ikonet for Intelligent-hjelp' : '• Click the Sparkles icon for Intelligent help' }</li>
                <li>{ language === 'no' ? '• Velg ønsket språk (norsk/engelsk)' : '• Select desired language (Norwegian/English)' }</li>
                <li>{ language === 'no' ? '• Bruk forbedringsknappene' : '• Use improvement buttons' }</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                { language === 'no' ? '⚡ Avanserte funksjoner' : '⚡ Advanced Features' }
              </h4>
              <ul className="space-y-1 text-gray-600">
                <li>{ language === 'no' ? '• Automatisk språkgjenkjenning' : '• Automatic language detection' }</li>
                <li>{ language === 'no' ? '• Kontekstspesifikk forbedring' : '• Context-specific improvement' }</li>
                <li>{ language === 'no' ? '• Professjonelle maler og stil' : '• Professional templates and style' }</li>
                <li>{ language === 'no' ? '• Sanntids kvalitetssjekk' : '• Real-time quality checking' }</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </MuiCard>
    </div>
  );
}
export default AIWritingIntegrationGuide;