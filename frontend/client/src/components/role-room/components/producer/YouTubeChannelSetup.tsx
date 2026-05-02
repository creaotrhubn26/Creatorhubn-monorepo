import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  AutoAwesome as AutoAwesomeIcon,
  Check as CheckIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomYouTubeChannel,
  type RoleRoomYouTubeChannelPlan,
} from '../../services/roleRoomAgentService';
import SocialAccessRequestDialog from './SocialAccessRequestDialog';

interface YouTubeChannelSetupProps {
  /** Prosjektet vi henter brand-snapshot fra. */
  projectId: string;
  /** Valgfri callback når en kanal er detektert (parent kan persiste valg). */
  onChannelSelected?: (channelId: string | null) => void;
}

/**
 * To-faset YouTube-onboarding:
 *   1. Detektér om brukeren har en kanal koblet til Google-tilkoblingen.
 *   2. Hvis ikke — vis en AI-generert kanal-plan (navn, beskrivelse,
 *      content pillars, video-ideer, kadens) slik at brukeren kan
 *      opprette kanalen på youtube.com med et gjennomtenkt utgangspunkt
 *      i stedet for blank slate.
 *
 * UX-prinsipper: lavt kognitivt trykk, alt på norsk, ingen JSON, kopi-
 * knapper på alt brukeren skal lime inn på YouTube.
 */
