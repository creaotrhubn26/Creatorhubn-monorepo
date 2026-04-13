import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';

type SelectionMeetConnectionState = 'loading' | 'connected' | 'disconnected' | 'expired' | 'error';

interface SelectionMeetPlannerCardProps {
  compact?: boolean;
  candidateName: string;
  candidateEmail?: string | null;
  scheduleHint?: string | null;
  connectionState: SelectionMeetConnectionState;
  title: string;
  onTitleChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  durationMinutes: number;
  onDurationChange: (value: number) => void;
  location: string;
  onLocationChange: (value: string) => void;
  latestMeetUrl?: string | null;
  latestMeetUpdatedAt?: string | null;
  busy?: boolean;
  onCreateMeet: () => void;
  onOpenMeet?: () => void;
  onCopyMeet?: () => void;
}

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return 'Ikke planlagt ennå';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const compactFieldSx = {
  '& .MuiInputBase-root': {
    fontSize: '0.78rem',
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.78rem',
  },
} as const;

export default function SelectionMeetPlannerCard({
  compact = false,
  candidateName,
  candidateEmail,
  scheduleHint,
  connectionState,
  title,
  onTitleChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  durationMinutes,
  onDurationChange,
  location,
  onLocationChange,
  latestMeetUrl,
  latestMeetUpdatedAt,
  busy = false,
  onCreateMeet,
  onOpenMeet,
  onCopyMeet,
}: SelectionMeetPlannerCardProps) {
  const isConnected = connectionState === 'connected';
  const tone = compact
    ? {
        border: 'rgba(245,158,11,0.28)',
        background: 'linear-gradient(180deg, rgba(120,53,15,0.22), rgba(15,23,42,0.68))',
        iconBackground: 'rgba(245,158,11,0.16)',
        iconColor: '#fbbf24',
        titleColor: '#fef3c7',
        textColor: 'rgba(254,243,199,0.82)',
      }
    : {
        border: 'rgba(245,158,11,0.24)',
        background: 'linear-gradient(180deg, rgba(120,53,15,0.18), rgba(15,23,42,0.74))',
        iconBackground: 'rgba(245,158,11,0.14)',
        iconColor: '#f59e0b',
        titleColor: '#fef3c7',
        textColor: 'rgba(254,243,199,0.8)',
      };

  return (
    <Box
      sx={{
        borderRadius: compact ? 1.4 : 1.6,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        p: compact ? 0.82 : 0.95,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 0.72 : 0.82,
      }}
    >
      <Stack direction="row" spacing={0.85} alignItems="flex-start" justifyContent="space-between">
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: compact ? 30 : 34,
              height: compact ? 30 : 34,
              borderRadius: compact ? 1 : 1.15,
              bgcolor: tone.iconBackground,
              border: '1px solid rgba(251,191,36,0.24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <VideoCallIcon sx={{ fontSize: compact ? 18 : 20, color: tone.iconColor }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: tone.titleColor, fontWeight: 800, fontSize: compact ? '0.75rem' : '0.78rem' }}>
              Google Meet for {candidateName}
            </Typography>
            <Typography sx={{ color: tone.textColor, fontSize: compact ? '0.66rem' : '0.7rem', lineHeight: 1.45 }}>
              Planlegg callback, intervju eller avklaringsmøte direkte fra utvelgelsen.
            </Typography>
          </Box>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
        {candidateEmail ? (
          <Chip
            size="small"
            label={candidateEmail}
            sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }}
          />
        ) : (
          <Chip
            size="small"
            label="Ingen kandidat-epost lagt inn"
            sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(251,191,36,0.12)', color: '#fde68a' }}
          />
        )}
        {scheduleHint ? (
          <Chip
            size="small"
            label={scheduleHint}
            sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
          />
        ) : null}
      </Stack>

      <Stack spacing={compact ? 0.55 : 0.7}>
        <TextField
          fullWidth
          size="small"
          label="Møtetittel"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={!isConnected || busy}
          sx={compact ? compactFieldSx : undefined}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.65}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label="Dato"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            disabled={!isConnected || busy}
            InputLabelProps={{ shrink: true }}
            sx={compact ? compactFieldSx : undefined}
          />
          <TextField
            fullWidth
            size="small"
            type="time"
            label="Tid"
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            disabled={!isConnected || busy}
            InputLabelProps={{ shrink: true }}
            sx={compact ? compactFieldSx : undefined}
          />
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Minutter"
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value) || 30)}
            disabled={!isConnected || busy}
            inputProps={{ min: 15, max: 240, step: 15 }}
            sx={compact ? compactFieldSx : undefined}
          />
        </Stack>
        <TextField
          fullWidth
          size="small"
          label="Lokasjon / kontekst"
          value={location}
          onChange={(event) => onLocationChange(event.target.value)}
          disabled={!isConnected || busy}
          placeholder="Callback · Oslo / Google Meet"
          sx={compact ? compactFieldSx : undefined}
        />
      </Stack>

      {latestMeetUrl ? (
        <Box
          sx={{
            borderRadius: 1.15,
            border: '1px solid rgba(96,165,250,0.22)',
            bgcolor: 'rgba(2,6,23,0.34)',
            p: compact ? 0.68 : 0.75,
          }}
        >
          <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: compact ? '0.66rem' : '0.7rem' }}>
            Siste Meet-lenke
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: compact ? '0.64rem' : '0.68rem', mt: 0.18 }}>
            Oppdatert {formatDateTime(latestMeetUpdatedAt)}
          </Typography>
        </Box>
      ) : null}

      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="contained"
          startIcon={<VideoCallIcon />}
          onClick={onCreateMeet}
          disabled={!isConnected || busy || !date || !time}
          sx={{
            textTransform: 'none',
            borderRadius: 999,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #f59e0b, #f97316)',
            color: '#111827',
            '&:hover': {
              background: 'linear-gradient(135deg, #d97706, #ea580c)',
            },
          }}
        >
          {busy ? 'Planlegger...' : 'Planlegg Meet'}
        </Button>
        {latestMeetUrl && onOpenMeet ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={onOpenMeet}
            sx={{ textTransform: 'none', borderRadius: 999, fontWeight: 700 }}
          >
            Åpne Meet
          </Button>
        ) : null}
        {latestMeetUrl && onCopyMeet ? (
          <Button
            size="small"
            variant="text"
            startIcon={<ContentCopyIcon />}
            onClick={onCopyMeet}
            sx={{ textTransform: 'none', borderRadius: 999, fontWeight: 700, color: '#fde68a' }}
          >
            Kopier lenke
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
