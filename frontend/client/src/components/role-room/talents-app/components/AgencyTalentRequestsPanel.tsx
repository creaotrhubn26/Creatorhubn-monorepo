import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as FulfillIcon,
  MarkEmailReadOutlined as AcknowledgeIcon,
  PersonSearchOutlined as RequestIcon,
  ThumbDownAltOutlined as DeclineIcon,
} from '@mui/icons-material';

import { MOBILE_TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import type {
  TalentRequest,
  TalentRequestQueueSummary,
  TalentRequestStatus,
} from '../../services/roleRoomPartnershipsService';
import { palette, radius } from '../theme';

interface AgencyTalentRequestsPanelProps {
  requests: TalentRequest[];
  summary: TalentRequestQueueSummary;
  busy: boolean;
  onRespond: (
    requestId: string,
    action: 'acknowledge' | 'decline' | 'fulfill',
    responseNote?: string,
  ) => Promise<void>;
}

type QueueFilter = 'open' | 'unacknowledged' | 'due' | 'history';

const STATUS: Record<TalentRequestStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Ny', color: '#fbbf24', bg: 'rgba(251,191,36,.14)' },
  acknowledged: { label: 'Mottatt', color: '#7dd3fc', bg: 'rgba(14,165,233,.14)' },
  fulfilled: { label: 'Forslag sendt', color: '#6ee7b7', bg: 'rgba(16,185,129,.14)' },
  declined: { label: 'Avslått', color: '#fda4af', bg: 'rgba(244,63,94,.14)' },
  cancelled: { label: 'Avbrutt av produksjon', color: '#cbd5e1', bg: 'rgba(148,163,184,.14)' },
  expired: { label: 'Frist utløpt', color: '#cbd5e1', bg: 'rgba(148,163,184,.14)' },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function deadlineLabel(value: string, status: TalentRequestStatus): string {
  if (status === 'expired') return 'Frist utløpt';
  if (status !== 'pending' && status !== 'acknowledged') return formatDate(value);
  const deadline = new Date(value).getTime();
  if (!Number.isFinite(deadline)) return value;
  const hours = Math.ceil((deadline - Date.now()) / (60 * 60 * 1000));
  if (hours <= 0) return 'Frist utløpt';
  if (hours <= 24) return `${hours} t igjen`;
  if (hours <= 48) return `${Math.ceil(hours / 24)} dager igjen`;
  return formatDate(value);
}

export default function AgencyTalentRequestsPanel({
  requests,
  summary,
  busy,
  onRespond,
}: AgencyTalentRequestsPanelProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<QueueFilter>('open');
  const visibleRequests = useMemo(() => requests.filter((request) => {
    const deadline = new Date(request.response_deadline).getTime();
    const active = request.status === 'pending' || request.status === 'acknowledged';
    if (filter === 'open') return active;
    if (filter === 'unacknowledged') return request.status === 'pending';
    if (filter === 'due') {
      return active && Number.isFinite(deadline) && deadline <= Date.now() + 48 * 60 * 60 * 1000;
    }
    return !active;
  }), [filter, requests]);

  if (requests.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${palette.border}`, borderRadius: radius.lg }}>
        <RequestIcon sx={{ color: palette.accentBright, fontSize: 36, mb: 1 }} />
        <Typography sx={{ color: palette.textPrimary, fontWeight: 750 }}>Ingen talentforespørsler</Typography>
        <Typography sx={{ color: palette.textMuted, mt: .5 }}>
          Når et castingteam ber dere vurdere en bestemt profil til en rolle, vises det her.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} data-testid="agency-talent-requests">
      <Alert severity="info">
        En forespørsel deler ikke nye data med produksjonen. Først når dere sender forslag, kan castingteamet behandle talentet videre.
      </Alert>
      <Box
        aria-label="SLA-oversikt for talentforespørsler"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {[
          { label: 'Åpne', value: summary.open, color: palette.textPrimary },
          { label: 'Ikke bekreftet', value: summary.unacknowledged, color: summary.unacknowledged ? '#fbbf24' : palette.textPrimary },
          { label: 'Frist ≤ 48 t', value: summary.due_within_48h, color: summary.due_within_48h ? '#fb923c' : palette.textPrimary },
          { label: 'Utløpt', value: summary.overdue, color: summary.overdue ? '#fda4af' : palette.textPrimary },
        ].map((metric) => (
          <Box key={metric.label} sx={{ p: 1.35, bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.sm }}>
            <Typography sx={{ color: metric.color, fontSize: '1.28rem', fontWeight: 850, lineHeight: 1.1 }}>
              {metric.value}
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '.72rem', mt: .35 }}>{metric.label}</Typography>
          </Box>
        ))}
      </Box>
      {summary.oldest_unacknowledged_hours !== null ? (
        <Typography sx={{ color: palette.textMuted, fontSize: '.78rem' }}>
          Eldste ubekreftede forespørsel har ventet {summary.oldest_unacknowledged_hours} t.
        </Typography>
      ) : null}
      <Stack direction="row" gap={.75} flexWrap="wrap" aria-label="Filtrer talentforespørsler">
        {([
          ['open', `Åpne (${summary.open})`],
          ['unacknowledged', `Ikke bekreftet (${summary.unacknowledged})`],
          ['due', `Frist ≤ 48 t (${summary.due_within_48h})`],
          ['history', `Historikk (${requests.length - summary.open})`],
        ] as Array<[QueueFilter, string]>).map(([value, label]) => (
          <Chip
            key={value}
            clickable
            label={label}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            sx={{
              minHeight: MOBILE_TOUCH_TARGET_SIZE,
              color: filter === value ? palette.textPrimary : palette.textMuted,
              bgcolor: filter === value ? 'rgba(93,118,203,.22)' : palette.bgCard,
              border: `1px solid ${filter === value ? palette.accentBright : palette.border}`,
              ...focusVisibleStyles,
            }}
          />
        ))}
      </Stack>
      {visibleRequests.length === 0 ? (
        <Box sx={{ p: 2.5, textAlign: 'center', border: `1px dashed ${palette.border}`, borderRadius: radius.lg }}>
          <Typography sx={{ color: palette.textMuted }}>Ingen forespørsler i dette filteret.</Typography>
        </Box>
      ) : null}
      {visibleRequests.map((request) => {
        const status = STATUS[request.status];
        const active = request.status === 'pending' || request.status === 'acknowledged';
        const consentRevoked = request.talent_display_name === 'Samtykke trukket';
        const note = notes[request.id] ?? '';
        return (
          <Box
            key={request.id}
            data-testid={`agency-talent-request-${request.id}`}
            sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.25}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.02rem' }}>
                  {request.talent_display_name} · {request.role_name}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '.82rem', mt: .2 }}>
                  {request.project_name} · {request.production_name || 'Produksjonsteam'} · {deadlineLabel(request.response_deadline, request.status)}
                </Typography>
              </Box>
              <Chip size="small" label={status.label} sx={{ alignSelf: 'flex-start', color: status.color, bgcolor: status.bg, fontWeight: 700 }} />
            </Stack>

            <Box sx={{ mt: 1.4, p: 1.4, bgcolor: 'rgba(0,0,0,.16)', borderRadius: radius.sm }}>
              <Typography sx={{ color: palette.textMuted, fontSize: '.72rem', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Castingbrief
              </Typography>
              <Typography sx={{ color: palette.textPrimary, fontSize: '.88rem', lineHeight: 1.55, mt: .45 }}>
                {request.brief}
              </Typography>
            </Box>

            {request.response_note && !active ? (
              <Typography sx={{ color: palette.textMuted, fontSize: '.82rem', mt: 1 }}>
                Deres svar: «{request.response_note}»
              </Typography>
            ) : null}

            {active ? (
              <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                {consentRevoked ? (
                  <Alert severity="warning">Talentets aktive samtykke er trukket. Forespørselen kan ikke oppfylles.</Alert>
                ) : null}
                <TextField
                  fullWidth
                  size="small"
                  label="Kommentar til produksjonen"
                  value={note}
                  onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value.slice(0, 2000) }))}
                  inputProps={{ maxLength: 2000 }}
                  multiline
                  minRows={2}
                  helperText="Påkrevd ved avslag, valgfri når dere sender forslag."
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  {request.status === 'pending' ? (
                    <Button
                      disabled={busy}
                      onClick={() => void onRespond(request.id, 'acknowledge')}
                      startIcon={<AcknowledgeIcon />}
                      sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, color: '#7dd3fc', ...focusVisibleStyles }}
                    >
                      Marker mottatt
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy || !note.trim()}
                    onClick={() => void onRespond(request.id, 'decline', note)}
                    startIcon={<DeclineIcon />}
                    sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, color: '#fda4af', ...focusVisibleStyles }}
                  >
                    Avslå
                  </Button>
                  <Button
                    variant="contained"
                    disabled={busy || consentRevoked}
                    onClick={() => void onRespond(request.id, 'fulfill', note)}
                    startIcon={<FulfillIcon />}
                    sx={{ minHeight: MOBILE_TOUCH_TARGET_SIZE, background: palette.accentGradient, ...focusVisibleStyles }}
                  >
                    Send som forslag
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}
