import { useState, cloneElement, type FC, type ReactNode, type ReactElement, type MouseEvent } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Rating,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import TheatersIcon from '@mui/icons-material/Theaters';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import HandshakeIcon from '@mui/icons-material/Handshake';
import DescriptionIcon from '@mui/icons-material/Description';
import MovieIcon from '@mui/icons-material/Movie';
import CancelIcon from '@mui/icons-material/Cancel';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarIcon from '@mui/icons-material/Star';
import type { WorkflowStatus } from '../services/castingApiService';

const WORKFLOW_STEPS: { status: WorkflowStatus; label: string; icon: ReactNode; color: string }[] = [
  { status: 'pending', label: 'Venter', icon: <PersonSearchIcon />, color: '#9ca3af' },
  { status: 'auditioned', label: 'Audition', icon: <TheatersIcon />, color: '#f59e0b' },
  { status: 'selected', label: 'Valgt', icon: <CheckCircleIcon />, color: '#10b981' },
  { status: 'offer_sent', label: 'Tilbud sendt', icon: <LocalOfferIcon />, color: '#3b82f6' },
  { status: 'confirmed', label: 'Bekreftet', icon: <HandshakeIcon />, color: '#8b5cf6' },
  { status: 'contracted', label: 'Kontrakt', icon: <DescriptionIcon />, color: '#06b6d4' },
  { status: 'production', label: 'Produksjon', icon: <MovieIcon />, color: '#ec4899' },
];

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 16,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(90deg, #10b981, #8b5cf6)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
  },
}));

const ColorlibStepIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean; declined?: boolean };
}>(({ ownerState }) => ({
  backgroundColor: ownerState.declined ? '#ef4444' : 'rgba(255,255,255,0.1)',
  zIndex: 1,
  color: '#fff',
  width: 36,
  height: 36,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'all 0.3s',
  ...(ownerState.active && {
    backgroundImage: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    boxShadow: '0 4px 10px 0 rgba(139,92,246,0.4)',
  }),
  ...(ownerState.completed && {
    backgroundImage: 'linear-gradient(135deg, #10b981, #059669)',
  }),
}));

interface CandidateWorkflowStatusProps {
  candidateId: string;
  candidateName: string;
  currentStatus: WorkflowStatus | 'declined';
  auditionRating?: number;
  auditionNotes?: string;
  onStatusChange: (candidateId: string, newStatus: WorkflowStatus) => void;
  onAuditionResultUpdate?: (candidateId: string, rating: number, notes: string) => void;
  compact?: boolean;
}

