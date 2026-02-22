/**
 * Firmware Update Service Component
 * Handles automatic firmware checking and displays manufacturer information
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Grid,
  Button,
  Alert,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Update,
  Download,
  Warning,
  CheckCircle,
  Info,
  ExpandMore,
  Security,
  BugReport,
  NewReleases,
  Schedule,
  GetApp,
  PhotoCamera as PhotoCameraAlt,
  Videocam as Videocamcam,
  Build,
  Launch,
} from '@mui/icons-material';

interface FirmwareUpdateServiceProps {
  firmwareUpdate: {
    equipment: {
      id: number;
      brand: string;
      model: string;
      currentFirmwareVersion?: string;
};
    firmwareUpdate: {
      version: string;
      releaseDate: string;
      photographerBenefits?: string[];
      videographerBenefits?: string[];
      generalImprovements?: string[];
      bugFixes?: string[];
      newFeatures?: string[];
      isCritical: boolean;
      downloadUrl?: string;
      downloadSize?: string;
      installationTime?: string;
      photographerRecommendation?: string;
      videographerRecommendation?: string;
      riskLevel: string;
      installationSteps?: string[];
      rollbackInstructions?: string[];
      requirements?: string[];
      knownIssues?: string[];
      sourceUrl?: string;
};
};
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor'
}

const PROFESSION_COLORS = {
  photographer: '#FF6B30',
  videographer: '#9C27B0',
  music_producer: '#FF5720',
  vendor: '#2196F0',
};

const RISK_COLORS = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44330',
};

const FirmwareUpdateService: React.FC<FirmwareUpdateServiceProps> = ({
  firmwareUpdate,
  profession,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [installing, setInstalling] = useState(false);
  const professionColor = PROFESSION_COLORS[profession];

  const { equipment, firmwareUpdate: update } = firmwareUpdate;

  const getBenefitsForProfession = () => {
    switch (profession) {
      case 'photographer':
        return update.photographerBenefits || [];
      case 'videographer':
        return update.videographerBenefits || [];
      default: return update.generalImprovements || [];
}
};

  const getRecommendationForProfession = () => {
    switch (profession) {
      case 'photographer':
        return update.photographerRecommendation;
      case 'videographer':
        return update.videographerRecommendation;
      default: return 'optional';
}
};

  const recommendation = getRecommendationForProfession();
  const benefits = getBenefitsForProfession();

  const getRecommendationColor = () => {
    switch (recommendation) {
      case 'critical':
        return '#F44336';
      case 'recommended':
        return '#FF9800';
      default: return '#4CAF50';
}
};

  const getRecommendationText = () => {
    switch (recommendation) {
      case 'critical':
        return 'Kritisk oppdatering';
      case 'recommended':
        return 'Anbefalt';
      default: return 'Valgfri';
}
};

  const renderInstallationSteps = () => {
    if (!update.installationSteps?.length) return null;

    return (
      <Stepper orientation="vertical">
        {update.installationSteps.map((step, index) => (
          <Step key={index} active>
            <StepLabel>{`Steg ${index + 1}`}</StepLabel>
            <StepContent>
              <Typography variant="body2">{step}</Typography>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    );
};

  return (
    <>
      <MuiCard
        sx={{
          border: update.isCritical ? '2px solid #F44336' : `1px solid ${professionColor}40`,
          boxShadow: update.isCritical ? '0 4px 20px rgba(24, 67, 54, 0.2)' : 'none'}}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <Avatar sx={{ bgcolor: professionColor, mr:  2 }}>
              {profession === 'photographer' ? theming.getThemedIcon('photoCamera') : theming.getThemedIcon('videocam')}
            </Avatar>
            <Box sx={{ flex:  1 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {equipment.brand} {equipment.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {equipment.currentFirmwareVersion} → {update.version}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap:  1,
                flexDirection: 'column',
                alignItems: 'flex-end'}}
            >
              {update.isCritical && (
                <Chip label="Kritisk" color="error" size="small" icon={theming.getThemedIcon('warning')} />
              )}
              <Chip
                label={getRecommendationText()}
                size="small"
                sx={{
                  bgcolor: getRecommendationColor() + '2',
                  color: getRecommendationColor()}}
              />
            </Box>
          </Box>

          {/* Critical Warning */}
          {update.isCritical && (
            <Alert severity="error" sx={{ mb:  2 }}>
              <Typography variant="subtitle2" sx={{ mb:  1 }}>
                Kritisk sikkerhetsopp datering
              </Typography>
              <Typography variant="body2">
                Denne oppdateringen inneholder viktige sikkerhetsforbedringer og bør installeres så
                snart som mulig.
              </Typography>
            </Alert>
          )}

          {/* Professional Benefits */}
          <Box sx={{ mb:  2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: professionColor }}>
              <Build sx={{ mr: 1, fontSize: '1rem', verticalAlign: 'middle'}} />
              Forbedringer for {profession === 'photographer' ? 'fotografer' : 'videografer'}:
            </Typography>
            <List dense>
              {benefits.slice(0, 3).map((benefit, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 24}}>
                    <CheckCircle sx={{ fontSize: '1rem', color: professionColor }} />
                  </ListItemIcon>
                  <ListItemText primary={benefit} primaryTypographyProps={{ variant: 'body2'}} />
                </ListItem>
              ))}
              {benefits.length > 3 && (
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`+${benefits.length - 3} flere forbedringer...`}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                      fontStyle: 'italic'}}
                  />
                </ListItem>
              )}
            </List>
          </Box>

          {/* Update Info */}
          <Grid container spacing={2} sx={{ mb:  2 }}>
            <Grid item xs={6} >
              <Box
                sx={{
                  textAlign: 'center',
                  p:  1,
                  bgcolor: 'grey.50',
                  borderRadius:  1}}
              >
                <Typography variant="body2" color="text.secondary">
                  Størrelse
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {update.downloadSize || 'Ukjent'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} >
              <Box
                sx={{
                  textAlign: 'center',
                  p:  1,
                  bgcolor: 'grey.50',
                  borderRadius:  1}}
              >
                <Typography variant="body2" color="text.secondary">
                  Installasjonstid
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {update.installationTime || '15-20 min'}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Risk Level */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <Security
              sx={{
                mr:  1,
                color: RISK_COLORS[update.riskLevel as keyof typeof RISK_COLOR]}}
            />
            <Typography variant="body2">
              Risikonivå:
              <Chip
                label={
                  update.riskLevel === 'low'
                    ? 'Lav'
                    : update.riskLevel === 'medium'
                      ? 'Middels'
                      : 'Høy'
              }
                size="small"
                sx={{
                  ml:  1,
                  bgcolor: RISK_COLORS[update.riskLevel as keyof typeof RISK_COLORS] + '2',
                  color: RISK_COLORS[update.riskLevel as keyof typeof RISK_COLOR]}}
              />
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {update.downloadUrl && (
              <Button variant="contained"
                startIcon={installing ? <LinearProgress sx={theming.getThemedButtonSx()} /> : theming.getThemedIcon('download')}
                onClick={() => {
                  setInstalling(true);
                  window.open(update.downloadUrl, '_blank');
                  setTimeout(() => setInstalling(false), 3000);
              }}
                disabled={installing}
                sx={{
                  bgcolor: professionColor, '&:hover': { bgcolor: professionColor, opacity: 0.9 }}}
              >
                {installing ? 'Laster ned...' : 'Last ned'}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('info')}
              onClick={() => setShowDetails(true)}
              sx={{ borderColor: professionColor, color: professionColor }}
            >
              Detaljer
            </Button>
            {update.sourceUrl && (
              <Button
                variant="text"
                startIcon={theming.getThemedIcon('launch')}
                onClick={() => window.open(update.sourceUrl, '_blank')}
                size="small"
              >
                Produsent
              </Button>
            )}
          </Box>

          {/* Known Issues Warning */}
          {update.knownIssues?.length && (
            <Alert severity="warning" size="small">
              <Typography variant="body2">
                <strong>Kjente problemer: </strong> Se detaljer for mer informasjon.
              </Typography>
            </Alert>
         )}

          {/* Quick Info Accordions */}
          <Box sx={{ mt:  2 }}>
            {update.newFeatures?.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
                  <Typography variant="body2">
                    <NewReleases sx={{ mr: 1, fontSize: '1rem', verticalAlign: 'middle'}} />
                    Nye funksjoner ({update.newFeatures.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {update.newFeatures.map((feature, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <NewReleases sx={{ fontSize: '1rem'}} />
                        </ListItemIcon>
                        <ListItemText primary={feature} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {update.bugFixes?.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
                  <Typography variant="body2">
                    <BugReport sx={{ mr: 1, fontSize: '1rem', verticalAlign: 'middle'}} />
                    Feilrettinger ({update.bugFixes.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {update.bugFixes.map((fix, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <BugReport sx={{ fontSize: '1rem'}} />
                        </ListItemIcon>
                        <ListItemText primary={fix} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        </CardContent>
      </MuiCard>

      {/* Detailed Information Dialog */}
      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Avatar sx={{ bgcolor: professionColor }}>
              <Update />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {equipment.brand} {equipment.model} - Firmware {update.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Utgitt: {new Date(update.releaseDate).toLocaleDateString('nb-NO')}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Installation Instructions */}
          {update.installationSteps?.length > 0 && (
            <Box sx={{ mb:  3 }}>
              <Typography variant="h6" sx={{  mb: 2, color: professionColor  }}>
                Installasjonsinstruksjoner
              </Typography>
              {renderInstallationSteps()}
            </Box>
          )}

          {/* System Requirements */}
          {update.requirements?.length > 0 && (
            <Box sx={{ mb:  3 }}>
              <Typography variant="h6" sx={{  mb: 2, color: professionColor  }}>
                Systemkrav
              </Typography>
              <List dense>
                {update.requirements.map((req, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CheckCircle sx={{ fontSize: '1rem', color: 'success.main'}} />
                    </ListItemIcon>
                    <ListItemText primary={req} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Known Issues */}
          {update.knownIssues?.length > 0 && (
            <Box sx={{ mb:  3 }}>
              <Typography variant="h6" sx={{  mb: 2, color: 'warning.main' }}>
                Kjente problemer
              </Typography>
              <List dense>
                {update.knownIssues.map((issue, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Warning sx={{ fontSize: '1rem', color: 'warning.main'}} />
                    </ListItemIcon>
                    <ListItemText primary={issue} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Rollback Instructions */}
          {update.rollbackInstructions?.length > 0 && (
            <Box sx={{ mb:  3 }}>
              <Typography variant="h6" sx={{  mb: 2, color: 'error.main' }}>
                Tilbakerullingsinstruksjoner
              </Typography>
              <Alert severity="info" sx={{ mb:  2 }}>
                Bruk kun hvis du opplever problemer etter oppdateringen.
              </Alert>
              <List dense>
                {update.rollbackInstructions.map((instruction, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {index + 1}.
                      </Typography>
                    </ListItemIcon>
                    <ListItemText primary={instruction} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Lukk</Button>
          {update.downloadUrl && (
            <Button variant="contained"
              startIcon={theming.getThemedIcon('download')}
              onClick={() => {
                window.open(update.downloadUrl, '_blank');
                setShowDetails(false);
            }}
              sx={{ bgcolor: professionColor }}
            >
              Last ned firmware
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FirmwareUpdateService;
