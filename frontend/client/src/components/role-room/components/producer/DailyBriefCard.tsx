/**
 * DailyBriefCard — "Dagens brief"
 *
 * Surfaces the nightly "Morning Brief" findings that the proactive daily scan
 * (backend/server/role-room-agent-daily-scan.ts) writes into
 * `producer_project_notifications` with `inbox_type='ai_scan'` and
 * `event_type` like `ai_scan_high|medium|low`.
 *
 * Reuses the existing producer-notifications fetch
 * (`producerWorkflowService.getNotifications`) and filters client-side to the
 * latest `ai_scan` rows — no new backend endpoint is needed because that
 * endpoint already returns every notification with `inbox_type`/`event_type`.
 *
 * Each finding can (best-effort) infer which producer fane it concerns from
 * its title/detail text and offers a "Gå til <fane>"-link that calls
 * `props.onNavigate(tabKey)` so the parent (RoleRoomAgentDialog) can switch tab.
 *
 * Self-styled per the shared dark producer palette — does NOT import any
 * package-A `ui/` primitives (they may not exist yet).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  WbTwilight as BriefIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArrowForward as GoIcon,
  CheckCircleOutline as CalmIcon,
} from '@mui/icons-material';
import {
  producerWorkflowService,
  type ProducerProjectNotification,
} from '../../services/producerWorkflowService';
import { useT, type TranslationKey } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

type BriefSeverity = 'high' | 'medium' | 'low';

/** Tab keys understood by RoleRoomAgentDialog's setActiveTab. */
type BriefTabKey = 'social-inbox' | 'leads' | 'feed-planner' | 'social-analytics';

export interface DailyBriefCardProps {
  projectId: string;
  /**
   * Called when the producer clicks "Gå til <fane>" on a finding. Receives the
   * inferred tab key (e.g. 'social-inbox'). Optional — the link is hidden when
   * not provided.
   */
  onNavigate?: (tab: BriefTabKey) => void;
  /** Hard cap on how many findings are shown (default 6). */
  maxItems?: number;
}

interface BriefFinding {
  id: string;
  severity: BriefSeverity;
  title: string;
  detail: string | null;
  createdAt: string;
  tab: BriefTabKey | null;
  faneLabel: TranslationKey | null;
}

const SEVERITY_COLOR: Record<BriefSeverity, string> = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#94a3b8',
};

const SEVERITY_BG: Record<BriefSeverity, string> = {
  high: 'rgba(248,113,113,0.14)',
  medium: 'rgba(251,191,36,0.14)',
  low: 'rgba(148,163,184,0.14)',
};

const buildSEVERITY_LABEL = (t: TFn): Record<BriefSeverity, string> => ({
  high: t('dailyBrief.s004'),
  medium: t('dailyBrief.s000'),
  low: t('dailyBrief.s010'),
});

const SEVERITY_RANK: Record<BriefSeverity, number> = { high: 0, medium: 1, low: 2 };

const TAB_LABEL: Record<BriefTabKey, TranslationKey> = {
  'social-inbox': 'dailyBrief.tabInbox',
  leads: 'dailyBrief.tabLeads',
  'feed-planner': 'dailyBrief.tabFeed',
  'social-analytics': 'dailyBrief.tabAnalyse',
};

/** Parse the persisted `event_type` (ai_scan_high|medium|low) into severity. */
function severityFromEventType(eventType: string): BriefSeverity {
  const normalized = String(eventType || '').toLowerCase();
  if (normalized.endsWith('_high') || normalized === 'ai_scan_high') return 'high';
  if (normalized.endsWith('_medium') || normalized === 'ai_scan_medium') return 'medium';
  return 'low';
}

/**
 * Infer which producer fane a finding concerns from its title/detail text.
 * The nightly scan does not persist the original `area`, so we keyword-match
 * the same four areas the scan reasons about (inbox/leads/feed/analytics).
 * Returns null when nothing matches — the row then renders without a link.
 */
function inferTab(title: string, detail: string | null): BriefTabKey | null {
  const haystack = `${title} ${detail ?? ''}`.toLowerCase();
  // Order matters: most specific signals first.
  if (/(innboks|inbox|ubesvart|kommentar|melding|dm\b|uleste?)/.test(haystack)) {
    return 'social-inbox';
  }
  if (/(lead|kunde|roi|oppfølg|prospekt|salg)/.test(haystack)) {
    return 'leads';
  }
  if (/(feed|post(er|en)?\b|publiser|frist|planlag|innlegg)/.test(haystack)) {
    return 'feed-planner';
  }
  if (/(analyse|analytics|stemning|sentiment|rytme|cadence|innsikt)/.test(haystack)) {
    return 'social-analytics';
  }
  return null;
}

function toFinding(row: ProducerProjectNotification): BriefFinding {
  const severity = severityFromEventType(row.event_type);
  const title = (row.title || '').trim();
  const detail = row.message && row.message.trim().length > 0 ? row.message.trim() : null;
  const tab = inferTab(title, detail);
  return {
    id: row.id,
    severity,
    title,
    detail,
    createdAt: row.created_at,
    tab,
    faneLabel: tab ? TAB_LABEL[tab] : null,
  };
}

