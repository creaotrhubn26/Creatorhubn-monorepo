import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import UniversalPrototypeFeedback from '../../prototype-testing/UniversalPrototypeFeedback';

import {
  Fab,
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';

import {
  Add,
  Settings,
  Analytics,
  CloudDone,
  NotificationAdd,
  SdCard,
  Feedback,
  EventNote,
  Email,
  Lightbulb,
  Tune,
  Chat,
  CalendarMonth,
  Group,
  Work,
  PhotoLibrary
} from '@mui/icons-material';

interface FloatingActionButtonsProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  onMeetingNotesOpen?: () => void;
  onAnalyticsOpen?: () => void;
  onDriveOpen?: () => void;
  onNotificationCenterOpen?: () => void;
  onFeedbackOpen?: () => void;
  onEmailDesignerOpen?: () => void;
  onProjectWizardOpen?: () => void;
  onMemoryCardRecoveryOpen?: () => void;
  onPhotographyTipsOpen?: () => void;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  onChatOpen?: () => void;
  onCalendarOpen?: () => void;
  onClientManagementOpen?: () => void;
  onGooglePhotosOpen?: () => void
}

interface ActionItem {
  name: string;
  icon: React.ReactNode;
  action: () => void
}

interface UserPreferences {
  sessionId: string;
  profession: string;
  speedDialOrder: string[];
  hiddenActions: string[];
  isDefault?: boolean
}