export const CandidateWorkflowStatus: FC<CandidateWorkflowStatusProps> = ({
  candidateId,
  candidateName,
  currentStatus,
  auditionRating,
  auditionNotes,
  onStatusChange,
  onAuditionResultUpdate,
  compact = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [auditionDialogOpen, setAuditionDialogOpen] = useState(false);
  const [rating, setRating] = useState(auditionRating || 0);
  const [notes, setNotes] = useState(auditionNotes || '');

  const isDeclined = currentStatus === 'declined';
  const activeStep = isDeclined ? -1 : WORKFLOW_STEPS.findIndex(s => s.status === currentStatus);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStatusSelect = (status: WorkflowStatus) => {
    onStatusChange(candidateId, status);
    handleMenuClose();
  };

  const handleAuditionDialogSubmit = () => {
    if (onAuditionResultUpdate) {
      onAuditionResultUpdate(candidateId, rating, notes);
    }
    setAuditionDialogOpen(false);
  };

  const getStatusChip = () => {
    if (isDeclined) {
      return (
        <Chip
          icon={<CancelIcon sx={{ fontSize: 16 }} />}
          label="Avslått"
          size="small"
          sx={{
            bgcolor: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            fontWeight: 600,
          }}
        />
      );
    }
    const step = WORKFLOW_STEPS.find(s => s.status === currentStatus);
    if (!step) return null;
    return (
      <Chip
        icon={step.icon as ReactElement}
        label={step.label}
        size="small"
        sx={{
          bgcolor: `${step.color}20`,
          color: step.color,
          fontWeight: 600,
          '& .MuiChip-icon': { color: step.color },
        }}
      />
    );
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getStatusChip()}
        {auditionRating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StarIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
            <Typography variant="caption" sx={{ color: '#f59e0b' }}>
              {auditionRating}/5
            </Typography>
          </Box>
        )}
        <Tooltip title="Endre status">
          <IconButton size="small" onClick={handleMenuOpen} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} sx={{ zIndex: 1400 }}>
          {WORKFLOW_STEPS.map((step) => (
            <MenuItem
              key={step.status}
              onClick={() => handleStatusSelect(step.status)}
              selected={step.status === currentStatus}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                '&.Mui-selected': { bgcolor: `${step.color}20` },
              }}
            >
              <Box sx={{ color: step.color }}>{step.icon}</Box>
              <Typography>{step.label}</Typography>
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => handleStatusSelect('declined' as WorkflowStatus)}
            sx={{ color: '#ef4444' }}
          >
            <CancelIcon sx={{ mr: 1 }} />
            Avslå kandidat
          </MenuItem>
          {currentStatus === 'auditioned' && onAuditionResultUpdate && (
            <MenuItem
              onClick={() => {
                handleMenuClose();
                setAuditionDialogOpen(true);
              }}
            >
              <StarIcon sx={{ mr: 1, color: '#f59e0b' }} />
              Legg til vurdering
            </MenuItem>
          )}
        </Menu>

        <Dialog open={auditionDialogOpen} onClose={() => setAuditionDialogOpen(false)}>
          <DialogTitle>Audition-vurdering for {candidateName}</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2, mt: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255,255,255,0.87)' }}>
                Rating
              </Typography>
              <Rating
                value={rating}
                onChange={(_, newValue) => setRating(newValue || 0)}
                size="large"
                sx={{
                  '& .MuiRating-iconFilled': { color: '#f59e0b' },
                }}
              />
            </Box>
            <TextField
              label="Notater fra audition"
              multiline
              rows={4}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Beskriv kandidatens prestasjon..."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAuditionDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleAuditionDialogSubmit} variant="contained" color="primary">
              Lagre vurdering
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  function ColorlibStepIcon(props: { active?: boolean; completed?: boolean; icon: number }) {
    const { active, completed, icon } = props;
    const stepData = WORKFLOW_STEPS[icon - 1];

    return (
      <ColorlibStepIconRoot ownerState={{ completed, active, declined: isDeclined }}>
        {stepData?.icon}
      </ColorlibStepIconRoot>
    );
  }

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
          Status for {candidateName}
        </Typography>
        {getStatusChip()}
      </Box>
      
      <Stepper
        alternativeLabel
        activeStep={activeStep}
        connector={<ColorlibConnector />}
      >
        {WORKFLOW_STEPS.map((step, index) => (
          <Step key={step.status} completed={index < activeStep}>
            <StepLabel
              StepIconComponent={(props) => (
                <ColorlibStepIcon {...props} icon={index + 1} />
              )}
              sx={{
                '& .MuiStepLabel-label': {
                  color: index <= activeStep ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: '0.75rem',
                  mt: 0.5,
                },
              }}
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {auditionRating && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Audition-vurdering:
          </Typography>
          <Rating value={auditionRating} readOnly size="small" sx={{ '& .MuiRating-iconFilled': { color: '#f59e0b' } }} />
          {auditionNotes && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', ml: 1 }}>
              "{auditionNotes}"
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export const WorkflowStatusBadge: FC<{
  status: WorkflowStatus | 'declined';
  showLabel?: boolean;
}> = ({ status, showLabel = true }) => {
  if (status === 'declined') {
    return (
      <Chip
        icon={<CancelIcon sx={{ fontSize: 14 }} />}
        label={showLabel ? 'Avslått' : undefined}
        size="small"
        sx={{
          bgcolor: 'rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          fontWeight: 600,
          fontSize: '0.7rem',
          height: showLabel ? 24 : 20,
        }}
      />
    );
  }

  const step = WORKFLOW_STEPS.find(s => s.status === status);
  if (!step) return null;

  return (
    <Chip
      icon={cloneElement(step.icon as ReactElement, { sx: { fontSize: 14 } })}
      label={showLabel ? step.label : undefined}
      size="small"
      sx={{
        bgcolor: `${step.color}20`,
        color: step.color,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: showLabel ? 24 : 20,
        '& .MuiChip-icon': { color: step.color },
      }}
    />
  );
};

export const getWorkflowStatusColor = (status: WorkflowStatus | 'declined'): string => {
  if (status === 'declined') return '#ef4444';
  const step = WORKFLOW_STEPS.find(s => s.status === status);
  return step?.color || '#9ca3af';
};

export const getWorkflowStatusLabel = (status: WorkflowStatus | 'declined'): string => {
  if (status === 'declined') return 'Avslått';
  const step = WORKFLOW_STEPS.find(s => s.status === status);
  return step?.label || 'Ukjent';
};

export default CandidateWorkflowStatus;
