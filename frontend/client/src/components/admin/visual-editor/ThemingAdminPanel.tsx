/**
 * Theming Admin Panel
 * Provides UI for administrating the centralized theming helper
 * Connected to ThemingAdminService for dynamic branding management
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  IconButton,
  Chip,
  Alert,
  Collapse,
  Divider,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Edit,
  RestartAlt,
  Download,
  Upload,
  Save,
  Close,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { themingAdminService } from '../../../services/ThemingAdminService';
import type { ProfessionBranding } from '../../../utils/theming-helper';
import { PROFESSION_BRANDING } from '../../../utils/theming-helper';

export const ThemingAdminPanel: React.FC = () => {
  const [editingProfession, setEditingProfession] = useState<string | null>(null);
  const [professionEdits, setProfessionEdits] = useState<Partial<ProfessionBranding>>({});
  const [stats, setStats] = useState(themingAdminService.getStats());
  const [updateKey, setUpdateKey] = useState(0); // Force re-render
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type: 'reset' | 'resetAll'; profession?: string }>({ open: false, type: 'reset' });

  // Enhanced Master Integration
  const { analytics, performance, debugging, lifecycle } = useEnhancedMasterIntegration();

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('theming_admin_panel_init');
    
    lifecycle.registerComponent({
      id: 'theming-admin-panel',
      type: 'admin-panel',
      version: '1.0.0',
      capabilities: {
        data: ['branding:read','branding:write','branding:export','branding:import'],
        events: ['branding:updated','branding:reset','branding:imported','branding:exported'],
        actions: ['edit','save','reset','export','import'],
        ui: ['profession-editor','color-picker','label-editor'],
        system: ['localStorage-integration']
      },
      dependencies: ['theming-admin-service','theming-helper'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    analytics.trackEvent('theming_admin_panel_opened', {
      customizedProfessions: stats.customizedProfessions,
      totalProfessions: stats.totalProfessions,
      timestamp: Date.now()
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('theming-admin-panel');
    };
  }, []);

  // Listen for updates and track analytics
  useEffect(() => {
    const unsubscribe = themingAdminService.addUpdateListener(() => {
      const newStats = themingAdminService.getStats();
      setStats(newStats);
      setUpdateKey(prev => prev + 1);
      
      analytics.trackEvent('theming_updated_external', {
        customizedCount: newStats.customizedProfessions,
        customizationRate: newStats.customizationRate
      });
    });
    return unsubscribe;
  }, [analytics]);

  const handleEdit = (profession: string) => {
    const current = themingAdminService.getProfessionBranding(profession);
    setProfessionEdits({
      color: current.color,
      label: current.label,
      labelEn: current.labelEn,
      emoji: current.emoji,
      description: current.description
    });
    setEditingProfession(profession);
  };

  const handleSave = () => {
    if (editingProfession) {
      const endTiming = performance.startTiming('theming_branding_save');
      
      const oldBranding = themingAdminService.getProfessionBranding(editingProfession);
      themingAdminService.updateProfessionBranding(editingProfession, professionEdits);
      
      analytics.trackEvent('profession_branding_updated', {
        profession: editingProfession,
        changes: {
          color: professionEdits.color !== oldBranding.color,
          label: professionEdits.label !== oldBranding.label,
          labelEn: professionEdits.labelEn !== oldBranding.labelEn,
          emoji: professionEdits.emoji !== oldBranding.emoji,
          description: professionEdits.description !== oldBranding.description
        },
        oldColor: oldBranding.color,
        newColor: professionEdits.color,
        timestamp: Date.now()
      });
      
      debugging.logIntegration('info', `Profession branding updated: ${editingProfession}`, {
        profession: editingProfession,
        updates: professionEdits
      });
      
      setEditingProfession(null);
      setProfessionEdits({});
      endTiming();
    }
  };

  const handleReset = (profession: string) => {
    setConfirmDialog({ open: true, type: 'reset', profession });
  };

  const confirmReset = () => {
    const profession = confirmDialog.profession;
    if (profession) {
      themingAdminService.resetProfession(profession);
      
      analytics.trackEvent('profession_branding_reset', {
        profession,
        timestamp: Date.now()
      });
      
      debugging.logIntegration('info', `Profession branding reset: ${profession}`);
    }
    setConfirmDialog({ open: false, type: 'reset' });
  };

  const handleResetAll = () => {
    setConfirmDialog({ open: true, type: 'resetAll' });
  };

  const confirmResetAll = () => {
    const beforeStats = themingAdminService.getStats();
    themingAdminService.resetAll();
    
    analytics.trackEvent('all_branding_reset', {
      professionsReset: beforeStats.customizedProfessions,
      timestamp: Date.now()
    });
    
    debugging.logIntegration('warn','All profession branding reset to defaults', {
      professionsAffected: beforeStats.customizedProfessions
    });
    setConfirmDialog({ open: false, type: 'resetAll' });
  };

  const handleExport = () => {
    const endTiming = performance.startTiming('theming_config_export');
    
    themingAdminService.downloadConfig();
    
    analytics.trackEvent('theming_config_exported', {
      customizedProfessions: stats.customizedProfessions,
      customizationRate: stats.customizationRate,
      timestamp: Date.now()
    });
    
    debugging.logIntegration('info','Theming configuration exported', {
      customizedCount: stats.customizedProfessions
    });
    
    endTiming();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const endTiming = performance.startTiming('theming_config_import');
        const success = await themingAdminService.importFromFile(file);
        
        if (success) {
          const newStats = themingAdminService.getStats();
          
          analytics.trackEvent('theming_config_imported', {
            filename: file.name,
            customizedProfessions: newStats.customizedProfessions,
            success: true,
            timestamp: Date.now()
          });
          
          debugging.logIntegration('info','Theming configuration imported successfully', {
            filename: file.name,
            customizedCount: newStats.customizedProfessions
          });
          
          setSnackbar({ open: true, message: 'Branding configuration imported successfully!', severity: 'success' });
        } else {
          analytics.trackEvent('theming_config_import_failed', {
            filename: file.name,
            success: false,
            timestamp: Date.now()
          });
          
          debugging.logIntegration('error', 'Failed to import theming configuration', {
            filename: file.name
          });
          
          setSnackbar({ open: true, message: 'Failed to import configuration. Please check the file format.', severity: 'error' });
        }
        
        endTiming();
      }
    };
    input.click();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            🎨 Theming Helper Administration
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage centralized profession branding used across all components
          </Typography>
        </Box>
        
        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip 
            label={`${stats.customizedProfessions}/${stats.totalProfessions} customized`}
            color={stats.customizedProfessions > 0 ? 'primary' : 'default'}
          />
          {stats.customizedProfessions > 0 && (
            <Chip 
              label={`${(stats.customizationRate * 100).toFixed(0)}% rate`}
              color="secondary"
            />
          )}
        </Box>
      </Box>

      {/* Global Actions */}
      <Card sx={{ mb: 3, bgcolor: 'warning.light', borderLeft: 4, borderColor: 'warning.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                Global Actions
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Export, import, or reset all profession branding
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download />}
                onClick={handleExport}
              >
                Export Config
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Upload />}
                onClick={handleImport}
              >
                Import Config
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<RestartAlt />}
                onClick={handleResetAll}
              >
                Reset All
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Profession List */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
        Profession Branding
      </Typography>

      <Box key={`profession-list-${updateKey}`}>
        {Object.keys(PROFESSION_BRANDING).map(profession => {
        const current = themingAdminService.getProfessionBranding(profession);
        const isEditing = editingProfession === profession;
        const hasCustomizations = themingAdminService.hasCustomizations(profession);

        return (
          <Card key={profession} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  {/* Icon */}
                  {React.createElement(current.icon, { 
                    sx: { fontSize: 40, color: current.color } 
                  })}
                  
                  {/* Info */}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6">{current.label}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {current.emoji} {profession}
                      </Typography>
                      {hasCustomizations && (
                        <Chip 
                          label="Customized" 
                          size="small" 
                          color="primary"
                          icon={<CheckCircle />}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 20, 
                          height: 20, 
                          bgcolor: current.color, 
                          borderRadius: 0.5,
                          border: '1px solid rgba(0,0,0,0.1)' 
                        }} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {current.color}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {current.labelEn}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {isEditing && professionEdits.color && !professionEdits.color.match(/^#[0-9A-Fa-f]{6}$/) && (
                    <Warning sx={{ color: 'error.main', fontSize: 20 }} titleAccess="Invalid color format" />
                  )}
                  <IconButton 
                    onClick={() => isEditing ? setEditingProfession(null) : handleEdit(profession)}
                    color={isEditing ? 'primary' : 'default'}
                  >
                    {isEditing ? <Close /> : <Edit />}
                  </IconButton>
                  {hasCustomizations && (
                    <IconButton 
                      onClick={() => handleReset(profession)}
                      color="warning"
                    >
                      <RestartAlt />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Edit Form */}
              <Collapse in={isEditing}>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Edit {current.label} Branding
                  </Typography>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
                    {/* Color Picker */}
                    <Box>
                      <Typography variant="caption" color="textSecondary" gutterBottom>
                        Primary Color
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <input
                          type="color"
                          value={professionEdits.color || current.color}
                          onChange={(e) => setProfessionEdits(prev => ({ ...prev, color: e.target.value }))}
                          style={{ 
                            width: 60, 
                            height: 40, 
                            border: '1px solid rgba(0,0,0,0.2)', 
                            borderRadius: 4, 
                            cursor: 'pointer' 
                          }}
                        />
                        <TextField
                          value={professionEdits.color || current.color}
                          onChange={(e) => setProfessionEdits(prev => ({ ...prev, color: e.target.value }))}
                          size="small"
                          sx={{ fontFamily: 'monospace' }}
                        />
                      </Box>
                    </Box>

                    {/* Emoji */}
                    <TextField
                      label="Emoji"
                      value={professionEdits.emoji || current.emoji}
                      onChange={(e) => setProfessionEdits(prev => ({ ...prev, emoji: e.target.value }))}
                      size="small"
                    />

                    {/* Norwegian Label */}
                    <TextField
                      label="Norwegian Label"
                      value={professionEdits.label || current.label}
                      onChange={(e) => setProfessionEdits(prev => ({ ...prev, label: e.target.value }))}
                      size="small"
                    />

                    {/* English Label */}
                    <TextField
                      label="English Label"
                      value={professionEdits.labelEn || current.labelEn}
                      onChange={(e) => setProfessionEdits(prev => ({ ...prev, labelEn: e.target.value }))}
                      size="small"
                    />

                    {/* Description */}
                    <TextField
                      label="Description"
                      value={professionEdits.description || current.description}
                      onChange={(e) => setProfessionEdits(prev => ({ ...prev, description: e.target.value }))}
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      sx={{ gridColumn: '1 / -1' }}
                    />
                  </Box>

                  {/* Save/Cancel Buttons */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setEditingProfession(null);
                        setProfessionEdits({});
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Save />}
                      onClick={handleSave}
                      sx={{ 
                        bgcolor: professionEdits.color || current.color,
                        '&:hover': { bgcolor: professionEdits.color || current.color, opacity: 0.9 }
                      }}
                    >
                      Save Changes
                    </Button>
                  </Box>
                </Box>
              </Collapse>

              {/* Description */}
              {!isEditing && current.description && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {current.description}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>💡 Tip:</strong> Changes apply instantly across all components using the theming helper 
          (PrototypeFeedbackPanel, PrototypeTesterModal, etc.). Customizations are saved to localStorage 
          and persist across sessions.
        </Typography>
      </Alert>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, type: 'reset' })}
      >
        <DialogTitle>
          {confirmDialog.type === 'resetAll' ? 'Reset All Branding' : 'Reset Branding'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.type === 'resetAll'
              ? 'Reset ALL profession branding to defaults? This cannot be undone.'
              : `Reset ${confirmDialog.profession} branding to default?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, type: 'reset' })}>
            Cancel
          </Button>
          <Button
            onClick={confirmDialog.type === 'resetAll' ? confirmResetAll : confirmReset}
            color="error"
            variant="contained"
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ThemingAdminPanel;
