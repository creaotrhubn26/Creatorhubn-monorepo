/**
 * CompetitorReportPanel — AI-konkurrent-rapport for The Role Room.
 *
 * Følger AdminRoom-design-tokens (./styles.ts): lilla primær for AI-funksjoner,
 * deep slate-paneler, bold #fff-headers, statusbaserte chips.
 *
 * Henter siste lagrede rapport ved mount; "Generer ny"-knapp kjører Claude
 * (~0.50 NOK) og lagrer i marketing_competitor_reports-tabell.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton,
  Menu, MenuItem, Stack, Tooltip, Typography, Divider,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import GavelIcon from '@mui/icons-material/Gavel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { adminTokens, adminSx, statusChipSx } from './styles';

const THEROLERROOM_LOGO_URL = '/role-room-assets/TheRoleRoom_Logo_Tagline.webp';

interface Insight {
  category: 'opportunity' | 'threat' | 'gap' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  actionableSteps: string[];
  relatedCompetitors?: string[];
}
interface Action {
  action: string;
  rationale: string;
  expectedImpact: string;
  timeframe?: string;
}
interface ScoreEntry {
  nickname: string;
  momentum: 'fast-growth' | 'steady' | 'flat' | 'declining';
  notableActivity: string;
}
interface KpiTarget {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'ga4';
  metric: string;
  currentValue: number | null;
  targetValue: number;
  timeframe: '7d' | '30d' | '90d';
  reasoning: string;
  difficulty: 'easy' | 'realistic' | 'stretch';
}
interface Report {
  summary: string;
  insights: Insight[];
  contentGaps: string[];
  recommendedNextActions: Action[];
  competitorScorecard: ScoreEntry[];
  kpiTargets?: KpiTarget[];
}

const CATEGORY_META: Record<Insight['category'], {
  status: keyof typeof adminTokens.status;
  icon: React.ReactElement;
  label: string;
}> = {
  opportunity: { status: 'success', icon: <LightbulbOutlinedIcon sx={{ fontSize: 16 }} />, label: 'Mulighet' },
  threat:      { status: 'error',   icon: <WarningAmberOutlinedIcon sx={{ fontSize: 16 }} />, label: 'Trussel' },
  gap:         { status: 'warning', icon: <GavelIcon sx={{ fontSize: 16 }} />, label: 'Gap' },
  trend:       { status: 'info',    icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, label: 'Trend' },
};
const PRIORITY_ORDER: Record<Insight['priority'], number> = { high: 0, medium: 1, low: 2 };
const MOMENTUM_META: Record<ScoreEntry['momentum'], { status: keyof typeof adminTokens.status; label: string }> = {
  'fast-growth': { status: 'success', label: 'Hot' },
  steady:        { status: 'info',    label: 'Stabil' },
  flat:          { status: 'neutral', label: 'Flat' },
  declining:     { status: 'error',   label: 'Faller' },
};

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1 }}>
      {icon && <Box sx={{ color: adminTokens.primary.textBright, display: 'flex' }}>{icon}</Box>}
      <Typography sx={adminSx.sectionSubHeader}>{children}</Typography>
    </Stack>
  );
}

function ComposeButton({
  ins, step, reportId,
}: { ins: Insight; step: string; reportId: number | null }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const platforms: Array<{ id: 'facebook' | 'instagram' | 'linkedin' | 'tiktok'; label: string; icon: React.ReactElement; color: string }> = [
    { id: 'facebook',  label: 'Facebook',  icon: <FacebookIcon sx={{ fontSize: 16 }} />, color: adminTokens.platforms.facebook },
    { id: 'instagram', label: 'Instagram', icon: <InstagramIcon sx={{ fontSize: 16 }} />, color: adminTokens.platforms.instagram },
    { id: 'linkedin',  label: 'LinkedIn',  icon: <LinkedInIcon sx={{ fontSize: 16 }} />, color: adminTokens.platforms.linkedin },
    { id: 'tiktok',    label: 'TikTok',    icon: <MusicNoteIcon sx={{ fontSize: 16 }} />, color: adminTokens.platforms.tiktok },
  ];

  const compose = async (platform: string) => {
    setAnchorEl(null);
    setBusy(platform);
    setNotice(null);
    try {
      const r = await fetch('/api/role-room/agent/compose-post-from-insight', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandKey: 'theroleroom',
          platform,
          insightTitle: ins.title,
          insightBody: ins.body,
          insightCategory: ins.category,
          actionableStep: step,
          sourceReportId: reportId,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setNotice({ kind: 'success', msg: `Draft skrevet for ${platform}. Se Post-drafts-panelet under.` });
        window.dispatchEvent(new CustomEvent('role-room:draft-composed', { detail: { draftId: d.draftId } }));
      } else {
        setNotice({ kind: 'error', msg: d.error || 'Compose failed' });
      }
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Tooltip title="Skriv dette innlegget med Claude (~0.12 NOK)">
        <Button
          size="small"
          startIcon={busy ? <CircularProgress size={12} /> : <EditNoteIcon sx={{ fontSize: 14 }} />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          disabled={!!busy}
          data-testid={`compose-button-${step.slice(0, 20)}`}
          sx={{
            textTransform: 'none', fontSize: '0.7rem', minHeight: 24, py: 0.25, px: 1,
            color: adminTokens.primary.textBright,
            border: `1px solid ${adminTokens.border.accent}`,
            '&:hover': { background: adminTokens.primary.softer },
          }}
        >
          {busy ? `Skriver til ${busy}…` : 'Skriv dette innlegget'}
        </Button>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { background: adminTokens.bg.overlay, color: adminTokens.text.body } } }}>
        {platforms.map((p) => (
          <MenuItem key={p.id} onClick={() => void compose(p.id)} sx={{ color: adminTokens.text.body }}>
            <Box sx={{ color: p.color, mr: 1, display: 'flex' }}>{p.icon}</Box>
            {p.label}
          </MenuItem>
        ))}
      </Menu>
      {notice && (
        <Alert severity={notice.kind} sx={{ mt: 0.75, py: 0.25 }} onClose={() => setNotice(null)}>
          <Typography variant="caption">{notice.msg}</Typography>
        </Alert>
      )}
    </>
  );
}

function InsightCard({ ins, reportId }: { ins: Insight; reportId: number | null }) {
  const meta = CATEGORY_META[ins.category];
  const status = adminTokens.status[meta.status];
  const isHighPriority = ins.priority === 'high';
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 1.5,
        border: `1px solid ${status.border}`,
        background: `${status.base}0d`,
        position: 'relative',
        ...(isHighPriority && {
          borderLeft: `4px solid ${status.base}`,
        }),
      }}
      data-testid={`insight-${ins.category}`}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <Box sx={{ color: status.base, display: 'flex' }}>{meta.icon}</Box>
        <Chip label={meta.label} size="small" sx={statusChipSx(meta.status)} />
        {isHighPriority && (
          <Chip label="HØY" size="small"
            sx={{
              background: 'rgba(239,68,68,0.18)', color: '#fca5a5',
              fontSize: '0.6rem', height: 16, fontWeight: 700, letterSpacing: '0.08em',
            }} />
        )}
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, color: adminTokens.text.primary }}>
          {ins.title}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: adminTokens.text.body, mb: 1, lineHeight: 1.6 }}>
        {ins.body}
      </Typography>
      {ins.actionableSteps.length > 0 && (
        <Box sx={{ mb: ins.relatedCompetitors?.length ? 0.75 : 0 }}>
          <Typography sx={{ ...adminSx.sectionSubHeader, mb: 0.5 }}>Handlinger</Typography>
          <Stack spacing={0.6}>
            {ins.actionableSteps.map((s, i) => (
              <Box key={i} sx={{
                pl: 1.2, borderLeft: `2px solid ${status.base}`,
              }}>
                <Typography variant="body2" sx={{ color: adminTokens.text.body, fontSize: '0.86rem', mb: 0.4 }}>
                  {s}
                </Typography>
                <ComposeButton ins={ins} step={s} reportId={reportId} />
              </Box>
            ))}
          </Stack>
        </Box>
      )}
      {ins.relatedCompetitors && ins.relatedCompetitors.length > 0 && (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          {ins.relatedCompetitors.map((n) => (
            <Chip key={n} label={n} size="small" sx={statusChipSx('neutral')} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function CompetitorReportPanel() {
  const [report, setReport] = useState<Report | null>(null);
  const [reportMeta, setReportMeta] = useState<{ generatedAt: string; cached: boolean; costNok: number | null; competitorCount: number; reportId: number | null } | null>(null);
  const [competitorPictures, setCompetitorPictures] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    try {
      const r = await fetch('/api/role-room/marketing-cockpit/competitors/reports/latest?brandKey=theroleroom', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (d.ok) {
          setReport(d.report);
          setReportMeta({
            generatedAt: d.generatedAt, cached: true,
            costNok: d.costNok, competitorCount: d.competitorCount,
            reportId: d.reportId ?? null,
          });
          setCompetitorPictures(d.competitorPictures || {});
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadLatest(); }, [loadLatest]);

  const generate = useCallback(async (useCache: boolean) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/role-room/marketing-cockpit/competitors/generate-report', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: 'theroleroom', useCache }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Generation failed');
      setReport(d.report);
      setReportMeta({
        generatedAt: d.generatedAt, cached: !!d.cached,
        costNok: d.costNok, competitorCount: d.competitorCount,
        reportId: d.reportId ?? null,
      });
      setCompetitorPictures(d.competitorPictures || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterNotice, setNewsletterNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const generateNewsletter = useCallback(async () => {
    if (!reportMeta?.reportId) return;
    setNewsletterBusy(true); setNewsletterNotice(null);
    try {
      const r = await fetch('/api/admin-room/newsletter/role-room/issues/from-report', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: 'theroleroom', reportId: reportMeta.reportId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `status ${r.status}`);
      setNewsletterNotice({
        kind: 'success',
        msg: `Weekly Brief-draft opprettet (${d.blockCount} blocks). Åpne Newsletter Studio for å redigere.`,
      });
    } catch (err) {
      setNewsletterNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setNewsletterBusy(false);
    }
  }, [reportMeta?.reportId]);

  const sortedInsights = report?.insights
    ? [...report.insights].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    : [];

  return (
    <Card sx={adminSx.panelAccent} data-testid="panel-competitor-report">
      <CardContent sx={{ p: 2.5 }}>
        {/* Header — The Role Room brand-logo + Claude AI-mark */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box
            component="img"
            src={THEROLERROOM_LOGO_URL}
            alt="The Role Room"
            sx={{
              height: 36, width: 'auto', maxWidth: 180,
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.25))',
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <Box sx={{
            width: 28, height: 28, borderRadius: 1,
            background: `linear-gradient(135deg, ${adminTokens.primary.soft}, ${adminTokens.primary.base}50)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${adminTokens.border.accent}`,
          }}>
            <AutoAwesomeIcon sx={{ color: adminTokens.primary.textBright, fontSize: 16 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={adminSx.sectionHeader}>AI Konkurrent-rapport</Typography>
            <Typography variant="caption" sx={{ color: adminTokens.text.muted, display: 'block' }}>
              Claude Sonnet 4.5 analyserer 30-d konkurrent-data + content pillars
            </Typography>
          </Box>
          <Button
            startIcon={<AutoAwesomeIcon />}
            onClick={() => void generate(false)} disabled={loading}
            data-testid="report-generate" variant="contained" sx={adminSx.primaryButton}
            size="medium"
          >
            {loading ? 'Genererer…' : 'Generer ny'}
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void generate(true)} disabled={loading}
            data-testid="report-cache" sx={adminSx.secondaryButton} size="medium"
          >
            Cache
          </Button>
          {reportMeta?.reportId && (
            <Button
              startIcon={<MailOutlineIcon />}
              onClick={() => void generateNewsletter()} disabled={newsletterBusy}
              data-testid="report-to-newsletter" sx={adminSx.secondaryButton} size="medium"
            >
              {newsletterBusy ? 'Lager…' : 'Lag Weekly Brief'}
            </Button>
          )}
        </Stack>

        {newsletterNotice && (
          <Alert
            severity={newsletterNotice.kind}
            sx={{ mb: 2 }}
            onClose={() => setNewsletterNotice(null)}
            data-testid="newsletter-from-report-notice"
          >
            {newsletterNotice.msg}
            {newsletterNotice.kind === 'success' && (
              <>
                {' '}
                <Box component="a" href="/admin?tab=newsletter-studio"
                  sx={{ color: adminTokens.primary.textBright, textDecoration: 'underline', fontWeight: 600 }}>
                  Åpne Newsletter Studio
                </Box>
              </>
            )}
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="report-error">{error}</Alert>}

        {reportMeta && (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip
              label={reportMeta.cached ? `Cached · ${new Date(reportMeta.generatedAt).toLocaleString('nb-NO')}` : `Fresh · ${new Date(reportMeta.generatedAt).toLocaleString('nb-NO')}`}
              size="small"
              sx={statusChipSx(reportMeta.cached ? 'info' : 'success')}
            />
            <Chip label={`${reportMeta.competitorCount} konkurrenter`} size="small" sx={statusChipSx('neutral')} />
            {reportMeta.costNok != null && (
              <Chip label={`${reportMeta.costNok.toFixed(2)} NOK`} size="small" sx={statusChipSx('warning')} />
            )}
          </Stack>
        )}

        {!report && !loading && (
          <Alert severity="info" data-testid="report-empty-state"
            sx={{
              background: 'rgba(59,130,246,0.10)',
              border: `1px solid ${adminTokens.status.info.border}`,
              color: adminTokens.status.info.text,
              '& .MuiAlert-icon': { color: adminTokens.status.info.base },
            }}>
            Ingen rapport generert ennå. Trenger ≥1 tracked konkurrent og ≥1 snapshot per konkurrent.
            Klikk "Generer ny" — koster ~0.50 NOK med Claude Sonnet 4.5.
          </Alert>
        )}

        {report && (
          <Stack spacing={2.5}>
            {/* Executive summary */}
            <Box sx={{
              p: 2,
              background: `linear-gradient(135deg, ${adminTokens.primary.softer}, ${adminTokens.primary.soft})`,
              borderRadius: 1.5,
              border: `1px solid ${adminTokens.border.accent}`,
            }}>
              <SectionLabel>Sammendrag</SectionLabel>
              <Typography sx={{ color: adminTokens.text.primary, lineHeight: 1.7, fontSize: '0.95rem' }}>
                {report.summary}
              </Typography>
            </Box>

            {/* Insights */}
            {sortedInsights.length > 0 && (
              <Box>
                <SectionLabel icon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}>
                  Insights · {sortedInsights.length}
                </SectionLabel>
                <Stack spacing={1.25}>
                  {sortedInsights.map((ins, i) =>
                    <InsightCard key={i} ins={ins} reportId={reportMeta?.reportId ?? null} />)}
                </Stack>
              </Box>
            )}

            {/* Recommended actions */}
            {report.recommendedNextActions.length > 0 && (
              <Box>
                <SectionLabel icon={<RocketLaunchOutlinedIcon sx={{ fontSize: 16 }} />}>
                  Anbefalte handlinger · {report.recommendedNextActions.length}
                </SectionLabel>
                <Stack spacing={1.25}>
                  {report.recommendedNextActions.map((a, i) => (
                    <Box key={i}
                      sx={{
                        p: 1.75, borderRadius: 1.5,
                        background: 'rgba(16,185,129,0.06)',
                        border: `1px solid ${adminTokens.status.success.border}`,
                        borderLeft: `4px solid ${adminTokens.status.success.base}`,
                      }}
                      data-testid="report-action">
                      <Typography sx={{
                        fontWeight: 700, color: adminTokens.status.success.text, fontSize: '0.95rem',
                      }}>
                        {a.action}
                      </Typography>
                      <Typography variant="body2" sx={{ color: adminTokens.text.body, mt: 0.5, lineHeight: 1.55 }}>
                        {a.rationale}
                      </Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap">
                        <Chip label={`Impact: ${a.expectedImpact}`} size="small" sx={statusChipSx('success')} />
                        {a.timeframe && <Chip label={a.timeframe} size="small" sx={statusChipSx('neutral')} />}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Content gaps */}
            {report.contentGaps.length > 0 && (
              <Box>
                <SectionLabel icon={<GavelIcon sx={{ fontSize: 16 }} />}>
                  Content-gaps · {report.contentGaps.length}
                </SectionLabel>
                <Stack spacing={0.6}>
                  {report.contentGaps.map((g, i) => (
                    <Box key={i}
                      sx={{
                        py: 0.75, pl: 1.5, pr: 1,
                        borderLeft: `3px solid ${adminTokens.status.warning.base}`,
                        background: 'rgba(251,191,36,0.04)',
                        borderRadius: '0 4px 4px 0',
                      }}
                      data-testid="report-gap">
                      <Typography variant="body2" sx={{ color: adminTokens.text.body, lineHeight: 1.55 }}>
                        {g}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* KPI Targets */}
            {report.kpiTargets && report.kpiTargets.length > 0 && (
              <Box>
                <SectionLabel icon={<TrackChangesIcon sx={{ fontSize: 16 }} />}>
                  KPI-mål · {report.kpiTargets.length}
                </SectionLabel>
                <Box sx={{
                  display: 'grid', gap: 1.25,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                }}>
                  {report.kpiTargets.map((k, i) => {
                    const diffMeta = k.difficulty === 'easy' ? 'success' as const
                      : k.difficulty === 'stretch' ? 'error' as const : 'warning' as const;
                    const platformColor = adminTokens.platforms[k.platform as keyof typeof adminTokens.platforms] || '#94a3b8';
                    const delta = k.currentValue != null ? k.targetValue - k.currentValue : null;
                    return (
                      <Box key={i}
                        sx={{
                          p: 1.5, borderRadius: 1.5,
                          background: `${platformColor}0d`,
                          border: `1px solid ${platformColor}40`,
                          borderLeft: `4px solid ${platformColor}`,
                        }}
                        data-testid="report-kpi">
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                          <Chip label={k.platform.toUpperCase()} size="small"
                            sx={{ background: `${platformColor}26`, color: platformColor, fontSize: '0.6rem', height: 16, fontWeight: 700 }} />
                          <Chip label={k.difficulty} size="small" sx={statusChipSx(diffMeta)} />
                          <Chip label={k.timeframe} size="small" sx={statusChipSx('neutral')} />
                        </Stack>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: adminTokens.text.primary }}>
                          {k.metric}
                        </Typography>
                        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
                          <Typography sx={{ color: adminTokens.text.muted, fontSize: '0.85rem' }}>
                            {k.currentValue != null ? k.currentValue : '?'}
                          </Typography>
                          <Typography sx={{ color: adminTokens.text.muted, fontSize: '0.9rem' }}>→</Typography>
                          <Typography sx={{ fontWeight: 700, color: platformColor, fontSize: '1.1rem' }}>
                            {k.targetValue}
                          </Typography>
                          {delta != null && (
                            <Chip
                              label={`${delta > 0 ? '+' : ''}${delta}`}
                              size="small"
                              sx={statusChipSx(delta > 0 ? 'success' : 'error')}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: adminTokens.text.body, display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                          {k.reasoning}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Competitor scorecard */}
            {report.competitorScorecard.length > 0 && (
              <Box>
                <SectionLabel>Konkurrent-scorecard</SectionLabel>
                <Box sx={{
                  border: `1px solid ${adminTokens.border.nominal}`,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                }}>
                  {report.competitorScorecard.map((s, i) => {
                    const meta = MOMENTUM_META[s.momentum];
                    const pic = competitorPictures[s.nickname];
                    return (
                      <Stack key={s.nickname} direction="row" alignItems="center" spacing={1.5}
                        sx={{
                          py: 1, px: 1.5,
                          background: i % 2 === 0 ? 'transparent' : adminTokens.bg.panelDeep,
                          borderBottom: i < report.competitorScorecard.length - 1
                            ? `1px solid ${adminTokens.border.subtle}` : 'none',
                        }}
                        data-testid="scorecard-row">
                        <Avatar
                          src={pic || undefined}
                          alt={s.nickname}
                          sx={{
                            width: 32, height: 32,
                            background: adminTokens.bg.panelDeep,
                            border: `1px solid ${adminTokens.border.nominal}`,
                            fontSize: '0.78rem',
                            color: adminTokens.text.body,
                          }}
                        >
                          {s.nickname.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography sx={{
                          fontWeight: 700, fontSize: '0.9rem', color: adminTokens.text.primary,
                          minWidth: { xs: 80, md: 120 },
                        }}>
                          {s.nickname}
                        </Typography>
                        <Chip label={meta.label} size="small" sx={statusChipSx(meta.status)} />
                        <Typography variant="body2"
                          sx={{ color: adminTokens.text.body, flex: 1, fontSize: '0.85rem' }}>
                          {s.notableActivity}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
