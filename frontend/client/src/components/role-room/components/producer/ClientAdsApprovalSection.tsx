/**
 * ClientAdsApprovalSection — klient-side flate som viser pending ads-anbefalinger
 * fra innholdsprodusenten og lar klient godkjenne / be om endringer.
 *
 * Mountes i ClientEconomyPanel under per-kanal-aggregatet.
 *
 * Backend:
 *   GET  /api/role-room/ads-approvals/pending?clientProjectId=...
 *   POST /api/role-room/ads-approvals/:configId/approve
 *   POST /api/role-room/ads-approvals/:configId/reject
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface PendingConfig {
  config: {
    id: string;
    client_name: string;
    client_website_url: string;
    business_type: string;
    business_summary: string;
    approval_status: string;
    sent_for_approval_at: string | null;
    review_deadline: string | null;
    approval_message: string | null;
    claude_analysis: Record<string, unknown>;
    management_fee_pct: number;
    management_fee_negotiated: boolean;
  };
  actions: Array<{
    id: string;
    action_name: string;
    display_name: string;
    goal_category: string;
    default_value: number;
    currency: string;
    trigger_type: string;
    url_pattern: string | null;
    claude_reasoning: string;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  purchase: 'Kjøp', add_to_cart: 'Add to cart', begin_checkout: 'Begin checkout',
  submit_lead_form: 'Lead-skjema', book_appointment: 'Book avtale', sign_up: 'Sign-up',
  subscribe: 'Subscribe', request_quote: 'Tilbudsforespørsel', contact: 'Kontakt',
  page_view: 'Sidevisning', outbound_click: 'Outbound', other: 'Annet',
};

const TRIGGER_LABELS: Record<string, string> = {
  page_load: 'Side-load', form_submit: 'Form submit', click: 'Klikk',
  event: 'JS-event', outbound: 'Outbound', manual: 'Manuell',
};

export default function ClientAdsApprovalSection({
  clientProjectId,
}: {
  clientProjectId: string;
}) {
  const [pending, setPending] = useState<PendingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyConfigId, setBusyConfigId] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/role-room/ads-approvals/pending?clientProjectId=${encodeURIComponent(clientProjectId)}`, {
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setPending(data.pending ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente anbefalinger');
    } finally {
      setLoading(false);
    }
  }, [clientProjectId]);

  useEffect(() => { void reload(); }, [reload]);

  const approve = async (configId: string) => {
    setBusyConfigId(configId);
    try {
      const r = await fetch(`/api/role-room/ads-approvals/${configId}/approve`, {
        method: 'POST', credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Godkjenning feilet');
    } finally {
      setBusyConfigId(null);
    }
  };

  const reject = async (configId: string) => {
    const fb = (feedbackDrafts[configId] ?? '').trim();
    if (!fb) {
      setError('Skriv en kort tilbakemelding først så innholdsprodusenten vet hva de skal endre.');
      return;
    }
    setBusyConfigId(configId);
    try {
      const r = await fetch(`/api/role-room/ads-approvals/${configId}/reject`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: fb }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avvisning feilet');
    } finally {
      setBusyConfigId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <CircularProgress size={22} sx={{ color: '#c084fc' }} />
      </Box>
    );
  }

  if (pending.length === 0) {
    return null; // Ingen ventende — vis ingenting, ikke støy opp UI
  }

  return (
    <Card sx={{
      bgcolor: '#150b2e',
      border: '1px solid rgba(168,85,247,0.32)',
      color: '#f5f3ff',
      mb: 2,
    }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.6 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.04rem' }}>
              Ads-anbefalinger venter på din godkjenning
            </Typography>
            <Typography sx={{ color: 'rgba(196,181,253,0.85)', fontSize: '0.82rem' }}>
              {pending.length} {pending.length === 1 ? 'forslag' : 'forslag'} fra innholdsprodusenten
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert> : null}

        <Stack spacing={2.4}>
          {pending.map(({ config, actions }) => {
            const deadline = config.review_deadline ? new Date(config.review_deadline) : null;
            const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
            return (
              <Box
                key={config.id}
                sx={{
                  bgcolor: 'rgba(168,85,247,0.06)',
                  border: '1px solid rgba(168,85,247,0.18)',
                  borderRadius: 1.6,
                  p: 2,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.4 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', mb: 0.4 }}>
                      {config.client_name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(196,181,253,0.75)', fontSize: '0.82rem' }}>
                      {config.client_website_url} · Bransje: {config.business_type}
                    </Typography>
                  </Box>
                  {daysLeft !== null ? (
                    <Chip
                      label={daysLeft === 0 ? 'Frist i dag' : `${daysLeft} dager igjen`}
                      size="small"
                      sx={{
                        bgcolor: daysLeft <= 1 ? 'rgba(248,113,113,0.18)' : 'rgba(96,165,250,0.18)',
                        color: daysLeft <= 1 ? '#f87171' : '#60a5fa',
                        fontWeight: 700,
                      }}
                    />
                  ) : null}
                </Stack>

                {config.approval_message ? (
                  <Typography sx={{ color: 'rgba(196,181,253,0.9)', fontStyle: 'italic', fontSize: '0.86rem', mb: 1.6, p: 1.2, bgcolor: 'rgba(168,85,247,0.10)', borderRadius: 1 }}>
                    Beskjed fra innholdsprodusenten: «{config.approval_message}»
                  </Typography>
                ) : null}

                {/* Management fee — det klient skal betale over ren ads-spend */}
                <Box sx={{
                  bgcolor: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.24)',
                  borderRadius: 1.2,
                  p: 1.4,
                  mb: 1.6,
                }}>
                  <Typography sx={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem', mb: 0.4 }}>
                    💰 Management fee: {Number(config.management_fee_pct).toFixed(0)}% av ads-spend
                    {config.management_fee_negotiated ? ' (forhandlet)' : ' (standard)'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(196,181,253,0.85)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                    Google Ads-kontoen står på dere som klient. Spend (annonse-kostnad) trekkes
                    direkte fra deres betalingsmetode til Google — innholdsprodusenten håndterer
                    aldri pengene. Innholdsprodusenten har kun OAuth-tilgang for å sette opp og
                    optimalisere kampanjene. I tillegg fakturerer innholdsprodusenten
                    {' '}{Number(config.management_fee_pct).toFixed(0)}% av spend som management-fee
                    (deres inntekt for arbeidet). Eks ved 20 000 kr/mnd ads-spend →
                    mgmt fee = {Math.round(20000 * Number(config.management_fee_pct) / 100).toLocaleString('nb-NO')} kr/mnd.
                  </Typography>
                </Box>

                <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.74rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
                  {actions.length} foreslåtte conversion-actions
                </Typography>

                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    mb: 1.6,
                    '& th': {
                      textAlign: 'left',
                      color: 'rgba(148,163,184,0.85)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      py: 0.8,
                      borderBottom: '1px solid rgba(148,163,184,0.18)',
                    },
                    '& td': {
                      color: '#f5f3ff',
                      fontSize: '0.84rem',
                      py: 1,
                      borderBottom: '1px solid rgba(148,163,184,0.08)',
                      verticalAlign: 'top',
                    },
                    '& td.num': { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Handling</th>
                      <th>Type</th>
                      <th>Trigger</th>
                      <th style={{ textAlign: 'right' }}>Verdi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.86rem' }}>{a.display_name}</Typography>
                            <Typography sx={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.74rem', fontStyle: 'italic', mt: 0.2 }}>
                              {a.claude_reasoning}
                            </Typography>
                          </Box>
                        </td>
                        <td style={{ color: 'rgba(196,181,253,0.85)' }}>
                          {CATEGORY_LABELS[a.goal_category] ?? a.goal_category}
                        </td>
                        <td style={{ color: 'rgba(96,165,250,0.85)' }}>
                          {TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type}
                        </td>
                        <td className="num">{a.default_value} {a.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </Box>

                <Divider sx={{ borderColor: 'rgba(168,85,247,0.18)', my: 1.6 }} />

                <TextField
                  multiline
                  rows={2}
                  fullWidth
                  size="small"
                  label="Hvis du vil ha endringer — skriv kort hva (eller la stå tom og trykk Godkjenn)"
                  value={feedbackDrafts[config.id] ?? ''}
                  onChange={(e) => setFeedbackDrafts({ ...feedbackDrafts, [config.id]: e.target.value })}
                  sx={{ mb: 1.4 }}
                  InputProps={{ sx: { color: '#f5f3ff' } }}
                  InputLabelProps={{ sx: { color: 'rgba(148,163,184,0.85)' } }}
                />

                <Stack direction="row" spacing={1.4} justifyContent="flex-end">
                  <Button
                    onClick={() => reject(config.id)}
                    disabled={busyConfigId === config.id}
                    startIcon={<EditNoteIcon fontSize="small" />}
                    sx={{
                      color: '#fbbf24',
                      textTransform: 'none',
                      fontWeight: 700,
                      border: '1px solid rgba(251,191,36,0.32)',
                    }}
                  >
                    Be om endringer
                  </Button>
                  <Button
                    onClick={() => approve(config.id)}
                    disabled={busyConfigId === config.id}
                    startIcon={busyConfigId === config.id ? <CircularProgress size={16} /> : <CheckCircleIcon fontSize="small" />}
                    sx={{
                      background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                      color: '#fff',
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 3,
                      '&:hover': { background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
                    }}
                  >
                    Godkjenn alle {actions.length} actions
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
