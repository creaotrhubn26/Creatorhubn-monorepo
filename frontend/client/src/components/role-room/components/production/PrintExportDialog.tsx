/**
 * PrintExportDialog.tsx
 * Dialog for configuring print / export options.
 */

import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  alpha,
} from '@mui/material';
import { Print as PrintIcon, TableChart as TableChartIcon } from '@mui/icons-material';
import type { PrintOptions, ResponsiveValues } from './stripboard.types';

interface PrintExportDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmPrint: () => void;
  onExportCSV: () => void;
  printOptions: PrintOptions;
  setPrintOptions: React.Dispatch<React.SetStateAction<PrintOptions>>;
  responsive: ResponsiveValues;
}

export const PrintExportDialog: FC<PrintExportDialogProps> = ({
  open,
  onClose,
  onConfirmPrint,
  onExportCSV,
  printOptions,
  setPrintOptions,
  responsive,
}) => {
  const toggle = (key: keyof PrintOptions) =>
    setPrintOptions(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: { xs: 2, sm: 3 } } }}
    >
      <DialogTitle
        sx={{
          bgcolor: alpha('#7C3AED', 0.05),
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <PrintIcon sx={{ color: '#7C3AED' }} />
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Skriv ut / Eksporter
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Velg hva som skal inkluderes i utskriften
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
        <FormGroup>
          {/* ── Layout options ─────────────────────────────────────── */}
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.header}
                onChange={() => toggle('header')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Topptekst med logo
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Prosjektnavn og The Role Room-branding
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.stats}
                onChange={() => toggle('stats')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Statistikk
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Totalt antall scener, sider, tid
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.legend}
                onChange={() => toggle('legend')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Fargeforklaring
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  INT/EXT, Dag/Natt fargekoder
                </Typography>
              </Box>
            }
          />

          <Divider sx={{ my: 1.5 }} />

          {/* ── Content options ────────────────────────────────────── */}
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.scheduledDays}
                onChange={() => toggle('scheduledDays')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Planlagte opptaksdager
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dag 1, Dag 2, osv. med scener
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.unassignedScenes}
                onChange={() => toggle('unassignedScenes')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Ikke planlagte scener
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Scener som ikke er tildelt en dag
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.castInfo}
                onChange={() => toggle('castInfo')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Skuespillere
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vis cast på hver scene
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={printOptions.notes}
                onChange={() => toggle('notes')}
                sx={{ color: '#7C3AED', '&.Mui-checked': { color: '#7C3AED' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Notater
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vis notater på scener
                </Typography>
              </Box>
            }
          />
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Eksporter som fil:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TableChartIcon />}
            onClick={() => {
              onExportCSV();
              onClose();
            }}
            sx={{
              borderColor: '#10B981',
              color: '#10B981',
              '&:hover': {
                borderColor: '#059669',
                bgcolor: alpha('#10B981', 0.05),
              },
            }}
          >
            CSV (Excel)
          </Button>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{ p: { xs: 2, sm: 2 }, borderTop: 1, borderColor: 'divider', gap: 1 }}
      >
        <Button onClick={onClose} sx={{ fontSize: responsive.fontSize.body }}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={onConfirmPrint}
          startIcon={<PrintIcon />}
          sx={{
            fontSize: responsive.fontSize.body,
            bgcolor: '#7C3AED',
            '&:hover': { bgcolor: '#6D28D9' },
          }}
        >
          Skriv ut PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintExportDialog;
