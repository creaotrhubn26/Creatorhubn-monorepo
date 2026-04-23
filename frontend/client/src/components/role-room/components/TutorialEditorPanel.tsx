import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Typography, Button, IconButton, Paper, TextField, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Chip, Divider, Grid, Tooltip, Collapse, Alert, useMediaQuery, useTheme, SwipeableDrawer } from "@mui/material";
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ContentCopy as DuplicateIcon, DragIndicator as DragIcon, ExpandMore as ExpandIcon, ExpandLess as CollapseIcon, PlayArrow as PreviewIcon, Save as _SaveIcon, Close as CloseIcon, School as TutorialIcon, ArrowUpward as MoveUpIcon, ArrowDownward as MoveDownIcon, Check as ActiveIcon, Menu as MenuIcon, ArrowBack as BackIcon } from "@mui/icons-material";
import { tutorialService, type Tutorial, type TutorialStep } from "../services/tutorialService";

interface TutorialEditorPanelProps {
  open: boolean;
  onClose: () => void;
  onPreviewTutorial?: (tutorial: Tutorial) => void;
}

const panelOptions = [
  { value: -1, label: 'Ingen (fullskjerm)' },
  { value: 0, label: 'Oversikt' },
  { value: 1, label: 'Roller' },
  { value: 2, label: 'Kandidater' },
  { value: 3, label: 'Team' },
  { value: 4, label: 'Lokasjoner' },
  { value: 5, label: 'Utstyr' },
  { value: 6, label: 'Kalender' },
  { value: 7, label: 'Shot-list' },
  { value: 8, label: 'Auditions' },
  { value: 9, label: 'Deling' },
];

const actionOptions = [
  { value: '', label: 'Ingen handling' },
  { value: 'click', label: 'Klikk' },
  { value: 'hover', label: 'Hover' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'drag', label: 'Dra' },
  { value: 'type', label: 'Skriv' },
];

const categoryOptions = [
  { value: 'casting-planner', label: 'Produksjonsteam' },
  { value: 'content-producer', label: 'Innholdsprodusent' },
  { value: 'studio', label: 'Studio' },
  { value: 'academy', label: 'Academy' },
  { value: 'general', label: 'Generell' },
];

