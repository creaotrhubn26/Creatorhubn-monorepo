/**
 * ProfileSuggestionsPanel — Agent «Profilforslag» i Meta-fanen.
 * Lister Facebook-sidene/profilene brukeren har tilgang til, og lar Agenten
 * foreslå en optimalisert bio, nøkkelord/hashtags og en handlingsknapp (CTA)
 * per profil. Porter prof-facebook-overlay-designet (ett kort per side).
 *
 * Backend: /api/role-room/facebook/pages (tilgjengelige sider)
 *          /api/role-room/profile-suggestions (mig 285)
 */

import * as React from 'react';
import {
  Box, Stack, Typography, Button, Chip, IconButton, CircularProgress, Tooltip, TextField, Alert,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RecommendIcon from '@mui/icons-material/Recommend';
import VerifiedIcon from '@mui/icons-material/Verified';
import SubjectIcon from '@mui/icons-material/Subject';
import TagIcon from '@mui/icons-material/Tag';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseIcon from '@mui/icons-material/Close';
import roleRoomAgentService, {
  roleRoomAgentDefaultHeaders,
  type RoleRoomProfileSuggestion,
} from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';
const BIO_MAX = 255;

interface AccessiblePage {
  id: string;
  name: string;
  category?: string | null;
  pictureUrl?: string | null;
}

export interface ProfileSuggestionsPanelProps {
  projectId?: string | null;
  platform?: string;
}

export default function ProfileSuggestionsPanel({ projectId, platform = 'facebook' }: ProfileSuggestionsPanelProps): React.ReactElement {
  const [pages, setPages] = React.useState<AccessiblePage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [connectRequired, setConnectRequired] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch('/api/role-room/facebook/pages', { headers: roleRoomAgentDefaultHeaders(), credentials: 'include' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          if (body?.connectRequired) setConnectRequired(true);
          setError(body?.error || `HTTP ${r.status}`);
          return;
        }
        setPages(Array.isArray(body.pages) ? body.pages : []);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke hente sider'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Stack spacing={1.6}>
      {/* Intro */}
      <Stack direction="row" alignItems="center" spacing={1.1}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 17, color: '#fff' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Profilforslag</Typography>
          <Typography sx={{ fontSize: 12.5, color: MUTED }}>Agenten foreslår bio, nøkkelord og CTA-knapp for profilene du har tilgang til.</Typography>
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
      ) : connectRequired ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(168,85,247,0.08)', color: '#e9d5ff', border: '1px solid rgba(168,85,247,0.28)' }}>
          Koble til en Facebook-side først, så foreslår Agenten optimalisert bio og CTA for hver profil.
        </Alert>
      ) : error ? (
        <Alert severity="warning" sx={{ bgcolor: 'rgba(250,204,21,0.08)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.25)' }}>
          Kunne ikke hente sider: {error}
        </Alert>
      ) : pages.length === 0 ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(148,163,184,0.08)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.2)' }}>
          Fant ingen sider du har tilgang til.
        </Alert>
      ) : (
        <Stack spacing={1.6}>
          {pages.map((p) => (
            <ProfileSuggestionCard key={p.id} page={p} platform={platform} projectId={projectId} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ProfileSuggestionCard({ page, platform, projectId }: { page: AccessiblePage; platform: string; projectId?: string | null }): React.ReactElement {
  const [suggestion, setSuggestion] = React.useState<RoleRoomProfileSuggestion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void roleRoomAgentService.getProfileSuggestion(platform, projectId, page.id)
      .then((r) => { if (!cancelled) setSuggestion(r.suggestion); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [platform, projectId, page.id]);

  const platformLabel = platform === 'facebook' ? 'Facebook' : platform.charAt(0).toUpperCase() + platform.slice(1);

  const generate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const created = await roleRoomAgentService.generateProfileSuggestion({
        projectId, platform, pageId: page.id, pageName: page.name, category: page.category ?? null,
      });
      if (created) setSuggestion(created);
    } finally { setGenerating(false); }
  };

  const resolve = async (status: 'applied' | 'dismissed'): Promise<void> => {
    if (!suggestion) return;
    setBusy(true);
    const ok = await roleRoomAgentService.patchProfileSuggestion(suggestion.id, status);
    setBusy(false);
    if (ok) {
      if (status === 'dismissed') setSuggestion(null);
      else setSuggestion({ ...suggestion, status: 'applied' });
    }
  };

  const copyBio = (): void => {
    if (!suggestion?.bio) return;
    void navigator.clipboard.writeText(suggestion.bio).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => undefined);
  };

  const bioLen = suggestion?.bio?.length ?? 0;

  return (
    <Box
      sx={{
        position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.6 }, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background:
          'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.18), transparent 55%), radial-gradient(110% 80% at 100% 114%, rgba(217,70,239,0.12), transparent 50%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 14px 40px rgba(124,58,237,0.22)',
      }}
    >
      {/* Header: side-info + AI-merke */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ minWidth: 0 }}>
          {page.pictureUrl ? (
            <Box component="img" src={page.pictureUrl} alt="" sx={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
          ) : (
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
              {page.name.charAt(0).toUpperCase()}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.name}</Typography>
              <VerifiedIcon sx={{ fontSize: 15, color: '#60a5fa' }} />
            </Stack>
            <Typography sx={{ fontSize: 12, color: MUTED }}>{platformLabel}{page.category ? ` · ${page.category}` : ''} · Profilforslag</Typography>
          </Box>
        </Stack>
        <Chip
          size="small" icon={<RecommendIcon sx={{ fontSize: 15, color: `${ACCENT} !important` }} />} label="AI-anbefaling"
          sx={{ bgcolor: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', fontWeight: 700, fontSize: 11, flexShrink: 0 }}
        />
      </Stack>

      {loading ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
      ) : !suggestion ? (
        <Box sx={{ textAlign: 'center', py: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: MUTED, mb: 1.6 }}>
            La Agenten foreslå optimalisert bio, nøkkelord og en handlingsknapp for denne profilen.
          </Typography>
          <Button
            onClick={() => void generate()} disabled={generating} variant="contained" disableElevation
            startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}
          >
            Foreslå CTA og bio
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {/* Anbefalt bio */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.7 }}>
              <Stack direction="row" alignItems="center" spacing={0.7}>
                <SubjectIcon sx={{ fontSize: 16, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Anbefalt bio</Typography>
              </Stack>
              <Typography sx={{ fontSize: 11, color: bioLen > BIO_MAX ? '#f87171' : MUTED, fontFamily: 'monospace' }}>{bioLen}/{BIO_MAX}</Typography>
            </Stack>
            <Box sx={{ position: 'relative', p: 1.4, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.16)' }}>
              <Typography sx={{ fontSize: 13.5, color: 'rgba(226,232,240,0.9)', lineHeight: 1.55, pr: 3 }}>{suggestion.bio}</Typography>
              <Tooltip title={copied ? 'Kopiert' : 'Kopier bio'}>
                <IconButton size="small" onClick={copyBio} sx={{ position: 'absolute', top: 6, right: 6, color: copied ? '#34d399' : 'rgba(226,232,240,0.5)' }}>
                  {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Nøkkelord og hashtags */}
          {suggestion.hashtags.length > 0 ? (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
                <TagIcon sx={{ fontSize: 16, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Nøkkelord og hashtags</Typography>
              </Stack>
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {suggestion.hashtags.map((h) => (
                  <Chip key={h} size="small" label={`#${h}`} sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff', fontWeight: 600, fontSize: 12 }} />
                ))}
              </Stack>
            </Box>
          ) : null}

          {/* Forslag til handlingsknapp */}
          {suggestion.cta_label ? (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
                <AdsClickIcon sx={{ fontSize: 16, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Forslag til handlingsknapp</Typography>
              </Stack>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, px: 1.6, py: 0.9, borderRadius: 2, background: GRAD, color: '#fff', fontWeight: 700, fontSize: 13.5, boxShadow: '0 6px 16px rgba(168,85,247,0.4)' }}>
                <StorefrontIcon sx={{ fontSize: 17 }} /> {suggestion.cta_label}
              </Box>
            </Box>
          ) : null}

          {/* Handlinger */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
            <Button
              onClick={() => void resolve('applied')} disabled={busy || suggestion.status === 'applied'}
              startIcon={<CheckRoundedIcon />}
              variant="contained" disableElevation size="small"
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}
            >
              {suggestion.status === 'applied' ? 'Tatt i bruk' : 'Marker som brukt'}
            </Button>
            <Button
              onClick={() => void generate()} disabled={generating} size="small" variant="outlined"
              startIcon={generating ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <AutoAwesomeIcon fontSize="small" />}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'rgba(168,85,247,0.4)', color: ACCENT }}
            >
              Generer på nytt
            </Button>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Avvis">
              <IconButton size="small" onClick={() => void resolve('dismissed')} disabled={busy} sx={{ color: 'rgba(226,232,240,0.5)' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      )}

      {/* Footer */}
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 2, pt: 1.4, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <AutoAwesomeIcon sx={{ fontSize: 13, color: ACCENT }} />
        <Typography sx={{ fontSize: 11, color: MUTED }}>Generert av The Role Room Agent</Typography>
      </Stack>
    </Box>
  );
}
