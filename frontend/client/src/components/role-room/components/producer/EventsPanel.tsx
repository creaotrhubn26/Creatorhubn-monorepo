// Arrangement — publish Instagram events on the client's IG Business account
// (open house, gratis-konsultasjon, webinar, lansering) so followers can RSVP.
// An event-driven lead source. Live writes need instagram_manage_events
// approval; until then the panel explains the pending state.
import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import EventCard from './EventCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Alert, Divider, IconButton,
} from '@mui/material';
import { EventOutlined as EventIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import ConnectionPicker from './ConnectionPicker';

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
        <ConnectionPicker connections={connections} value={connectionId} onChange={setConnectionId} label="Velg konto" />
      </Stack>

      {connLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : connections.length === 0 ? (
        <Alert severity="info">Koble til kundens Instagram-bedriftskonto først (under Feed-planner) for å lage arrangement.</Alert>
      ) : (
        <>
          {graphError ? (
            <Alert severity="info">
              Arrangement er ikke aktivert ennå (venter på godkjenning av <code>instagram_manage_events</code> fra Meta). Du kan fylle ut under nå; det publiseres når det er godkjent.
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
            <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>
          ) : events.length === 0 ? (
            <Typography sx={{ p: 2, color: 'rgba(226,232,240,0.5)', fontSize: '0.84rem' }}>Ingen kommende arrangement ennå.</Typography>
          ) : (
            <Stack spacing={1.2}>
              {events.map((ev) => (
                <EventCard key={ev.id} event={ev} onDelete={(id) => remove.mutate(id)} deleting={remove.isPending} />
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
