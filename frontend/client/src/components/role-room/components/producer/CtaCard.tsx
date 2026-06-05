// "Book nå"-CTA — sets the client's Facebook Page call-to-action button so the
// Page itself captures leads. Lives at the top of the Leads tab (lead capture).
// Live writes need pages_manage_cta approval; UI explains the pending state.
import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Button, TextField, Select, MenuItem, Alert, Collapse, CircularProgress,
} from '@mui/material';
import { TouchAppOutlined as CtaIcon } from '@mui/icons-material';

const CTA_LABELS: Record<string, string> = {
  BOOK_NOW: 'Book nå', CALL_NOW: 'Ring nå', SIGN_UP: 'Registrer deg', GET_QUOTE: 'Få tilbud',
  CONTACT_US: 'Kontakt oss', LEARN_MORE: 'Les mer', SHOP_NOW: 'Kjøp nå',
  MESSAGE_PAGE: 'Send melding', GET_DIRECTIONS: 'Veibeskrivelse',
};
// CTA types that target a phone number rather than a URL.
const PHONE_TYPES = ['BOOK_NOW', 'CALL_NOW'];

export default function CtaCard({ connectionId }: { connectionId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ctaType, setCtaType] = useState('BOOK_NOW');
  const [ctaUrl, setCtaUrl] = useState('');

  const { data, isLoading } = useQuery<{
    success: boolean; pageName?: string; phone?: string | null; website?: string | null;
    ctaTypes?: string[]; error?: string;
  }>({
    queryKey: ['cta-producer', connectionId],
    enabled: !!connectionId && open,
    queryFn: () => apiRequest(`/api/role-room/cta/producer?connectionId=${encodeURIComponent(connectionId)}`),
  });

  // Seed the target field from the page's current phone/website.
  useEffect(() => {
    if (!data?.success) return;
    setCtaUrl((prev) => prev || (PHONE_TYPES.includes(ctaType) ? (data.phone || '') : (data.website || '')));
  }, [data, ctaType]);

  const save = useMutation<{ success: boolean; note?: string | null; error?: string | null }, Error, void>({
    mutationFn: async () =>
      apiRequest('/api/role-room/cta/producer', {
        method: 'POST', body: JSON.stringify({ connectionId, ctaType, ctaUrl }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cta-producer', connectionId] }),
  });

  const isPhone = PHONE_TYPES.includes(ctaType);

  return (
    <Box sx={{ border: '1px solid rgba(168,85,247,0.32)', bgcolor: 'rgba(168,85,247,0.07)', borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.4, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <CtaIcon sx={{ color: '#c084fc' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: '#f8fafc' }}>Gjør Facebook-siden til en lead-maskin</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
            Sett en «Book nå»-knapp på kundens side, så folk kan booke/ringe rett fra Facebook.
          </Typography>
        </Box>
        <Typography sx={{ color: '#c084fc', fontSize: '0.8rem', fontWeight: 700 }}>{open ? 'Skjul' : 'Sett knapp'}</Typography>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.4, pb: 1.6 }}>
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={18} /></Box>
          ) : (
            <Stack spacing={1.2}>
              {data && data.success === false ? (
                <Alert severity="info">
                  Knapp-endring er ikke aktiv ennå (venter på godkjenning av <code>pages_manage_cta</code> fra Meta). Valget lagres når det er godkjent.
                </Alert>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }}>
                <Select
                  size="small" value={ctaType}
                  onChange={(e) => { setCtaType(e.target.value); setCtaUrl(''); }}
                  sx={{ minWidth: 170 }}
                >
                  {Object.keys(CTA_LABELS).map((t) => (
                    <MenuItem key={t} value={t}>{CTA_LABELS[t]}</MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small" fullWidth value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder={isPhone ? '+47 …' : 'https://kunde.no/book'}
                  label={isPhone ? 'Telefonnummer' : 'Lenke'}
                />
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                {save.data?.success ? (
                  <Typography sx={{ fontSize: '0.78rem', color: '#86efac' }}>«{CTA_LABELS[ctaType]}»-knappen er satt</Typography>
                ) : save.data && save.data.success === false ? (
                  <Typography sx={{ fontSize: '0.78rem', color: '#fca5a5' }}>{save.data.error}</Typography>
                ) : null}
                <Button size="small" variant="contained" onClick={() => save.mutate()} disabled={!ctaUrl || save.isPending}>
                  {save.isPending ? 'Setter…' : 'Sett knapp'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
