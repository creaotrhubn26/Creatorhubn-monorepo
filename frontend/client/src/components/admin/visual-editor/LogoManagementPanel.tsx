/**
 * Logo Management Panel
 * Upload, manage, and configure logo placement across the application
 * 
 * Features:
 * - Upload primary, secondary, favicon, and dark mode logos
 * - Configure placement (navbar, sidebar, footer, modals, emails, invoices, contracts, reports)
 * - Set dimensions and alignment
 * - Live preview
 * - Export/Import logo configs
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  IconButton,
  Tooltip,
  Grid,
  Alert,
  Chip,
  Divider,
  Tab,
  Tabs,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  Dashboard as DashboardIcon,
  Email as EmailIcon,
  Description as DocumentIcon,
  Assessment as ReportIcon,
  ViewSidebar as SidebarIcon,
  ViewDay as NavbarIcon,
} from '@mui/icons-material';
import { useCreatorHubBranding } from '../../../hooks/useCreatorHubBranding';

interface LogoManagementPanelProps {
  open: boolean;
  onClose: () => void;
}

export const LogoManagementPanel: React.FC<LogoManagementPanelProps> = ({ open, onClose }) => {
  const branding = useCreatorHubBranding({ persist: true });
  const [activeTab, setActiveTab] = useState(0);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(branding.logo?.alignment || 'left');
  const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const darkModeInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'primary' | 'secondary' | 'favicon' | 'darkMode'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorSnackbar({ open: true, message: 'Please upload an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorSnackbar({ open: true, message: 'File size should be less than 5MB' });
      return;
  }

    await branding.uploadLogo(file, type);
};

  const placementConfig = [
    { key: 'navbar' as const, label: 'Navigation Bar', icon: <NavbarIcon /> },
    { key: 'sidebar' as const, label: 'Sidebar', icon: <SidebarIcon /> },
    { key: 'footer' as const, label: 'Footer', icon: <DashboardIcon /> },
    { key: 'modals' as const, label: 'Modals & Dialogs', icon: <SidebarIcon /> },
    { key: 'emails' as const, label: 'Email Templates', icon: <EmailIcon /> },
    { key: 'invoices' as const, label: 'Invoices', icon: <DocumentIcon /> },
    { key: 'contracts' as const, label: 'Contracts', icon: <DocumentIcon /> },
    { key: 'reports' as const, label: 'Reports', icon: <ReportIcon /> },
  ];

  const exportLogoConfig = () => {
    const config = branding.exportConfig();
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `creatorhub-logo-config-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
};

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '600px',
        height: '100vh',
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 3,
        overflowY: 'auto',
        zIndex: 1300
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          🎨 Logo Management
        </Typography>
        <Button onClick={onClose} variant="outlined">Close</Button>
      </Box>

      {/* Upload Status */}
      {branding.uploadingLogo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography>Uploading logo...</Typography>
          </Box>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Upload Logos" />
        <Tab label="Placement" />
        <Tab label="Dimensions" />
        <Tab label="Preview" />
      </Tabs>

      {/* Tab 1: Upload Logos */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Upload Logo Files</Typography>
          
          <Grid container spacing={3}>
            {/* Primary Logo */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Primary Logo</Typography>
                      <Typography variant="caption" color="textSecondary">Main logo for light mode</Typography>
                    </Box>
                    {branding.logo?.primary && (
                      <IconButton onClick={() => branding.removeLogo('primary')} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  
                  {branding.logo?.primary ? (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <img 
                        src={branding.logo.primary} 
                        alt="Primary Logo" 
                        style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }}
                      />
                    </Box>
                  ) : (
                    <Box 
                      sx={{ 
                        border: '2px dashed #ccc', 
                        borderRadius: 2, 
                        p: 3, 
                        textAlign: 'center',
                        cursor: 'pointer',
                        '&:hover': { borderColor: branding.color }
                      }}
                      onClick={() => primaryInputRef.current?.click()}
                    >
                      <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography color="textSecondary">Click to upload</Typography>
                    </Box>
                  )}
                  
                  <input
                    ref={primaryInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'primary')}
                  />
                  
                  {!branding.logo?.primary && (
                    <Button 
                      variant="outlined" 
                      startIcon={<UploadIcon />}
                      fullWidth
                      onClick={() => primaryInputRef.current?.click()}
                    >
                      Upload Primary Logo
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Secondary Logo */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Secondary Logo</Typography>
                      <Typography variant="caption" color="textSecondary">Alternative logo variant</Typography>
                    </Box>
                    {branding.logo?.secondary && (
                      <IconButton onClick={() => branding.removeLogo('secondary')} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  
                  {branding.logo?.secondary ? (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <img 
                        src={branding.logo.secondary} 
                        alt="Secondary Logo" 
                        style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }}
                      />
                    </Box>
                  ) : null}
                  
                  <input
                    ref={secondaryInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'secondary')}
                  />
                  
                  <Button 
                    variant="outlined" 
                    startIcon={<UploadIcon />}
                    fullWidth
                    onClick={() => secondaryInputRef.current?.click()}
                  >
                    {branding.logo?.secondary ? 'Replace' : 'Upload'} Secondary Logo
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Dark Mode Logo */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Dark Mode Logo</Typography>
                      <Typography variant="caption" color="textSecondary">Logo for dark theme</Typography>
                    </Box>
                    {branding.logo?.darkMode && (
                      <IconButton onClick={() => branding.removeLogo('darkMode')} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  
                  {branding.logo?.darkMode ? (
                    <Box sx={{ textAlign: 'center', mb: 2, bgcolor: '#1a1a1a', p: 2, borderRadius: 2 }}>
                      <img 
                        src={branding.logo.darkMode} 
                        alt="Dark Mode Logo" 
                        style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }}
                      />
                    </Box>
                  ) : null}
                  
                  <input
                    ref={darkModeInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'darkMode')}
                  />
                  
                  <Button 
                    variant="outlined" 
                    startIcon={<UploadIcon />}
                    fullWidth
                    onClick={() => darkModeInputRef.current?.click()}
                  >
                    {branding.logo?.darkMode ? 'Replace' : 'Upload'} Dark Mode Logo
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Favicon */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600}}>Favicon</Typography>
                      <Typography variant="caption" color="textSecondary">Browser tab icon (16x16 or 32x32)</Typography>
                    </Box>
                    {branding.logo?.favicon && (
                      <IconButton onClick={() => branding.removeLogo('favicon')} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  
                  {branding.logo?.favicon ? (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <img 
                        src={branding.logo.favicon} 
                        alt="Favicon" 
                        style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                      />
                    </Box>
                  ) : null}
                  
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'favicon')}
                  />
                  
                  <Button 
                    variant="outlined" 
                    startIcon={<UploadIcon />}
                    fullWidth
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    {branding.logo?.favicon ? 'Replace' : 'Upload'} Favicon
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Tab 2: Placement */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Logo Placement Configuration
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Choose where your logo should appear across the application
          </Typography>

          <List>
            {placementConfig.map((config) => (
              <ListItem key={config.key} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {config.icon}
                      <Typography variant="body1">{config.label}</Typography>
                    </Box>
                  }
                  secondary={`Show logo in ${config.label.toLowerCase()}`}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={branding.logo?.placement?.[config.key] ?? false}
                    onChange={(e) => branding.updateLogoPlacement({ [config.key]: e.target.checked })}
                    color="primary"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 3 }} />

          {/* Alignment */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Logo Alignment</InputLabel>
            <Select
              value={alignment}
              onChange={(e) => {
                const newAlignment = e.target.value as 'left' | 'center' | 'right';
                setAlignment(newAlignment);
                branding.updateLogoPlacement(branding.logo?.placement || {});
            }}
              label="Logo Alignment"
            >
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="right">Right</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Tab 3: Dimensions */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Logo Dimensions
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Set custom dimensions for your logo
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Width (px)"
                type="number"
                value={branding.logo?.dimensions?.width || ''}
                onChange={(e) => branding.updateLogoDimensions({
                  ...branding.logo?.dimensions,
                  width: parseInt(e.target.value) || undefined
                })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Height (px)"
                type="number"
                value={branding.logo?.dimensions?.height || ''}
                onChange={(e) => branding.updateLogoDimensions({
                  ...branding.logo?.dimensions,
                  height: parseInt(e.target.value) || undefined
              })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Max Width (px)"
                type="number"
                value={branding.logo?.dimensions?.maxWidth || 200}
                onChange={(e) => branding.updateLogoDimensions({
                  ...branding.logo?.dimensions,
                  maxWidth: parseInt(e.target.value) || 200
              })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Max Height (px)"
                type="number"
                value={branding.logo?.dimensions?.maxHeight || 60}
                onChange={(e) => branding.updateLogoDimensions({
                  ...branding.logo?.dimensions,
                  maxHeight: parseInt(e.target.value) || 60
              })}
              />
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            Leave width/height empty for automatic sizing. Max dimensions ensure responsiveness.
          </Alert>
        </Box>
      )}

      {/* Tab 4: Preview */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Logo Preview
          </Typography>

          {!branding.hasLogo ? (
            <Alert severity="warning">
              No logo uploaded yet. Upload a logo in the "Upload Logos" tab.
            </Alert>
          ) : (
            <>
              {/* Navbar Preview */}
              {branding.logo?.placement?.navbar && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Navigation Bar</Typography>
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                      <img {...branding.getLogoProps('navbar')} />
                    </Paper>
                  </CardContent>
                </Card>
              )}

              {/* Modal Preview */}
              {branding.logo?.placement?.modals && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Modal Dialog</Typography>
                    <Paper sx={{ p: 3, border: '1px solid #ddd' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <img {...branding.getLogoProps('modals')} />
                        <Typography sx={{ mt: 2 }}>Modal Content</Typography>
                      </Box>
                    </Paper>
                  </CardContent>
                </Card>
              )}

              {/* Email Preview */}
              {branding.logo?.placement?.emails && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Email Template</Typography>
                    <Paper sx={{ p: 2, bgcolor: '#fff', border: '1px solid #ddd' }}>
                      <img {...branding.getLogoProps('emails')} />
                      <Typography sx={{ mt: 2, fontSize: 14 }}>
                        Dear Customer,<br />
                        Thank you for choosing our services...
                      </Typography>
                    </Paper>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={exportLogoConfig}
          disabled={!branding.hasLogo}
        >
          Export Config
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            branding.saveDraft({
              name: `Logo Config ${new Date().toLocaleString()}`,
              description: 'Logo configuration with placement',
              logo: branding.logo ?? undefined
          });
        }}
          disabled={!branding.hasLogo}
        >
          Save Draft
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            branding.publishPreset(branding.activePresetId ||'');
        }}
          disabled={!branding.hasLogo || !branding.activePresetId}
        >
          Publish
        </Button>
      </Box>

      {/* Status */}
      {branding.hasUnsavedChanges && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          You have unsaved changes. Save or publish to apply them.
        </Alert>
      )}

      {/* Error Snackbar */}
      <Snackbar
        open={errorSnackbar.open}
        autoHideDuration={5000}
        onClose={() => setErrorSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setErrorSnackbar({ open: false, message: '' })}
          severity="error"
          sx={{ width: '100%' }}
        >
          {errorSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};




