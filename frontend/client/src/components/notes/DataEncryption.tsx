import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface EncryptionConfig {
  id: string;
  name: string;
  algorithm: 'AES-256' | 'RSA-4096' | 'ChaCha20' | 'Twofish';
  keySize: number;
  mode: 'CBC' | 'GCM' | 'CTR' | 'OFB';
  enabled: boolean;
  description: string;
  strength: 'low' | 'medium' | 'high' | 'maximum'
}

interface EncryptionKey {
  id: string;
  name: string;
  algorithm: string;
  keySize: number;
  created: Date;
  expires?: Date;
  status: 'active' | 'expired' | 'revoked';
  usage: string[]
}

interface EncryptionStatus {
  totalFiles: number;
  encryptedFiles: number;
  pendingEncryption: number;
  failedEncryption: number;
  encryptionProgress: number
}

interface DataEncryptionProps {
  className?: string;
  onConfigChange?: (config: EncryptionConfig) => void;
  onKeyChange?: (key: EncryptionKey) => void;
  onEncryptionStart?: (files: string[]) => void;
  onEncryptionExport?: (data: { configs: EncryptionConfig[], keys: EncryptionKey[, ],}) => void;
}

// Mock data
const defaultConfigs: EncryptionConfig[] = [
  {
    id: 'aes-256-gcm',
    name: 'AES-256-GC',
    algorithm: 'AES-25',
    keySize: 26,
    mode: 'GC',
    enabled: true,
    description: 'Advanced Encryption Standard with Galois/Counter Mode',
    strength: 'maximum'
},
  {
    id: 'rsa-409',
    name: 'RSA-409',
    algorithm: 'RSA-409',
    keySize: 406,
    mode: 'CB',
    enabled: true,
    description: 'Rivest-Shamir-Adleman with 4096-bit keys',
    strength: 'high'
},
  {
    id: 'chacha2',
    name: 'ChaCha2',
    algorithm: 'ChaCha2',
    keySize: 26,
    mode: 'CT',
    enabled: false,
    description: 'Stream cipher with 256-bit keys',
    strength: 'high'
}
];

const defaultKeys: EncryptionKey[] = [
  {
    id: 'key',
    name: 'Master Key',
    algorithm: 'AES-25',
    keySize: 26,
    created: new Date('2024-01-01', ),
    expires: new Date('2025-01-01,', ),
    status: 'active',
    usage: ['documents', 'media','database']
},
  {
    id: 'key',
    name: 'Backup Key',
    algorithm: 'RSA-409',
    keySize: 406,
    created: new Date('2024-01-15,', ),
    status: 'active',
    usage: ['authentication','signing']
}
];

