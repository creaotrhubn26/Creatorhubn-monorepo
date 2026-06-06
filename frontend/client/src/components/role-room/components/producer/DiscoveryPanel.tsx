// Oppdag — research-boost. One real feature on top of three App Review demos:
// IG hashtag search, IG business-discovery (@username), and Facebook Page lookup.
// Lets the producer research competitors, partners and content angles in the
// client's niche. Live data needs Public Content Access approval; until then the
// panel explains the pending state.
import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Chip, Button, TextField, CircularProgress, Alert, Divider, Link, Avatar,
} from '@mui/material';
import {
  TravelExplore as DiscoveryIcon, Tag as HashtagIcon, AlternateEmail as ProfileIcon,
  Facebook as PageIcon, OpenInNew as OpenIcon, CodeOutlined as EmbedIcon,
  ThumbUpOutlined as LikeIcon, ChatBubbleOutline as CommentIcon,
} from '@mui/icons-material';
import ConnectionPicker from './ConnectionPicker';

type Mode = 'hashtag' | 'ig-profile' | 'fb-page' | 'embed';
const MODES: { key: Mode; label: string; icon: React.ReactNode; placeholder: string; hint: string }[] = [
  { key: 'hashtag', label: 'Emneknagg', icon: <HashtagIcon fontSize="small" />, placeholder: 'f.eks. tannlege', hint: 'Se ferske innlegg på en emneknagg — innholdsinspirasjon i kundens nisje.' },
  { key: 'ig-profile', label: 'IG-profil', icon: <ProfileIcon fontSize="small" />, placeholder: '@konkurrent', hint: 'Slå opp en konkurrents Instagram-bedriftskonto: følgere, bio og siste innlegg.' },
  { key: 'fb-page', label: 'Facebook-side', icon: <PageIcon fontSize="small" />, placeholder: 'side-ID eller brukernavn', hint: 'Offentlig info + siste innlegg fra en Facebook-side (partner/konkurrent).' },
  { key: 'embed', label: 'Bygg inn', icon: <EmbedIcon fontSize="small" />, placeholder: 'lim inn FB/IG-innleggslenke', hint: 'Forhåndsvis et offentlig innlegg og kopier innbyggingskoden til kundemateriell / landingsside.' },
];

interface IgConnection { id: string; igUsername: string | null; facebookPageName: string | null }
interface Media { id: string; caption: string | null; mediaType: string | null; permalink: string | null; timestamp: string | null }

function fmt(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('nb-NO', { dateStyle: 'short' }); } catch { return ''; }
}
function num(n: number | null | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('nb-NO') : '–';
}

