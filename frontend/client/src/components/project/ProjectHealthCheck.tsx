/**
 * CreatorHub Norge - Project Health Check
 * Validerer prosjektdata før opprettelse og viser manglende felt med "Gå til"-knapper
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  LinearProgress,
  Grid
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error,
  ArrowForward,
  Assignment,
  ContactPhone,
  Event,
  AttachMoney,
  LocationOn,
  Description,
  Person,
  Email,
  Phone,
  CameraAlt,
  VideoCall,
  MusicNote,
  Store,
  Business,
  Gavel
} from '@mui/icons-material';

interface HealthCheckIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  action: string;
  stepIndex?: number;
  tabName?: string;
  icon: React.ComponentType
}

interface ProjectHealthCheckProps {
  projectData: any;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onGoToStep: (stepIndex: number) => void;
  onGoToTab?: (tabName: string) => void
}

export default function ProjectHealthCheck({
  projectData,
  profession,
  open,
  onClose,
  onContinue,
  onGoToStep,
  onGoToTab
}: ProjectHealthCheckProps) {
  const [issues, setIssues] = useState<HealthCheckIssue[]>([]);
  const [healthScore, setHealthScore] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');

  // Analyser prosjektdata ved åpning
  useEffect(() => {
    if (open && projectData) {
      analyzeProjectHealth();
  }
}, [open, projectData, profession]);

  const analyzeProjectHealth = () => {
    const foundIssues: HealthCheckIssue[] = [];

    // 1. KRITISKE FELT - må være utfylt
    if (!projectData.projectName?.trim()) {
      foundIssues.push({
        id: 'missing_project_name',
        severity: 'error',
        field: 'Prosjektnavn',
        message: 'Prosjektnavn er påkrevd',
        action: 'Gå til grunnleggende informasjon',
        stepIndex:  0,
        icon: Assignment
  });
  }

    if (!projectData.clientName?.trim()) {
      foundIssues.push({
        id: 'missing_client_name',
        severity: 'error',
        field: 'Klientnavn',
        message: 'Klientnavn er påkrevd',
        action: 'Gå til klientinformasjon',
        stepIndex:  1,
        icon: Person
  });
  }

    if (!projectData.projectDate) {
      foundIssues.push({
        id: 'missing_project_date',
        severity: 'error',
        field: 'Prosjektdato',
        message: 'Prosjektdato må være satt',
        action: 'Gå til tidsplanlegging',
        stepIndex:  2,
        icon: Event
  });
  }

    // 2. KONTAKTINFORMASJON
    if (!projectData.clientEmail?.trim() && !projectData.clientPhone?.trim()) {
      foundIssues.push({
        id: 'missing_contact_info',
        severity: 'error',
        field: 'Kontaktinformasjon',
        message: 'Enten e-post eller telefon må være oppgitt',
        action: 'Gå til klientinformasjon',
        stepIndex:  1,
        icon: ContactPhone
  });
  }

    if (projectData.clientEmail && !isValidEmail(projectData.clientEmail)) {
      foundIssues.push({
        id: 'invalid_email',
        severity: 'warning',
        field: 'E-post',
        message: 'E-postadresse ser ikke gyldig ut',
        action: 'Gå til klientinformasjon',
        stepIndex:  1,
        icon: Email
  });
  }

    // 3. LEVERANSEVALG
    if (!projectData.deliveryMethod) {
      foundIssues.push({
        id: 'missing_delivery_method',
        severity: 'error',
        field: 'Leveransevalg',
        message: 'Leveransemethod må velges',
        action: 'Gå til leveranse og prising',
        stepIndex:  4,
        icon: Description
  });
  }

    // 4. PRISING (profession-spesifikt)
    if (!projectData.selectedPackage && !projectData.customPrice) {
      const professionTerms = {
        photographer: 'Fotopakke',
        videographer: 'Videopakke', 
        music_producer: 'Studiopakke',
        vendor: 'Produktpakke'
  };
      
      foundIssues.push({
        id: 'missing_pricing',
        severity: 'error',
        field: 'Prising',
        message: `${professionTerms[profession]} eller tilpasset pris må velges`,
        action: 'Gå til leveranse og prising',
        stepIndex:  4,
        icon: AttachMoney
  });
  }

    // 5. LOKASJON (kun for on-site profesjoner)
    if ((profession === 'photographer' || profession === 'videographer') && !projectData.location?.trim()) {
      foundIssues.push({
        id: 'missing_location',
        severity: 'warning',
        field: 'Lokasjon',
        message: 'Lokasjon bør oppgis for on-site tjenester',
        action: 'Gå til tidsplanlegging',
        stepIndex:  2,
        icon: LocationOn
  });
  }

    // 6. KONTRAKT VALIDERING
    if (!projectData.contractGenerated) {
      foundIssues.push({
        id: 'missing_contract',
        severity: 'warning',
        field: 'Kontrakt',
        message: 'Kontrakt er ikke generert enn, å',
        action: 'Gå til kontrakt-tab',
        tabName: 'contracts',
        icon: Gavel
  });
  }

    // 7. PROFESSION-SPESIFIKKE VALIDERINGER
    if (profession === 'photographer') {
      if (projectData.projectType === 'wedding' && !projectData.culture) {
        foundIssues.push({
          id: 'missing_wedding_culture',
          severity: 'warning',
          field: 'Bryllupskultur',
          message: 'Bryllupskultur bør spesifiseres for bedre planlegging',
          action: 'Gå til grunnleggende informasjon',
          stepIndex:  0,
          icon: CameraAlt
    });
    }

      if (projectData.totalDays > 1 && (!projectData.activeDays || projectData.activeDays.length === 0)) {
        foundIssues.push({
          id: 'missing_active_days',
          severity: 'warning',
          field: 'Aktive dager',
          message: 'Aktive dager bør spesifiseres for flerdagers-prosjekt',
          action: 'Gå til tidsplanlegging',
          stepIndex:  2,
          icon: Event
    });
    }
  }

    if (profession === 'videographer' && !projectData.videoStyle) {
      foundIssues.push({
        id: 'missing_video_style',
        severity: 'info',
        field: 'Videostil',
        message: 'Videostil kan spesifiseres for bedre resultat',
        action: 'Gå til grunnleggende informasjon',
        stepIndex:  0,
        icon: VideoCall
  });
  }

    if (profession === 'music_producer' && !projectData.genre) {
      foundIssues.push({
        id: 'missing_genre',
        severity: 'info',
        field: 'Musikksjanger',
        message: 'Musikksjanger kan spesifiseres',
        action: 'Gå til grunnleggende informasjon',
        stepIndex:  0,
        icon: MusicNote
  });
  }

    if (profession === 'vendor' && (!projectData.products || projectData.products.length === 0)) {
      foundIssues.push({
        id: 'missing_products',
        severity: 'warning',
        field: 'Produkter',
        message: 'Produkter bør legges til bestillingen',
        action: 'Gå til produktvalg',
        stepIndex:  3,
        icon: Store
  });
  }

    setIssues(foundIssues);
    calculateHealthScore(foundIssues);
};

  const calculateHealthScore = (issues: HealthCheckIssue[]) => {
    const totalFields = 10; // Totalt antall felt som sjekkes
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    
    // Errors teller dobbelt så mye som warnings
    const penaltyPoints = (errorCount * 2) + warningCount;
    const score = Math.max, (Math.min(100, ((totalFields - penaltyPoints) / totalFields) * 100));
    
    setHealthScore(Math.round(score));
};

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

  const getHealthColor = () => {
    if (healthScore >= 80) return 'success';
    if (healthScore >= 60) return 'warning';
    return 'error';
};

  const getHealthMessage = () => {
    if (healthScore >= 90) return 'Prosjektet er klar for opprettelse!';
    if (healthScore >= 80) return 'Prosjektet er i god stand med mindre mangler';
    if (healthScore >= 60) return 'Prosjektet trenger noen forbedringer';
    return 'Prosjektet har flere mangler som bør adresseres';
};

  const canContinue = () => {
    const criticalIssues = issues.filter(i => i.severity === 'error');
    return criticalIssues.length === 0;
};

  const handleGoToAction = (issue: HealthCheckIssue) => {
    if (issue.stepIndex !== undefined) {
      onGoToStep(issue.stepIndex);
} else if (issue.tabName && onGoToTab) {
      onGoToTab(issue.tabName);
  }
    onClose();
};

  const professionIcons = {
    photographer: CameraAt,
    videographer: VideoCall,
    music_producer: MusicNote,
    vendor: Store
};

  const ProfessionIcon = professionIcons[profession] || Business;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <ProfessionIcon color="primary" />
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            Health Check - Prosjektvalidering
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Health Score */}
        <Card sx={{ mb:  3, backgroundColor: `${getHealthColor()}.50` ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="h4" color={`${getHealthColor()}.main`} sx={{ color: theming.colors.primary }}>
                {healthScore}%
              </Typography>
              <Box flex={1}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  {getHealthMessage()}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={healthScore}
                  color={getHealthColor() as 'success' | 'warning' | 'error'}
                  sx={{ height:  8, borderRadius:  4 }}
                />
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              Prosjekt: <strong>{projectData.projectName || 'Ikke navngitt'}</strong> • 
              Klient: <strong>{projectData.clientName || 'Ikke oppgitt'}</strong>
            </Typography>
          </CardContent>
        </Card>

        {/* Issues */}
        {issues.length > 0 ? (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Funnet {issues.length} problem{issues.length !== 1 ? 'er' : ', '}:
            </Typography>
            
            <List>
              {issues.map((issue, index) => (
                <React.Fragment key={issue.id}>
                  <ListItem 
                    sx={{ 
                      px:  0,
                      backgroundColor: issue.severity === 'error' ? 'error.50' :
                                    issue.severity === 'warning' ? 'warning.50' : 
                                    'info.5',
                      borderRadius:  1,
                      mb: 1 }}
                  >
                    <ListItemIcon>
                      {issue.severity === 'error' ? (
                        <Error color="error" />
                      ) : issue.severity === 'warning' ? (
                        <Warning color="warning" />
                      ) : (
                        <issue.icon color="info" />
                      )}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {issue.field}
                          </Typography>
                          <Chip 
                            label={issue.severity === 'error' ? 'KRITISK' : 
                                  issue.severity === 'warning' ? 'ADVARSEL' : 'INFO'}
                            size="small"
                            color={issue.severity as any}
                            variant="outlined"
                          />
                        </Box>
                    }
                      secondary={issue.message}
                    />
                    
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={() => handleGoToAction(issue)}
                      color={issue.severity as any}
                    >
                      {issue.action}
                    </Button>
                  </ListItem>
                  
                  {index < issues.length - 1 && <Divider sx={{ my:  1 }} />}
                </React.Fragment>
              ))}
            </List>
          </Box>
        ) : (
          <Alert severity="success">
            <AlertTitle>✅ Alle sjekker bestått!</AlertTitle>
            Prosjektet er klar for opprettelse uten problemer.
          </Alert>
        )}

        {/* Kontrakt-specific info */}
        {issues.some(i => i.id === 'missing_contract') && (
          <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: 'rgba(16, 39, 176, 0.1)' ,  ...theming.getThemedCardSx() }}>
            <Typography variant="body2" color="text.secondary">
              💡 <strong>Tips: </strong> Generer kontrakt via Universal Dashboard → Kontrakt-tab for å 
              sikre juridisk beskyttelse og profesjonell fremstilling.
            </Typography>
          </Paper>
       )}
      </DialogContent>

      <DialogActions sx={{ p:  3 }}>
        <Button onClick={onClose}>
          Lukk
        </Button>
        
        {!canContinue() && (
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              // Gå til første kritiske issue
              const firstError = issues.find(i => i.severity === 'error');
              if (firstError) {
                handleGoToAction(firstError);
            }
          }}
          >
            Fiks kritiske problemer
          </Button>
        )}
        
        <Button variant="contained"
          onClick={onContinue}
          disabled={!canContinue()}
          color={canContinue() ? 'success' : 'error'}
          startIcon={canContinue() ? theming.getThemedIcon('checkCircle') : theming.getThemedIcon('error')}
         sx={theming.getThemedButtonSx()}>
          {canContinue() ? 'Opprett prosjekt' : `${issues.filter(i => i.severity ==='error').length} kritiske feil`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}