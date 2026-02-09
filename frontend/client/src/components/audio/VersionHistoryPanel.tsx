import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  TextField,
  Alert
} from '@mui/material';
import {
  History,
  Save,
  Restore,
  Delete,
  CompareArrows,
  AudioFile
} from '@mui/icons-material';

interface VersionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentAudioUrl: string;
  onVersionRestore: (version: AudioVersion) => void;
  onCompareVersions: (versions: AudioVersion[]) => void;
}

interface AudioVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  name: string;
  description: string;
  audioUrl: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  createdBy: string;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  open,
  onClose,
  projectId,
  currentAudioUrl,
  onVersionRestore,
  onCompareVersions
}) => {
  const [versions, setVersions] = useState<AudioVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && projectId) {
      loadVersions();
    }
  }, [open, projectId]);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/audio/versions/${projectId}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        const mapped = (data.versions || []).map((version: any) => ({
          ...version,
          createdAt: new Date(version.createdAt)
        }));
        setVersions(mapped);
      } else {
        setError(data.error || 'Failed to load versions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!versionName.trim()) {
      setError('Versjonsnavn er paakrevd');
      return;
    }

    setSavingVersion(true);
    setError(null);

    try {
      const response = await fetch('/api/audio/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          name: versionName,
          description: versionDescription,
          audioUrl: currentAudioUrl,
          settings: {}
        })
      });

      const data = await response.json();

      if (data.success) {
        setVersionName('');
        setVersionDescription('');
        loadVersions();
      } else {
        setError(data.error || 'Failed to save version');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save version');
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestoreVersion = (version: AudioVersion) => {
    if (window.confirm(`Gjenopprett versjon "${version.name}"?`)) {
      onVersionRestore(version);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!window.confirm('Er du sikker pa at du vil slette denne versjonen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/audio/versions/${versionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        loadVersions();
      } else {
        setError(data.error || 'Failed to delete version');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete version');
    }
  };

  const handleCompare = () => {
    const selected = versions.filter((version) => selectedVersions.includes(version.id));
    if (selected.length >= 2) {
      onCompareVersions(selected);
    }
  };

  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      if (prev.length < 2) {
        return [...prev, versionId];
      }
      return [prev[1], versionId];
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <History />
          <Typography variant="h6">Versjonshistorikk</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mb={3} p={2} sx={{ bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Lagre ny versjon
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Versjonsnavn"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Beskrivelse (valgfritt)"
            value={versionDescription}
            onChange={(e) => setVersionDescription(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSaveVersion}
            disabled={savingVersion || !versionName.trim()}
            fullWidth
          >
            {savingVersion ? 'Lagrer...' : 'Lagre versjon'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" gutterBottom>
          Tidligere versjoner ({versions.length})
        </Typography>

        {selectedVersions.length === 2 && (
          <Button
            variant="outlined"
            startIcon={<CompareArrows />}
            onClick={handleCompare}
            fullWidth
            sx={{ mb: 2 }}
          >
            Sammenlign valgte versjoner
          </Button>
        )}

        {loading && <Typography variant="body2">Laster versjoner...</Typography>}

        <List>
          {versions.map((version) => (
            <ListItem
              key={version.id}
              sx={{ border: '1px solid #eee', borderRadius: 1, mb: 1 }}
              secondaryAction={
                <Box>
                  <IconButton onClick={() => toggleVersionSelection(version.id)}>
                    <CompareArrows color={selectedVersions.includes(version.id) ? 'primary' : 'inherit'} />
                  </IconButton>
                  <IconButton onClick={() => handleRestoreVersion(version)}>
                    <Restore />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteVersion(version.id)}>
                    <Delete />
                  </IconButton>
                </Box>
              }
            >
              <ListItemIcon>
                <AudioFile />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body1">{version.name}</Typography>
                    <Chip label={`v${version.versionNumber}`} size="small" />
                  </Box>
                }
                secondary={`${version.description || 'Ingen beskrivelse'} • ${version.createdAt.toLocaleString('no-NO')}`}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default VersionHistoryPanel;