export default function DiscoveryPanel() {
  const [connectionId, setConnectionId] = useState('');
  const [mode, setMode] = useState<Mode>('hashtag');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  const { data: connData, isLoading: connLoading } = useQuery<{ connections: IgConnection[] }>({
    queryKey: ['discovery-connections'],
    queryFn: () => apiRequest('/api/role-room/instagram/messaging/connections'),
  });
  const connections = connData?.connections || [];
  useEffect(() => {
    if (!connectionId && connections.length > 0) setConnectionId(connections[0].id);
  }, [connectionId, connections]);

  const endpoint = mode === 'hashtag'
    ? `/api/role-room/discovery/hashtag?connectionId=${encodeURIComponent(connectionId)}&q=${encodeURIComponent(query)}`
    : mode === 'ig-profile'
      ? `/api/role-room/discovery/ig-profile?connectionId=${encodeURIComponent(connectionId)}&username=${encodeURIComponent(query)}`
      : mode === 'fb-page'
        ? `/api/role-room/discovery/fb-page?connectionId=${encodeURIComponent(connectionId)}&pageId=${encodeURIComponent(query)}`
        : `/api/role-room/embed/oembed?url=${encodeURIComponent(query)}`;

  const { data, isLoading, isFetching } = useQuery<any>({
    queryKey: ['discovery', mode, connectionId, query],
    enabled: !!connectionId && query.length > 0,
    queryFn: () => apiRequest(endpoint),
  });

  const runSearch = () => setQuery(input.trim());
  const activeMode = MODES.find((m) => m.key === mode)!;
  const graphError = data && data.success === false ? data.error : null;
  const [copied, setCopied] = useState(false);
  const copyEmbed = (html: string) => {
    try { navigator.clipboard?.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <Stack spacing={1.6} sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <DiscoveryIcon sx={{ color: '#22d3ee' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>Oppdag</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem' }}>
            Research på konkurrenter, samarbeidspartnere og innholdsidéer i kundens nisje.
          </Typography>
        </Box>
        <ConnectionPicker connections={connections} value={connectionId} onChange={setConnectionId} label="Velg konto" />
      </Stack>

      {connLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : connections.length === 0 ? (
        <Alert severity="info">Koble til kundens Facebook-/Instagram-konto først (under Feed-planner) for å bruke Oppdag.</Alert>
      ) : (
        <>
          {/* Mode picker */}
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            {MODES.map((m) => (
              <Chip
                key={m.key} clickable icon={m.icon as any} label={m.label}
                onClick={() => { setMode(m.key); setInput(''); setQuery(''); }}
                variant={mode === m.key ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700, bgcolor: mode === m.key ? 'rgba(34,211,238,0.18)' : 'transparent', color: mode === m.key ? '#22d3ee' : 'rgba(226,232,240,0.7)' }}
              />
            ))}
          </Stack>
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.8rem' }}>{activeMode.hint}</Typography>

          {/* Search */}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small" fullWidth value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder={activeMode.placeholder}
            />
            <Button variant="contained" onClick={runSearch} disabled={!input.trim()}>Søk</Button>
          </Stack>

          {graphError ? (
            <Alert severity="info">
              Oppdag er ikke aktivert ennå (venter på godkjenning av <code>Public Content Access</code> fra Meta).
              {' '}Når det er godkjent kan du søke på ekte data her. ({graphError})
            </Alert>
          ) : null}

          {(isLoading || isFetching) && query ? (
            <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>
          ) : null}

          {/* Results */}
          {data?.success && mode === 'hashtag' ? (
            <MediaGrid title={`#${data.hashtag}`} media={data.media || []} />
          ) : null}

          {data?.success && mode === 'ig-profile' && data.profile ? (
            <Box>
              <Stack direction="row" spacing={1.4} alignItems="center" sx={{ mb: 1 }}>
                <Avatar src={data.profile.profilePictureUrl || undefined} sx={{ width: 56, height: 56 }} />
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{data.profile.name || `@${data.profile.username}`}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.8rem' }}>@{data.profile.username}</Typography>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 0.4 }}>
                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem' }}><strong>{num(data.profile.followersCount)}</strong> følgere</Typography>
                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem' }}><strong>{num(data.profile.mediaCount)}</strong> innlegg</Typography>
                  </Stack>
                </Box>
              </Stack>
              {data.profile.biography ? <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', mb: 1, whiteSpace: 'pre-wrap' }}>{data.profile.biography}</Typography> : null}
              {data.profile.website ? <Link href={data.profile.website} target="_blank" rel="noopener" sx={{ fontSize: '0.82rem' }}>{data.profile.website}</Link> : null}
              <Divider sx={{ my: 1 }} />
              <MediaGrid title="Siste innlegg" media={data.profile.media || []} />
            </Box>
          ) : null}

          {data?.success && mode === 'embed' && data.data ? (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.4 }}>
              <Stack direction="row" spacing={1.4}>
                {data.data.thumbnail_url ? (
                  <Box component="img" src={data.data.thumbnail_url} alt="" sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }} />
                ) : null}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>{data.data.author_name || data.data.title || 'Offentlig innlegg'}</Typography>
                  {data.data.title && data.data.author_name ? <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', mt: 0.3 }}>{data.data.title}</Typography> : null}
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', mt: 0.4 }}>{data.data.provider_name || ''}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.8 }} alignItems="center">
                    <Button size="small" variant="outlined" onClick={() => copyEmbed(String(data.data.html || ''))} disabled={!data.data.html}>
                      {copied ? 'Kopiert!' : 'Kopier innbyggingskode'}
                    </Button>
                    <Link href={query} target="_blank" rel="noopener" sx={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                      Åpne innlegget <OpenIcon sx={{ fontSize: 14 }} />
                    </Link>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          ) : null}

          {data?.success && mode === 'fb-page' && data.page ? (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{data.page.name || data.page.id}</Typography>
                {data.page.verified === 'blue_verified' || data.page.verified === 'gray_verified' ? (
                  <Chip size="small" label="Verifisert" sx={{ height: 18, fontSize: '0.66rem', bgcolor: 'rgba(56,189,248,0.2)', color: '#7dd3fc' }} />
                ) : null}
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ mb: 0.6 }} flexWrap="wrap" useFlexGap>
                {data.page.category ? <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.8rem' }}>{data.page.category}</Typography> : null}
                <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem' }}><strong>{num(data.page.fanCount)}</strong> følgere</Typography>
                {data.page.website ? <Link href={data.page.website} target="_blank" rel="noopener" sx={{ fontSize: '0.8rem' }}>{data.page.website}</Link> : null}
              </Stack>
              {data.page.about ? <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', mb: 1 }}>{data.page.about}</Typography> : null}
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.8}>
                {(data.posts || []).length === 0 ? (
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.84rem' }}>Ingen offentlige innlegg ennå.</Typography>
                ) : (data.posts || []).map((p: any) => (
                  <Box key={p.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.2 }}>
                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{p.message || '(uten tekst)'}</Typography>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 0.6 }} alignItems="center">
                      <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem' }}>{fmt(p.createdTime)}</Typography>
                      {p.reactions != null ? (
                        <Stack direction="row" spacing={0.4} alignItems="center" sx={{ color: 'rgba(226,232,240,0.6)' }}>
                          <LikeIcon sx={{ fontSize: 14 }} aria-label="reaksjoner" />
                          <Typography sx={{ fontSize: '0.72rem' }}>{num(p.reactions)}</Typography>
                        </Stack>
                      ) : null}
                      {p.comments != null ? (
                        <Stack direction="row" spacing={0.4} alignItems="center" sx={{ color: 'rgba(226,232,240,0.6)' }}>
                          <CommentIcon sx={{ fontSize: 14 }} aria-label="kommentarer" />
                          <Typography sx={{ fontSize: '0.72rem' }}>{num(p.comments)}</Typography>
                        </Stack>
                      ) : null}
                      {p.permalinkUrl ? <Link href={p.permalinkUrl} target="_blank" rel="noopener" sx={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>Åpne <OpenIcon sx={{ fontSize: 13 }} /></Link> : null}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}
        </>
      )}
    </Stack>
  );
}

function MediaGrid({ title, media }: { title: string; media: Media[] }) {
  if (!media || media.length === 0) {
    return <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.84rem' }}>Ingen innlegg funnet ennå.</Typography>;
  }
  return (
    <Box>
      <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontWeight: 700, fontSize: '0.78rem', mb: 0.6 }}>{title} · {media.length} innlegg</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1 }}>
        {media.map((m) => (
          <Box key={m.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.1, bgcolor: 'rgba(15,23,41,0.4)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4 }}>
              <Chip size="small" label={m.mediaType || 'media'} sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(148,163,184,0.18)', color: '#cbd5e1' }} />
              {m.permalink ? <Link href={m.permalink} target="_blank" rel="noopener" sx={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>Åpne <OpenIcon sx={{ fontSize: 13 }} /></Link> : null}
            </Stack>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {m.caption || '(uten tekst)'}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.68rem', mt: 0.4 }}>{fmt(m.timestamp)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
