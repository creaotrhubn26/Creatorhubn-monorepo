/**
 * OptimizationPanel.tsx
 * Sidebar panel + full-screen dialog for schedule optimization suggestions.
 */

import type { FC } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  EmojiTransportation as TransportIcon,
  TrendingUp as TrendingUpIcon,
  Savings as SavingsIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import type { OptimizationSuggestion } from './stripboard.types';

// ─── Shared card ─────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};
const PRIORITY_LABELS: Record<string, string> = {
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
};
function typeIcon(type: OptimizationSuggestion['type']) {
  switch (type) {
    case 'location':  return <PlaceIcon />;
    case 'cast':      return <PersonIcon />;
    case 'transport': return <TransportIcon />;
    case 'time':      return <ScheduleIcon />;
  }
}

const SuggestionCard: FC<{ suggestion: OptimizationSuggestion }> = ({ suggestion }) => {
  const color = PRIORITY_COLORS[suggestion.priority];
  return (
    <Paper
      sx={{
        p: 2,
        mb: 1.5,
        borderLeft: 4,
        borderColor: color,
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(color, 0.1),
            color,
          }}
        >
          {typeIcon(suggestion.type)}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {suggestion.title}
            </Typography>
            <Chip
              label={PRIORITY_LABELS[suggestion.priority]}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: alpha(color, 0.1),
                color,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {suggestion.description}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<SavingsIcon sx={{ fontSize: 14 }} />}
              label={suggestion.potentialSaving}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
            <Typography variant="caption" color="text.secondary">
              Scener: {suggestion.affectedScenes.join(', ')}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

// ─── Inline sidebar panel ─────────────────────────────────────────────────────

interface OptimizationPanelProps {
  suggestions: OptimizationSuggestion[];
  onClose: () => void;
}

export const OptimizationPanel: FC<OptimizationPanelProps> = ({
  suggestions,
  onClose,
}) => (
  <Box
    sx={{
      width: { xs: '100%', md: 340, lg: 380 },
      flexShrink: 0,
      borderLeft: 1,
      borderColor: 'divider',
      overflow: 'auto',
      bgcolor: alpha('#F59E0B', 0.02),
    }}
  >
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Typography
        variant="subtitle1"
        fontWeight="bold"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <TrendingUpIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
        Optimaliseringsforslag
        {suggestions.length > 0 && (
          <Chip
            label={suggestions.length}
            size="small"
            sx={{ height: 20, bgcolor: '#F59E0B', color: '#fff', fontSize: '0.7rem' }}
          />
        )}
      </Typography>
      <IconButton size="small" onClick={onClose} aria-label="Lukk optimaliseringspanel">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
    <Box sx={{ p: 2 }}>
      {suggestions.length === 0 ? (
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          <Typography variant="body2">
            Ingen optimaliseringer nødvendig! Planen ser bra ut.
          </Typography>
        </Alert>
      ) : (
        suggestions.map(s => <SuggestionCard key={s.id} suggestion={s} />)
      )}
    </Box>
  </Box>
);

// ─── Full-screen / modal dialog ───────────────────────────────────────────────

interface OptimizationDialogProps {
  open: boolean;
  onClose: () => void;
  suggestions: OptimizationSuggestion[];
  isMobile: boolean;
}

export const OptimizationDialog: FC<OptimizationDialogProps> = ({
  open,
  onClose,
  suggestions,
  isMobile,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullScreen={isMobile}
    maxWidth="sm"
    fullWidth
  >
    <DialogTitle
      sx={{
        bgcolor: alpha('#F59E0B', 0.08),
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <TrendingUpIcon sx={{ color: '#F59E0B' }} /> Optimaliseringsforslag
    </DialogTitle>
    <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
      {suggestions.length === 0 ? (
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          <Typography variant="body2">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CelebrationIcon sx={{ color: 'success.main' }} />
              Ingen optimaliseringer funnet! Planen ser bra ut.
            </Box>
          </Typography>
        </Alert>
      ) : (
        <List>
          {suggestions.map(suggestion => (
            <ListItem key={suggestion.id} alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      size="small"
                      icon={<SavingsIcon sx={{ fontSize: 14 }} />}
                      label={suggestion.potentialSaving}
                      variant="outlined"
                      color="success"
                    />
                    <Typography variant="subtitle2" fontWeight={600}>
                      {suggestion.title}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    {suggestion.description}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </DialogContent>
    <DialogActions sx={{ p: { xs: 2, sm: 2 } }}>
      <Button onClick={onClose}>Lukk</Button>
    </DialogActions>
  </Dialog>
);
