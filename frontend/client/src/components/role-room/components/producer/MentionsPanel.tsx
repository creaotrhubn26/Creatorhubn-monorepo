// Omtaler — social listening. Surfaces public posts where the client's connected
// Facebook Page is tagged/mentioned, so the producer can see "who's talking about
// the client", respond, and turn positive mentions into content or warm leads.
// Real-product surface on top of the Page Mentions capability. Live data needs
// App Review approval; until then the panel explains the pending state.
import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Chip, Button, CircularProgress, Alert, Divider, Link, TextField,
} from '@mui/material';
import { CampaignOutlined as MentionsIcon, OpenInNew as OpenIcon, AutoAwesome as AiIcon } from '@mui/icons-material';
import ConnectionPicker from './ConnectionPicker';
import { LoadingSkeleton, PanelHeader } from './ui';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

type Status = 'svart' | 'lead' | 'skjult';
const buildSTATUSES = (t: TFn): { key: Status; label: string; color: string }[] => ([
  { key: 'svart', label: t('mentions.s014'), color: '#38bdf8' },
  { key: 'lead', label: t('mentions.s010'), color: '#22c55e' },
  { key: 'skjult', label: t('mentions.s012'), color: '#94a3b8' },
]);

interface IgConnection {
  id: string;
  igUsername: string | null;
  facebookPageName: string | null;
}
interface Mention {
  id: string;
  from: string | null;
  message: string | null;
  createdTime: string | null;
  permalinkUrl: string | null;
  status: Status | null;
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
}

