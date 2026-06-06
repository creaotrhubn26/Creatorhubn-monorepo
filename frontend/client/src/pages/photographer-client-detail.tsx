// Slice 9X.8.B — klient-detaljside.
// Kontakt-info-card + 3 tabs (Galleri, Bestillinger, Kontrakter).

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation, Link } from 'wouter';
import {
  Box, Typography, Paper, Tabs, Tab, Stack, Button, TextField,
  Chip, CircularProgress, Divider, IconButton, MenuItem,
} from '@mui/material';
import {
  ArrowBack, Person, Email, Phone, LocationOn, Edit, Save, Close,
} from '@mui/icons-material';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ClientDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customerType?: 'person' | 'company';
  organizationNumber?: string | null;
}

interface GalleryRow {
  id: string;
  projectTitle: string;
  accessToken: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface OrderRow {
  id: string;
  galleryId: string | null;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string | null;
  createdAt: string;
}

interface ContractRow {
  id: string;
  title: string;
  status: string;
  contractValue: number | null;
  currency: string;
  signedAt: string | null;
  createdAt: string;
}

interface MessageRow {
  id: string;
  type: string;
  direction: string;
  subject: string;
  content: string;
  fromEmail: string | null;
  toEmail: string | null;
  createdAt: string;
}

interface DetailResponse {
  client: ClientDetail;
  galleries: GalleryRow[];
  orders: OrderRow[];
  contracts: ContractRow[];
  messages: MessageRow[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusColor(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  if (['paid', 'signed', 'completed', 'active', 'fulfilled'].includes(status)) return 'success';
  if (['pending', 'draft'].includes(status)) return 'warning';
  if (['cancelled', 'refunded', 'expired'].includes(status)) return 'error';
  return 'default';
}

export default function PhotographerClientDetail() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Partial<ClientDetail>>({});

  const { data, isLoading, error } = useQuery<DetailResponse>({
    queryKey: ['/api/photographer/clients', clientId],
    queryFn: () => apiRequest(`/api/photographer/clients/${clientId}`),
    enabled: !!clientId,
  });

  const patch = useMutation({
    mutationFn: (body: Partial<ClientDetail>) =>
      apiRequest(`/api/photographer/clients/${clientId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/clients'] });
      setEditing(false);
      setEdits({});
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Kunne ikke laste klient.</Typography>
        <Button component={Link} href="/photographer/clients" startIcon={<ArrowBack />} sx={{ mt: 2 }}>
          Tilbake til klient-liste
        </Button>
      </Box>
    );
  }

  const c = data.client;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/photographer/clients')} size="small">
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person /> {c.displayName}
        </Typography>
      </Stack>

      {/* Kontakt-card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Kontaktinformasjon</Typography>
          {!editing ? (
            <Button startIcon={<Edit />} size="small" onClick={() => { setEditing(true); setEdits({}); }}>
              Rediger
            </Button>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button
                startIcon={<Save />}
                size="small"
                variant="contained"
                disabled={patch.isPending}
                onClick={() => patch.mutate(edits)}
              >
                Lagre
              </Button>
              <Button
                startIcon={<Close />}
                size="small"
                onClick={() => { setEditing(false); setEdits({}); }}
              >
                Avbryt
              </Button>
            </Stack>
          )}
        </Stack>

        {!editing ? (
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Email fontSize="small" color="action" />
              <Typography variant="body2">{c.email}</Typography>
            </Stack>
            {c.phone && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Phone fontSize="small" color="action" />
                <Typography variant="body2">{c.phone}</Typography>
              </Stack>
            )}
            {(c.address || c.city) && (
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <LocationOn fontSize="small" color="action" sx={{ mt: 0.3 }} />
                <Typography variant="body2">
                  {[c.address, [c.postalCode, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                </Typography>
              </Stack>
            )}
            {c.notes && (
              <Box sx={{ mt: 1, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Notater</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{c.notes}</Typography>
              </Box>
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Kundetype"
                size="small"
                sx={{ width: 200 }}
                value={edits.customerType ?? c.customerType ?? 'person'}
                onChange={(e) => setEdits((p) => ({ ...p, customerType: e.target.value as 'person' | 'company' }))}
                helperText="Bestemmer hvordan kunden registreres i PowerOffice"
              >
                <MenuItem value="person">Privatperson</MenuItem>
                <MenuItem value="company">Bedrift</MenuItem>
              </TextField>
              {(edits.customerType ?? c.customerType) === 'company' && (
                <TextField
                  label="Org.nr"
                  size="small"
                  sx={{ width: 180 }}
                  defaultValue={c.organizationNumber ?? ''}
                  onChange={(e) => setEdits((p) => ({ ...p, organizationNumber: e.target.value }))}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Fornavn" size="small" fullWidth
                defaultValue={c.firstName}
                onChange={(e) => setEdits((p) => ({ ...p, firstName: e.target.value }))}
              />
              <TextField
                label="Etternavn" size="small" fullWidth
                defaultValue={c.lastName}
                onChange={(e) => setEdits((p) => ({ ...p, lastName: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Telefon" size="small" fullWidth
              defaultValue={c.phone ?? ''}
              onChange={(e) => setEdits((p) => ({ ...p, phone: e.target.value }))}
            />
            <TextField
              label="Adresse" size="small" fullWidth
              defaultValue={c.address ?? ''}
              onChange={(e) => setEdits((p) => ({ ...p, address: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Postnummer" size="small" sx={{ width: 140 }}
                defaultValue={c.postalCode ?? ''}
                onChange={(e) => setEdits((p) => ({ ...p, postalCode: e.target.value }))}
              />
              <TextField
                label="By" size="small" fullWidth
                defaultValue={c.city ?? ''}
                onChange={(e) => setEdits((p) => ({ ...p, city: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Notater" size="small" fullWidth multiline minRows={3}
              defaultValue={c.notes ?? ''}
              onChange={(e) => setEdits((p) => ({ ...p, notes: e.target.value }))}
            />
          </Stack>
        )}
      </Paper>

      {/* Tabs */}
      <Paper>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label={`Galleri (${data.galleries.length})`} />
          <Tab label={`Bestillinger (${data.orders.length})`} />
          <Tab label={`Kontrakter (${data.contracts.length})`} />
          <Tab label={`Meldinger (${data.messages.length})`} />
        </Tabs>
        <Divider />

        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            {data.galleries.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Ingen galleri levert ennå.
              </Typography>
            )}
            {data.galleries.map((g) => (
              <Stack
                key={g.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>{g.projectTitle}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Opprettet {formatDate(g.createdAt)}
                    {g.completedAt && ` • Levert ${formatDate(g.completedAt)}`}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={g.status} color={statusColor(g.status)} />
                  <Button
                    size="small"
                    component={Link}
                    href={`/client/gallery/${g.accessToken}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Åpne
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Box>
        )}

        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            {data.orders.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Ingen bestillinger ennå.
              </Typography>
            )}
            {data.orders.map((o) => (
              <Stack
                key={o.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {o.totalAmount.toLocaleString('nb-NO')} {o.currency}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(o.createdAt)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={`Betaling: ${o.paymentStatus}`} color={statusColor(o.paymentStatus)} />
                  {o.fulfillmentStatus && (
                    <Chip size="small" variant="outlined" label={`Lev: ${o.fulfillmentStatus}`} color={statusColor(o.fulfillmentStatus)} />
                  )}
                </Stack>
              </Stack>
            ))}
          </Box>
        )}

        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            {data.contracts.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Ingen kontrakter ennå.
              </Typography>
            )}
            {data.contracts.map((ct) => (
              <Stack
                key={ct.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>{ct.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Opprettet {formatDate(ct.createdAt)}
                    {ct.signedAt && ` • Signert ${formatDate(ct.signedAt)}`}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {ct.contractValue != null && (
                    <Typography variant="body2">
                      {ct.contractValue.toLocaleString('nb-NO')} {ct.currency}
                    </Typography>
                  )}
                  <Chip size="small" label={ct.status} color={statusColor(ct.status)} />
                </Stack>
              </Stack>
            ))}
          </Box>
        )}

        {activeTab === 3 && (
          <Box sx={{ p: 2 }}>
            {data.messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                Ingen meldinger registrert.
              </Typography>
            )}
            {data.messages.map((m) => (
              <Box
                key={m.id}
                sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={m.direction === 'inbound' ? 'Inn' : 'Ut'} color={m.direction === 'inbound' ? 'primary' : 'default'} />
                    <Typography variant="body2" fontWeight={500}>
                      {m.subject || `(${m.type})`}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(m.createdAt)}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {m.content}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
