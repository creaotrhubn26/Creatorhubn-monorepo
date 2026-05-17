// Slice 9X.22 — klient-form for brudepar. De fyller ut:
//   - GDPR-samtykke (kreves før noe lagres)
//   - Kultur-velger (norsk-kristen, muslimsk, hindu, jødisk, sekulær)
//   - Fotografens ankomst-tid
//   - Lokasjoner (forberedelse, vielse, festlokale)
//   - VIP-kontakter (foreldre, forlover, brudepiker)
//   - Inspirasjons-lenker (Pinterest, Instagram)
//   - Slett-mine-data-knapp (GDPR Art. 17)

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, TextField, IconButton,
  CircularProgress, Alert, FormControl, FormControlLabel, Checkbox,
  Select, MenuItem, InputLabel, Divider, Snackbar, Switch, Chip,
} from '@mui/material';
import {
  FavoriteBorder, Add, Delete, LocationOn, Person, Image as ImageIcon,
  Save, DeleteForever, Warning, CheckCircle, Schedule, Comment as CommentIcon,
} from '@mui/icons-material';
import { Avatar } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import VenueInfoCard from '@/components/photographer/VenueInfoCard';
import PlanBManager from '@/components/wedding/PlanBManager';
import { useWeddingWebSocket } from '@/hooks/useWeddingWebSocket';

interface WeddingTimeline {
  id: string;
  coupleName: string;
  weddingDate: string;
  culture: string | null;
  photographerArrival: string | null;
  showcaseUrl: string | null;
  gdprConsented: boolean;
}

interface WeddingLocation {
  id?: string;
  label: string;
  address: string;
  postalCode: string;
  city: string;
  arrivalTime: string;
  departureTime: string;
  notes: string;
  // Slice 9X.37 — værsensitivitet + plan B
  isIndoor?: boolean;
  weatherDependent?: boolean;
  // Lagrede alternativer (kun lest — adminstreres via separat endpoint)
  alternatives?: Array<{
    id: string;
    label: string;
    address: string | null;
    city: string | null;
    isIndoor: boolean | null;
    activationStatus: 'standby' | 'active' | 'used';
  }>;
}

interface WeddingContact {
  id?: string;
  fullName: string;
  relation: string;
  phone: string;
  email: string;
  notes: string;
  isMustCapture: boolean;
}

interface WeddingInspiration {
  id?: string;
  imageUrl: string;
  sourceUrl: string;
  caption: string;
  uploadedByEmail: string;
}

interface CultureTemplate {
  id: string;
  displayName: string;
  description: string;
}

interface DetailResponse {
  timeline: WeddingTimeline;
  locations: WeddingLocation[];
  contacts: WeddingContact[];
  inspirations: WeddingInspiration[];
}