export default function MentionsPanel() {
  const { t } = useT();
  const STATUSES = useMemo(() => buildSTATUSES(t), [t]);
  const [connectionId, setConnectionId] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'alle'>('alle');
  const queryClient = useQueryClient();

  const { data: connData, isLoading: connLoading } = useQuery<{ connections: IgConnection[] }>({
    queryKey: ['mentions-connections'],
    queryFn: () => apiRequest('/api/role-room/instagram/connections'),
  });
  const connections = connData?.connections || [];
  useEffect(() => {
    if (!connectionId && connections.length > 0) setConnectionId(connections[0].id);
  }, [connectionId, connections]);

  const { data: mentionsData, isLoading: mentionsLoading } = useQuery<{
    mentions: Mention[]; pageName: string | null; success: boolean; error: string | null;
  }>({
    queryKey: ['mentions-list', connectionId],
    enabled: !!connectionId,
    queryFn: () => apiRequest(`/api/role-room/mentions/producer?connectionId=${encodeURIComponent(connectionId)}`),
  });
  const mentions = mentionsData?.mentions || [];

  const setStatus = useMutation({
    mutationFn: async (vars: { mentionId: string; status: Status | null }) =>
      apiRequest('/api/role-room/mentions/producer/status', {
        method: 'POST',
        body: JSON.stringify({ connectionId, mentionId: vars.mentionId, status: vars.status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mentions-list', connectionId] }),
  });

  // AI-drafted replies, keyed by mention id (producer reviews before posting).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState<string | null>(null);
  const draftReply = async (m: Mention) => {
    setDrafting(m.id);
    try {
      const r = await apiRequest('/api/role-room/mentions/producer/draft-reply', {
        method: 'POST',
        body: JSON.stringify({ connectionId, from: m.from, message: m.message }),
      }) as { success: boolean; reply?: string; error?: string };
      setDrafts((d) => ({ ...d, [m.id]: r.success ? (r.reply || '') : (r.error || t('mentions.s003')) }));
    } catch (e) {
      setDrafts((d) => ({ ...d, [m.id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setDrafting(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: mentions.length };
    for (const s of STATUSES) c[s.key] = mentions.filter((m) => m.status === s.key).length;
    return c;
  }, [mentions]);
  const visible = statusFilter === 'alle' ? mentions : mentions.filter((m) => m.status === statusFilter);
  const graphError = mentionsData && mentionsData.success === false ? mentionsData.error : null;

  return (
    <Stack spacing={1.6} sx={{ p: { xs: 1, md: 2 } }}>
      <PanelHeader
        icon={<MentionsIcon />}
        title={t('mentions.s004')}
        subtitle={t('mentions.s007')}
        actions={<ConnectionPicker connections={connections} value={connectionId} onChange={setConnectionId} label={t('mentions.s016')} />}
      />

      {connLoading ? (
        <LoadingSkeleton variant="list" />
      ) : connections.length === 0 ? (
        <Alert severity="info">{t('mentions.s008')}</Alert>
      ) : (
        <>
          {graphError ? (
            <Alert severity="info">
              {t('mentions.s011')} <code>Page Mentions</code> {t('mentions.s017')}
            </Alert>
          ) : null}

          {/* Status filter */}
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Chip
              size="small" label={t('mentions.p00', { v0: counts.alle })} clickable
              onClick={() => setStatusFilter('alle')}
              variant={statusFilter === 'alle' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, bgcolor: statusFilter === 'alle' ? 'rgba(34,211,238,0.18)' : 'transparent', color: statusFilter === 'alle' ? 'var(--role-cyan, #22d3ee)' : 'rgba(226,232,240,0.7)' }}
            />
            {STATUSES.map((s) => (
              <Chip
                key={s.key} size="small" clickable
                label={`${s.label} (${counts[s.key] ?? 0})`}
                onClick={() => setStatusFilter(s.key)}
                variant={statusFilter === s.key ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700, bgcolor: statusFilter === s.key ? `${s.color}26` : 'transparent', color: s.color, borderColor: `${s.color}66` }}
              />
            ))}
          </Stack>

          <Divider />

          {mentionsLoading ? (
            <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>
          ) : visible.length === 0 ? (
            <Typography sx={{ p: 2, color: 'rgba(226,232,240,0.5)', fontSize: '0.84rem' }}>
              {mentions.length === 0 ? t('mentions.s005') : t('mentions.s006')}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {visible.map((m) => {
                const active = STATUSES.find((s) => s.key === m.status) || null;
                return (
                  <Box key={m.id} sx={{ border: '1px solid', borderColor: active ? `${active.color}55` : 'divider', borderRadius: 2, p: 1.4, bgcolor: 'rgba(15,23,41,0.4)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.86rem' }}>{m.from || t('mentions.s015')}</Typography>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.88rem', mt: 0.4, whiteSpace: 'pre-wrap' }}>{m.message || t('mentions.s000')}</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', mt: 0.6 }}>{fmt(m.createdTime)}</Typography>
                      </Box>
                      {m.permalinkUrl ? (
                        <Link href={m.permalinkUrl} target="_blank" rel="noopener" sx={{ flexShrink: 0, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                          {t('mentions.s018')} <OpenIcon sx={{ fontSize: 14 }} />
                        </Link>
                      ) : null}
                    </Stack>
                    <Stack direction="row" spacing={0.6} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      {STATUSES.map((s) => (
                        <Chip
                          key={s.key} size="small" clickable
                          label={s.label}
                          onClick={() => setStatus.mutate({ mentionId: m.id, status: m.status === s.key ? null : s.key })}
                          variant={m.status === s.key ? 'filled' : 'outlined'}
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: m.status === s.key ? `${s.color}26` : 'transparent', color: s.color, borderColor: `${s.color}66` }}
                        />
                      ))}
                      <Chip
                        size="small" clickable icon={<AiIcon sx={{ fontSize: 14 }} />}
                        label={drafting === m.id ? t('mentions.s013') : t('mentions.s002')}
                        onClick={() => draftReply(m)}
                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: 'rgba(168,85,247,0.16)', color: '#d8b4fe', '& .MuiChip-icon': { color: '#d8b4fe' } }}
                      />
                    </Stack>
                    {drafts[m.id] !== undefined ? (
                      <Stack spacing={0.6} sx={{ mt: 1 }}>
                        <TextField
                          size="small" multiline fullWidth minRows={2}
                          value={drafts[m.id]}
                          onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                          label={t('mentions.s001')}
                        />
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" sx={{ textTransform: 'none', fontSize: '0.74rem' }}
                            onClick={() => { try { navigator.clipboard?.writeText(drafts[m.id]); } catch { /* ignore */ } }}>
                            {t('mentions.s009')}
                          </Button>
                          {m.permalinkUrl ? (
                            <Button size="small" variant="outlined" sx={{ textTransform: 'none', fontSize: '0.74rem' }}
                              href={m.permalinkUrl} target="_blank" rel="noopener">
                              {t('mentions.s019')}
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
