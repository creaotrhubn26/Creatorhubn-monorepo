/**
 * AssignStripDialog.tsx
 * Dialog for moving one or more scene strips to a shooting day.
 */

import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  alpha,
} from '@mui/material';
import type { ShootingDay, StripboardStrip } from '../../services/productionWorkflowService';
import type { ResponsiveValues } from './stripboard.types';

interface AssignStripDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedStrip: StripboardStrip | null;
  /** The first 3 scene numbers to show as preview for bulk moves */
  sampleSceneNumbers: string[];
  selectedStripCount: number;
  shootingDays: ShootingDay[];
  assignDayId: string;
  onAssignDayChange: (dayId: string) => void;
  isMobile: boolean;
  responsive: ResponsiveValues;
}

export const AssignStripDialog: FC<AssignStripDialogProps> = ({
  open,
  onClose,
  onConfirm,
  selectedStrip,
  sampleSceneNumbers,
  selectedStripCount,
  shootingDays,
  assignDayId,
  onAssignDayChange,
  isMobile,
  responsive,
}) => {

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: { borderRadius: isMobile ? 0 : 3 },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: responsive.fontSize.title,
          bgcolor: alpha('#7C3AED', 0.05),
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {isMobile ? 'Flytt scene' : 'Flytt scene til opptaksdag'}
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {selectedStrip && (
          <Box sx={{ mb: 2 }}>
            {selectedStripCount > 1 ? (
              <Typography sx={{ fontSize: responsive.fontSize.body }}>
                {selectedStripCount} scener valgt (f.eks.{' '}
                {sampleSceneNumbers.join(', ')}
                )
              </Typography>
            ) : (
              <Typography sx={{ fontSize: responsive.fontSize.body }}>
                Scene <strong>{selectedStrip.sceneNumber}</strong> -{' '}
                {selectedStrip.location}
              </Typography>
            )}
          </Box>
        )}

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Velg dag</InputLabel>
          <Select
            value={assignDayId}
            label="Velg dag"
            onChange={e => onAssignDayChange(e.target.value)}
            sx={{ fontSize: responsive.fontSize.body }}
            MenuProps={{ sx: { zIndex: 1400 } }}
          >
            <MenuItem value="unassign">
              <em>Fjern fra plan</em>
            </MenuItem>
            {shootingDays.map(day => (
              <MenuItem key={day.id} value={day.id}>
                Dag {day.dayNumber} -{' '}
                {new Date(day.date).toLocaleDateString('nb-NO')}
                {!isMobile && ` - ${day.location}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>

      <DialogActions
        sx={{ p: { xs: 2, sm: 2 }, borderTop: 1, borderColor: 'divider' }}
      >
        <Button onClick={onClose} sx={{ fontSize: responsive.fontSize.body }}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            fontSize: responsive.fontSize.body,
            bgcolor: '#7C3AED',
            '&:hover': { bgcolor: '#6D28D9' },
          }}
        >
          Flytt
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignStripDialog;