const PANEL_BG = 'rgba(15,23,42,0.55)';
const CARD_BG = 'rgba(15,23,42,0.6)';
const BORDER = '1px solid rgba(148,163,184,0.18)';
const ACCENT = 'var(--role-cyan, #22d3ee)';

export function DailyBriefCard({ projectId, onNavigate, maxItems = 6 }: DailyBriefCardProps): JSX.Element {
  const { t } = useT();
  const SEVERITY_LABEL = useMemo(() => buildSEVERITY_LABEL(t), [t]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<BriefFinding[]>([]);
  const [expanded, setExpanded] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setFindings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const all = await producerWorkflowService.getNotifications(projectId);
      const aiScan = all.filter((n) => String(n.inbox_type || '').toLowerCase() === 'ai_scan');
      // Latest first (the service already sorts by updated_at desc), then rank
      // by severity so high → low is the reading order inside the card.
      const ranked = aiScan
        .map(toFinding)
        .sort((a, b) => {
          const byRank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
          if (byRank !== 0) return byRank;
          return b.createdAt.localeCompare(a.createdAt);
        })
        .slice(0, Math.max(1, maxItems));
      setFindings(ranked);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dailyBrief.s006'));
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, maxItems]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const highCount = useMemo(
    () => findings.filter((f) => f.severity === 'high').length,
    [findings],
  );

  return (
    <Box
      sx={{
        bgcolor: PANEL_BG,
        border: BORDER,
        borderRadius: 2,
        p: { xs: 1.4, md: 1.8 },
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 1.4,
            bgcolor: 'rgba(34,211,238,0.12)',
            color: ACCENT,
          }}
        >
          <BriefIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.1 }}>
            {t('dailyBrief.s001')}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem', mt: 0.2 }}>
            {t('dailyBrief.s007')}
          </Typography>
        </Box>
        {!loading && highCount > 0 ? (
          <Chip
            label={t('dailyBrief.p00', { v0: highCount })}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.68rem',
              fontWeight: 700,
              color: SEVERITY_COLOR.high,
              bgcolor: SEVERITY_BG.high,
              border: `1px solid ${SEVERITY_COLOR.high}55`,
            }}
          />
        ) : null}
        <IconButton size="small" sx={{ color: 'rgba(226,232,240,0.66)' }} aria-label={expanded ? t('dailyBrief.s009') : t('dailyBrief.s011')}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1.4 }}>
          {loading ? (
            <Stack spacing={1}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{ bgcolor: CARD_BG, border: BORDER, borderRadius: 1.4, p: 1.2 }}
                >
                  <Skeleton variant="text" width="42%" height={16} sx={{ bgcolor: 'rgba(148,163,184,0.15)' }} />
                  <Skeleton variant="text" width="88%" height={14} sx={{ bgcolor: 'rgba(148,163,184,0.1)' }} />
                </Box>
              ))}
            </Stack>
          ) : error ? (
            <Box
              sx={{
                bgcolor: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 1.4,
                p: 1.4,
              }}
            >
              <Typography sx={{ color: '#fecaca', fontSize: '0.84rem' }}>{error}</Typography>
              <Link
                component="button"
                type="button"
                onClick={() => void refresh()}
                sx={{ color: ACCENT, fontSize: '0.78rem', fontWeight: 700, mt: 0.6 }}
              >
                {t('dailyBrief.s008')}
              </Link>
            </Box>
          ) : findings.length === 0 ? (
            <Stack
              alignItems="center"
              spacing={0.6}
              sx={{
                bgcolor: CARD_BG,
                border: BORDER,
                borderRadius: 1.4,
                py: 2.4,
                px: 1.4,
              }}
            >
              <CalmIcon sx={{ color: '#86efac', fontSize: 28 }} />
              <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                {t('dailyBrief.s005')}
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem', textAlign: 'center' }}>
                {t('dailyBrief.s002')}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {findings.map((finding) => (
                <Box
                  key={finding.id}
                  sx={{
                    bgcolor: CARD_BG,
                    border: BORDER,
                    borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity]}`,
                    borderRadius: 1.4,
                    p: 1.2,
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Chip
                      label={SEVERITY_LABEL[finding.severity]}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: SEVERITY_COLOR[finding.severity],
                        bgcolor: SEVERITY_BG[finding.severity],
                        border: `1px solid ${SEVERITY_COLOR[finding.severity]}55`,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.25 }}>
                        {finding.title || t('dailyBrief.funnFraBrief')}
                      </Typography>
                      {finding.detail ? (
                        <Typography
                          sx={{
                            color: 'rgba(226,232,240,0.66)',
                            fontSize: '0.78rem',
                            mt: 0.4,
                            lineHeight: 1.35,
                          }}
                        >
                          {finding.detail}
                        </Typography>
                      ) : null}
                      {finding.tab && finding.faneLabel && onNavigate ? (
                        <Link
                          component="button"
                          type="button"
                          onClick={() => onNavigate(finding.tab as BriefTabKey)}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.4,
                            color: ACCENT,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            mt: 0.7,
                            textDecoration: 'none',
                            '&:hover': { color: '#a5f3fc' },
                          }}
                        >
                          {t('dailyBrief.s003')} {t(finding.faneLabel)}
                          <GoIcon sx={{ fontSize: 14 }} />
                        </Link>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export default DailyBriefCard;
