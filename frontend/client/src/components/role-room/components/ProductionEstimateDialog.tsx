// @ts-nocheck
import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  LinearProgress,
  Divider,
  Alert,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Videocam as VideocamIcon,
  Lightbulb as LightbulbIcon,
  Mic as MicIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon, TrendingIcon as TrendingUpIcon } from './icons/CastingIcons';
import type { SceneBreakdown, ShotList } from '../models/casting';

interface ProductionEstimateDialogProps {
  open: boolean;
  onClose: () => void;
  scenes: SceneBreakdown[];
  shotLists: ShotList[];
  manuscriptTitle: string;
}

interface ProductionEstimate {
  totalShootDays: number;
  totalSetupTime: number; // minutes
  totalShootingTime: number; // minutes
  crewRequired: {
    director: boolean;
    cinematographer: boolean;
    soundEngineer: boolean;
    gaffer: boolean;
    grip: boolean;
    productionAssistant: boolean;
    makeup: boolean;
    wardrobe: boolean;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  breakdown: {
    intScenes: number;
    extScenes: number;
    dayScenes: number;
    nightScenes: number;
    uniqueLocations: number;
    totalShots: number;
  };
}

const getRiskColor = (level: 'low' | 'medium' | 'high' | 'critical'): string => {
  switch (level) {
    case 'low': return '#4caf50';
    case 'medium': return '#9333ea';
    case 'high': return '#f44336';
    case 'critical': return '#9c27b0';
  }
};

const getRiskLabel = (level: 'low' | 'medium' | 'high' | 'critical'): string => {
  switch (level) {
    case 'low': return 'Lav risiko';
    case 'medium': return 'Moderat risiko';
    case 'high': return 'Høy risiko';
    case 'critical': return 'Kritisk risiko';
  }
};

export const ProductionEstimateDialog: React.FC<ProductionEstimateDialogProps> = ({
  open,
  onClose,
  scenes,
  shotLists,
  manuscriptTitle,
}) => {
  const estimate = useMemo((): ProductionEstimate => {
    // Calculate scene breakdown
    const intScenes = scenes.filter(s => s.intExt === 'INT').length;
    const extScenes = scenes.filter(s => s.intExt === 'EXT').length;
    const dayScenes = scenes.filter(s => s.timeOfDay === 'DAY').length;
    const nightScenes = scenes.filter(s => s.timeOfDay === 'NIGHT').length;
    
    const locations = new Set(scenes.map(s => s.locationName).filter(Boolean));
    const uniqueLocations = locations.size;
    
    const totalShots = shotLists.reduce((sum, list) => sum + list.shots.length, 0);
    
    // Calculate shooting time
    // Industry standard: 15-30 minutes per shot setup + shooting
    const avgMinutesPerShot = 20;
    const totalShootingTime = totalShots * avgMinutesPerShot;
    
    // Setup time: 1-2 hours per location
    const setupTimePerLocation = 90; // minutes
    const totalSetupTime = uniqueLocations * setupTimePerLocation;
    
    // Total shoot days (8-hour workdays)
    const workDayMinutes = 8 * 60;
    const totalMinutes = totalShootingTime + totalSetupTime;
    const totalShootDays = Math.ceil(totalMinutes / workDayMinutes);
    
    // Determine crew requirements
    const hasComplexLighting = scenes.some(s => 
      shotLists.find(sl => sl.sceneId === s.id)?.shots.some(shot => 
        shot.lightingSetup && shot.lightingSetup !== ''
      )
    );
    
    const hasDialogue = scenes.some(s => s.characters && s.characters.length > 0);
    const hasManyShots = totalShots > 20;
    const hasNightScenes = nightScenes > 0;
    const hasExteriorScenes = extScenes > 0;
    
    const crewRequired = {
      director: true, // Always needed
      cinematographer: totalShots > 10,
      soundEngineer: hasDialogue,
      gaffer: hasComplexLighting || hasNightScenes,
      grip: hasManyShots || hasExteriorScenes,
      productionAssistant: totalShootDays > 1,
      makeup: scenes.some(s => s.characters && s.characters.length > 0),
      wardrobe: scenes.some(s => s.characters && s.characters.length > 0),
    };
    
    // Calculate risks
    const risks: ProductionEstimate['risks'] = [];
    
    // Location risk
    if (uniqueLocations > 5) {
      risks.push({
        type: 'Lokasjoner',
        severity: 'high',
        description: `${uniqueLocations} forskjellige lokasjoner krever omfattende planlegging og transport`,
      });
    } else if (uniqueLocations > 3) {
      risks.push({
        type: 'Lokasjoner',
        severity: 'medium',
        description: `${uniqueLocations} lokasjoner krever god logistikk`,
      });
    }
    
    // Exterior scenes risk
    if (extScenes > intScenes * 2) {
      risks.push({
        type: 'Utendørs',
        severity: 'high',
        description: 'Mange utendørs scener - væravhengig produksjon',
      });
    } else if (extScenes > intScenes) {
      risks.push({
        type: 'Utendørs',
        severity: 'medium',
        description: 'Flertall utendørs scener - planlegg for værforhold',
      });
    }
    
    // Night scenes risk
    if (nightScenes > dayScenes) {
      risks.push({
        type: 'Nattscener',
        severity: 'high',
        description: 'Mange nattscener krever ekstra lys og lengre oppsett',
      });
    } else if (nightScenes > 0) {
      risks.push({
        type: 'Nattscener',
        severity: 'medium',
        description: `${nightScenes} nattscener krever lysutstyr`,
      });
    }
    
    // Shot complexity risk
    if (totalShots > 50) {
      risks.push({
        type: 'Shot-kompleksitet',
        severity: 'high',
        description: `${totalShots} shots er svært ambisiøst - vurder å redusere`,
      });
    } else if (totalShots > 30) {
      risks.push({
        type: 'Shot-kompleksitet',
        severity: 'medium',
        description: `${totalShots} shots krever grundig planlegging`,
      });
    }
    
    // Missing shots risk
    const scenesWithoutShots = scenes.filter(s => 
      !shotLists.find(sl => sl.sceneId === s.id)?.shots.length
    );
    if (scenesWithoutShots.length > scenes.length / 2) {
      risks.push({
        type: 'Manglende shots',
        severity: 'high',
        description: `${scenesWithoutShots.length} scener mangler shot planning`,
      });
    } else if (scenesWithoutShots.length > 0) {
      risks.push({
        type: 'Manglende shots',
        severity: 'medium',
        description: `${scenesWithoutShots.length} scener mangler shots`,
      });
    }
    
    // Schedule risk
    if (totalShootDays > 10) {
      risks.push({
        type: 'Tidsplan',
        severity: 'high',
        description: `${totalShootDays} innspillingsdager - lang produksjon`,
      });
    } else if (totalShootDays > 5) {
      risks.push({
        type: 'Tidsplan',
        severity: 'medium',
        description: `${totalShootDays} innspillingsdager - planlegg godt`,
      });
    }
    
    // Determine overall risk level
    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (highRisks >= 3) riskLevel = 'critical';
    else if (highRisks >= 1) riskLevel = 'high';
    else if (mediumRisks >= 2) riskLevel = 'medium';
    
    return {
      totalShootDays,
      totalSetupTime,
      totalShootingTime,
      crewRequired,
      riskLevel,
      risks,
      breakdown: {
        intScenes,
        extScenes,
        dayScenes,
        nightScenes,
        uniqueLocations,
        totalShots,
      },
    };
  }, [scenes, shotLists]);

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}t ${mins}m`;
  };

  const crewCount = Object.values(estimate.crewRequired).filter(Boolean).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          color: '#fff',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TrendingUpIcon sx={{ color: '#64b5f6' }} />
          <Box>
            <Typography variant="h6">Produksjonsestimater</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {manuscriptTitle}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Overall Risk Alert */}
          <Alert
            severity={estimate.riskLevel === 'low' ? 'success' : estimate.riskLevel === 'medium' ? 'warning' : 'error'}
            icon={estimate.riskLevel === 'low' ? <CheckCircleIcon /> : <WarningIcon />}
            sx={{
              bgcolor: `${getRiskColor(estimate.riskLevel)}20`,
              color: '#fff',
              border: `1px solid ${getRiskColor(estimate.riskLevel)}`,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {getRiskLabel(estimate.riskLevel)}
            </Typography>
            <Typography variant="body2">
              Produksjonen har {estimate.risks.length} identifiserte risikoer
            </Typography>
          </Alert>

          {/* Key Metrics */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: '#16213e', border: '1px solid rgba(100, 181, 246, 0.3)' }}>
                <CardContent>
                  <Stack spacing={1} alignItems="center">
                    <ScheduleIcon sx={{ fontSize: 32, color: '#64b5f6' }} />
                    <Typography variant="h4" sx={{ color: '#64b5f6', fontWeight: 700 }}>
                      {estimate.totalShootDays}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      Innspillingsdager
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: '#16213e', border: '1px solid rgba(255, 167, 38, 0.3)' }}>
                <CardContent>
                  <Stack spacing={1} alignItems="center">
                    <PeopleIcon sx={{ fontSize: 32, color: '#ffa726' }} />
                    <Typography variant="h4" sx={{ color: '#ffa726', fontWeight: 700 }}>
                      {crewCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      Crew-medlemmer
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: '#16213e', border: '1px solid rgba(156, 39, 176, 0.3)' }}>
                <CardContent>
                  <Stack spacing={1} alignItems="center">
                    <VideocamIcon sx={{ fontSize: 32, color: '#9c27b0' }} />
                    <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 700 }}>
                      {estimate.breakdown.totalShots}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      Totalt shots
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: '#16213e', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                <CardContent>
                  <Stack spacing={1} alignItems="center">
                    <LocationIcon sx={{ fontSize: 32, color: '#4caf50' }} />
                    <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
                      {estimate.breakdown.uniqueLocations}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      Lokasjoner
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Time Breakdown */}
          <Paper sx={{ p: 2, bgcolor: '#16213e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#64b5f6', fontWeight: 600 }}>
              TIDSESTIMAT
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">Oppsett-tid</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatTime(estimate.totalSetupTime)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(estimate.totalSetupTime / (estimate.totalSetupTime + estimate.totalShootingTime)) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'rgba(100, 181, 246, 0.2)',
                    '& .MuiLinearProgress-bar': { bgcolor: '#64b5f6' },
                  }}
                />
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">Innspillingstid</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatTime(estimate.totalShootingTime)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(estimate.totalShootingTime / (estimate.totalSetupTime + estimate.totalShootingTime)) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'rgba(255, 167, 38, 0.2)',
                    '& .MuiLinearProgress-bar': { bgcolor: '#ffa726' },
                  }}
                />
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">Total tid</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4caf50' }}>
                  {formatTime(estimate.totalSetupTime + estimate.totalShootingTime)}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* Crew Requirements */}
          <Paper sx={{ p: 2, bgcolor: '#16213e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#ffa726', fontWeight: 600 }}>
              CREW-BEHOV
            </Typography>
            <Stack spacing={1}>
              {Object.entries(estimate.crewRequired).map(([role, required]) => (
                <Stack key={role} direction="row" spacing={1} alignItems="center">
                  {required ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                  ) : (
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
                  )}
                  <Typography variant="body2" sx={{ color: required ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                    {role === 'director' && 'Regissør'}
                    {role === 'cinematographer' && 'Filmfotograf'}
                    {role === 'soundEngineer' && 'Lydtekniker'}
                    {role === 'gaffer' && 'Gaffer (Lystekniker)'}
                    {role === 'grip' && 'Grip'}
                    {role === 'productionAssistant' && 'Produksjonsassistent'}
                    {role === 'makeup' && 'Sminke'}
                    {role === 'wardrobe' && 'Kostyme'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>

          {/* Risks */}
          {estimate.risks.length > 0 && (
            <Paper sx={{ p: 2, bgcolor: '#16213e', border: `1px solid ${getRiskColor(estimate.riskLevel)}` }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: getRiskColor(estimate.riskLevel), fontWeight: 600 }}>
                RISIKOER & ADVARSLER
              </Typography>
              <Stack spacing={1.5}>
                {estimate.risks.map((risk, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: `${getRiskColor(risk.severity)}15`,
                      border: `1px solid ${getRiskColor(risk.severity)}40`,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      {risk.severity === 'high' ? (
                        <ErrorIcon sx={{ fontSize: 20, color: getRiskColor(risk.severity), mt: 0.2 }} />
                      ) : (
                        <WarningIcon sx={{ fontSize: 20, color: getRiskColor(risk.severity), mt: 0.2 }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: getRiskColor(risk.severity) }}>
                          {risk.type}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {risk.description}
                        </Typography>
                      </Box>
                      <Chip
                        label={risk.severity === 'high' ? 'HØY' : 'MEDIUM'}
                        size="small"
                        sx={{
                          bgcolor: getRiskColor(risk.severity),
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                        }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Scene Breakdown */}
          <Paper sx={{ p: 2, bgcolor: '#16213e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#9c27b0', fontWeight: 600 }}>
              SCENE-OVERSIKT
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Innendørs
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#64b5f6' }}>
                    {estimate.breakdown.intScenes} scener
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Utendørs
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffa726' }}>
                    {estimate.breakdown.extScenes} scener
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Dag
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#fff176' }}>
                    {estimate.breakdown.dayScenes} scener
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Natt
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#7e57c2' }}>
                    {estimate.breakdown.nightScenes} scener
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Lukk
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: '#64b5f6',
            '&:hover': { bgcolor: '#42a5f5' },
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductionEstimateDialog;
