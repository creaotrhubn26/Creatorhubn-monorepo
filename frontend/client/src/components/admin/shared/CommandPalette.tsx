/**
 * CreatorHub Norge - Command Palette
 * ⌘K command interface for quick actions
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  IconButton,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Key as KeyIcon,
  Webhook as WebhookIcon,
  Security as SecurityIcon,
  Test as TestIcon,
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'creation' | 'testing' | 'management' | 'analytics';
  keywords: string[];
  requiresPermission?: string;
  badge?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCreateApiKey?: () => void;
  onCreateWebhook?: () => void;
  onCreateOAuth?: () => void;
  onTestProxy?: () => void;
  onTestSpecificApi?: () => void;
  onViewAnalytics?: () => void;
  onRefreshAll?: () => void;
  onOpenSettings?: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  onCreateApiKey,
  onCreateWebhook,
  onCreateOAuth,
  onTestProxy,
  onTestSpecificApi,
  onViewAnalytics,
  onRefreshAll,
  onOpenSettings
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { canPerformAction } = useUserPermissions();
  
  // Theming system
  const theming = useTheming('prototype_tester,');

  const commands: Command[] = [
    {
      id: 'create-api-key',
      label: 'Opprett API-nøkkel',
      description: 'Lag en ny API-nøkkel for en tjeneste',
      icon: <KeyIcon />,
      action: () => { onCreateApiKey?.(); onClose(); },
      category: 'creation',
      keywords: ['api','nøkkel','key','opprett','create','ny'],
      requiresPermission: 'canCreateApiKeys'
},
    {
      id: 'create-webhook',
      label: 'Opprett Webhook',
      description: 'Konfigurer en ny webhook-endepunkt',
      icon: <WebhookIcon />,
      action: () => { onCreateWebhook?.(); onClose(); },
      category: 'creation',
      keywords: ['webhook','endepunkt','opprett','create','ny'],
      requiresPermission: 'canConfigureWebhooks'
},
    {
      id: 'create-oauth',
      label: 'Opprett OAuth-klient',
      description: 'Registrer en ny OAuth-applikasjon',
      icon: <SecurityIcon />,
      action: () => { onCreateOAuth?.(); onClose(); },
      category: 'creation',
      keywords: ['oauth','klient','auth','opprett','create','ny'],
      requiresPermission: 'canManageOAuth'
},
    {
      id: 'test-proxy',
      label: 'Test Proxy',
      description: 'Kjør en test av proxy-tjenesten',
      icon: <TestIcon />,
      action: () => { onTestProxy?.(); onClose(); },
      category: 'testing',
      keywords: ['test','proxy','kjør','sjekk'],
      requiresPermission: 'canTestIntegrations'
},
    {
      id: 'test-api',
      label: 'Test Spesifikk AP',
      description: 'Test en bestemt API-integrasjon',
      icon: <TestIcon />,
      action: () => { onTestSpecificApi?.(); onClose(); },
      category: 'testing',
      keywords: ['test','api','spesifikk','integrasjon','sjekk'],
      requiresPermission: 'canTestIntegrations'
},
    {
      id: 'view-analytics',
      label: 'Se Analytikk',
      description: 'Åpne avanserte analyseverktø',
      icon: <AnalyticsIcon />,
      action: () => { onViewAnalytics?.(); onClose(); },
      category: 'analytics',
      keywords: ['analytikk','analyse','stats','statistikk','rapport'],
      badge: 'Avansert'
},
    {
      id: 'refresh-all',
      label: 'Oppdater Alt',
      description: 'Oppdater all data og status',
      icon: <RefreshIcon />,
      action: () => { onRefreshAll?.(); onClose(); },
      category: 'management',
      keywords: ['oppdater', 'refresh', 'reload', 'last','sync']
  },
    {
      id: 'open-settings',
      label: 'Åpne Innstillinger',
      description: 'Gå til integrasjonssettings',
      icon: <SettingsIcon />,
      action: () => { onOpenSettings?.(); onClose(); },
      category: 'management',
      keywords: ['innstillinger', 'settings', 'konfigurasjon','setup']
  }
  ];

  // Filter commands based on search and permissions
  const getFilteredCommands = useCallback(() => {
    let filtered = commands.filter(command => {
      // Check permissions
      if (command.requiresPermission && !canPerformAction(command.requiresPermission as any)) {
        return false;
    }

      // Check search query
      if (searchQuery.trim() === ', ') {
        return true;
    }

      const query = searchQuery.toLowerCase();
      return (
        command.label.toLowerCase().includes(query) ||
        command.description.toLowerCase().includes(query) ||
        command.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
  });

    return filtered;
}, [searchQuery, canPerformAction]);

  useEffect(() => {
    setFilteredCommands(getFilteredCommands());
    setSelectedIndex(0);
}, [getFilteredCommands]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
      }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
    }
  };

    document.addEventListener('keydown,', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [open, filteredCommands, selectedIndex, onClose]);

  // Global keyboard shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (!open) {
          // onOpen would need to be passed from parent
    }
    }
  };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
}, [open]);

  const handleClose = () => {
    setSearchQuery('');
    setSelectedIndex(0);
    onClose();
};

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'creation': return 'Opprettelse';
      case 'testing': return 'Testing';
      case 'management': return 'Administrasjon';
      case 'analytics': return 'Analytikk';
      default: return category;
}
};

  const groupedCommands = filteredCommands.reduce((groups, command) => {
    const category = command.category;
    if (!groups[category]) {
      groups[category] = [];
  }
    groups[category].push(command);
    return groups;
}, {} as Record<string, Command[]>);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          mt: '10vh'
    }
    }}
    >
      <DialogContent sx={{ p:  0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <SearchIcon color="action" />
            <TextField
              autoFocus
              fullWidth
              placeholder="Søk etter kommandoer..."
              variant="standard"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                disableUnderline: true,
                sx: { fontSize: '1.1rem' }
            }}
            />
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
          {Object.keys(groupedCommands).length === 0 ? (
            <Box sx={{ p:  3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Ingen kommandoer funnet for "{searchQuery},"
              </Typography>
            </Box>
          ) : (
            Object.entries(groupedCommands).map(([category, commands], categoryIndex) => (
              <Box key={category}>
                {categoryIndex > 0 && <Divider />}
                <Box sx={{ p:  1 }}>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ px: 2, fontWeight: 'medium' }}
                  >
                    {getCategoryLabel(category)}
                  </Typography>
                </Box>
                <List dense>
                  {commands.map((command, commandIndex) => {
                    const globalIndex = Object.values(groupedCommands)
                      .slice(0, categoryIndex)
                      .reduce((acc, cmds) => acc + cmds.length, 0) + commandIndex;
                    
                    return (
                      <ListItem
                        key={command.id}
                        button
                        selected={globalIndex === selectedIndex}
                        onClick={command.action}
                        sx={{
                          borderRadius:  1,
                          mx: 1'&.Mui-selected': { bgcolor: 'primary.light', '&:hover': {
                              bgcolor: 'primary.light' }
                        }
                      }}
                      >
                        <ListItemIcon>
                          {command.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Typography variant="body2" fontWeight="medium">
                                {command.label}
                              </Typography>
                              {command.badge && (
                                <Chip 
                                  label={command.badge}
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                            </Box>
                        }
                          secondary={command.description}
                        />
                      </ListItem>
                    );
                })}
                </List>
              </Box>
            ))
          )}
        </Box>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Bruk ↑↓ piler for å navigere, Enter for å velge, Esc for å lukke
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}