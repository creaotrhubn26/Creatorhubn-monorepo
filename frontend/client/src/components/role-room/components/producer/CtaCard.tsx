// "Book nå"-CTA — sets the client's Facebook Page call-to-action button so the
// Page itself captures leads. Lives at the top of the Leads tab (lead capture).
// Live writes need pages_manage_cta approval; UI explains the pending state.
import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Button, TextField, Select, MenuItem, Alert, Collapse, CircularProgress,
} from '@mui/material';
import { TouchAppOutlined as CtaIcon } from '@mui/icons-material';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

const buildCTA_LABELS = (t: TFn): Record<string, string> => ({
  BOOK_NOW: t('ctaCard.s000'), CALL_NOW: t('ctaCard.s009'), SIGN_UP: t('ctaCard.s008'), GET_QUOTE: t('ctaCard.s001'),
  CONTACT_US: t('ctaCard.s005'), LEARN_MORE: t('ctaCard.s007'), SHOP_NOW: t('ctaCard.s003'),
  MESSAGE_PAGE: t('ctaCard.s010'), GET_DIRECTIONS: t('ctaCard.s016'),
});
// CTA types that target a phone number rather than a URL.
const PHONE_TYPES = ['BOOK_NOW', 'CALL_NOW'];

export default function CtaCard({ connectionId }: { connectionId: string }) {
  const { t } = useT();
  const CTA_LABELS = useMemo(() => buildCTA_LABELS(t), [t]);
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
    <Box sx={{ border: '1px solid rgba(34,211,238,0.3)', bgcolor: 'rgba(34,211,238,0.06)', borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.4, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <CtaIcon sx={{ color: 'var(--role-cyan, #22d3ee)' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: '#f8fafc' }}>{t('ctaCard.s002')}</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
            {t('ctaCard.s011')}
          </Typography>
        </Box>
        <Typography sx={{ color: 'var(--role-cyan, #22d3ee)', fontSize: '0.8rem', fontWeight: 700 }}>{open ? t('ctaCard.s014') : t('ctaCard.s012')}</Typography>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.4, pb: 1.6 }}>
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={18} /></Box>
          ) : (
            <Stack spacing={1.2}>
              {data && data.success === false ? (
                <Alert severity="info">
                  {t('ctaCard.s004')} <code>pages_manage_cta</code> {t('ctaCard.s017')}
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
                  label={isPhone ? t('ctaCard.s015') : t('ctaCard.s006')}
                />
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                {save.data?.success ? (
                  <Typography sx={{ fontSize: '0.78rem', color: '#86efac' }}>«{CTA_LABELS[ctaType]}»-knappen er satt</Typography>
                ) : save.data && save.data.success === false ? (
                  <Typography sx={{ fontSize: '0.78rem', color: '#fca5a5' }}>{save.data.error}</Typography>
                ) : null}
                <Button size="small" variant="contained" onClick={() => save.mutate()} disabled={!ctaUrl || save.isPending}>
                  {save.isPending ? t('ctaCard.s013') : t('ctaCard.s012')}
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
