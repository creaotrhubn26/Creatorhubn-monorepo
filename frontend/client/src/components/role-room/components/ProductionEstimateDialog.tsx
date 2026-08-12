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
import { useT } from '../../../i18n';

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

export const ProductionEstimateDialog: React.FC<ProductionEstimateDialogProps> = ({
  open,
  onClose,
  scenes,
  shotLists,
  manuscriptTitle,
}) => {
  const { t } = useT();
  const riskLabels = useMemo<Record<string, string>>(() => ({
    low: t('prodEst.riskLow'),
    medium: t('prodEst.riskMedium'),
    high: t('prodEst.riskHigh'),
    critical: t('prodEst.riskCritical'),
  }), [t]);
  const roleLabels = useMemo<Record<string, string>>(() => ({
    director: t('prodEst.roleDirector'),
    cinematographer: t('prodEst.roleCinematographer'),
    soundEngineer: t('prodEst.roleSoundEngineer'),
    gaffer: t('prodEst.roleGaffer'),
    grip: t('prodEst.roleGrip'),
    productionAssistant: t('prodEst.roleProductionAssistant'),
    makeup: t('prodEst.roleMakeup'),
    wardrobe: t('prodEst.roleWardrobe'),
  }), [t]);
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
        type: t('prodEst.riskLocations'),
        severity: 'high',
        description: t('prodEst.riskLocDescHigh', { n: uniqueLocations }),
      });
    } else if (uniqueLocations > 3) {
      risks.push({
        type: t('prodEst.riskLocations'),
        severity: 'medium',
        description: t('prodEst.riskLocDescMed', { n: uniqueLocations }),
      });
    }
    
    // Exterior scenes risk
    if (extScenes > intScenes * 2) {
      risks.push({
        type: t('prodEst.riskExterior'),
        severity: 'high',
        description: t('prodEst.riskExtDescHigh'),
      });
    } else if (extScenes > intScenes) {
      risks.push({
        type: t('prodEst.riskExterior'),
        severity: 'medium',
        description: t('prodEst.riskExtDescMed'),
      });
    }
    
    // Night scenes risk
    if (nightScenes > dayScenes) {
      risks.push({
        type: t('prodEst.riskNight'),
        severity: 'high',
        description: t('prodEst.riskNightDescHigh'),
      });
    } else if (nightScenes > 0) {
      risks.push({
        type: t('prodEst.riskNight'),
        severity: 'medium',
        description: t('prodEst.riskNightDescMed', { n: nightScenes }),
      });
    }
    
    // Shot complexity risk
    if (totalShots > 50) {
      risks.push({
        type: t('prodEst.riskShotComplexity'),
        severity: 'high',
        description: t('prodEst.riskShotDescHigh', { n: totalShots }),
      });
    } else if (totalShots > 30) {
      risks.push({
        type: t('prodEst.riskShotComplexity'),
        severity: 'medium',
        description: t('prodEst.riskShotDescMed', { n: totalShots }),
      });
    }
    
    // Missing shots risk
    const scenesWithoutShots = scenes.filter(s => 
      !shotLists.find(sl => sl.sceneId === s.id)?.shots.length
    );
    if (scenesWithoutShots.length > scenes.length / 2) {
      risks.push({
        type: t('prodEst.riskMissingShots'),
        severity: 'high',
        description: t('prodEst.riskMissingDescHigh', { n: scenesWithoutShots.length }),
      });
    } else if (scenesWithoutShots.length > 0) {
      risks.push({
        type: t('prodEst.riskMissingShots'),
        severity: 'medium',
        description: t('prodEst.riskMissingDescMed', { n: scenesWithoutShots.length }),
      });
    }
    
    // Schedule risk
    if (totalShootDays > 10) {
      risks.push({
        type: t('prodEst.riskSchedule'),
        severity: 'high',
        description: t('prodEst.riskSchedDescHigh', { n: totalShootDays }),
      });
    } else if (totalShootDays > 5) {
      risks.push({
        type: t('prodEst.riskSchedule'),
        severity: 'medium',
        description: t('prodEst.riskSchedDescMed', { n: totalShootDays }),
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
  }, [scenes, shotLists, t]);

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return t('prodEst.durationHm', { h: hours, m: mins });
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
            <Typography variant="h6">{t('prodEst.title')}</Typography>
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
              {riskLabels[estimate.riskLevel]}
            </Typography>
            <Typography variant="body2">
              {t('prodEst.risksIdentified', { n: estimate.risks.length })}
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
                      {t('prodEst.shootDays')}
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
                      {t('prodEst.crewMembers')}
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
                      {t('prodEst.totalShots')}
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
                      {t('prodEst.locations')}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Time Breakdown */}
          <Paper sx={{ p: 2, bgcolor: '#16213e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#64b5f6', fontWeight: 600 }}>
              {t('prodEst.timeEstimate')}
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2">{t('prodEst.setupTime')}</Typography>
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
                  <Typography variant="body2">{t('prodEst.shootingTime')}</Typography>
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
                <Typography variant="subtitle2">{t('prodEst.totalTime')}</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4caf50' }}>
                  {formatTime(estimate.totalSetupTime + estimate.totalShootingTime)}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* Crew Requirements */}
          <Paper sx={{ p: 2, bgcolor: '#16213e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#ffa726', fontWeight: 600 }}>
              {t('prodEst.crewNeeds')}
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
                    {roleLabels[role]}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>

          {/* Risks */}
          {estimate.risks.length > 0 && (
            <Paper sx={{ p: 2, bgcolor: '#16213e', border: `1px solid ${getRiskColor(estimate.riskLevel)}` }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: getRiskColor(estimate.riskLevel), fontWeight: 600 }}>
                {t('prodEst.risksWarnings')}
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
                        label={risk.severity === 'high' ? t('prodEst.sevHigh') : t('prodEst.sevMedium')}
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
              {t('prodEst.sceneOverview')}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {t('prodEst.interior')}
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#64b5f6' }}>
                    {t('prodEst.scenesCount', { n: estimate.breakdown.intScenes })}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {t('prodEst.exterior')}
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffa726' }}>
                    {t('prodEst.scenesCount', { n: estimate.breakdown.extScenes })}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {t('prodEst.day')}
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#fff176' }}>
                    {t('prodEst.scenesCount', { n: estimate.breakdown.dayScenes })}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {t('prodEst.night')}
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#7e57c2' }}>
                    {t('prodEst.scenesCount', { n: estimate.breakdown.nightScenes })}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          {t('prodEst.close')}
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