export default function FloatingActionButtons({
  profession = 'photographer',
  onMeetingNotesOpen,
  onAnalyticsOpen,
  onDriveOpen,
  onNotificationCenterOpen,
  onFeedbackOpen,
  onEmailDesignerOpen,
  onProjectWizardOpen,
  onMemoryCardRecoveryOpen,
  onPhotographyTipsOpen,
  onChatOpen,
  onCalendarOpen,
  onClientManagementOpen,
  onGooglePhotosOpen,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}: FloatingActionButtonsProps) {
  const [open, setOpen] = useState(false);
  const [showInfoMessage, setShowInfoMessage] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [clickedAction, setClickedAction] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [organizerDialogOpen, setOrganizerDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  
  // Generate session ID (in production, this would come from auth)
  const sessionId = 'dev-session-' + profession;

  // Get user preferences from database
  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['user-preferences', sessionId, profession],
    queryFn: () => apiRequest(`/api/user-preferences/${sessionId}/${profession}`)
  });

  // Save user preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      return apiRequest('/api/user-preferences', {
        headers: {
          "Content-Type" : "application/json"
        },
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          profession,
          ...data
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    }
  });

  const hiddenActions = preferences?.hiddenActions || [];
  const actionOrder = preferences?.speedDialOrder || [];

  // Info message logic (server-first, local fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/user/kv/speedDial_info_shown', { credentials: 'include' });
        const j = r.ok ? await r.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
        const hasShownMessage = v ?? localStorage.getItem('speedDial_info_shown');
        if (!hasShownMessage && mounted) {
          const timer = setTimeout(() => {
            setShowInfoMessage(true);
            // Persist server-first and locally
            fetch('/api/user/kv', {
              method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
              body: JSON.stringify({ key: 'speedDial_info_shown', value: 'true' })
            }).catch(() => {});
            localStorage.setItem('speedDial_info_shown','true');
            setTimeout(() => setShowInfoMessage(false), 6000);
          }, 1000);
          return () => clearTimeout(timer);
        }
      } catch {
        const hasShownMessage = localStorage.getItem('speedDial_info_shown');
        if (!hasShownMessage && mounted) {
          const timer = setTimeout(() => {
            setShowInfoMessage(true);
            localStorage.setItem('speedDial_info_shown','true');
            setTimeout(() => setShowInfoMessage(false), 6000);
          }, 1000);
          return () => clearTimeout(timer);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getAllAvailableActions = (): ActionItem[] => {
    const baseActions = [
      { name: 'møtenotater', icon: <EventNote />, action: () => onMeetingNotesOpen?.() },
      { name: 'nytt-prosjekt', icon: <Work />, action: () => onProjectWizardOpen?.() },
      { name: 'klient-chat', icon: <Chat />, action: () => onChatOpen?.() },
      { name: 'kalender', icon: <CalendarMonth />, action: () => onCalendarOpen?.() },
      { name: 'analytics', icon: <Analytics />, action: () => onAnalyticsOpen?.() },
      { name: 'drive-backup', icon: <CloudDone />, action: () => onDriveOpen?.() },
      { name: 'varslingssenter', icon: <NotificationAdd />, action: () => onNotificationCenterOpen?.() },
      { name: 'tilbakemeldinger', icon: <Feedback />, action: () => onFeedbackOpen?.() ?? setFeedbackOpen(true) },
      { name: 'e-post-designer', icon: <Email />, action: () => onEmailDesignerOpen?.() },
      { name: 'klient-management', icon: <Group />, action: () => onClientManagementOpen?.() },
      { name: 'google-photos', icon: <PhotoLibrary />, action: () => onGooglePhotosOpen?.() }
    ];

    // Add profession-specific actions
    // Note: These could be made dynamic via profession config capabilities in the future
    const professionActions: ActionItem[] = [];

    if (profession === 'photographer') {
      professionActions.push(
        { name: 'minnekort-gjenoppretting', icon: <SdCard />, action: () => onMemoryCardRecoveryOpen?.() },
        { name: 'fotograferingstips', icon: <Lightbulb />, action: () => onPhotographyTipsOpen?.() }
      );
    } else if (profession === 'videographer') {
      professionActions.push(
        { name: 'filgjenoppretting', icon: <SdCard />, action: () => onMemoryCardRecoveryOpen?.() }
      );
    } else if (profession === 'music_producer') {
      professionActions.push(
        { name: 'plugin-manager', icon: <Tune />, action: () => console.log('Plugin Manager clicked, ') }
      );
    }

    // Add organizer action with proper icon
    const organizerAction = {
      name: 'organiser',
      icon: <Settings />,
      action: () => setOrganizerDialogOpen(true)
    };

    return [...baseActions, ...professionActions, organizerAction];
  };

  const getOrderedActions = (): ActionItem[] => {
    const allActions = getAllAvailableActions();
    
    // If we have no custom order or it's empty, return default order
    if (!actionOrder || actionOrder.length === 0) {
      return allActions;
  }

    // Apply custom order
    const orderedActions: ActionItem[] = [];
    
    // First, add actions in the specified order
    for (const actionName of actionOrder) {
      const action = allActions.find(action => action.name === actionName);
      if (action) {
        orderedActions.push(action);
    }
  }
    
    // Then add any new actions that weren't in the saved order
    for (const action of allActions) {
      if (!actionOrder.includes(action.name)) {
        orderedActions.push(action);
    }
  }
    
    return orderedActions;
};

  const getVisibleActions = (): ActionItem[] => {
    const orderedActions = getOrderedActions();
    return orderedActions.filter(action => !hiddenActions.includes(action.name));
};



  const handleActionClick = (actionName: string, actionFunction: () => void) => {
    // Trigger click animation
    setClickedAction(actionName);
    
    // Clear animation after 600ms
    setTimeout(() => {
      setClickedAction(null);
}, 600);
    
    // Close SpeedDial
    setOpen(false);
    
    // Execute the action
    actionFunction();
  };

  return (
    <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1300}}>
      {/* Info Message */}
      {showInfoMessage && (
        <Box
          onClick={() => setShowInfoMessage(false)}
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-5%, -50%)',
            width: '320px',
            height: '200px',
            zIndex: 999,
            background: 'linear-gradient(135deg, #FF6B00 0%, #FF8500 50%, #FF4500 100%)',
            borderRadius:  4,
            border: '4px solid white',
            padding:  3,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'pulse 2s infinite'
      }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.05)' },
              '100%': { transform: 'scale(1)' },
            }
          }}>
            <Add sx={{
              fontSize: 40,
              color: 'white',
              animation: 'pulse 1.5s infinite'
            }} />
            <Typography variant="h6" sx={{
              color: 'white',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}>
              Raske handlinger
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9, lineHeight: 1.5, color: 'white' }}>
            Trykk på + ikonet for å få tilgang til alle raske handlinger som møtenotater, prosjektopprettelse, analytics og mer!
          </Typography>
          <Typography variant="caption" sx={{
            opacity: 0.7,
            fontSize: '0.7rem',
            display: 'block',
            mt: 1,
            fontStyle: 'italic',
            color: 'white'
          }}>
            Klikk for å lukke
          </Typography>
        </Box>
      )}

      {/* Simple Organizer Dialog */}
      <Dialog
        open={organizerDialogOpen}
        onClose={() => setOrganizerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Organiser SpeedDial
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tilgjengelige handlinger: </Typography>
          <List>
            {getVisibleActions().map((action) => (
              <ListItem key={action.name}>
                <ListItemIcon>
                  {action.icon}
                </ListItemIcon>
                <ListItemText
                  primary={action.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOrganizerDialogOpen(false)}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #FF6B00, #FF8500)', '&:hover': {
                background: 'linear-gradient(135deg, #FF8500, #FF6B00)'
              }
            }}
          >
            Ferdig
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom SpeedDial with proper keyboard navigation */}
      <Box
        sx={{
          position: 'fixed',
          bottom:  20,
          right:  20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1300}}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setFocusedIndex(-1);
        } else if (open && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
            e.preventDefault();
            const actions = getVisibleActions();
            const direction = (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) ? -1 : 1;
            const newIndex = (focusedIndex + direction + actions.length) % actions.length;
            setFocusedIndex(newIndex);
        } else if (open && (e.key === 'Enter' || e.key === ', ')) {
            e.preventDefault();
            const actions = getVisibleActions();
            if (focusedIndex >= 0 && focusedIndex < actions.length) {
              handleActionClick(actions[focusedIndex].name, actions[focusedIndex].action);
          }
        }
      }}
      >
        {/* Action buttons (appear above main button when open) */}
        {open && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              mb: 2,
              alignItems: 'flex-end'
        }}
          >
            {getVisibleActions().map((action, index) => {
              const isClicked = clickedAction === action.name;
              const isFocused = focusedIndex === index;
              return (
                <Box
                  key={action.name}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    animation: `slideUp 0.3s ease-out ${index * 0.1}s both`
                }}
                >
                  {/* Label */}
                  <Typography
                    sx={{
                      position: 'absolute',
                      right: '100%',
                      mr: 1.5,
                      bgcolor: 'rgba(255, 255, 255, 0.98)',
                      color: isFocused ? '#FF6B00' : 'text.primary',
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      boxShadow: isFocused
                        ? '0 4px 20px rgba(255, 107, 0, 0.4)'
                        : '0 4px 12px rgba(0, 0, 0, 0.15)',
                      backdropFilter: 'blur(10px)',
                      border: isFocused ? '2px solid #FF6B00' : '1px solid rgba(0, 0, 0, 0.08)',
                      zIndex: 1400,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        boxShadow: '0 6px 16px rgba(255, 107, 0, 0.3)',
                        transform: 'translateX(-4px)'
                      }
                    }}
                  >
                    {action.name.replace(/-/g, ', ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>

                  {/* Action button */}
                  <Fab
                    size="medium"
                    tabIndex={0}
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => handleActionClick(action.name, action.action)}
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: isFocused ? '#FF6B00' : '#2563eb',
                      color: 'white',
                      transform: isClicked ? 'scale(1.15)' : isFocused ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isFocused 
                        ? '0 6px 20px rgba(255, 107, 0, 0.4)' 
                        : '0 4px 12px rgba(37, 99, 235, 0.3)',
                      outline: 'none',
                      '&:hover': {
                        bgcolor: '#FF8500',
                        transform: 'scale(1.12)',
                        boxShadow: '0 8px 24px rgba(255, 107, 0, 0.5)'
                      },
                      '&:active': {
                        transform: 'scale(0.95)'
                      },
                      '&:focus': {
                        outline: '3px solid rgba(255, 107, 0, 0.3)',
                        outlineOffset: '2px'
                      }
                    }}
                  >
                    {action.icon}
                  </Fab>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Main SpeedDial button */}
        <Fab
          color="primary"
          tabIndex={0}
          onClick={() => {
            setOpen(!open);
            setFocusedIndex(open ? -1 : 0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(!open);
              setFocusedIndex(open ? -1 : 0);
            }
          }}
          sx={{
            width: 64,
            height: 64,
            bgcolor: '#FF6B00',
            color: 'white',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 8px 24px rgba(255, 107, 0, 0.35)',
            '&:hover': {
              bgcolor: '#FF8500',
              transform: open ? 'rotate(45deg) scale(1.1)' : 'scale(1.1)',
              boxShadow: '0 12px 32px rgba(255, 107, 0, 0.45)'
            },
            '&:active': {
              transform: open ? 'rotate(45deg) scale(0.95)' : 'scale(0.95)'
            },
            '&:focus': {
              outline: '3px solid rgba(255, 107, 0, 0.4)',
              outlineOffset: '2px'
            }
          }}
        >
          <Add sx={{ fontSize: 30 }} />
        </Fab>

        {/* Keyframe animations */}
        <style>
          {`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px) scale(0.8);
          }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
          }
          }
          `}
        </style>
      </Box>

      {/* Universal Prototype Feedback */}
      <UniversalPrototypeFeedback
        profession={profession}
        component="FloatingActionButtons"
        isFloating={false}
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
}