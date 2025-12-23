import React from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { Box, Typography, Grid, Card, CardContent, Button, Stack } from '@mui/material';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

const ProfessionThemingDemo: React.FC = () => {
  const integration = useEnhancedMasterIntegration();
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Mock icons implementation for demo
  const icons = {
    getProfessionColors: (profession: string) => ({
      primary: '#2e7d32',
      secondary: '#4caf50',
      accent: '#8bc34a',
      light: '#c8e6c9',
      dark: '#1b5e20'
  }),
    getThemedIcon: (iconName: string, profession: string) => ({ sx }: any) => <Box sx={{ width: 32, height: 32, backgroundColor: '#2e7d32', borderRadius: 1, ...sx }} />,
    getIcon: (iconName: string) => ({ sx }: any) => <Box sx={{ width: 32, height: 32, backgroundColor: '#666', borderRadius: 1, ...sx }} />
};

  const professions = [
    { name: 'photographer', label: getProfessionDisplayName('photographer, '), color: '#2e7d32',},
    { name: 'videographer', label: getProfessionDisplayName('videographer,'), color: '#1565c0',},
    { name: 'music_producer', label: getProfessionDisplayName('music_producer,'), color: '#7b1fa2',},
    { name: 'vendor', label: getProfessionDisplayName('vendor'), color: '#ff8c00',},
    { name: 'prototype_tester', label: 'Prototype Tester', color: '#e65100',}
  ];

  const iconExamples = [
    'memoryCard','cameraTemplate','cameraSetup','workflow','templateManager','cameraGear','lens','tripod','gimbal','lighting'
  ] as const;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', mb: 4 }}>
        Profession-Based Icon Theming Demo
      </Typography>
      
      <Typography variant="body1" sx={{ textAlign: 'center', mb: 4, color: 'text.secondary' }}>
        Icons automatically change colors based on the user's profession, creating a consistent visual experience.
      </Typography>

      {professions.map((profession) => {
        const colors = icons.getProfessionColors(profession.name);
        
        return (
          <Card key={profession.name} sx={{ mb: 3, border: `2px solid ${colors.primary}` }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ color: colors.primary, fontWeight: 'bold' }}>
                {profession.label} Theme
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Primary: {colors.primary} | Secondary: {colors.secondary} | Accent: {colors.accent}
              </Typography>

              <Grid container spacing={2}>
                {iconExamples.map((iconName) => {
                  const ThemedIcon = icons.getThemedIcon(iconName, profession.name);
                  const RegularIcon = icons.getIcon(iconName);
                  
                  return (
                    <Grid item xs={6} sm={4} md={3} key={iconName}>
                      <Box sx={{ 
                        p: 2,
                        textAlign: 'center',
                        border: `1px solid ${colors.light}`,
                        borderRadius: 2,
                        backgroundColor: colors.secondary
                    }}>
                        <Box sx={{ mb: 1 }}>
                          {ThemedIcon && <ThemedIcon sx={{ fontSize: 32 }} />}
                        </Box>
                        <Typography variant="caption" sx={{ color: colors.primary, fontWeight: 'bold' }}>
                          {iconName}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Box sx={{ 
                            width: 16,
                            height: 16,
                            backgroundColor: colors.primary, 
                            borderRadius: '50%' 
                        }} />
                          <Box sx={{ 
                            width: 16,
                            height: 16,
                            backgroundColor: colors.accent, 
                            borderRadius: '50%' 
                        }} />
                          <Box sx={{ 
                            width: 16,
                            height: 16,
                            backgroundColor: colors.light, 
                            borderRadius: '50%' 
                        }} />
                        </Box>
                      </Box>
                    </Grid>
                  );
              })}
              </Grid>

              <Box sx={{ mt: 2, p: 2, backgroundColor: colors.light, borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: colors.dark, fontWeight: 'bold' }}>
                  Usage Example: </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: colors.dark }}>
                  {`const ThemedIcon = icons.getThemedIcon('${iconExamples[0]}', '${profession.name}');`}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: colors.dark }}>
                  {`<ThemedIcon sx={{ fontSize: 24 }} />`}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        );
    })}

      <Card sx={{ mt: 4, backgroundColor: '#f5f5f5' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Available Icon Theming Methods: </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              • <code>icons.getThemedIcon(iconName, profession)</code> - Get themed icon for specific profession
            </Typography>
            <Typography variant="body2">
              • <code>icons.getPhotographerIcon(iconName)</code> - Get photographer-themed icon
            </Typography>
            <Typography variant="body2">
              • <code>icons.getVideographerIcon(iconName)</code> - Get videographer-themed icon
            </Typography>
            <Typography variant="body2">
              • <code>icons.getMusicProducerIcon(iconName)</code> - Get music producer-themed icon
            </Typography>
            <Typography variant="body2">
              • <code>icons.getVendorIcon(iconName)</code> - Get vendor-themed icon
            </Typography>
            <Typography variant="body2">
              • <code>icons.getProfessionColors(profession)</code> - Get color palette for profession
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProfessionThemingDemo;














