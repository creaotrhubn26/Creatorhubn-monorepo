/**
 * RoleRoomResearchCompleteOverlay — full-screen "Research Complete"
 * card that appears once when bootstrap finishes. Covers items 1, 7, 8,
 * 11, 18, 19, 21, 22, 23, 24, 25 from the research-presentation backlog:
 *
 *   #1  Full-screen overlay before dialog returns control
 *   #7  Source attribution per service (timeline labels)
 *   #8  Tooltip on each service: "Bygget på {kilde} – sist sjekket {ts}"
 *   #11 Timeline: "Vi fant N datapunkter på X.Xs"
 *   #18 Debug view (collapsible raw service latencies)
 *   #19 Fallbacks used as warning chips
 *   #21 Highlight missing critical fields with red badge
 *   #22 Sticky summary card: "Bedrift: X · Bransje: Y · Klar for Plan? ✅"
 *   #23 Sound toast (off by default, gated on prefersAudio)
 *   #24 Confetti only at 100% completeness — never otherwise
 *   #25 Smooth scroll on dismiss
 *
 * Tracks the last-seen researchId in sessionStorage so the overlay
 * doesn't reappear on every dialog open — only on a fresh bootstrap.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Modal,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type {
  RoleRoomAgentProducerBootstrapResult,
  RoleRoomAgentServiceLatencies,
} from '../../services/roleRoomAgentService';
import SocialProfileCandidatesPreview from './SocialProfileCandidatesPreview';
import ResearchDiffSection from './ResearchDiffSection';
import ResearchFieldProvenancePanel from './ResearchFieldProvenancePanel';
import ResearchNextStepsCards from './ResearchNextStepsCards';
import ResearchFirstWeekIdeas from './ResearchFirstWeekIdeas';
import ResearchValidationFlagsSection from './ResearchValidationFlagsSection';
import {
  exportResearchAsCsv,
  exportResearchAsJson,
  exportResearchAsPdf,
  recordResearchVersion,
  fetchServerResearchVersion,
} from '../../utils/researchExport';
import {
  computeResearchDiff,
  saveResearchSnapshot,
  type ResearchDiff,
} from '../../utils/researchDiff';

const SEEN_RESEARCH_KEY = 'roleRoom.researchOverlay.seenResearchIds';
const SOUND_PREF_KEY = 'roleRoom.researchOverlay.soundEnabled';

interface ServiceTimelineEntry {
  key: keyof RoleRoomAgentServiceLatencies;
  label: string;
  source: string;
  ms: number;
}

const SERVICE_LABELS: Record<keyof RoleRoomAgentServiceLatencies, { label: string; source: string }> = {
  brreg: { label: 'Brønnøysundregistrene', source: 'data.brreg.no' },
  website: { label: 'Nettsidescraping', source: 'kundens domene' },
  googlePlacesBusiness: { label: 'Google Places (bedrift)', source: 'places.googleapis.com' },
  googlePlacesCompetitors: { label: 'Google Places (konkurrenter)', source: 'places.googleapis.com' },
  googlePlacesLocal: { label: 'Google Places (nærområde)', source: 'places.googleapis.com' },
  competitorAnalysis: { label: 'Konkurrentanalyse', source: 'aggregert' },
  localPresence: { label: 'Lokal tilstedeværelse', source: 'aggregert' },
  merchSuppliers: { label: 'Merch-leverandører', source: 'Brreg + Google Places' },
  metaPagesEnrichment: { label: 'Meta Pages-berikelse', source: 'graph.facebook.com' },
  colorExtraction: { label: 'Logo-paletten', source: 'node-vibrant' },
  claudeSynthesis: { label: 'Claude-syntese', source: 'api.anthropic.com' },
  openaiSynthesis: { label: 'OpenAI-syntese', source: 'api.openai.com' },
  totalMs: { label: 'Totaltid', source: 'wall clock' },
};

function readSeenResearchIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_RESEARCH_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function markResearchSeen(researchId: string): void {
  try {
    const seen = readSeenResearchIds();
    seen.add(researchId);
    // Cap at 50 to avoid unbounded growth across long sessions
    const arr = Array.from(seen).slice(-50);
    sessionStorage.setItem(SEEN_RESEARCH_KEY, JSON.stringify(arr));
  } catch {
    // sessionStorage unavailable (private mode, quota) — graceful skip
  }
}

function formatMs(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '–';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** A short, lightweight WebAudio chime — no MP3 asset required, plays
 *  inline on a freshly-resumed AudioContext. User-gated via SOUND_PREF_KEY. */
