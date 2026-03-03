/**
 * CreatorHub Norge - Command Palette
 * ⌘K command interface for quick actions
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Close as CloseIcon,
  Key as KeyIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Webhook as WebhookIcon,
  BugReport as TestIcon,
} from '@mui/icons-material';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'creation' | 'testing' | 'management' | 'analytics';
  keywords: string[];
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

function categoryLabel(category: Command['category']): string {
  switch (category) {
    case 'creation':
      return 'Oppretting';
    case 'testing':
      return 'Testing';
    case 'management':
      return 'Administrasjon';
    case 'analytics':
      return 'Analytikk';
    default:
      return category;
  }
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
  onOpenSettings,
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'create-api-key',
        label: 'Opprett API-nøkkel',
        description: 'Lag en ny API-nøkkel for en tjeneste',
        icon: <KeyIcon />,
        action: () => {
          onCreateApiKey?.();
          onClose();
        },
        category: 'creation',
        keywords: ['api', 'nøkkel', 'key', 'opprett', 'create', 'ny'],
      },
      {
        id: 'create-webhook',
        label: 'Opprett Webhook',
        description: 'Konfigurer et nytt webhook-endepunkt',
        icon: <WebhookIcon />,
        action: () => {
          onCreateWebhook?.();
          onClose();
        },
        category: 'creation',
        keywords: ['webhook', 'endepunkt', 'opprett', 'create', 'ny'],
      },
      {
        id: 'create-oauth',
        label: 'Opprett OAuth-klient',
        description: 'Registrer en ny OAuth-applikasjon',
        icon: <SecurityIcon />,
        action: () => {
          onCreateOAuth?.();
          onClose();
        },
        category: 'creation',
        keywords: ['oauth', 'klient', 'auth', 'opprett', 'create', 'ny'],
      },
      {
        id: 'test-proxy',
        label: 'Test Proxy',
        description: 'Kjør en test av proxy-tjenesten',
        icon: <TestIcon />,
        action: () => {
          onTestProxy?.();
          onClose();
        },
        category: 'testing',
        keywords: ['test', 'proxy', 'kjør', 'sjekk'],
      },
      {
        id: 'test-api',
        label: 'Test spesifikk API',
        description: 'Test en bestemt API-integrasjon',
        icon: <TestIcon />,
        action: () => {
          onTestSpecificApi?.();
          onClose();
        },
        category: 'testing',
        keywords: ['test', 'api', 'spesifikk', 'integrasjon', 'sjekk'],
      },
      {
        id: 'view-analytics',
        label: 'Se analytikk',
        description: 'Åpne avanserte analyseverktøy',
        icon: <AnalyticsIcon />,
        action: () => {
          onViewAnalytics?.();
          onClose();
        },
        category: 'analytics',
        keywords: ['analytikk', 'analyse', 'stats', 'statistikk', 'rapport'],
        badge: 'Avansert',
      },
      {
        id: 'refresh-all',
        label: 'Oppdater alt',
        description: 'Oppdater all data og status',
        icon: <RefreshIcon />,
        action: () => {
          onRefreshAll?.();
          onClose();
        },
        category: 'management',
        keywords: ['oppdater', 'refresh', 'reload', 'last', 'sync'],
      },
      {
        id: 'open-settings',
        label: 'Åpne innstillinger',
        description: 'Gå til integrasjonsinnstillinger',
        icon: <SettingsIcon />,
        action: () => {
          onOpenSettings?.();
          onClose();
        },
        category: 'management',
        keywords: ['innstillinger', 'settings', 'konfigurasjon', 'setup'],
      },
    ],
    [
      onClose,
      onCreateApiKey,
      onCreateOAuth,
      onCreateWebhook,
      onOpenSettings,
      onRefreshAll,
      onTestProxy,
      onTestSpecificApi,
      onViewAnalytics,
    ],
  );

  const filteredCommands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return commands;
    }

    return commands.filter((command) => {
      return (
        command.label.toLowerCase().includes(query) ||
        command.description.toLowerCase().includes(query) ||
        command.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      );
    });
  }, [commands, searchQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(filteredCommands.length - 1, 0)));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        filteredCommands[selectedIndex]?.action();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, onClose, open, selectedIndex]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon color="action" />
          <TextField
            autoFocus
            fullWidth
            placeholder="Søk etter kommando..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            variant="standard"
            InputProps={{ disableUnderline: true }}
          />
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider />

        {filteredCommands.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Ingen kommandoer matcher søket.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0.5 }}>
            {filteredCommands.map((command, index) => (
              <ListItem key={command.id} disablePadding>
                <ListItemButton selected={index === selectedIndex} onClick={command.action}>
                  <ListItemIcon>{command.icon}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {command.label}
                        </Typography>
                        <Chip size="small" label={categoryLabel(command.category)} variant="outlined" />
                        {command.badge && <Chip size="small" color="primary" label={command.badge} />}
                      </Box>
                    }
                    secondary={command.description}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
