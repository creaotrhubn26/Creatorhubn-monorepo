import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Stack,
} from '@mui/material';
import {
  Movie as MovieIcon,
  People as PeopleIcon,
  Videocam as VideocamIcon,
  ViewInAr as ViewInArIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  PhotoCamera as CameraIcon,
  Lightbulb as LightIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { CastingProject } from '../models/casting';
import { castingService } from '../services/castingService';
import { castingToSceneService } from '../services/castingToSceneService';
import { useToast } from './ToastStack';

interface ProductionDashboardProps {
  projectId?: string;
  onOpenCasting?: () => void;
  onOpenScene?: () => void;
}

export function ProductionDashboard({
  projectId,
  onOpenCasting,
  onOpenScene,
}: ProductionDashboardProps) {
  const [project, setProject] = useState<CastingProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const { showSuccess, showError, showInfo } = useToast();

  useEffect(() => {
    const loadProject = async () => {
      setLoading(true);
      try {
        if (projectId) {
          const p = await castingService.getProject(projectId);
          setProject(p);
        } else {
          const projects = await castingService.getProjects();
          if (projects.length > 0) {
            setProject(projects[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [projectId]);

  const handleRefresh = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const updated = await castingService.getProject(project.id);
      setProject(updated);
    } catch (error) {
      console.error('Failed to refresh project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferToScene = async () => {
    if (!project) return;
    
    setTransferring(true);
    try {
      const result = await castingToSceneService.transferProjectToScene(project.id);
      
      if (result.success) {
        showSuccess(`Prosjekt overført til 3D-scene: ${result.candidatesAdded} kandidater`, 4000);
        if (result.avatarsGenerated > 0) {
          showInfo(`Genererer ${result.avatarsGenerated} avatar(er)...`, 5000);
        }
      } else {
        showError(`Feil ved overføring: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error transferring to scene:', error);
      showError('Kunne ikke overføre prosjekt til scene');
    } finally {
      setTransferring(false);
    }
  };

  if (!project) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Ingen prosjekter funnet. Opprett et nytt prosjekt i Casting Planner.
        </Typography>
        <Button
          variant="contained"
          onClick={onOpenCasting}
          sx={{ mt: 2, bgcolor: '#10b981' }}
        >
          Åpne Casting Planner
        </Button>
      </Box>
    );
  }

  const confirmedCandidates = project.candidates.filter(c => c.status === 'confirmed').length;
  const selectedCandidates = project.candidates.filter(c => c.status === 'selected').length;
  const readyForScene = confirmedCandidates + selectedCandidates;
  const totalCandidates = project.candidates.length;
  const progress = totalCandidates > 0 ? (readyForScene / totalCandidates) * 100 : 0;

  return (
    <Box sx={{ p: 3 }}>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MovieIcon sx={{ color: '#10b981' }} />
            {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Produksjonsoversikt
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Oppdater">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon sx={{ color: '#fff' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 120 }}>
          <Card sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <PeopleIcon sx={{ fontSize: 32, color: '#10b981', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>
                {totalCandidates}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Kandidater
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 120 }}>
          <Card sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <ViewInArIcon sx={{ fontSize: 32, color: '#8b5cf6', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 700 }}>
                {readyForScene}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Klare for scene
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 120 }}>
          <Card sx={{ bgcolor: 'rgba(255, 184, 0, 0.1)', border: '1px solid rgba(255, 184, 0, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <LocationIcon sx={{ fontSize: 32, color: '#ffb800', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700 }}>
                {project.locations.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Lokasjoner
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 120 }}>
          <Card sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <VideocamIcon sx={{ fontSize: 32, color: '#00d4ff', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700 }}>
                {project.shotLists.reduce((sum, sl) => sum + sl.shots.length, 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Innstillinger
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 2, color: '#fff' }}>
            Casting-fremdrift
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: progress >= 100 ? '#10b981' : '#8b5cf6',
                    borderRadius: 5,
                  },
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#fff', minWidth: 50 }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`${confirmedCandidates} bekreftet`}
              size="small"
              sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
            />
            <Chip
              label={`${selectedCandidates} valgt`}
              size="small"
              sx={{ bgcolor: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}
            />
            <Chip
              label={`${project.roles.length} roller`}
              size="small"
              sx={{ bgcolor: 'rgba(255, 184, 0, 0.2)', color: '#ffb800' }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

      <Typography variant="subtitle1" sx={{ mb: 2, color: '#fff', fontWeight: 600 }}>
        Hurtighandlinger
      </Typography>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 200 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<ViewInArIcon />}
            onClick={handleTransferToScene}
            disabled={transferring || readyForScene === 0}
            sx={{
              bgcolor: '#8b5cf6',
              py: 1.5,
              '&:hover': { bgcolor: '#7c3aed' },
              '&:disabled': { bgcolor: 'rgba(139, 92, 246, 0.3)' },
            }}
          >
            {transferring ? 'Overfører...' : `Overfør til 3D-scene (${readyForScene})`}
          </Button>
        </Box>
        <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 200 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<PlayIcon />}
            onClick={onOpenScene}
            sx={{
              borderColor: '#10b981',
              color: '#10b981',
              py: 1.5,
              '&:hover': { borderColor: '#059669', bgcolor: 'rgba(16, 185, 129, 0.1)' },
            }}
          >
            Åpne 3D-studio
          </Button>
        </Box>
        <Box sx={{ flex: '1 1 calc(25% - 12px)', minWidth: 120 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<CameraIcon />}
            onClick={onOpenCasting}
            size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Casting
          </Button>
        </Box>
        <Box sx={{ flex: '1 1 calc(25% - 12px)', minWidth: 120 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LightIcon />}
            size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Lyssetting
          </Button>
        </Box>
        <Box sx={{ flex: '1 1 calc(25% - 12px)', minWidth: 120 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LocationIcon />}
            size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Lokasjoner
          </Button>
        </Box>
        <Box sx={{ flex: '1 1 calc(25% - 12px)', minWidth: 120 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<VideocamIcon />}
            size="small"
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Shot List
          </Button>
        </Box>
      </Box>

      {project.candidates.length > 0 && (
        <>
          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
          <Typography variant="subtitle1" sx={{ mb: 2, color: '#fff', fontWeight: 600 }}>
            Nylige kandidater
          </Typography>
          <Stack spacing={1}>
            {project.candidates.slice(0, 5).map((candidate) => (
              <Box
                key={candidate.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: candidate.photos[0] ? 'transparent' : 'rgba(139, 92, 246, 0.2)',
                      backgroundImage: candidate.photos[0] ? `url(${candidate.photos[0]})` : 'none',
                      backgroundSize: 'cover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!candidate.photos[0] && (
                      <PeopleIcon sx={{ fontSize: 20, color: '#8b5cf6' }} />
                    )}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                      {candidate.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {candidate.assignedRoles
                        .map(rid => project.roles.find(r => r.id === rid)?.name)
                        .filter(Boolean)
                        .join(', ') || 'Ingen roller'}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={candidate.status === 'confirmed' ? 'Bekreftet' : 
                         candidate.status === 'selected' ? 'Valgt' : 
                         candidate.status === 'shortlist' ? 'Shortlist' : 'Venter'}
                  size="small"
                  sx={{
                    bgcolor: candidate.status === 'confirmed' ? 'rgba(16, 185, 129, 0.2)' :
                             candidate.status === 'selected' ? 'rgba(139, 92, 246, 0.2)' :
                             candidate.status === 'shortlist' ? 'rgba(255, 184, 0, 0.2)' :
                             'rgba(107, 114, 128, 0.2)',
                    color: candidate.status === 'confirmed' ? '#10b981' :
                           candidate.status === 'selected' ? '#8b5cf6' :
                           candidate.status === 'shortlist' ? '#ffb800' : '#6b7280',
                  }}
                />
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