interface ClientEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  scheduledTime: string | null;
  durationMinutes: number;
  estimatedShots: number | null;
  clientCanComment: boolean;
  comments: Array<{
    id: string;
    authorType: 'photographer' | 'client';
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

function ClientTimelineEventsSection({ token }: { token: string }) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ events: ClientEvent[] }>({
    queryKey: [`/api/wedding/client/${token}/timeline-events`],
    queryFn: () => apiRequest(`/api/wedding/client/${token}/timeline-events`),
  });

  const postComment = useMutation<unknown, Error, { eventId: string; content: string }>({
    mutationFn: ({ eventId, content }) =>
      apiRequest(`/api/wedding/client/${token}/timeline-events/${eventId}/comments`, {
        method: 'POST', body: JSON.stringify({ content }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/client/${token}/timeline-events`] });
      setDrafts((s) => ({ ...s, [vars.eventId]: '' }));
    },
  });

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }
  const events = data?.events ?? [];
  if (events.length === 0) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Schedule /> Fotografens timeline
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Her ser dere fotografens planlagte foto-events. Bruk kommentar-feltet under hvert event for
        å gi innspill (f.eks. "Ikke glem at far holder tale", "Bedstemor sitter ved bord 3").
      </Typography>
      <Stack spacing={2}>
        {events.map((ev) => (
          <Paper key={ev.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              <Box sx={{ minWidth: 70, textAlign: 'center' }}>
                <Schedule color="primary" />
                <Typography variant="caption" display="block" fontWeight={500}>
                  {ev.scheduledTime
                    ? new Date(ev.scheduledTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ev.durationMinutes} min
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1" fontWeight={500}>{ev.title}</Typography>
                {ev.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {ev.description}
                  </Typography>
                )}
                {ev.estimatedShots !== null && (
                  <Chip size="small" variant="outlined" label={`~${ev.estimatedShots} bilder`}
                    sx={{ height: 18, fontSize: 11 }} />
                )}
              </Box>
            </Stack>

            {ev.comments.length > 0 && (
              <Stack spacing={1} sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                {ev.comments.map((c) => (
                  <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start">
                    <Avatar sx={{
                      width: 24, height: 24, fontSize: 11,
                      bgcolor: c.authorType === 'photographer' ? 'primary.main' : 'secondary.main',
                    }}>
                      {c.authorName.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="caption" fontWeight={500}>
                        {c.authorName}
                        <Chip size="small" sx={{ height: 14, fontSize: 9, ml: 0.5 }}
                          label={c.authorType === 'photographer' ? 'Fotograf' : 'Dere'}
                          color={c.authorType === 'photographer' ? 'primary' : 'secondary'} />
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}

            {ev.clientCanComment && (
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <TextField fullWidth size="small" placeholder="Skriv en kommentar..."
                  value={drafts[ev.id] ?? ''}
                  onChange={(e) => setDrafts((s) => ({ ...s, [ev.id]: e.target.value }))} />
                <Button variant="outlined" size="small" startIcon={<CommentIcon />}
                  disabled={!drafts[ev.id]?.trim() || postComment.isPending}
                  onClick={() => postComment.mutate({ eventId: ev.id, content: drafts[ev.id] })}>
                  Send
                </Button>
              </Stack>
            )}
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

const RELATIONS = [
  'Mor til bruden', 'Far til bruden', 'Mor til brudgom', 'Far til brudgom',
  'Søsken til bruden', 'Søsken til brudgom', 'Forlover (kvinne)', 'Forlover (mann)',
  'Brudepike', 'Forlovet/Best man', 'Bestemor', 'Bestefar',
  'Onkel/Tante', 'Vitner', 'Bryllups-koordinator', 'Annet',
];

export default function WeddingClientFormPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const qc = useQueryClient();

  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [culture, setCulture] = useState('');
  const [photographerArrival, setPhotographerArrival] = useState('');
  const [locations, setLocations] = useState<WeddingLocation[]>([]);
  const [contacts, setContacts] = useState<WeddingContact[]>([]);
  const [inspirations, setInspirations] = useState<WeddingInspiration[]>([]);
  const [newInspirationUrl, setNewInspirationUrl] = useState('');
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data, isLoading, error } = useQuery<DetailResponse>({
    queryKey: [`/api/wedding/client/${token}`],
    queryFn: () => apiRequest(`/api/wedding/client/${token}`),
    enabled: !!token,
  });

  // Slice 9X.39 — brudeparet (token-tilgang, ingen userId) hører på samme
  // wedding-room. Bruker token som pseudo-userId for å unngå anonymitet.
  useWeddingWebSocket({
    weddingId: data?.timeline?.id || '',
    userId: token ? `couple:${token}` : '',
    enabled: !!data?.timeline?.id && !!token,
    onEvent: (evt) => {
      if (evt.type === 'plan_b_activated' || evt.type === 'plan_b_deactivated') {
        const triggeredBy = evt.payload?.triggeredBy === 'photographer' ? 'fotografen' : 'dere';
        setSnackbar({
          msg: evt.type === 'plan_b_activated'
            ? `Plan B aktivert av ${triggeredBy}: ${evt.payload?.altLabel || 'ny lokasjon'}`
            : `Plan B avbrutt av ${triggeredBy} — tilbake til opprinnelig`,
          severity: evt.type === 'plan_b_activated' ? 'info' : 'success',
        });
        qc.invalidateQueries({ queryKey: [`/api/wedding/client/${token}`] });
      }
    },
  });

  const { data: culturesData } = useQuery<{ templates: CultureTemplate[] }>({
    queryKey: ['/api/wedding/culture-templates'],
    queryFn: () => apiRequest('/api/wedding/culture-templates'),
  });

  // Hydrer state fra server-data
  useEffect(() => {
    if (!data) return;
    setGdprAccepted(data.timeline.gdprConsented);
    setCulture(data.timeline.culture ?? '');
    setPhotographerArrival(
      data.timeline.photographerArrival
        ? new Date(data.timeline.photographerArrival).toISOString().slice(0, 16)
        : '',
    );
    setLocations(data.locations.map((l) => ({
      ...l,
      label: l.label ?? '',
      address: l.address ?? '',
      postalCode: l.postalCode ?? '',
      city: l.city ?? '',
      arrivalTime: l.arrivalTime ? new Date(l.arrivalTime).toISOString().slice(0, 16) : '',
      departureTime: l.departureTime ? new Date(l.departureTime).toISOString().slice(0, 16) : '',
      notes: l.notes ?? '',
    })));
    setContacts(data.contacts.map((c) => ({
      ...c,
      fullName: c.fullName ?? '',
      relation: c.relation ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      notes: c.notes ?? '',
      isMustCapture: !!c.isMustCapture,
    })));
    setInspirations(data.inspirations);
  }, [data]);

  const save = useMutation<unknown, Error, { markComplete?: boolean }>({
    mutationFn: ({ markComplete }) => apiRequest(`/api/wedding/client/${token}/details`, {
      method: 'POST',
      body: JSON.stringify({
        gdprConsent: gdprAccepted,
        culture: culture || null,
        photographerArrival: photographerArrival ? new Date(photographerArrival).toISOString() : null,
        locations,
        contacts,
        inspirations: inspirations.filter((i) => !i.id), // kun nye
        markComplete: !!markComplete,
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/client/${token}`] });
      setSnackbar({
        msg: vars.markComplete ? 'Lagret og merket som ferdig! Fotografen er varslet.' : 'Lagret',
        severity: 'success',
      });
    },
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try { const p = JSON.parse(msg); msg = p.message || p.error || msg; } catch { /* */ }
      setSnackbar({ msg: `Kunne ikke lagre: ${msg}`, severity: 'error' });
    },
  });

  const deleteData = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest(`/api/wedding/client/${token}/data`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar({ msg: 'Alle data slettet. Du vil bli omdirigert.', severity: 'success' });
      setTimeout(() => { window.location.href = '/'; }, 3000);
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
        <Alert severity="error">Kunne ikke laste wedding-timeline. Sjekk lenken eller kontakt fotografen.</Alert>
      </Box>
    );
  }

  const t = data.timeline;
  const weddingDate = new Date(t.weddingDate).toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fff5e6 0%, #ffe0c4 100%)',
      py: { xs: 2, md: 4 },
    }}>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 3 } }}>
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 3, textAlign: 'center' }}>
          <FavoriteBorder sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t.coupleName}</Typography>
          <Typography variant="h6" color="text.secondary">{weddingDate}</Typography>
        </Paper>

        {/* GDPR */}
        {!gdprAccepted && (
          <Paper sx={{ p: 3, mb: 3, border: 2, borderColor: 'warning.main' }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Warning color="warning" sx={{ mt: 0.5 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>GDPR-samtykke kreves</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Når dere fyller ut detaljer her, lagres informasjonen sikkert hos fotografen
                  for å forberede deres bryllup. Dere kan slette alle data når som helst med
                  "Slett mine data"-knappen nederst.
                </Typography>
                <FormControlLabel
                  control={<Checkbox
                    checked={gdprAccepted}
                    onChange={(e) => setGdprAccepted(e.target.checked)}
                  />}
                  label={
                    <Typography variant="body2">
                      Jeg samtykker til at fotografen lagrer disse opplysningene for bryllups-planlegging
                      i henhold til GDPR.
                    </Typography>
                  }
                />
              </Box>
            </Stack>
          </Paper>
        )}

        {/* KULTUR + FOTOGRAF ANKOMST */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Om bryllupet</Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Kultur / tradisjon</InputLabel>
              <Select
                value={culture}
                label="Kultur / tradisjon"
                onChange={(e) => setCulture(e.target.value)}
                disabled={!gdprAccepted}
              >
                <MenuItem value="">— Velg —</MenuItem>
                {(culturesData?.templates ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <Stack>
                      <Typography variant="body2">{c.displayName}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.description}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Fotografens ankomst-tid"
              type="datetime-local"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={photographerArrival}
              onChange={(e) => setPhotographerArrival(e.target.value)}
              disabled={!gdprAccepted}
              helperText="Når skal fotografen møte opp? F.eks. ved brudens forberedelse."
            />
          </Stack>
        </Paper>

        {/* LOKASJONER */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOn /> Lokasjoner ({locations.length})
            </Typography>
            <Button
              size="small" startIcon={<Add />}
              onClick={() => setLocations((l) => [...l, {
                label: '', address: '', postalCode: '', city: '',
                arrivalTime: '', departureTime: '', notes: '',
              }])}
              disabled={!gdprAccepted}
            >
              Legg til lokasjon
            </Button>
          </Stack>
          {locations.length === 0 && (
            <Alert severity="info">Legg til alle steder bryllupet skal være — forberedelse, kirken, festlokale.</Alert>
          )}
          <Stack spacing={2}>
            {locations.map((loc, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={500}>Lokasjon {i + 1}</Typography>
                  <IconButton size="small" color="error"
                    onClick={() => setLocations((l) => l.filter((_, idx) => idx !== i))}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1.5}>
                  <TextField
                    label="Navn på lokasjon" size="small" fullWidth required
                    placeholder="f.eks. Sankt Hanshaugen kirke"
                    value={loc.label}
                    onChange={(e) => setLocations((l) =>
                      l.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                  />
                  <TextField
                    label="Adresse" size="small" fullWidth
                    value={loc.address}
                    onChange={(e) => setLocations((l) =>
                      l.map((x, idx) => idx === i ? { ...x, address: e.target.value } : x))}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Postnr" size="small" sx={{ width: 100 }}
                      value={loc.postalCode}
                      onChange={(e) => setLocations((l) =>
                        l.map((x, idx) => idx === i ? { ...x, postalCode: e.target.value } : x))}
                    />
                    <TextField
                      label="Sted" size="small" fullWidth
                      value={loc.city}
                      onChange={(e) => setLocations((l) =>
                        l.map((x, idx) => idx === i ? { ...x, city: e.target.value } : x))}
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Fotograf ankomst" size="small" type="datetime-local" fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={loc.arrivalTime}
                      onChange={(e) => setLocations((l) =>
                        l.map((x, idx) => idx === i ? { ...x, arrivalTime: e.target.value } : x))}
                    />
                    <TextField
                      label="Forventet avgang" size="small" type="datetime-local" fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={loc.departureTime}
                      onChange={(e) => setLocations((l) =>
                        l.map((x, idx) => idx === i ? { ...x, departureTime: e.target.value } : x))}
                    />
                  </Stack>
                  <TextField
                    label="Notater" size="small" fullWidth multiline rows={2}
                    placeholder="f.eks. Parker på baksiden, ring vakt ved ankomst..."
                    value={loc.notes}
                    onChange={(e) => setLocations((l) =>
                      l.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))}
                  />
                  {/* Slice 9X.37 — Værsensitivitet og plan B */}
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={!!loc.weatherDependent}
                          onChange={(e) => setLocations((l) =>
                            l.map((x, idx) => idx === i ? { ...x, weatherDependent: e.target.checked } : x))}
                        />
                      }
                      label="Værsensitiv (utendørs)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={!!loc.isIndoor}
                          onChange={(e) => setLocations((l) =>
                            l.map((x, idx) => idx === i ? { ...x, isIndoor: e.target.checked } : x))}
                        />
                      }
                      label="Innendørs"
                    />
                  </Stack>
                  {loc.weatherDependent && loc.id && data?.timeline?.id && (
                    <PlanBManager
                      weddingId={data.timeline.id}
                      primaryLocationId={loc.id}
                      alternatives={loc.alternatives || []}
                      onChanged={() => qc.invalidateQueries({ queryKey: [`/api/wedding/client/${token}`] })}
                    />
                  )}
                  {loc.weatherDependent && !loc.id && (
                    <Alert severity="info">
                      Lagre denne lokasjonen først for å legge til en plan B.
                    </Alert>
                  )}
                  {/* Slice 9X.34 — Auto-oppslag mot foto-lokasjons-katalog */}
                  <VenueInfoCard locationQuery={loc.label || loc.address} />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {/* KONTAKTER / VIPs */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person /> Viktige personer ({contacts.length})
            </Typography>
            <Button
              size="small" startIcon={<Add />}
              onClick={() => setContacts((c) => [...c, {
                fullName: '', relation: '', phone: '', email: '', notes: '', isMustCapture: false,
              }])}
              disabled={!gdprAccepted}
            >
              Legg til person
            </Button>
          </Stack>
          {contacts.length === 0 && (
            <Alert severity="info">
              Legg inn foreldre, forlover, brudepiker — de fotografen bør kjenne til.
              Marker "Må fotograferes" for personer som skal være med på bildene.
            </Alert>
          )}
          <Stack spacing={2}>
            {contacts.map((c, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    Person {i + 1}
                    {c.isMustCapture && <Chip size="small" color="primary" label="Må fotograferes" sx={{ ml: 1, height: 18 }} />}
                  </Typography>
                  <IconButton size="small" color="error"
                    onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Fullt navn" size="small" fullWidth required
                      value={c.fullName}
                      onChange={(e) => setContacts((cs) =>
                        cs.map((x, idx) => idx === i ? { ...x, fullName: e.target.value } : x))}
                    />
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Relasjon</InputLabel>
                      <Select
                        label="Relasjon" value={c.relation}
                        onChange={(e) => setContacts((cs) =>
                          cs.map((x, idx) => idx === i ? { ...x, relation: e.target.value } : x))}
                      >
                        {RELATIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Telefon" size="small" fullWidth
                      value={c.phone}
                      onChange={(e) => setContacts((cs) =>
                        cs.map((x, idx) => idx === i ? { ...x, phone: e.target.value } : x))}
                    />
                    <TextField
                      label="E-post" size="small" fullWidth
                      value={c.email}
                      onChange={(e) => setContacts((cs) =>
                        cs.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                    />
                  </Stack>
                  <TextField
                    label="Notater" size="small" fullWidth
                    placeholder="f.eks. Holder tale, i rullestol, etc."
                    value={c.notes}
                    onChange={(e) => setContacts((cs) =>
                      cs.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))}
                  />
                  <FormControlLabel
                    control={<Switch
                      checked={c.isMustCapture}
                      onChange={(e) => setContacts((cs) =>
                        cs.map((x, idx) => idx === i ? { ...x, isMustCapture: e.target.checked } : x))}
                    />}
                    label="Må være med på bilder"
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {/* INSPIRASJONER */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon /> Inspirasjoner ({inspirations.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Del Pinterest-lenker, Instagram-poster eller bilder som inspirerer dere — så fotografen kjenner stilen.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small" fullWidth
              placeholder="https://pinterest.com/pin/..."
              value={newInspirationUrl}
              onChange={(e) => setNewInspirationUrl(e.target.value)}
              disabled={!gdprAccepted}
            />
            <Button
              variant="outlined" startIcon={<Add />}
              onClick={() => {
                if (!newInspirationUrl.trim()) return;
                setInspirations((i) => [...i, {
                  sourceUrl: newInspirationUrl.trim(), imageUrl: '',
                  caption: '', uploadedByEmail: '',
                }]);
                setNewInspirationUrl('');
              }}
              disabled={!gdprAccepted}
            >
              Legg til
            </Button>
          </Stack>
          {inspirations.length > 0 && (
            <Stack spacing={1}>
              {inspirations.map((ins, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ImageIcon color="action" fontSize="small" />
                  <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-all', fontSize: 13 }}>
                    {ins.sourceUrl || ins.imageUrl}
                  </Typography>
                  <IconButton size="small" color="error"
                    onClick={() => setInspirations((arr) => arr.filter((_, idx) => idx !== i))}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        {/* FOTOGRAFENS TIMELINE — Slice 9X.23 */}
        <ClientTimelineEventsSection token={token!} />

        {/* SAVE + COMPLETE */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="outlined" startIcon={<Save />} size="large" fullWidth
            disabled={!gdprAccepted || save.isPending}
            onClick={() => save.mutate({ markComplete: false })}
          >
            Lagre kladd
          </Button>
          <Button
            variant="contained" startIcon={<CheckCircle />} size="large" fullWidth
            disabled={!gdprAccepted || save.isPending}
            onClick={() => save.mutate({ markComplete: true })}
          >
            Ferdig — varsle fotograf
          </Button>
        </Stack>

        {/* GDPR DELETE */}
        <Paper sx={{ p: 3, mb: 3, borderColor: 'error.light', borderWidth: 1, borderStyle: 'solid' }}>
          <Typography variant="subtitle1" sx={{ mb: 1, color: 'error.main' }}>
            Slett mine data (GDPR Art. 17)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Du kan be om at all wedding-timeline-data slettes permanent. Dette kan ikke angres.
          </Typography>
          {!deleteConfirmOpen ? (
            <Button color="error" variant="outlined" startIcon={<DeleteForever />}
              onClick={() => setDeleteConfirmOpen(true)}>
              Slett alle mine data
            </Button>
          ) : (
            <Alert severity="error" action={
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => setDeleteConfirmOpen(false)}>Avbryt</Button>
                <Button size="small" color="error" variant="contained"
                  onClick={() => deleteData.mutate()} disabled={deleteData.isPending}>
                  Ja, slett alt
                </Button>
              </Stack>
            }>
              Er du sikker? Lokasjoner, kontakter, inspirasjoner og samtykker slettes permanent.
            </Alert>
          )}
        </Paper>

        <Snackbar open={!!snackbar} autoHideDuration={4500} onClose={() => setSnackbar(null)}>
          <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
            {snackbar?.msg}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
