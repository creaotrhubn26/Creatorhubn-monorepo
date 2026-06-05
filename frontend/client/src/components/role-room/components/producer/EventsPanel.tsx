// Arrangement — publish Instagram events on the client's IG Business account
// (open house, gratis-konsultasjon, webinar, lansering) so followers can RSVP.
// An event-driven lead source. Live writes need instagram_manage_events
// approval; until then the panel explains the pending state.
import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Alert, Divider, IconButton,
} from '@mui/material';
import { EventOutlined as EventIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';

interface IgConnection { id: string; igUsername: string | null; facebookPageName: string | null }
interface IgEvent {
  id: string; title: string | null; startTime: string | null; endTime: string | null;
  description: string | null; venue: string | null;
}

function fmt(v: string | null): string {
  if (!v) return '';
  // Graph returns epoch seconds or ISO; handle both.
  const d = /^\d+$/.test(v) ? new Date(Number(v) * 1000) : new Date(v);
  try { return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return v; }
}

export default function EventsPanel() {
  const [connectionId, setConnectionId] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: connData, isLoading: connLoading } = useQuery<{ connections: IgConnection[] }>({
    queryKey: ['events-connections'],
    queryFn: () => apiRequest('/api/role-room/instagram/messaging/connections'),
  });
  const connections = connData?.connections || [];
  useEffect(() => {
    if (!connectionId && connections.length > 0) setConnectionId(connections[0].id);
  }, [connectionId, connections]);

  const { data, isLoading } = useQuery<{ events: IgEvent[]; success: boolean; error: string | null }>({
    queryKey: ['events-list', connectionId],
    enabled: !!connectionId,
    queryFn: () => apiRequest(`/api/role-room/events/producer?connectionId=${encodeURIComponent(connectionId)}`),
  });
  const events = data?.events || [];
  const graphError = data && data.success === false ? data.error : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['events-list', connectionId] });
  const create = useMutation<{ success: boolean; error?: string }, Error, void>({
    mutationFn: async () =>
      apiRequest('/api/role-room/events/producer', {
        method: 'POST',
        body: JSON.stringify({ connectionId, name, startTime, endTime: endTime || undefined, placeName: placeName || undefined, description: description || undefined }),
      }),
    onSuccess: (r) => { if (r.success) { setName(''); setStartTime(''); setEndTime(''); setPlaceName(''); setDescription(''); } invalidate(); },
  });
  const remove = useMutation<unknown, Error, string>({
    mutationFn: async (eventId: string) =>
      apiRequest(`/api/role-room/events/producer/${encodeURIComponent(eventId)}?connectionId=${encodeURIComponent(connectionId)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return (
    <Stack spacing={1.6} sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <EventIcon sx={{ color: '#22d3ee' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>Arrangement</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem' }}>
            Lag Instagram-arrangement (åpen dag, gratis konsultasjon, webinar) som følgere kan melde seg på — en kilde til nye leads.
          </Typography>
        </Box>
        {connections.length > 1 ? (
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            style={{ background: '#0f1729', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: 8 }}
          >
            {connections.map((c) => <option key={c.id} value={c.id}>{c.facebookPageName || `@${c.igUsername}`}</option>)}
          </select>
        ) : null}
      </Stack>

      {connLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : connections.length === 0 ? (
        <Alert severity="info">Koble til kundens Instagram-bedriftskonto først (under Feed-planner) for å lage arrangement.</Alert>
      ) : (
        <>
          {graphError ? (
            <Alert severity="info">
              Arrangement er ikke aktivt ennå (venter på godkjenning av <code>instagram_manage_events</code> fra Meta). Du kan fylle ut under nå; det publiseres når det er godkjent.
            </Alert>
          ) : null}

          {/* Create form */}
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.6 }}>
            <Typography sx={{ fontWeight: 800, color: '#f8fafc', mb: 1 }}>Nytt arrangement</Typography>
            <Stack spacing={1.2}>
              <TextField size="small" label="Tittel" fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="Gratis tannsjekk-dag" />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                <TextField size="small" type="datetime-local" label="Start" fullWidth InputLabelProps={{ shrink: true }} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <TextField size="small" type="datetime-local" label="Slutt (valgfritt)" fullWidth InputLabelProps={{ shrink: true }} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Stack>
              <TextField size="small" label="Sted (valgfritt)" fullWidth value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Klinikken, Storgata 1" />
              <TextField size="small" label="Beskrivelse (valgfritt)" fullWidth multiline minRows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                {create.data && create.data.success === false ? <Typography sx={{ fontSize: '0.78rem', color: '#fca5a5' }}>{create.data.error}</Typography> : null}
                {create.data?.success ? <Typography sx={{ fontSize: '0.78rem', color: '#86efac' }}>Arrangement opprettet</Typography> : null}
                <Button variant="contained" size="small" onClick={() => create.mutate()} disabled={!name || !startTime || create.isPending}>
                  {create.isPending ? 'Oppretter…' : 'Opprett arrangement'}
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Divider>Kommende arrangement</Divider>
          {isLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>
          ) : events.length === 0 ? (
            <Typography sx={{ p: 2, color: 'rgba(226,232,240,0.5)', fontSize: '0.84rem' }}>Ingen kommende arrangement ennå.</Typography>
          ) : (
            <Stack spacing={1}>
              {events.map((ev) => (
                <Box key={ev.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.2, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>{ev.title || '(uten tittel)'}</Typography>
                    <Typography sx={{ color: '#7dd3fc', fontSize: '0.78rem', mt: 0.2 }}>{fmt(ev.startTime)}{ev.endTime ? ` – ${fmt(ev.endTime)}` : ''}</Typography>
                    {ev.venue ? <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.78rem' }}>{ev.venue}</Typography> : null}
                    {ev.description ? <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', mt: 0.4, whiteSpace: 'pre-wrap' }}>{ev.description}</Typography> : null}
                  </Box>
                  <IconButton size="small" onClick={() => remove.mutate(ev.id)} disabled={remove.isPending} aria-label="Slett arrangement">
                    <DeleteIcon fontSize="small" sx={{ color: '#fca5a5' }} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