export default function YouTubeChannelSetup({
  projectId,
  onChannelSelected,
}: YouTubeChannelSetupProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<RoleRoomYouTubeChannel[]>([]);
  const [scopeMissing, setScopeMissing] = useState(false);
  const [noConnection, setNoConnection] = useState(false);
  const [plan, setPlan] = useState<RoleRoomYouTubeChannelPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await roleRoomAgentService.listYouTubeChannels();
      if (cancelled) return;
      setChannels(result.channels);
      setScopeMissing(result.scopeMissing);
      setNoConnection(result.noConnection);
      if (result.channels.length === 1) {
        setSelectedChannelId(result.channels[0].id);
        onChannelSelected?.(result.channels[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [onChannelSelected]);

  async function handleGeneratePlan() {
    setPlanLoading(true);
    setPlanError(null);
    const result = await roleRoomAgentService.generateYouTubeChannelPlan({ projectId });
    if (result.error) setPlanError(result.error);
    setPlan(result.plan);
    setPlanLoading(false);
  }

  function copy(value: string, key: string) {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  if (loading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
        <CircularProgress size={16} />
        <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.78rem' }}>
          Sjekker YouTube-kanaler…
        </Typography>
      </Stack>
    );
  }

  if (noConnection) {
    return (
      <>
        <SetupCard intent="info" title="Koble til Google for å bruke YouTube">
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.82rem', mb: 1 }}>
            YouTube-publisering krever en Google-tilkobling. Hvis kunden eier YouTube-kanalen, kan
            du be dem invitere deg som Manager — vi lager e-posten for deg.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EmailIcon sx={{ fontSize: '0.95rem' }} />}
              onClick={() => setAccessDialogOpen(true)}
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                color: '#93c5fd',
                borderColor: 'rgba(59,130,246,0.4)',
              }}
            >
              Be kunden om tilgang
            </Button>
          </Stack>
        </SetupCard>
        <SocialAccessRequestDialog
          open={accessDialogOpen}
          onClose={() => setAccessDialogOpen(false)}
          projectId={projectId}
          platform="youtube"
          platformLabel="YouTube"
        />
      </>
    );
  }

  if (scopeMissing) {
    return (
      <SetupCard intent="warn" title="YouTube-tilgang mangler">
        <Typography sx={{ color: 'rgba(253,230,138,0.85)', fontSize: '0.78rem', mb: 1 }}>
          Google-tilkoblingen din har ikke YouTube-scope. Re-connect for å hente kanalene dine.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            window.open('/api/role-room/google/oauth/start', '_blank', 'width=600,height=720,noopener')
          }
          sx={{ textTransform: 'none', fontSize: '0.78rem', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.5)' }}
        >
          Re-connect Google
        </Button>
      </SetupCard>
    );
  }

  return (
    <>
    <Stack spacing={1.6} data-testid="youtube-channel-setup">
      {channels.length > 0 ? (
        <SetupCard intent="success" title={`${channels.length} ${channels.length === 1 ? 'kanal' : 'kanaler'} koblet`}>
          <Stack spacing={0.8}>
            {channels.map((c) => {
              const isSelected = selectedChannelId === c.id;
              return (
                <Stack
                  key={c.id}
                  direction="row"
                  spacing={1.2}
                  alignItems="center"
                  onClick={() => {
                    setSelectedChannelId(c.id);
                    onChannelSelected?.(c.id);
                  }}
                  sx={{
                    p: 1,
                    borderRadius: 1.2,
                    cursor: channels.length > 1 ? 'pointer' : 'default',
                    bgcolor: isSelected ? 'rgba(34,197,94,0.1)' : 'rgba(15,23,42,0.4)',
                    border: `1px solid ${isSelected ? 'rgba(34,197,94,0.4)' : 'rgba(148,163,184,0.18)'}`,
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <Avatar
                    src={c.thumbnailUrl ?? undefined}
                    alt={c.title}
                    sx={{ width: 36, height: 36 }}
                  >
                    <PlayCircleOutlineIcon />
                  </Avatar>
                  <Stack spacing={0.1} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <Typography
                        sx={{
                          color: '#e2e8f0',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.title}
                      </Typography>
                      {c.isBrandAccount ? (
                        <Chip
                          label="Brand-konto"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.62rem',
                            bgcolor: 'rgba(168,85,247,0.18)',
                            color: '#d8b4fe',
                            border: '1px solid rgba(168,85,247,0.3)',
                          }}
                        />
                      ) : null}
                    </Stack>
                    <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.72rem' }}>
                      {[
                        c.subscriberCount != null ? `${c.subscriberCount.toLocaleString('no-NO')} abonn.` : null,
                        c.videoCount != null ? `${c.videoCount} videoer` : null,
                        c.customUrl,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Stack>
                  {isSelected ? <CheckIcon sx={{ color: '#22c55e', fontSize: '1.2rem' }} /> : null}
                </Stack>
              );
            })}
          </Stack>
        </SetupCard>
      ) : (
        <SetupCard intent="info" title="Ingen YouTube-kanal funnet ennå">
          <Typography sx={{ color: 'rgba(226,232,240,0.75)', fontSize: '0.82rem', mb: 1 }}>
            YouTube krever at du oppretter kanalen manuelt på youtube.com — det kan ikke gjøres via API.
            Claude kan lage et gjennomtenkt utgangspunkt basert på kunden din: navn, beskrivelse,
            content pillars, video-ideer og publiseringskadens.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              startIcon={<AutoAwesomeIcon />}
              disabled={planLoading}
              onClick={handleGeneratePlan}
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                bgcolor: '#ef4444',
                '&:hover': { bgcolor: '#dc2626' },
              }}
            >
              {planLoading ? 'Lager plan…' : 'Lag kanal-plan med Claude'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewIcon sx={{ fontSize: '0.9rem' }} />}
              onClick={() => window.open('https://www.youtube.com/create_channel', '_blank', 'noopener')}
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                borderColor: 'rgba(148,163,184,0.4)',
              }}
            >
              Opprett kanal på YouTube
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EmailIcon sx={{ fontSize: '0.95rem' }} />}
              onClick={() => setAccessDialogOpen(true)}
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                color: '#93c5fd',
                borderColor: 'rgba(59,130,246,0.4)',
              }}
            >
              Be kunden om tilgang
            </Button>
          </Stack>
        </SetupCard>
      )}

      {planError ? (
        <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem' }}>{planError}</Typography>
      ) : null}

      {plan ? <ChannelPlanView plan={plan} copied={copied} onCopy={copy} /> : null}
    </Stack>
    <SocialAccessRequestDialog
      open={accessDialogOpen}
      onClose={() => setAccessDialogOpen(false)}
      projectId={projectId}
      platform="youtube"
      platformLabel="YouTube"
    />
    </>
  );
}

