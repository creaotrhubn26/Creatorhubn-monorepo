/**
 * ClientAiPromptsPanel.tsx
 *
 * 10 klar-til-paste prompter for klient's AI-kode-agent (Loveable / v0 / Bolt
 * / Cursor / generic). Innholdsprodusenten velger target, kopierer prompten
 * og sender til klient — klient limer den inn i sitt verktøy. Resultat: GA4
 * / Ads / GTM / Consent Mode / SEO / sitemap blir riktig installert uten at
 * producer trenger kode-tilgang.
 *
 * Backend: GET /api/admin-room/agent/ads/configs/:id/ai-prompts?target=…
 */

import { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const palette = {
  bgCard: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface Prompt {
  scenario: string;
  title: string;
  prompt: string;
  verifyAfter: string;
  applicable: boolean;
  notApplicableReason?: string;
}

const TARGET_OPTIONS: Array<{ value: 'loveable' | 'v0' | 'bolt' | 'cursor' | 'generic'; label: string; subtitle: string }> = [
  { value: 'loveable', label: 'Loveable', subtitle: 'Vite + React (vanligst)' },
  { value: 'v0', label: 'v0 by Vercel', subtitle: 'Next.js App Router + shadcn' },
  { value: 'bolt', label: 'Bolt.new', subtitle: 'StackBlitz-baserte prosjekter' },
  { value: 'cursor', label: 'Cursor / Windsurf', subtitle: 'Generelt IDE-AI' },
  { value: 'generic', label: 'Generisk', subtitle: 'Hvilken som helst AI-agent' },
];

export default function ClientAiPromptsPanel({
  configId,
  clientName,
}: {
  configId: string;
  clientName: string;
}) {
  const [target, setTarget] = useState<'loveable' | 'v0' | 'bolt' | 'cursor' | 'generic'>('loveable');
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedScenario, setCopiedScenario] = useState<string | null>(null);

  const loadPrompts = async (t = target) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/ai-prompts?target=${t}`, {
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setPrompts(data.prompts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke generere prompter');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const copyToClipboard = (scenario: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScenario(scenario);
    setTimeout(() => setCopiedScenario(null), 1800);
  };

  const applicable = prompts?.filter((p) => p.applicable) ?? [];
  const notApplicable = prompts?.filter((p) => !p.applicable) ?? [];

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 0.8 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: 'rgba(192,132,252,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AutoAwesomeIcon sx={{ color: palette.accent }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
              AI-prompter for klient
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
              Klar-til-paste prompter med {clientName}-spesifikke ID-er. Send til klient → de limer inn i sitt AI-verktøy.
            </Typography>
          </Box>
        </Stack>

        {/* Target-agent-velger */}
        <Box sx={{ mb: 2, mt: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.8 }}>
            Hvilket verktøy bruker klient?
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {TARGET_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                onClick={() => setTarget(opt.value)}
                sx={{
                  textTransform: 'none',
                  background: target === opt.value ? palette.accentGradient : 'transparent',
                  border: `1px solid ${target === opt.value ? 'transparent' : palette.borderStrong}`,
                  color: target === opt.value ? '#fff' : palette.textSecondary,
                  px: 1.6, py: 0.8,
                  flexDirection: 'column', alignItems: 'flex-start',
                  minWidth: 0,
                  '&:hover': {
                    background: target === opt.value ? palette.accentGradient : 'rgba(168,85,247,0.08)',
                  },
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                  {opt.label}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', opacity: 0.85, lineHeight: 1.2 }}>
                  {opt.subtitle}
                </Typography>
              </Button>
            ))}
          </Stack>
        </Box>

        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={16} />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem' }}>Genererer prompter…</Typography>
          </Stack>
        ) : null}

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}

        {prompts ? (
          <Box>
            {/* Statuslinje */}
            <Stack direction="row" spacing={1} sx={{ mb: 1.4 }}>
              <Chip
                size="small"
                icon={<CheckCircleOutlineIcon sx={{ color: '#34d399 !important' }} fontSize="small" />}
                label={`${applicable.length} klare prompter`}
                sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700 }}
              />
              {notApplicable.length > 0 ? (
                <Chip
                  size="small"
                  icon={<LockOutlinedIcon sx={{ color: '#94a3b8 !important' }} fontSize="small" />}
                  label={`${notApplicable.length} venter på setup`}
                  sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: '#94a3b8', fontWeight: 700 }}
                />
              ) : null}
            </Stack>

            {/* Klare prompter — accordion */}
            <Stack spacing={0.8}>
              {applicable.map((p) => (
                <Accordion
                  key={p.scenario}
                  expanded={expanded === p.scenario}
                  onChange={() => setExpanded(expanded === p.scenario ? null : p.scenario)}
                  disableGutters
                  elevation={0}
                  sx={{
                    bgcolor: 'rgba(168,85,247,0.04)',
                    border: `1px solid ${palette.border}`,
                    borderRadius: 1.4,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { mt: 0.8 },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: palette.textMuted }} />}
                    sx={{ minHeight: 48 }}
                  >
                    <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.88rem' }}>
                      {p.title}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Box sx={{
                      bgcolor: '#0a0a1a',
                      border: `1px solid ${palette.borderStrong}`,
                      borderRadius: 1.2,
                      p: 1.4,
                      mb: 1,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.78rem',
                      color: '#e9d5ff',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 460,
                      overflow: 'auto',
                      lineHeight: 1.55,
                    }}>
                      {p.prompt}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        onClick={() => copyToClipboard(p.scenario, p.prompt)}
                        startIcon={copiedScenario === p.scenario
                          ? <CheckCircleOutlineIcon fontSize="small" />
                          : <ContentCopyIcon fontSize="small" />}
                        sx={{
                          background: copiedScenario === p.scenario
                            ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                            : palette.accentGradient,
                          color: '#fff', textTransform: 'none', fontWeight: 700,
                          '&:hover': {
                            background: copiedScenario === p.scenario
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
                          },
                        }}
                      >
                        {copiedScenario === p.scenario ? 'Kopiert — lim inn i klient-verktøy' : 'Kopier prompt'}
                      </Button>
                      {p.verifyAfter ? (
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', flex: 1 }}>
                          <strong>Verifiser etter:</strong> {p.verifyAfter}
                        </Typography>
                      ) : null}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>

            {/* Locked prompter — viser hva som mangler */}
            {notApplicable.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.8 }}>
                  Venter på setup
                </Typography>
                <Stack spacing={0.8}>
                  {notApplicable.map((p) => (
                    <Box
                      key={p.scenario}
                      sx={{
                        bgcolor: 'rgba(148,163,184,0.06)',
                        border: `1px solid rgba(148,163,184,0.18)`,
                        borderRadius: 1.2,
                        p: 1.2,
                        display: 'flex', gap: 1.2, alignItems: 'flex-start',
                      }}
                    >
                      <LockOutlinedIcon sx={{ color: palette.textMuted, fontSize: 18, mt: 0.2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.86rem' }}>
                          {p.title}
                        </Typography>
                        <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem' }}>
                          {p.notApplicableReason}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