function playCompleteChime(): void {
  try {
    const Ctor: typeof AudioContext | undefined =
      (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    gain.connect(ctx.destination);
    [880, 1320].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + idx * 0.12);
      osc.stop(now + 0.7);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // audio unavailable; silent failure
  }
}

interface ResearchCompleteOverlayProps {
  result: RoleRoomAgentProducerBootstrapResult | null;
  /** Used to compute the client-side researchVersion (v1/v2/v3...) — the
   *  version index is project-scoped, stored in localStorage, no DB.
   *  Pass the prosjekt-id so we don't conflate research runs across
   *  projects in the same browser. */
  projectId?: string | null;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
}

const ResearchCompleteOverlay: React.FC<ResearchCompleteOverlayProps> = ({
  result,
  projectId = null,
  onPrimaryAction,
  primaryActionLabel = 'Fortsett til neste steg',
}) => {
  const researchId = result?.researchId ?? null;

  // #15 — researchVersion. Prefers the server-side counter (multi-user-
  // consistent) and falls back to a per-browser localStorage counter if
  // the server endpoint isn't reachable yet (migration not deployed).
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [versionTotal, setVersionTotal] = useState<number | null>(null);
  // #9 — diff vs. previous bootstrap. Compute BEFORE saving the new
  // snapshot, otherwise the diff would always be empty (current === stored).
  const [diff, setDiff] = useState<ResearchDiff | null>(null);
  useEffect(() => {
    if (!researchId) return;
    let cancelled = false;
    // Optimistically set localStorage version so UI doesn't flicker
    // while we wait for the server. If the server replies with a real
    // version, we overwrite — same number ~95% of the time so it's a
    // no-op visually, different number means another user/browser
    // already created versions and this one is higher.
    setVersionNumber(recordResearchVersion(projectId, researchId));
    void (async () => {
      const serverVersion = await fetchServerResearchVersion(researchId);
      if (cancelled) return;
      if (serverVersion) {
        setVersionNumber(serverVersion.versionNumber);
        setVersionTotal(serverVersion.totalVersions);
      }
    })();
    const computedDiff = computeResearchDiff(projectId, result);
    setDiff(computedDiff);
    // Save AFTER computing the diff so next research run sees this one
    // as "previous" and can diff against it.
    saveResearchSnapshot(projectId, result);
    return () => {
      cancelled = true;
    };
  }, [researchId, projectId, result]);

  const [open, setOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_PREF_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!researchId) return;
    const seen = readSeenResearchIds();
    if (seen.has(researchId)) return;
    setOpen(true);
    markResearchSeen(researchId);
  }, [researchId]);

  // Build the timeline once per result. Skips totalMs (rendered separately).
  const timeline = useMemo<ServiceTimelineEntry[]>(() => {
    if (!result?.serviceLatencies) return [];
    return (Object.entries(result.serviceLatencies) as Array<
      [keyof RoleRoomAgentServiceLatencies, number | undefined]
    >)
      .filter(([key, ms]) => key !== 'totalMs' && typeof ms === 'number' && ms >= 0)
      .map(([key, ms]) => ({
        key,
        ms: ms as number,
        label: SERVICE_LABELS[key]?.label ?? String(key),
        source: SERVICE_LABELS[key]?.source ?? '',
      }))
      .sort((a, b) => b.ms - a.ms);
  }, [result]);

  // Item #21 — missing critical fields. These mirror the marketing-plan
  // readiness gate in role-room-marketing-plan.ts:65 so the overlay
  // tells the user *up front* whether they can move on, not after
  // they click Generate Plan and get rejected.
  const missingCriticalFields = useMemo<string[]>(() => {
    if (!result) return [];
    const missing: string[] = [];
    if (!result.companyProfile?.companyName) missing.push('Bedriftsnavn');
    if (!result.companyProfile?.industry) missing.push('Bransje');
    if (!result.companyProfile?.targetAudience?.length) missing.push('Målgruppe');
    if ((result.companyProfile?.toneAndBrandSignals?.length ?? 0) < 3) missing.push('Tone-signaler (minst 3)');
    return missing;
  }, [result]);

  const fallbacksUsed = result?.fallbacksUsed ?? [];
  const totalMs = result?.serviceLatencies?.totalMs;
  const datapoints =
    (result?.competitorAnalysis?.competitors?.length ?? 0)
    + (result?.localPresencePlan?.nearbyOpportunities?.length ?? 0)
    + (result?.socialProfileCandidates?.length ?? 0)
    + (result?.merchSuppliers?.suppliers?.length ?? 0);

  const fullyComplete =
    missingCriticalFields.length === 0
    && fallbacksUsed.length === 0
    && Boolean(result?.companyProfile?.logoUrl)
    && (result?.planningDraft?.brandGuide?.colors?.length ?? 0) > 0;

  // Sound: only fire on mount when overlay opens AND user has enabled it.
  useEffect(() => {
    if (!open) return;
    if (!soundEnabled) return;
    playCompleteChime();
  }, [open, soundEnabled]);

  const handleClose = (): void => {
    setOpen(false);
    // #25 smooth scroll: nudge the user toward the first actionable
    // section once the overlay clears. We scroll the dialog body's
    // first interactive element into view.
    requestAnimationFrame(() => {
      const target = document.querySelector('[data-research-primary-action]') as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handlePrimary = (): void => {
    handleClose();
    onPrimaryAction?.();
  };

  const toggleSound = (): void => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  if (!result || !researchId) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="research-complete-title"
      closeAfterTransition
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '94%',
          maxWidth: 760,
          maxHeight: '92vh',
          overflowY: 'auto',
          bgcolor: '#0b1226',
          color: '#f8fafc',
          borderRadius: 4,
          border: '1px solid rgba(148,163,184,0.18)',
          boxShadow: '0 30px 80px rgba(15,23,42,0.6)',
          p: { xs: 2.4, md: 3.2 },
          outline: 'none',
        }}
      >
        {/* Confetti — pure CSS pseudo-emoji shower, only when 100% complete */}
        {fullyComplete ? <ConfettiLayer /> : null}

        {/* Header / close + sound toggle */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircleIcon sx={{ color: fullyComplete ? '#34d399' : '#fbbf24', fontSize: 30 }} />
            <Typography
              id="research-complete-title"
              variant="h6"
              sx={{ fontWeight: 800, color: '#f8fafc' }}
            >
              Research er ferdig
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.4} alignItems="center">
            <Tooltip title={soundEnabled ? 'Slå av lyd ved ferdig research' : 'Slå på lyd ved ferdig research'}>
              <IconButton size="small" onClick={toggleSound} sx={{ color: '#cbd5e1' }}>
                {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={handleClose} sx={{ color: '#cbd5e1' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* #22 Sticky-style summary card */}
        <Box
          sx={{
            p: 1.8,
            borderRadius: 3,
            border: `1px solid ${fullyComplete ? 'rgba(52,211,153,0.32)' : 'rgba(251,191,36,0.28)'}`,
            bgcolor: fullyComplete ? 'rgba(16,185,129,0.08)' : 'rgba(251,191,36,0.06)',
            mb: 2,
          }}
        >
          <Stack spacing={0.6}>
            <Stack direction="row" alignItems="center" spacing={1.2} flexWrap="wrap" useFlexGap>
              {result.companyProfile?.logoUrl ? (
                <Box
                  component="img"
                  src={result.companyProfile.logoUrl}
                  alt=""
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: 'rgba(248,250,252,0.95)',
                    objectFit: 'contain',
                    p: 0.3,
                  }}
                />
              ) : null}
              <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>
                {result.companyProfile?.companyName || 'Ukjent bedrift'}
              </Typography>
              <Chip
                size="small"
                label={result.companyProfile?.industry || 'ukjent bransje'}
                sx={{ bgcolor: 'rgba(99,102,241,0.18)', color: '#e0e7ff', fontWeight: 600 }}
              />
              {result.companyProfile?.businessModel ? (
                <Chip
                  size="small"
                  label={result.companyProfile.businessModel}
                  sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#e2e8f0' }}
                />
              ) : null}
              {versionNumber !== null ? (
                <Tooltip
                  title={
                    versionTotal !== null
                      ? `Versjon ${versionNumber} av ${versionTotal} for denne kunden — synlig på tvers av nettlesere/team-medlemmer.`
                      : 'Versjon for denne kunden i denne nettleseren — server-versjonering ikke tilgjengelig.'
                  }
                >
                  <Chip
                    size="small"
                    label={versionTotal !== null && versionTotal > 1 ? `v${versionNumber}/${versionTotal}` : `v${versionNumber}`}
                    sx={{ bgcolor: 'rgba(34,211,238,0.16)', color: '#a5f3fc', fontWeight: 700, fontFamily: 'monospace' }}
                  />
                </Tooltip>
              ) : null}
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.86rem' }}>
              Vi fant <strong>{datapoints}</strong> datapunkter på{' '}
              <strong>{formatMs(totalMs)}</strong>.
              {missingCriticalFields.length === 0 ? (
                <> Klar for marketing plan ✓</>
              ) : (
                <> Mangler {missingCriticalFields.length} kritisk{missingCriticalFields.length === 1 ? '' : 'e'} felt før marketing plan.</>
              )}
            </Typography>
            {/* #42 — Claude-generert executive summary, render kun hvis den
                kom tilbake. Faller tilbake til companyProfile.summary
                visuelt ellers (allerede en del av basis-overlay-en). */}
            {result.executiveSummary ? (
              <Typography
                sx={{
                  color: '#e0e7ff',
                  fontSize: '0.88rem',
                  fontStyle: 'italic',
                  lineHeight: 1.55,
                  mt: 0.6,
                  pt: 0.6,
                  borderTop: '1px dashed rgba(148,163,184,0.18)',
                }}
              >
                {result.executiveSummary}
              </Typography>
            ) : null}
          </Stack>
        </Box>

        {/* #21 Missing critical fields */}
        {missingCriticalFields.length > 0 ? (
          <Alert
            icon={<WarningIcon fontSize="inherit" />}
            severity="warning"
            sx={{
              mb: 2,
              bgcolor: 'rgba(251,191,36,0.1)',
              color: '#fde68a',
              border: '1px solid rgba(251,191,36,0.3)',
              '& .MuiAlert-icon': { color: '#fbbf24' },
            }}
          >
            <Typography sx={{ fontWeight: 700, mb: 0.4 }}>Manglende felt før marketing plan</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {missingCriticalFields.map((field) => (
                <Chip
                  key={field}
                  size="small"
                  label={field}
                  sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fecaca', fontWeight: 600 }}
                />
              ))}
            </Stack>
          </Alert>
        ) : null}

        {/* #19 Fallbacks used */}
        {fallbacksUsed.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.82rem', mb: 0.6 }}>
              Fallbacks vi brukte (research kom gjennom, men noen kilder svarte tomt):
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {fallbacksUsed.map((fallback) => (
                <Chip
                  key={fallback}
                  size="small"
                  label={fallback}
                  sx={{
                    bgcolor: 'rgba(148,163,184,0.14)',
                    color: '#cbd5e1',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                  }}
                />
              ))}
            </Stack>
          </Box>
        ) : null}

        {/* #7 + #8 + #11 Timeline with source attribution + tooltips */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 1 }}>
            Hvordan vi fant dette
          </Typography>
          <Stack spacing={0.4}>
            {timeline.length === 0 ? (
              <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem' }}>
                Ingen latency-data tilgjengelig.
              </Typography>
            ) : (
              timeline.map((entry) => {
                const pct = totalMs && totalMs > 0 ? Math.min(100, (entry.ms / totalMs) * 100) : 0;
                const tooltipBody = `Bygget på ${entry.source} – sist sjekket ${
                  result.bootstrapFinishedAt
                    ? new Date(result.bootstrapFinishedAt).toLocaleString('nb-NO')
                    : 'ukjent tid'
                }`;
                return (
                  <Tooltip key={entry.key} title={tooltipBody} placement="left" arrow>
                    <Box
                      sx={{
                        position: 'relative',
                        p: 0.8,
                        borderRadius: 1.6,
                        border: '1px solid rgba(148,163,184,0.14)',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: `${pct}%`,
                          bgcolor: 'rgba(99,102,241,0.18)',
                          zIndex: 0,
                        }}
                      />
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ position: 'relative', zIndex: 1 }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.88rem' }}>
                            {entry.label}
                          </Typography>
                          <Typography
                            sx={{
                              color: 'rgba(226,232,240,0.5)',
                              fontSize: '0.72rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            {entry.source}
                          </Typography>
                        </Stack>
                        <Typography
                          sx={{
                            color: '#a5b4fc',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                          }}
                        >
                          {formatMs(entry.ms)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Tooltip>
                );
              })
            )}
          </Stack>
        </Box>

        {/* #26 + #27 + #29 — three-action CTA cards + readiness checklist
            + missing-fields fill-in. Sits at the top of the action area
            so users land on "what to do next" before the rest of the data. */}
        <ResearchNextStepsCards
          result={result}
          onGenerateMarketingPlan={onPrimaryAction}
        />

        {/* #51-#75 — quality-assurance flags (cross-validation, completeness,
            data quality, trust signals, performance, suggestions, change-detect) */}
        <ResearchValidationFlagsSection flags={result.validationFlags} />

        {/* #44 — three first-week content suggestions */}
        <ResearchFirstWeekIdeas result={result} />

        {/* #5 + #6 + #7-extended + #16 + #17 Field provenance heatmap with confidence + rationale modal */}
        <ResearchFieldProvenancePanel result={result} />

        {/* #9 Diff vs. previous research */}
        <ResearchDiffSection diff={diff} />

        {/* #20 + #33 Social profile candidates preview with Connect-knapper */}
        {result.socialProfileCandidates && result.socialProfileCandidates.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            <SocialProfileCandidatesPreview
              candidates={result.socialProfileCandidates}
              projectId={projectId}
            />
          </Box>
        ) : null}

        {/* #18 Debug view */}
        <Box sx={{ mb: 2 }}>
          <Button
            size="small"
            onClick={() => setShowDebug((prev) => !prev)}
            startIcon={
              <ExpandMoreIcon
                sx={{
                  transform: showDebug ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            }
            sx={{
              textTransform: 'none',
              color: '#cbd5e1',
              fontSize: '0.82rem',
              px: 0,
            }}
          >
            Debug-data
          </Button>
          <Collapse in={showDebug} unmountOnExit>
            <Box
              sx={{
                mt: 1,
                p: 1.4,
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.18)',
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                color: 'rgba(226,232,240,0.78)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(
                {
                  researchId,
                  startedAt: result.bootstrapStartedAt,
                  finishedAt: result.bootstrapFinishedAt,
                  provider: result.provider,
                  model: result.model,
                  serviceLatencies: result.serviceLatencies,
                  fallbacksUsed: result.fallbacksUsed,
                  datapoints: {
                    competitors: result.competitorAnalysis?.competitors?.length ?? 0,
                    localOpportunities: result.localPresencePlan?.nearbyOpportunities?.length ?? 0,
                    socialProfiles: result.socialProfileCandidates?.length ?? 0,
                    merchSuppliers: result.merchSuppliers?.suppliers?.length ?? 0,
                    brandColors: result.planningDraft?.brandGuide?.colors?.length ?? 0,
                  },
                },
                null,
                2,
              )}
            </Box>
          </Collapse>
        </Box>

        {/* Actions: export trio + close + primary CTA */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          {/* #12 — Export JSON / CSV / PDF. Keep buttons text-only so they
              read as secondary actions next to the primary CTA. */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Tooltip title="Last ned hele research-resultatet som JSON">
              <Button
                size="small"
                onClick={() => exportResearchAsJson(result)}
                startIcon={<DownloadIcon fontSize="small" />}
                sx={{
                  color: '#cbd5e1',
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  borderColor: 'rgba(148,163,184,0.24)',
                }}
                variant="outlined"
              >
                JSON
              </Button>
            </Tooltip>
            <Tooltip title="Last ned firmaprofil som CSV (åpnes i Excel/Google Sheets)">
              <Button
                size="small"
                onClick={() => exportResearchAsCsv(result)}
                startIcon={<DownloadIcon fontSize="small" />}
                sx={{
                  color: '#cbd5e1',
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  borderColor: 'rgba(148,163,184,0.24)',
                }}
                variant="outlined"
              >
                CSV
              </Button>
            </Tooltip>
            <Tooltip title="Generer pitchklar PDF med brandfarger fra logo">
              <Button
                size="small"
                onClick={() =>
                  exportResearchAsPdf(
                    result,
                    versionNumber !== null ? `Versjon ${versionNumber}` : null,
                  )
                }
                startIcon={<DownloadIcon fontSize="small" />}
                sx={{
                  color: '#cbd5e1',
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  borderColor: 'rgba(148,163,184,0.24)',
                }}
                variant="outlined"
              >
                PDF
              </Button>
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button onClick={handleClose} sx={{ color: '#cbd5e1', textTransform: 'none' }}>
              Lukk
            </Button>
            {onPrimaryAction ? (
              <Button
                onClick={handlePrimary}
                variant="contained"
                endIcon={<ChevronRightIcon />}
                data-research-primary-action
                sx={{
                  bgcolor: '#6366f1',
                  '&:hover': { bgcolor: '#4f46e5' },
                  textTransform: 'none',
                  fontWeight: 700,
                }}
              >
                {primaryActionLabel}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Modal>
  );
};

/** Pure-CSS confetti — 60 absolutely-positioned spans falling at staggered
 *  delays + horizontal drift. No new dependency, no canvas. Auto-removes
 *  after 3.5s via parent re-render when overlay closes. */
const ConfettiLayer: React.FC = () => {
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 2,
        '@keyframes researchOverlayConfetti': {
          '0%': { transform: 'translate3d(0,-20px,0) rotate(0deg)', opacity: 1 },
          '100%': { transform: 'translate3d(var(--drift),120vh,0) rotate(720deg)', opacity: 0 },
        },
      }}
    >
      {pieces.map((i) => {
        const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#22d3ee'];
        const color = colors[i % colors.length];
        const left = (i * 7) % 100;
        const drift = `${(((i * 13) % 80) - 40)}px`;
        const duration = 2.4 + ((i % 5) * 0.3);
        const delay = (i % 12) * 0.08;
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: 0,
              left: `${left}%`,
              width: 8,
              height: 14,
              bgcolor: color,
              borderRadius: '2px',
              animation: `researchOverlayConfetti ${duration}s linear ${delay}s forwards`,
              '--drift': drift,
            } as React.CSSProperties}
          />
        );
      })}
    </Box>
  );
};

export default ResearchCompleteOverlay;
