import { useState, useEffect, type FC } from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  Warning as WarningIcon,
  PersonAdd as PersonAddIcon,
  Category as CategoryIcon,
  Comment as CommentIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationOnIcon } from './icons/CastingIcons';
import { SceneBreakdown, DialogueLine } from '../models/casting';
import { useToast } from './ToastStack';
import { manuscriptService } from '../services/manuscriptService';

interface BreakdownReviewPanelProps {
  projectId: string;
  manuscriptId: string;
  scenes: SceneBreakdown[];
  dialogue: DialogueLine[];
  characters: Set<string>;
  onApprove: (scenes: SceneBreakdown[], dialogue: DialogueLine[]) => void;
  onReject: () => void;
}

export const BreakdownReviewPanel: FC<BreakdownReviewPanelProps> = ({
  projectId,
  manuscriptId,
  scenes,
  dialogue,
  characters,
  onApprove,
  onReject,
}) => {
  const { showSuccess, showError, showInfo } = useToast();
  const [reviewedScenes, setReviewedScenes] = useState<SceneBreakdown[]>(scenes);
  const [reviewedDialogue, setReviewedDialogue] = useState<DialogueLine[]>(dialogue);
  const [sceneApprovals, setSceneApprovals] = useState<Map<string, boolean>>(new Map());
  const [isLinking, setIsLinking] = useState(false);
  const [linkingStats, setLinkingStats] = useState<{
    rolesLinked: number;
    locationsLinked: number;
    propsFound: number;
  } | null>(null);
  const [editingScene, setEditingScene] = useState<SceneBreakdown | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Initialize all scenes as not approved
  useEffect(() => {
    const approvals = new Map<string, boolean>();
    scenes.forEach(scene => approvals.set(scene.id, false));
    setSceneApprovals(approvals);
  }, [scenes]);

  const handleApproveScene = (sceneId: string) => {
    setSceneApprovals(prev => new Map(prev).set(sceneId, true));
  };

  const handleRejectScene = (sceneId: string) => {
    setSceneApprovals(prev => new Map(prev).set(sceneId, false));
  };

  const handleEditScene = (scene: SceneBreakdown) => {
    setEditingScene({ ...scene });
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingScene) return;

    setReviewedScenes(prev =>
      prev.map(s => (s.id === editingScene.id ? editingScene : s))
    );
    setShowEditDialog(false);
    setEditingScene(null);
    showSuccess('Scene oppdatert');
  };

  const handleAutoLink = async () => {
    setIsLinking(true);
    try {
      const result = await manuscriptService.applyAutoLinking(
        projectId,
        reviewedScenes,
        reviewedDialogue,
        characters
      );

      setReviewedScenes(result.scenes);
      setReviewedDialogue(result.dialogue);
      setLinkingStats(result.stats);

      showSuccess(
        `Auto-linking fullført: ${result.stats.rolesLinked} roller, ${result.stats.locationsLinked} lokasjoner, ${result.stats.propsFound} rekvisitter funnet`
      );
    } catch (error) {
      showError('Feil ved auto-linking');
      console.error(error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleApproveAll = () => {
    const allApproved = new Map<string, boolean>();
    reviewedScenes.forEach(scene => allApproved.set(scene.id, true));
    setSceneApprovals(allApproved);
    showSuccess('Alle scener godkjent');
  };

  const handleFinalApprove = () => {
    const unapprovedCount = Array.from(sceneApprovals.values()).filter(v => !v).length;

    if (unapprovedCount > 0) {
      if (!confirm(`${unapprovedCount} scener er ikke godkjent. Fortsett likevel?`)) {
        return;
      }
    }

    onApprove(reviewedScenes, reviewedDialogue);
  };

  const approvedCount = Array.from(sceneApprovals.values()).filter(v => v).length;
  const totalScenes = reviewedScenes.length;
  const approvalPercentage = totalScenes > 0 ? Math.round((approvedCount / totalScenes) * 100) : 0;

  return (
    <Box sx={{ p: 3 }}>
      <ContextualNudgeBanner context="breakdown" accentColor="#8b5cf6" />
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Breakdown Review
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gjennomgå og godkjenn automatisk genererte scene breakdowns
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            startIcon={<LinkIcon />}
            variant="outlined"
            onClick={handleAutoLink}
            disabled={isLinking}
          >
            {isLinking ? 'Linker...' : 'Auto-Link Roller & Lokasjoner'}
          </Button>
          <Button
            startIcon={<PlaylistAddCheckIcon />}
            variant="outlined"
            onClick={handleApproveAll}
          >
            Godkjenn Alle
          </Button>
        </Stack>
      </Stack>

      {/* Progress Card */}
      <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold">
                {approvedCount} / {totalScenes}
              </Typography>
              <Typography variant="body2">Scener Godkjent ({approvalPercentage}%)</Typography>
            </Box>
            {linkingStats && (
              <Stack spacing={1}>
                <Typography variant="body2">
                  <PersonAddIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  {linkingStats.rolesLinked} roller linket
                </Typography>
                <Typography variant="body2">
                  <LocationOnIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  {linkingStats.locationsLinked} lokasjoner linket
                </Typography>
                <Typography variant="body2">
                  <CategoryIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  {linkingStats.propsFound} rekvisitter funnet
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Scene List */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        {reviewedScenes.map(scene => {
          const isApproved = sceneApprovals.get(scene.id) || false;
          const hasIssues = !scene.locationId || scene.characters.length === 0;

          return (
            <Accordion key={scene.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                  <Chip
                    label={scene.sceneNumber}
                    size="small"
                    color="primary"
                    sx={{ minWidth: 50 }}
                  />
                  <Typography sx={{ flex: 1 }}>{scene.sceneHeading}</Typography>
                  {hasIssues && (
                    <Tooltip title="Scene har mangler">
                      <WarningIcon color="warning" fontSize="small" />
                    </Tooltip>
                  )}
                  <Chip
                    icon={isApproved ? <CheckCircleIcon /> : <CancelIcon />}
                    label={isApproved ? 'Godkjent' : 'Ikke godkjent'}
                    color={isApproved ? 'success' : 'default'}
                    size="small"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {/* Scene Details */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Detaljer
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Chip label={scene.intExt || 'N/A'} size="small" />
                      <Chip label={scene.timeOfDay || 'N/A'} size="small" />
                      <Chip
                        label={scene.locationId ? 'Lokasjon linket' : 'Ingen lokasjon'}
                        size="small"
                        color={scene.locationId ? 'success' : 'warning'}
                      />
                      <Chip
                        label={`${scene.characters.length} karakterer`}
                        size="small"
                        color={scene.characters.length > 0 ? 'info' : 'warning'}
                      />
                    </Stack>
                  </Box>

                  {/* Characters */}
                  {scene.characters.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Karakterer
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {scene.characters.map(char => (
                          <Chip key={char} label={char} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Description */}
                  {scene.description && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Beskrivelse
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {scene.description.substring(0, 300)}
                        {scene.description.length > 300 ? '...' : ''}
                      </Typography>
                    </Box>
                  )}

                  {/* Actions */}
                  <Stack direction="row" spacing={2}>
                    <Button
                      startIcon={<EditIcon />}
                      size="small"
                      onClick={() => handleEditScene(scene)}
                    >
                      Rediger
                    </Button>
                    {!isApproved ? (
                      <Button
                        startIcon={<CheckCircleIcon />}
                        size="small"
                        color="success"
                        variant="contained"
                        onClick={() => handleApproveScene(scene.id)}
                      >
                        Godkjenn
                      </Button>
                    ) : (
                      <Button
                        startIcon={<CancelIcon />}
                        size="small"
                        color="warning"
                        variant="outlined"
                        onClick={() => handleRejectScene(scene.id)}
                      >
                        Angre Godkjenning
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>

      {/* Final Actions */}
      <Stack direction="row" justifyContent="flex-end" spacing={2}>
        <Button onClick={onReject} color="error">
          Avbryt Breakdown
        </Button>
        <Button
          variant="contained"
          onClick={handleFinalApprove}
          disabled={approvedCount === 0}
          startIcon={<CheckCircleIcon />}
        >
          Godkjenn & Importer ({approvedCount} scener)
        </Button>
      </Stack>

      {/* Edit Scene Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Rediger Scene</DialogTitle>
        <DialogContent>
          {editingScene && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Scene Nummer"
                value={editingScene.sceneNumber}
                onChange={e => setEditingScene({ ...editingScene, sceneNumber: e.target.value })}
                fullWidth
              />
              <TextField
                label="Scene Heading"
                value={editingScene.sceneHeading}
                onChange={e => setEditingScene({ ...editingScene, sceneHeading: e.target.value })}
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>INT/EXT</InputLabel>
                  <Select
                    value={editingScene.intExt || 'INT'}
                    onChange={e =>
                      setEditingScene({
                        ...editingScene,
                        intExt: e.target.value as 'INT' | 'EXT' | 'INT/EXT',
                      })
                    }
                  >
                    <MenuItem value="INT">INT</MenuItem>
                    <MenuItem value="EXT">EXT</MenuItem>
                    <MenuItem value="INT/EXT">INT/EXT</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Lokasjon"
                  value={editingScene.locationName}
                  onChange={e => setEditingScene({ ...editingScene, locationName: e.target.value })}
                  fullWidth
                />
              </Stack>
              <FormControl fullWidth>
                <InputLabel>Tid på døgnet</InputLabel>
                <Select
                  value={editingScene.timeOfDay || 'DAY'}
                  onChange={e =>
                    setEditingScene({ ...editingScene, timeOfDay: e.target.value as SceneBreakdown['timeOfDay'] })
                  }
                >
                  <MenuItem value="DAY">DAY</MenuItem>
                  <MenuItem value="NIGHT">NIGHT</MenuItem>
                  <MenuItem value="DAWN">DAWN</MenuItem>
                  <MenuItem value="DUSK">DUSK</MenuItem>
                  <MenuItem value="MORNING">MORNING</MenuItem>
                  <MenuItem value="EVENING">EVENING</MenuItem>
                  <MenuItem value="CONTINUOUS">CONTINUOUS</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Beskrivelse"
                value={editingScene.description || ''}
                onChange={e => setEditingScene({ ...editingScene, description: e.target.value })}
                multiline
                rows={6}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Avbryt</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
