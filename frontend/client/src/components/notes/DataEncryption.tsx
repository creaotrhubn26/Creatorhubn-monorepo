import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Download,
  Key,
  Lock,
  PlayArrow,
  Shield,
  VpnKey,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface EncryptionConfig {
  id: string;
  name: string;
  algorithm: 'AES-256' | 'RSA-4096' | 'ChaCha20' | 'Twofish';
  keySize: number;
  mode: 'CBC' | 'GCM' | 'CTR' | 'OFB';
  enabled: boolean;
  description: string;
  strength: 'low' | 'medium' | 'high' | 'maximum';
}

interface EncryptionKey {
  id: string;
  name: string;
  algorithm: string;
  keySize: number;
  created: Date;
  expires?: Date;
  status: 'active' | 'expired' | 'revoked';
  usage: string[];
}

interface EncryptionStatus {
  totalFiles: number;
  encryptedFiles: number;
  pendingEncryption: number;
  failedEncryption: number;
  encryptionProgress: number;
}

interface DataEncryptionProps {
  className?: string;
  onConfigChange?: (config: EncryptionConfig) => void;
  onKeyChange?: (key: EncryptionKey) => void;
  onEncryptionStart?: (files: string[]) => void;
  onEncryptionExport?: (data: { configs: EncryptionConfig[]; keys: EncryptionKey[] }) => void;
}

const INITIAL_CONFIGS: EncryptionConfig[] = [
  {
    id: 'cfg-aes',
    name: 'AES-256 GCM',
    algorithm: 'AES-256',
    keySize: 256,
    mode: 'GCM',
    enabled: true,
    description: 'Primary symmetric encryption profile for files and blobs.',
    strength: 'maximum',
  },
  {
    id: 'cfg-rsa',
    name: 'RSA-4096 Envelope',
    algorithm: 'RSA-4096',
    keySize: 4096,
    mode: 'CBC',
    enabled: true,
    description: 'Asymmetric key wrapping and signature validation.',
    strength: 'high',
  },
  {
    id: 'cfg-chacha',
    name: 'ChaCha20 Streaming',
    algorithm: 'ChaCha20',
    keySize: 256,
    mode: 'CTR',
    enabled: false,
    description: 'Low-latency stream encryption profile for realtime pipelines.',
    strength: 'high',
  },
];

const INITIAL_KEYS: EncryptionKey[] = [
  {
    id: 'key-1',
    name: 'Master Key',
    algorithm: 'AES-256',
    keySize: 256,
    created: new Date('2026-01-10T08:00:00Z'),
    expires: new Date('2027-01-10T08:00:00Z'),
    status: 'active',
    usage: ['media', 'documents', 'database'],
  },
  {
    id: 'key-2',
    name: 'Signing Key',
    algorithm: 'RSA-4096',
    keySize: 4096,
    created: new Date('2026-01-15T08:00:00Z'),
    status: 'active',
    usage: ['tokens', 'signatures'],
  },
];