function SetupCard({
  intent,
  title,
  children,
}: {
  intent: 'info' | 'success' | 'warn';
  title: string;
  children: React.ReactNode;
}) {
  const palette = useMemo(() => {
    if (intent === 'success') {
      return {
        bg: 'rgba(34,197,94,0.06)',
        border: 'rgba(34,197,94,0.25)',
        accent: '#86efac',
      };
    }
    if (intent === 'warn') {
      return {
        bg: 'rgba(251,191,36,0.08)',
        border: 'rgba(251,191,36,0.3)',
        accent: '#fde68a',
      };
    }
    return {
      bg: 'rgba(59,130,246,0.06)',
      border: 'rgba(59,130,246,0.25)',
      accent: '#93c5fd',
    };
  }, [intent]);

  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: 1.6,
        bgcolor: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <Typography
        sx={{
          color: palette.accent,
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 0.6,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function ChannelPlanView({
  plan,
  copied,
  onCopy,
}: {
  plan: RoleRoomYouTubeChannelPlan;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  return (
    <Box
      sx={{
        p: 1.6,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.18)',
      }}
      data-testid="youtube-channel-plan"
    >
      <Stack spacing={1.4}>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <AutoAwesomeIcon sx={{ color: '#fbbf24', fontSize: '1rem' }} />
          <Typography sx={{ color: '#fef3c7', fontSize: '0.78rem', fontWeight: 700 }}>
            Forslag til kanal-oppsett
          </Typography>
          {plan.source === 'fallback' ? (
            <Chip
              label="starter-mal"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.62rem',
                bgcolor: 'rgba(148,163,184,0.18)',
                color: '#cbd5e1',
              }}
            />
          ) : null}
        </Stack>

        <PlanField
          label="Kanal-navn"
          value={plan.channelName}
          onCopy={() => onCopy(plan.channelName, 'name')}
          copied={copied === 'name'}
        />
        {plan.alternativeNames.length > 0 ? (
          <Box>
            <FieldLabel>Alternative navn</FieldLabel>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              {plan.alternativeNames.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  size="small"
                  onClick={() => onCopy(n, `alt-${n}`)}
                  sx={{
                    bgcolor: 'rgba(15,23,42,0.7)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148,163,184,0.2)',
                    fontSize: '0.74rem',
                  }}
                />
              ))}
            </Stack>
          </Box>
        ) : null}
        <PlanField
          label="Handle"
          value={plan.handleSuggestion}
          onCopy={() => onCopy(plan.handleSuggestion, 'handle')}
          copied={copied === 'handle'}
        />
        {plan.tagline ? (
          <PlanField
            label="Tagline"
            value={plan.tagline}
            onCopy={() => onCopy(plan.tagline, 'tagline')}
            copied={copied === 'tagline'}
          />
        ) : null}
        <PlanField
          label="Kanal-beskrivelse"
          value={plan.description}
          multiline
          onCopy={() => onCopy(plan.description, 'desc')}
          copied={copied === 'desc'}
        />

        {plan.keywords.length > 0 ? (
          <Box>
            <FieldLabel>Søkeord</FieldLabel>
            <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
              {plan.keywords.map((k) => (
                <Chip
                  key={k}
                  label={k}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(59,130,246,0.1)',
                    color: '#bfdbfe',
                    border: '1px solid rgba(59,130,246,0.25)',
                    fontSize: '0.72rem',
                    height: 22,
                  }}
                />
              ))}
            </Stack>
          </Box>
        ) : null}

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />

        {plan.contentPillars.length > 0 ? (
          <Box>
            <FieldLabel>Content pillars</FieldLabel>
            <Stack spacing={0.8}>
              {plan.contentPillars.map((p) => (
                <Box
                  key={p.name}
                  sx={{
                    p: 1,
                    borderRadius: 1.2,
                    bgcolor: 'rgba(168,85,247,0.06)',
                    border: '1px solid rgba(168,85,247,0.2)',
                  }}
                >
                  <Typography sx={{ color: '#d8b4fe', fontSize: '0.82rem', fontWeight: 700 }}>
                    {p.name}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.76rem', mb: 0.5 }}>
                    {p.description}
                  </Typography>
                  <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                    {p.exampleTopics.map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(15,23,42,0.6)',
                          color: '#e2e8f0',
                          fontSize: '0.7rem',
                          height: 20,
                          border: '1px solid rgba(148,163,184,0.18)',
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}

        {plan.firstVideoIdeas.length > 0 ? (
          <Box>
            <FieldLabel>Første 5 videoer</FieldLabel>
            <Stack spacing={0.8}>
              {plan.firstVideoIdeas.map((v, idx) => (
                <Box
                  key={`${v.title}-${idx}`}
                  sx={{
                    p: 1,
                    borderRadius: 1.2,
                    bgcolor: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.16)',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 600 }}>
                      {idx + 1}. {v.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.7rem' }}>
                      {Math.round(v.durationSeconds / 60)} min
                    </Typography>
                  </Stack>
                  <Typography
                    sx={{ color: '#94a3b8', fontSize: '0.74rem', fontStyle: 'italic', mt: 0.2 }}
                  >
                    Hook: {v.hook}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.76rem', mt: 0.4 }}>
                    {v.description}
                  </Typography>
                  <Stack direction="row" spacing={0.6} sx={{ mt: 0.6 }} alignItems="center">
                    <Chip
                      label={v.contentPillar}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(168,85,247,0.15)',
                        color: '#d8b4fe',
                        fontSize: '0.66rem',
                        height: 18,
                      }}
                    />
                    <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.7rem' }}>
                      CTA: {v.callToAction}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}

        {plan.channelTrailerConcept.hook ? (
          <Box>
            <FieldLabel>Channel-trailer ({plan.channelTrailerConcept.durationSeconds} sek)</FieldLabel>
            <Box
              sx={{
                p: 1,
                borderRadius: 1.2,
                bgcolor: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <Typography sx={{ color: '#fca5a5', fontSize: '0.76rem', fontWeight: 700, mb: 0.4 }}>
                Hook: {plan.channelTrailerConcept.hook}
              </Typography>
              <Stack spacing={0.2} sx={{ pl: 1 }}>
                {plan.channelTrailerConcept.storyBeats.map((b, i) => (
                  <Typography key={i} sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.74rem' }}>
                    {i + 1}. {b}
                  </Typography>
                ))}
              </Stack>
              <Typography
                sx={{ color: '#fbbf24', fontSize: '0.74rem', mt: 0.5, fontStyle: 'italic' }}
              >
                CTA: {plan.channelTrailerConcept.callToAction}
              </Typography>
            </Box>
          </Box>
        ) : null}

        <Box>
          <FieldLabel>Publiseringskadens</FieldLabel>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600 }}>
            {plan.postingCadence.frequency}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.75)', fontSize: '0.74rem', mb: 0.4 }}>
            {plan.postingCadence.bestDays.join(', ')} · {plan.postingCadence.bestTimeWindows.join(', ')}
          </Typography>
          <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.74rem', fontStyle: 'italic' }}>
            {plan.postingCadence.rationale}
          </Typography>
        </Box>

        {plan.visualIdentity.bannerConcept ? (
          <Box>
            <FieldLabel>Visuell identitet</FieldLabel>
            <Stack spacing={0.4}>
              <PlanLine label="Banner" value={plan.visualIdentity.bannerConcept} />
              <PlanLine label="Avatar" value={plan.visualIdentity.avatarConcept} />
              <PlanLine label="Thumbnails" value={plan.visualIdentity.thumbnailStyle} />
              <PlanLine label="Farger" value={plan.visualIdentity.colorPaletteHint} />
            </Stack>
          </Box>
        ) : null}

        {plan.growthAdvice.length > 0 ? (
          <Box>
            <FieldLabel>Vekst-tips</FieldLabel>
            <Stack spacing={0.3}>
              {plan.growthAdvice.map((g, i) => (
                <Typography
                  key={i}
                  sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.76rem', pl: 1.2, position: 'relative' }}
                >
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '0.45em',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      bgcolor: '#22c55e',
                    }}
                  />
                  {g}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
        <Button
          variant="outlined"
          size="small"
          endIcon={<OpenInNewIcon sx={{ fontSize: '0.9rem' }} />}
          onClick={() =>
            window.open('https://www.youtube.com/create_channel', '_blank', 'noopener')
          }
          sx={{
            textTransform: 'none',
            fontSize: '0.82rem',
            color: '#fca5a5',
            borderColor: 'rgba(239,68,68,0.4)',
            alignSelf: 'flex-start',
          }}
        >
          Opprett kanalen på YouTube
        </Button>
      </Stack>
    </Box>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        color: 'rgba(148,163,184,0.85)',
        fontSize: '0.66rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        mb: 0.4,
      }}
    >
      {children}
    </Typography>
  );
}

function PlanField({
  label,
  value,
  multiline,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
        <FieldLabel>{label}</FieldLabel>
        <Tooltip title={copied ? 'Kopiert' : 'Kopier'}>
          <IconButton
            size="small"
            onClick={onCopy}
            sx={{ color: copied ? '#86efac' : 'rgba(148,163,184,0.7)', p: 0.4 }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: '0.9rem' }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography
        sx={{
          color: '#e2e8f0',
          fontSize: '0.86rem',
          fontWeight: multiline ? 400 : 600,
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
          lineHeight: multiline ? 1.5 : 1.3,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Typography
        sx={{
          color: 'rgba(148,163,184,0.85)',
          fontSize: '0.72rem',
          fontWeight: 700,
          minWidth: 70,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.76rem', flex: 1 }}>
        {value}
      </Typography>
    </Stack>
  );
}