export const TutorialEditorPanel: React.FC<TutorialEditorPanelProps> = ({
  open,
  onClose,
  onPreviewTutorial,
}) => {
  const _theme = useTheme();
  const isMobile = useMediaQuery('(max-width:599px)');
  const isTablet = useMediaQuery('(min-width:600px) and (max-width:959px)');
  const is720p = useMediaQuery('(min-width:960px) and (max-width:1279px)');
  const is1080p = useMediaQuery('(min-width:1280px) and (max-width:1919px)');
  const is2K = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const isHiDPI = useMediaQuery('(min-width:2560px) and (max-width:3599px)');
  const is4K = useMediaQuery('(min-width:3600px)');
  const showMobileMenu = useMediaQuery('(max-width:959px)');

  const getResponsiveValue = useCallback(<T,>(mobile: T, tablet: T, hd720: T, hd1080: T, qhd2k: T, hiDPI: T, uhd4k: T): T => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    if (is720p) return hd720;
    if (is1080p) return hd1080;
    if (is2K) return qhd2k;
    if (isHiDPI) return hiDPI;
    return uhd4k;
  }, [isMobile, isTablet, is720p, is1080p, is2K, isHiDPI, is4K]);

  const responsiveTokens = useMemo(() => ({
    buttonMinHeight: getResponsiveValue(44, 44, 40, 42, 48, 52, 58),
    iconButtonSize: getResponsiveValue(44, 44, 36, 40, 48, 52, 58),
    fontSize: {
      title: getResponsiveValue('1rem', '1.1rem', '1.15rem', '1.25rem', '1.5rem', '1.65rem', '1.85rem'),
      body: getResponsiveValue('0.875rem', '0.9rem', '0.95rem', '1rem', '1.1rem', '1.2rem', '1.35rem'),
      caption: getResponsiveValue('0.7rem', '0.75rem', '0.8rem', '0.85rem', '0.95rem', '1.05rem', '1.15rem'),
      button: getResponsiveValue('0.75rem', '0.8rem', '0.85rem', '0.9rem', '1rem', '1.1rem', '1.2rem'),
    },
    spacing: getResponsiveValue(1.5, 2, 2, 2.5, 3, 3.5, 4),
    sidebarWidth: getResponsiveValue(280, 300, 280, 320, 380, 420, 480),
    chipHeight: getResponsiveValue(24, 26, 26, 28, 32, 36, 40),
    iconSize: getResponsiveValue(18, 20, 20, 22, 26, 28, 32),
    logoSize: getResponsiveValue(32, 36, 36, 40, 48, 52, 58),
  }), [getResponsiveValue]);

  const { buttonMinHeight, iconButtonSize, fontSize, spacing, sidebarWidth, chipHeight, iconSize, logoSize } = responsiveTokens;

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [editingStep, setEditingStep] = useState<TutorialStep | null>(null);
  const [isCreatingTutorial, setIsCreatingTutorial] = useState(false);
  const [isCreatingStep, setIsCreatingStep] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [tutorialForm, setTutorialForm] = useState({
    name: '',
    description: '',
    category: 'casting-planner' as Tutorial['category'],
  });

  const [stepForm, setStepForm] = useState<Partial<TutorialStep>>({
    title: '',
    description: '',
    panel: -1,
    targetSelector: '',
    action: undefined,
    actionDescription: '',
    tips: [],
    duration: 5000,
  });

  const [newTip, setNewTip] = useState('');

  useEffect(() => {
    if (open) {
      loadTutorials();
    }
  }, [open]);

  const loadTutorials = useCallback(() => {
    setTutorials(tutorialService.getAllTutorials());
  }, []);

  const showSaveMessage = useCallback((message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 3000);
  }, []);

  const handleCreateTutorial = useCallback(() => {
    if (!tutorialForm.name.trim()) return;

    const newTutorial = tutorialService.createTutorial({
      name: tutorialForm.name,
      description: tutorialForm.description,
      category: tutorialForm.category,
      steps: [],
      isActive: false,
    });

    setTutorials(tutorialService.getAllTutorials());
    setSelectedTutorial(newTutorial);
    setIsCreatingTutorial(false);
    setTutorialForm({ name: '', description: '', category: 'casting-planner' });
    showSaveMessage('Veiledning opprettet');
  }, [tutorialForm, showSaveMessage]);

  const handleUpdateTutorial = useCallback((updates: Partial<Tutorial>) => {
    if (!selectedTutorial) return;

    tutorialService.updateTutorial(selectedTutorial.id, updates);
    loadTutorials();
    setSelectedTutorial(tutorialService.getTutorialById(selectedTutorial.id) || null);
    showSaveMessage('Veiledning oppdatert');
  }, [selectedTutorial, loadTutorials, showSaveMessage]);

  const handleDeleteTutorial = useCallback(async (id: string) => {
    if (!window.confirm('Er du sikker på at du vil slette denne veiledningen?')) return;

    try {
      await tutorialService.deleteTutorial(id);
      loadTutorials();
      if (selectedTutorial?.id === id) {
        setSelectedTutorial(null);
      }
      showSaveMessage('Veiledning slettet');
    } catch (error) {
      console.error('Failed to delete tutorial:', error);
    }
  }, [selectedTutorial, loadTutorials, showSaveMessage]);

  const handleDuplicateTutorial = useCallback(async (id: string) => {
    try {
      const duplicate = await tutorialService.duplicateTutorial(id);
      if (duplicate) {
        loadTutorials();
        setSelectedTutorial(duplicate);
        showSaveMessage('Veiledning duplisert');
      }
    } catch (error) {
      console.error('Failed to duplicate tutorial:', error);
    }
  }, [loadTutorials, showSaveMessage]);

  const handleSetActive = useCallback(async (id: string, category: Tutorial['category']) => {
    try {
      await tutorialService.setActiveTutorial(id, category);
      loadTutorials();
      showSaveMessage('Aktiv veiledning endret');
    } catch (error) {
      console.error('Failed to set active tutorial:', error);
    }
  }, [loadTutorials, showSaveMessage]);

  const resetStepForm = useCallback(() => {
    setStepForm({
      title: '',
      description: '',
      panel: -1,
      targetSelector: '',
      action: undefined,
      actionDescription: '',
      tips: [],
      duration: 5000,
    });
    setNewTip('');
  }, []);

  const handleCreateStep = useCallback(() => {
    if (!selectedTutorial || !stepForm.title?.trim()) return;

    tutorialService.addStep(selectedTutorial.id, {
      title: stepForm.title || '',
      description: stepForm.description || '',
      panel: stepForm.panel || -1,
      targetSelector: stepForm.targetSelector || undefined,
      action: stepForm.action || undefined,
      actionDescription: stepForm.actionDescription || undefined,
      tips: stepForm.tips || [],
      duration: stepForm.duration || 5000,
    });

    loadTutorials();
    setSelectedTutorial(tutorialService.getTutorialById(selectedTutorial.id) || null);
    setIsCreatingStep(false);
    resetStepForm();
    showSaveMessage('Steg opprettet');
  }, [selectedTutorial, stepForm, loadTutorials, resetStepForm, showSaveMessage]);

  const handleUpdateStep = useCallback(() => {
    if (!selectedTutorial || !editingStep) return;

    tutorialService.updateStep(selectedTutorial.id, editingStep.id, stepForm);
    loadTutorials();
    setSelectedTutorial(tutorialService.getTutorialById(selectedTutorial.id) || null);
    setEditingStep(null);
    resetStepForm();
    showSaveMessage('Steg oppdatert');
  }, [selectedTutorial, editingStep, stepForm, loadTutorials, resetStepForm, showSaveMessage]);

  const handleDeleteStep = useCallback((stepId: string) => {
    if (!selectedTutorial) return;
    if (!window.confirm('Er du sikker på at du vil slette dette steget?')) return;

    tutorialService.deleteStep(selectedTutorial.id, stepId);
    loadTutorials();
    setSelectedTutorial(tutorialService.getTutorialById(selectedTutorial.id) || null);
    showSaveMessage('Steg slettet');
  }, [selectedTutorial, loadTutorials, showSaveMessage]);

  const handleMoveStep = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    if (!selectedTutorial) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

    tutorialService.reorderSteps(selectedTutorial.id, fromIndex, toIndex);
    loadTutorials();
    setSelectedTutorial(tutorialService.getTutorialById(selectedTutorial.id) || null);
  }, [selectedTutorial, loadTutorials]);

  const startEditingStep = useCallback((step: TutorialStep) => {
    setEditingStep(step);
    setStepForm({
      title: step.title,
      description: step.description,
      panel: step.panel,
      targetSelector: step.targetSelector || '',
      action: step.action,
      actionDescription: step.actionDescription || '',
      tips: step.tips || [],
      duration: step.duration || 5000,
    });
  }, []);

  const addTip = useCallback(() => {
    if (!newTip.trim()) return;
    setStepForm(prev => ({
      ...prev,
      tips: [...(prev.tips || []), newTip.trim()],
    }));
    setNewTip('');
  }, [newTip]);

  const removeTip = useCallback((index: number) => {
    setStepForm(prev => ({
      ...prev,
      tips: prev.tips?.filter((_, i) => i !== index) || [],
    }));
  }, []);

  const toggleStepExpanded = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  }, []);

  if (!open) return null;

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: spacing, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsCreatingTutorial(true)}
          sx={{ 
            bgcolor: '#e91e63', 
            '&:hover': { bgcolor: '#c2185b' },
            minHeight: buttonMinHeight,
            fontSize: fontSize.button,
          }}
        >
          Ny veiledning
        </Button>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {tutorials.map(tutorial => (
          <ListItem
            key={tutorial.id}
            onClick={() => {
              setSelectedTutorial(tutorial);
              if (showMobileMenu) setSidebarOpen(false);
            }}
            sx={{
              borderRadius: 2,
              mb: 1,
              p: spacing,
              bgcolor: selectedTutorial?.id === tutorial.id ? 'rgba(233,30,99,0.2)' : 'rgba(255,255,255,0.02)',
              border: selectedTutorial?.id === tutorial.id ? '1px solid #e91e63' : '1px solid transparent',
              cursor: 'pointer',
              minHeight: buttonMinHeight,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            <ListItemText
              primary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography component="span" sx={{ fontWeight: 600, color: '#fff', fontSize: fontSize.body }}>
                    {tutorial.name}
                  </Typography>
                  {tutorial.isActive && (
                    <ActiveIcon sx={{ fontSize: iconSize - 4, color: '#4caf50' }} />
                  )}
                </Box>
              }
              secondary={
                <Box component="span" sx={{ display: 'block' }}>
                  <Chip
                    label={categoryOptions.find(c => c.value === tutorial.category)?.label}
                    size="small"
                    sx={{ mt: 0.5, fontSize: fontSize.caption, height: chipHeight }}
                  />
                  <Typography component="span" sx={{ display: 'block', color: 'rgba(255,255,255,0.87)', mt: 0.5, fontSize: fontSize.caption }}>
                    {tutorial.steps.length} steg
                  </Typography>
                </Box>
              }
              secondaryTypographyProps={{ component: 'div' }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      container={document.body}
      sx={{ zIndex: 100010 }}
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          color: '#fff',
          minHeight: isMobile ? '100vh' : '80vh',
          maxHeight: isMobile ? '100vh' : '90vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        p: spacing,
        minHeight: buttonMinHeight + 16,
      }}>
        {showMobileMenu && (
          <IconButton 
            onClick={() => setSidebarOpen(true)} 
            sx={{ 
              color: 'rgba(255,255,255,0.87)',
              minWidth: iconButtonSize,
              minHeight: iconButtonSize,
            }}
            aria-label="Åpne meny"
          >
            <MenuIcon sx={{ fontSize: iconSize + 4 }} />
          </IconButton>
        )}
        <Box
          sx={{
            width: logoSize,
            height: logoSize,
            borderRadius: 1,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            src="/role-room-assets/TheRoleRoom_Logo_Tagline.webp"
            alt="The Role Room"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
        <Typography sx={{ flex: 1, fontSize: fontSize.title, fontWeight: 600 }}>
          Veiledningsredigerer
        </Typography>
        {saveMessage && (
          <Chip
            label={saveMessage}
            color="success"
            size="small"
            sx={{ mr: spacing, fontSize: fontSize.caption, height: chipHeight }}
          />
        )}
        <IconButton
          onClick={onClose}
          aria-label="Lukk veiledningseditor"
          sx={{
            color: 'rgba(255,255,255,0.87)',
            minWidth: iconButtonSize,
            minHeight: iconButtonSize,
          }}
        >
          <CloseIcon sx={{ fontSize: iconSize + 4 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
        {showMobileMenu ? (
          <SwipeableDrawer
            anchor="left"
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpen={() => setSidebarOpen(true)}
            PaperProps={{
              sx: {
                width: sidebarWidth,
                bgcolor: '#1a1a2e',
                color: '#fff',
              },
            }}
          >
            <Box sx={{ p: spacing, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                onClick={() => setSidebarOpen(false)}
                aria-label="Lukk meny"
                sx={{
                  color: 'rgba(255,255,255,0.87)',
                  minWidth: iconButtonSize,
                  minHeight: iconButtonSize,
                }}
              >
                <BackIcon />
              </IconButton>
              <Typography sx={{ fontSize: fontSize.title, fontWeight: 600 }}>Veiledninger</Typography>
            </Box>
            {sidebarContent}
          </SwipeableDrawer>
        ) : (
          <Box sx={{ width: sidebarWidth, borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
            {sidebarContent}
          </Box>
        )}

        <Box sx={{ flex: 1, overflow: 'auto', p: spacing }}>
          {selectedTutorial ? (
            <>
              <Box sx={{ mb: spacing }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'flex-start', 
                  gap: spacing, 
                  mb: spacing 
                }}>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      label="Navn"
                      value={selectedTutorial.name}
                      onChange={(e) => handleUpdateTutorial({ name: e.target.value })}
                      size={isMobile ? 'medium' : 'small'}
                      sx={{ 
                        mb: spacing, 
                        '& .MuiOutlinedInput-root': { 
                          bgcolor: 'rgba(255,255,255,0.05)',
                          fontSize: fontSize.body,
                          minHeight: buttonMinHeight,
                        } 
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                      InputProps={{ sx: { color: '#fff' } }}
                    />
                    <TextField
                      fullWidth
                      label="Beskrivelse"
                      value={selectedTutorial.description}
                      onChange={(e) => handleUpdateTutorial({ description: e.target.value })}
                      size={isMobile ? 'medium' : 'small'}
                      multiline
                      rows={2}
                      sx={{ 
                        mb: spacing, 
                        '& .MuiOutlinedInput-root': { 
                          bgcolor: 'rgba(255,255,255,0.05)',
                          fontSize: fontSize.body,
                        } 
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                      InputProps={{ sx: { color: '#fff' } }}
                    />
                    <FormControl size={isMobile ? 'medium' : 'small'} fullWidth={isMobile} sx={{ minWidth: isMobile ? '100%' : 200 }}>
                      <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Kategori</InputLabel>
                      <Select
                        value={selectedTutorial.category}
                        label="Kategori"
                        onChange={(e) => handleUpdateTutorial({ category: e.target.value as Tutorial['category'] })}
                        sx={{ 
                          color: '#fff', 
                          fontSize: fontSize.body,
                          minHeight: buttonMinHeight,
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } 
                        }}
                      >
                        {categoryOptions.map(opt => (
                          <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: fontSize.body }}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: isMobile ? 'row' : 'column', 
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                    gap: 1 
                  }}>
                    <Tooltip title={selectedTutorial.isActive ? 'Aktiv veiledning' : 'Sett som aktiv'}>
                      <Button
                        variant={selectedTutorial.isActive ? 'contained' : 'outlined'}
                        startIcon={<ActiveIcon />}
                        onClick={() => handleSetActive(selectedTutorial.id, selectedTutorial.category)}
                        sx={{
                          bgcolor: selectedTutorial.isActive ? '#4caf50' : 'transparent',
                          borderColor: '#4caf50',
                          color: selectedTutorial.isActive ? '#fff' : '#4caf50',
                          minHeight: buttonMinHeight,
                          fontSize: fontSize.button,
                          flex: isMobile ? 1 : 'none',
                        }}
                      >
                        {selectedTutorial.isActive ? 'Aktiv' : 'Aktiver'}
                      </Button>
                    </Tooltip>
                    {onPreviewTutorial && (
                      <Button
                        variant="outlined"
                        startIcon={<PreviewIcon />}
                        onClick={() => onPreviewTutorial(selectedTutorial)}
                        sx={{ 
                          borderColor: '#e91e63', 
                          color: '#e91e63',
                          minHeight: buttonMinHeight,
                          fontSize: fontSize.button,
                          flex: isMobile ? 1 : 'none',
                        }}
                      >
                        Forhåndsvis
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<DuplicateIcon />}
                      onClick={() => handleDuplicateTutorial(selectedTutorial.id)}
                      sx={{ 
                        borderColor: 'rgba(255,255,255,0.3)', 
                        color: 'rgba(255,255,255,0.87)',
                        minHeight: buttonMinHeight,
                        fontSize: fontSize.button,
                        flex: isMobile ? 1 : 'none',
                      }}
                    >
                      Dupliser
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteTutorial(selectedTutorial.id)}
                      sx={{ 
                        borderColor: '#f44336', 
                        color: '#f44336',
                        minHeight: buttonMinHeight,
                        fontSize: fontSize.button,
                        flex: isMobile ? 1 : 'none',
                      }}
                    >
                      Slett
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: spacing }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: spacing }}>
                <Typography sx={{ fontSize: fontSize.title, fontWeight: 600 }}>
                  Steg ({selectedTutorial.steps.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    resetStepForm();
                    setIsCreatingStep(true);
                  }}
                  sx={{ 
                    bgcolor: '#e91e63', 
                    '&:hover': { bgcolor: '#c2185b' },
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.button,
                  }}
                >
                  Legg til steg
                </Button>
              </Box>

              <List sx={{ p: 0 }}>
                {selectedTutorial.steps.map((step, index) => (
                  <Paper
                    key={step.id}
                    sx={{
                      mb: 1,
                      bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: spacing,
                        cursor: 'pointer',
                        minHeight: buttonMinHeight + 16,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                      onClick={() => toggleStepExpanded(step.id)}
                    >
                      <DragIcon sx={{ color: 'rgba(255,255,255,0.6)', mr: 1, fontSize: iconSize + 2 }} />
                      <Chip
                        label={index + 1}
                        size="small"
                        sx={{ mr: spacing, bgcolor: '#e91e63', color: '#fff', fontWeight: 700, height: chipHeight, fontSize: fontSize.caption }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: fontSize.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {step.title}
                        </Typography>
                        {!isMobile && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.caption }}>
                            Panel: {panelOptions.find(p => p.value === step.panel)?.label}
                            {step.action && ` | Handling: ${actionOptions.find(a => a.value === step.action)?.label}`}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <IconButton
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleMoveStep(index, 'up'); }}
                          disabled={index === 0}
                          aria-label="Flytt opp"
                          sx={{ color: 'rgba(255,255,255,0.87)', minWidth: iconButtonSize, minHeight: iconButtonSize }}
                        >
                          <MoveUpIcon sx={{ fontSize: iconSize }} />
                        </IconButton>
                        <IconButton
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleMoveStep(index, 'down'); }}
                          disabled={index === selectedTutorial.steps.length - 1}
                          aria-label="Flytt ned"
                          sx={{ color: 'rgba(255,255,255,0.87)', minWidth: iconButtonSize, minHeight: iconButtonSize }}
                        >
                          <MoveDownIcon sx={{ fontSize: iconSize }} />
                        </IconButton>
                        <IconButton
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); startEditingStep(step); }}
                          aria-label="Rediger steg"
                          sx={{ color: '#00d4ff', minWidth: iconButtonSize, minHeight: iconButtonSize }}
                        >
                          <EditIcon sx={{ fontSize: iconSize }} />
                        </IconButton>
                        <IconButton
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                          aria-label="Slett steg"
                          sx={{ color: '#f44336', minWidth: iconButtonSize, minHeight: iconButtonSize }}
                        >
                          <DeleteIcon sx={{ fontSize: iconSize }} />
                        </IconButton>
                      </Box>
                      {expandedSteps.has(step.id) ? <CollapseIcon /> : <ExpandIcon />}
                    </Box>

                    <Collapse in={expandedSteps.has(step.id)}>
                      <Box sx={{ p: spacing, pt: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 1, fontSize: fontSize.body }}>
                          {step.description}
                        </Typography>
                        {step.actionDescription && (
                          <Alert severity="info" sx={{ mb: 1, py: 0, '& .MuiAlert-message': { fontSize: fontSize.caption } }}>
                            Handling: {step.actionDescription}
                          </Alert>
                        )}
                        {step.targetSelector && (
                          <Typography sx={{ display: 'block', color: 'rgba(255,255,255,0.87)', fontFamily: 'monospace', fontSize: fontSize.caption }}>
                            Selector: {step.targetSelector}
                          </Typography>
                        )}
                        {step.tips && step.tips.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography sx={{ color: '#4caf50', fontWeight: 600, fontSize: fontSize.caption }}>Tips:</Typography>
                            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                              {step.tips.map((tip, i) => (
                                <li key={i}>
                                  <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.caption }}>{tip}</Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Paper>
                ))}
              </List>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
              <TutorialIcon sx={{ fontSize: iconSize * 3, mb: 2 }} />
              <Typography sx={{ fontSize: fontSize.title }}>Velg en veiledning</Typography>
              <Typography sx={{ fontSize: fontSize.body }}>eller opprett en ny for å begynne</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <Dialog
        open={isCreatingTutorial}
        onClose={() => setIsCreatingTutorial(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        container={document.body}
        sx={{ zIndex: 100011 }}
        PaperProps={{ sx: { bgcolor: '#1a1a2e', color: '#fff' } }}
      >
        <DialogTitle sx={{ fontSize: fontSize.title, p: spacing }}>Ny veiledning</DialogTitle>
        <DialogContent sx={{ p: spacing }}>
          <TextField
            fullWidth
            label="Navn"
            value={tutorialForm.name}
            onChange={(e) => setTutorialForm(prev => ({ ...prev, name: e.target.value }))}
            size={isMobile ? 'medium' : 'small'}
            sx={{ 
              mt: spacing, 
              mb: spacing, 
              '& .MuiOutlinedInput-root': { 
                bgcolor: 'rgba(255,255,255,0.05)',
                minHeight: buttonMinHeight,
                fontSize: fontSize.body,
              } 
            }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
            InputProps={{ sx: { color: '#fff' } }}
          />
          <TextField
            fullWidth
            label="Beskrivelse"
            value={tutorialForm.description}
            onChange={(e) => setTutorialForm(prev => ({ ...prev, description: e.target.value }))}
            multiline
            rows={2}
            size={isMobile ? 'medium' : 'small'}
            sx={{ 
              mb: spacing, 
              '& .MuiOutlinedInput-root': { 
                bgcolor: 'rgba(255,255,255,0.05)',
                fontSize: fontSize.body,
              } 
            }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
            InputProps={{ sx: { color: '#fff' } }}
          />
          <FormControl fullWidth size={isMobile ? 'medium' : 'small'}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Kategori</InputLabel>
            <Select
              value={tutorialForm.category}
              label="Kategori"
              onChange={(e) => setTutorialForm(prev => ({ ...prev, category: e.target.value as Tutorial['category'] }))}
              sx={{ 
                color: '#fff', 
                minHeight: buttonMinHeight,
                fontSize: fontSize.body,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } 
              }}
            >
              {categoryOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: spacing, gap: 1 }}>
          <Button 
            onClick={() => setIsCreatingTutorial(false)}
            sx={{ minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateTutorial} 
            sx={{ bgcolor: '#e91e63', minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isCreatingStep || editingStep !== null}
        onClose={() => { setIsCreatingStep(false); setEditingStep(null); resetStepForm(); }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        container={document.body}
        sx={{ zIndex: 100011 }}
        PaperProps={{ sx: { bgcolor: '#1a1a2e', color: '#fff' } }}
      >
        <DialogTitle sx={{ fontSize: fontSize.title, p: spacing }}>{editingStep ? 'Rediger steg' : 'Nytt steg'}</DialogTitle>
        <DialogContent sx={{ p: spacing }}>
          <Grid container spacing={spacing} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tittel"
                value={stepForm.title}
                onChange={(e) => setStepForm(prev => ({ ...prev, title: e.target.value }))}
                size={isMobile ? 'medium' : 'small'}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.body,
                  } 
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                InputProps={{ sx: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                value={stepForm.description}
                onChange={(e) => setStepForm(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
                size={isMobile ? 'medium' : 'small'}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    fontSize: fontSize.body,
                  } 
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                InputProps={{ sx: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={isMobile ? 12 : 6}>
              <FormControl fullWidth size={isMobile ? 'medium' : 'small'}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Panel</InputLabel>
                <Select
                  value={stepForm.panel}
                  label="Panel"
                  onChange={(e) => setStepForm(prev => ({ ...prev, panel: Number(e.target.value) }))}
                  sx={{ 
                    color: '#fff', 
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.body,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } 
                  }}
                >
                  {panelOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={isMobile ? 12 : 6}>
              <FormControl fullWidth size={isMobile ? 'medium' : 'small'}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Handling</InputLabel>
                <Select
                  value={stepForm.action || ''}
                  label="Handling"
                  onChange={(e) => setStepForm(prev => ({ ...prev, action: e.target.value as TutorialStep['action'] || undefined }))}
                  sx={{ 
                    color: '#fff', 
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.body,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } 
                  }}
                >
                  {actionOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="CSS Selector (valgfritt)"
                value={stepForm.targetSelector}
                onChange={(e) => setStepForm(prev => ({ ...prev, targetSelector: e.target.value }))}
                placeholder='f.eks. [role="tab"]:first-of-type'
                size={isMobile ? 'medium' : 'small'}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.body,
                  } 
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                InputProps={{ sx: { color: '#fff', fontFamily: 'monospace' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Handlingsbeskrivelse"
                value={stepForm.actionDescription}
                onChange={(e) => setStepForm(prev => ({ ...prev, actionDescription: e.target.value }))}
                placeholder="f.eks. Klikk på Roller-fanen"
                size={isMobile ? 'medium' : 'small'}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.body,
                  } 
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                InputProps={{ sx: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={isMobile ? 12 : 6}>
              <TextField
                fullWidth
                label="Varighet (ms)"
                type="number"
                value={stepForm.duration}
                onChange={(e) => setStepForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                size={isMobile ? 'medium' : 'small'}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.body,
                  } 
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body } }}
                InputProps={{ sx: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography sx={{ mb: 1, color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Tips</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexDirection: isMobile ? 'column' : 'row' }}>
                <TextField
                  fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  value={newTip}
                  onChange={(e) => setNewTip(e.target.value)}
                  placeholder="Legg til et tips..."
                  onKeyPress={(e) => e.key === 'Enter' && addTip()}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      minHeight: buttonMinHeight,
                      fontSize: fontSize.body,
                    } 
                  }}
                  InputProps={{ sx: { color: '#fff' } }}
                />
                <Button 
                  variant="outlined" 
                  onClick={addTip} 
                  sx={{ 
                    borderColor: '#4caf50', 
                    color: '#4caf50',
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.button,
                    minWidth: isMobile ? '100%' : 'auto',
                  }}
                >
                  Legg til
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {stepForm.tips?.map((tip, index) => (
                  <Chip
                    key={index}
                    label={tip}
                    onDelete={() => removeTip(index)}
                    sx={{ 
                      bgcolor: 'rgba(76,175,80,0.2)', 
                      color: '#4caf50',
                      height: chipHeight,
                      fontSize: fontSize.caption,
                    }}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: spacing, gap: 1 }}>
          <Button 
            onClick={() => { setIsCreatingStep(false); setEditingStep(null); resetStepForm(); }}
            sx={{ minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={editingStep ? handleUpdateStep : handleCreateStep}
            sx={{ bgcolor: '#e91e63', minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            {editingStep ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default TutorialEditorPanel;
