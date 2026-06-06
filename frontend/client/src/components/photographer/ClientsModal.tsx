// ClientsModal — modal-wrapper for fotograf-klient-CRM.
// Lar dashboardet åpne klient-liste som overlay i stedet for å navigere
// til /photographer/clients-siden. Den underliggende siden beholdes
// for direkte-link-bruk (delte URL-er, breadcrumbs, mobil-deep-links).

import React, { Suspense } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  CircularProgress,
  Typography,
  Stack,
} from '@mui/material';
import { Close, Person } from '@mui/icons-material';

// Lazy-import for å unngå å dra inn hele klient-CRM-bundlen før modalen
// faktisk åpnes. Matcher mønsteret dashboardets quickModal allerede bruker.
const PhotographerClientsList = React.lazy(
  () => import('@/pages/photographer-clients-list'),
);

export interface ClientsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ClientsModal({ open, onClose }: ClientsModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', minHeight: '85vh' } }}
      aria-labelledby="clients-modal-title"
    >
      <DialogTitle
        id="clients-modal-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Person />
          <Typography component="span" variant="h6">Kunder</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label="Lukk">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Suspense
          fallback={(
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
        >
          {open && <PhotographerClientsList />}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