const DataEncryption: React.FC<DataEncryptionProps> = ({
  className =', ',
  onConfigChange,
  onKeyChange,
  onEncryptionStart,
  onEncryptionExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedConfig, setSelectedConfig] = useState<EncryptionConfig | null>(null);
  const [selectedKey, setSelectedKey] = useState<EncryptionKey | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [configs, setConfigs] = useState<EncryptionConfig[]>(defaultConfigs);
  const [keys, setKeys] = useState<EncryptionKey[]>(defaultKeys);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus>({
    totalFiles: 100,
    encryptedFiles: 70,
    pendingEncryption: 20,
    failedEncryption:  50,
    encryptionProgress: 75 });
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionLog, setEncryptionLog] = useState<any[]>([]);

  // Handlers
  const handleConfigSelect = useCallback((config: EncryptionConfig) => {
    setSelectedConfig(config);
    onConfigChange?.(config);
}, [onConfigChange]);

  const handleKeySelect = useCallback((key: EncryptionKey) => {
    setSelectedKey(key);
    onKeyChange?.(key);
}, [onKeyChange]);

  const handleConfigEdit = useCallback((config: EncryptionConfig) => {
    setSelectedConfig(config);
    setShowConfigEditor(true);
}, []);

  const handleKeyEdit = useCallback((key: EncryptionKey) => {
    setSelectedKey(key);
    setShowKeyEditor(true);
}, []);

  const handleConfigSave = useCallback(() => {
    if (selectedConfig) {
      const existingIndex = configs.findIndex(c => c.id === selectedConfig.id);
      if (existingIndex >= 0) {
        setConfigs(prev => prev.map((c, i) => i === existingIndex ? selectedConfig : c));
    } else {
        setConfigs(prev => [...prev, selectedConfig]);
    }
      setShowConfigEditor(false);
  }
}, [selectedConfig, configs]);

  const handleKeySave = useCallback(() => {
    if (selectedKey) {
      const existingIndex = keys.findIndex(k => k.id === selectedKey.id);
      if (existingIndex >= 0) {
        setKeys(prev => prev.map((k, i) => i === existingIndex ? selectedKey : k));
    } else {
        setKeys(prev => [...prev, selectedKey]);
    }
      setShowKeyEditor(false);
  }
}, [selectedKey, keys]);

  const handleEncryptionStart = useCallback(() => {
    setIsEncrypting(true);
    onEncryptionStart?.(['file1.pdf','file2.docx','file3.jpg']);
    
    // Simulate encryption process
    setTimeout(() => {
      setIsEncrypting(false);
      setEncryptionStatus(prev => ({
        ...prev,
        encryptedFiles: prev.encryptedFiles +, 3,
        pendingEncryption: Math.max, (prev.pendingEncryption - 3)
    }));
  }, 3000);
}, [onEncryptionStart]);

  const handleEncryptionExport = useCallback(() => {
    onEncryptionExport?.({ configs, keys });
}, [configs, keys, onEncryptionExport]);

  const getAlgorithmIcon = useCallback((algorithm: string) => {
    switch (algorithm) {
      case 'AES-256': return <CREATOR_HUB_ICONS.security />;
      case 'RSA-4096': return <CREATOR_HUB_ICONS.key />;
      case 'ChaCha20': return <CREATOR_HUB_ICONS.lock />;
      case 'Twofish': return <CREATOR_HUB_ICONS.shield />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStrengthColor = useCallback((strength: string) => {
    switch (strength) {
      case 'low': return 'error';
      case 'medium': return 'warning';
      case 'high': return 'info';
      case 'maximum': return 'success';
      default: return 'default';
}
}, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'active': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'expired': return <CREATOR_HUB_ICONS.warning />;
      case 'revoked': return <CREATOR_HUB_ICONS.error />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  // Memoized data
  const encryptionStats = useMemo(() => {
    const totalConfigs = configs.length;
    const activeConfigs = configs.filter(c => c.enabled).length;
    const totalKeys = keys.length;
    const activeKeys = keys.filter(k => k.status === 'active').length;
    
    return { totalConfigs, activeConfigs, totalKeys, activeKeys };
}, [configs, keys]);

  const recentActivity = useMemo(() => {
    return [
      { id: 1, action: 'File encrypted', file: 'document.pdf', timestamp: new Date(), status: 'success',},
      { id: 2, action: 'Key generated', key: 'Master Key', timestamp: new Date(), status: 'success',},
      { id:  3, action: 'Encryption failed', file: 'large_file.zip', timestamp: new Date(), status: 'error',},
    ];
}, []);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.security sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Data Encryption</Typography>
              <Typography variant="body2" color="text.secondary">
                Advanced encryption and security management
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedConfig({
                  id: `config-${Date.now()}`,
                  name: 'New Config',
                  algorithm: 'AES-25',
                  keySize: 26,
                  mode: 'GC',
                  enabled: true,
                  description: 'Custom encryption configuration',
                  strength: 'high'
            });
                setShowConfigEditor(true);
            }}
            >
              New Config
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
              onClick={handleEncryptionExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.security sx={{ fontSize:  40, color: 'primary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{encryptionStats.totalConfigs}</Typography>
                  <Typography variant="body2" color="text.secondary">Encryption Configs</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.key sx={{ fontSize:  40, color: 'secondary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{encryptionStats.totalKeys}</Typography>
                  <Typography variant="body2" color="text.secondary">Encryption Keys</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.checkCircle sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{encryptionStatus.encryptedFiles}</Typography>
                  <Typography variant="body2" color="text.secondary">Encrypted Files</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.timeline sx={{ fontSize:  40, color: 'warning.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{encryptionStatus.pendingEncryption}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Encryption Progress */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Encryption Progress
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={encryptionStatus.encryptionProgress}
          sx={{ mb: 2, height:  8, borderRadius:  4 }}
        />
        <Stack direction="row" spacing={4} justifyContent="space-between">
          <Typography variant="body2">
            {encryptionStatus.encryptedFiles} of {encryptionStatus.totalFiles} files encrypted
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {encryptionStatus.encryptionProgress}% complete
          </Typography>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Configurations" icon={<CREATOR_HUB_ICONS.settings />} />
        <Tab label="Keys" icon={<CREATOR_HUB_ICONS.key />} />
        <Tab label="Encryption" icon={<CREATOR_HUB_ICONS.security />} />
        <Tab label="Activity" icon={<CREATOR_HUB_ICONS.history />} />
      </Tabs>

      {/* Configurations Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {configs.map((config) => (
            <Grid item xs={12} sm={6} md={4} key={config.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedConfig?.id === config.id ? 2 : 0,
                  borderColor: selectedConfig?.id === config.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleConfigSelect(config)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getAlgorithmIcon(config.algorithm)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {config.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {config.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={config.algorithm}
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          label={`${config.keySize}-bit`}
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={config.strength}
                          size="small" 
                          color={getStrengthColor(config.strength) as any}
                        />
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfigEdit(config);
                        }}
                        >
                          Edit
                        </Button>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.enabled}
                              onChange={(e) => {
                                e.stopPropagation();
                                setConfigs(prev => prev.map(c => 
                                  c.id === config.id ? { ...c, enabled: e.target.checked } : c
                                ));
                            }}
                            />
                        }
                          label="Enabled"
                        />
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Keys Tab */}
      {activeTab === 1 && (
        <Grid container spacing={2}>
          {keys.map((key) => (
            <Grid item xs={12} sm={6} md={4} key={key.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedKey?.id === key.id ? 2 : 0,
                  borderColor: selectedKey?.id === key.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleKeySelect(key)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getAlgorithmIcon(key.algorithm)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {key.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {key.algorithm} • {key.keySize}-bit
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          icon={getStatusIcon(key.status)}
                          label={key.status}
                          size="small" 
                          color={key.status === 'active' ? 'success' : key.status === 'expired' ? 'warning' : 'error'}
                        />
                        <Chip 
                          label={`${key.usage.length} uses`}
                          size="small" 
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        Created: {key.created.toLocaleDateString()}
                        {key.expires && ` • Expires: ${key.expires.toLocaleDateString()}`}
                      </Typography>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKeyEdit(key);
                        }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<CREATOR_HUB_ICONS.delete />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setKeys(prev => prev.filter(k => k.id !== key.id));
                        }}
                        >
                          Revoke
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Encryption Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Encryption Operations
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Start Encryption
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Encrypt files using the selected configuration
                  </Typography>
                  <Button variant="contained"
                    startIcon={<CREATOR_HUB_ICONS.security sx={theming.getThemedButtonSx()} />}
                    onClick={handleEncryptionStart}
                    disabled={isEncrypting}
                    fullWidth
                  >
                    {isEncrypting ? 'Encrypting...' : 'Start Encryption'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Encryption Status
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Files
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {encryptionStatus.totalFiles}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Encrypted
                      </Typography>
                      <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                        {encryptionStatus.encryptedFiles}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Pending
                      </Typography>
                      <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                        {encryptionStatus.pendingEncryption}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Failed
                      </Typography>
                      <Typography variant="h6" color="error.main" sx={{ color: theming.colors.primary }}>
                        {encryptionStatus.failedEncryption}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Activity Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Encryption Activity
          </Typography>
          <List>
            {recentActivity.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  <CREATOR_HUB_ICONS.history />
                </ListItemIcon>
                <ListItemText
                  primary={activity.action}
                  secondary={`${activity.file || activity.key} • ${activity.timestamp.toLocaleString()}`}
                />
                <Chip 
                  label={activity.status}
                  size="small" 
                  color={activity.status === 'success' ? 'success' : 'error'}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Config Editor Dialog */}
      <Dialog open={showConfigEditor} onClose={() => setShowConfigEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedConfig?.id.startsWith('config-') ? 'Create Configuration' : 'Edit Configuration'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedConfig && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Configuration Name"
                value={selectedConfig.name}
                onChange={(e) => setSelectedConfig(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedConfig.description}
                onChange={(e) => setSelectedConfig(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>Algorithm</InputLabel>
                <Select
                  value={selectedConfig.algorithm}
                  onChange={(e) => setSelectedConfig(prev => prev ? { ...prev, algorithm: e.target.value as any } : null)}
                >
                  <MenuItem value="AES-256">AES-256</MenuItem>
                  <MenuItem value="RSA-4096">RSA-4096</MenuItem>
                  <MenuItem value="ChaCha20">ChaCha20</MenuItem>
                  <MenuItem value="Twofish">Twofish</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Mode</InputLabel>
                <Select
                  value={selectedConfig.mode}
                  onChange={(e) => setSelectedConfig(prev => prev ? { ...prev, mode: e.target.value as any } : null)}
                >
                  <MenuItem value="CBC">CBC</MenuItem>
                  <MenuItem value="GCM">GCM</MenuItem>
                  <MenuItem value="CTR">CTR</MenuItem>
                  <MenuItem value="OFB">OFB</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Strength</InputLabel>
                <Select
                  value={selectedConfig.strength}
                  onChange={(e) => setSelectedConfig(prev => prev ? { ...prev, strength: e.target.value as any } : null)}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="maximum">Maximum</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedConfig.enabled}
                    onChange={(e) => setSelectedConfig(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                  />
              }
                label="Enabled"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfigEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleConfigSave}
           sx={theming.getThemedButtonSx()}>
            {selectedConfig?.id.startsWith('config-') ? 'Create' : 'Update'} Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Key Editor Dialog */}
      <Dialog open={showKeyEditor} onClose={() => setShowKeyEditor(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.key />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedKey?.id.startsWith('key-') ? 'Create Key' : 'Edit Key'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedKey && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Key Name"
                value={selectedKey.name}
                onChange={(e) => setSelectedKey(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Algorithm</InputLabel>
                <Select
                  value={selectedKey.algorithm}
                  onChange={(e) => setSelectedKey(prev => prev ? { ...prev, algorithm: e.target.value } : null)}
                >
                  <MenuItem value="AES-256">AES-256</MenuItem>
                  <MenuItem value="RSA-4096">RSA-4096</MenuItem>
                  <MenuItem value="ChaCha20">ChaCha20</MenuItem>
                  <MenuItem value="Twofish">Twofish</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedKey.status}
                  onChange={(e) => setSelectedKey(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="revoked">Revoked</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKeyEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleKeySave}
           sx={theming.getThemedButtonSx()}>
            {selectedKey?.id.startsWith('key-') ? 'Create' : 'Update'} Key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataEncryption;