export default function DataEncryption({
  className,
  onConfigChange,
  onKeyChange,
  onEncryptionStart,
  onEncryptionExport,
}: DataEncryptionProps): React.ReactElement {
  const theming = useTheming('photographer');

  const [activeTab, setActiveTab] = useState(0);
  const [configs, setConfigs] = useState<EncryptionConfig[]>(INITIAL_CONFIGS);
  const [keys, setKeys] = useState<EncryptionKey[]>(INITIAL_KEYS);
  const [status, setStatus] = useState<EncryptionStatus>({
    totalFiles: 1000,
    encryptedFiles: 700,
    pendingEncryption: 250,
    failedEncryption: 50,
    encryptionProgress: 70,
  });
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const activeConfigCount = useMemo(
    () => configs.filter((config) => config.enabled).length,
    [configs],
  );

  const toggleConfig = (configId: string): void => {
    setConfigs((previous) =>
      previous.map((config) => {
        if (config.id !== configId) {
          return config;
        }
        const updated = { ...config, enabled: !config.enabled };
        onConfigChange?.(updated);
        return updated;
      }),
    );
  };

  const runEncryptionPass = (): void => {
    const files = ['video-1.mov', 'audio-1.wav', 'notes.json'];
    onEncryptionStart?.(files);

    setIsEncrypting(true);
    setStatus((previous) => ({ ...previous, pendingEncryption: Math.max(0, previous.pendingEncryption - 60) }));

    const interval = window.setInterval(() => {
      setStatus((previous) => {
        const nextEncrypted = Math.min(previous.totalFiles, previous.encryptedFiles + 30);
        const nextPending = Math.max(0, previous.totalFiles - nextEncrypted - previous.failedEncryption);
        const nextProgress = Math.round((nextEncrypted / previous.totalFiles) * 100);

        if (nextProgress >= 100 || nextPending === 0) {
          window.clearInterval(interval);
          setIsEncrypting(false);
        }

        return {
          ...previous,
          encryptedFiles: nextEncrypted,
          pendingEncryption: nextPending,
          encryptionProgress: nextProgress,
        };
      });
    }, 500);
  };

  const createKey = (): void => {
    if (!newKeyName.trim()) {
      return;
    }

    const key: EncryptionKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      algorithm: 'AES-256',
      keySize: 256,
      created: new Date(),
      status: 'active',
      usage: ['custom'],
    };

    setKeys((previous) => [key, ...previous]);
    setNewKeyName('');
    setShowKeyDialog(false);
    onKeyChange?.(key);
  };

  const exportConfiguration = (): void => {
    onEncryptionExport?.({ configs, keys });
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Shield color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Data Encryption
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure encryption profiles, key lifecycle, and processing status.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label={`${activeConfigCount} active profiles`} size="small" />
            <Button size="small" variant="outlined" startIcon={<Download />} onClick={exportConfiguration}>
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, tab) => setActiveTab(tab)}>
          <Tab icon={<Lock />} iconPosition="start" label="Profiles" />
          <Tab icon={<VpnKey />} iconPosition="start" label="Keys" />
          <Tab icon={<PlayArrow />} iconPosition="start" label="Jobs" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Card>
          <CardContent>
            <List>
              {configs.map((config) => (
                <ListItem key={config.id}>
                  <ListItemText
                    primary={`${config.name} (${config.algorithm} ${config.mode})`}
                    secondary={`${config.description} • ${config.keySize}-bit`}
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={config.strength} />
                      <Switch checked={config.enabled} onChange={() => toggleConfig(config.id)} />
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 1 ? (
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Encryption Keys</Typography>
              <Button size="small" variant="outlined" startIcon={<Key />} onClick={() => setShowKeyDialog(true)}>
                New Key
              </Button>
            </Stack>
            <Grid container spacing={2}>
              {keys.map((key) => (
                <Grid key={key.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2">{key.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {key.algorithm} • {key.keySize}-bit
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created {key.created.toLocaleDateString()}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip size="small" color={key.status === 'active' ? 'success' : 'default'} label={key.status} />
                        {key.usage.map((usageItem) => (
                          <Chip key={usageItem} size="small" label={usageItem} variant="outlined" />
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 2 ? (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle1">Encryption Pipeline</Typography>
              <LinearProgress variant="determinate" value={status.encryptionProgress} />
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={`Total: ${status.totalFiles}`} size="small" />
                <Chip label={`Encrypted: ${status.encryptedFiles}`} size="small" color="success" />
                <Chip label={`Pending: ${status.pendingEncryption}`} size="small" color="warning" />
                <Chip label={`Failed: ${status.failedEncryption}`} size="small" color="error" />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  disabled={isEncrypting || status.pendingEncryption === 0}
                  onClick={runEncryptionPass}
                >
                  {isEncrypting ? 'Encrypting...' : 'Run Encryption Pass'}
                </Button>
              </Stack>
              {status.failedEncryption > 0 ? (
                <Alert severity="warning">Some files failed in previous runs and should be retried.</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showKeyDialog} onClose={() => setShowKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Encryption Key</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            sx={{ mt: 1 }}
            label="Key name"
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKeyDialog(false)}>Cancel</Button>
          <Button onClick={createKey} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
