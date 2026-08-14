// @ts-nocheck
/**
 * GearNewsTab — utstyrsnyheter (live RSS / kompatibilitets-feed).
 * Restyled til mørk CreatorHub: WsPageTitle, kilde-filter (Alle/Norsk/
 * Internasjonal), relative tidsstempler, frisk-opp, stat-info.
 */
import React, { useMemo, useState } from 'react';
import {
  Article,
  Business,
  CameraAlt,
  Close,
  Favorite,
  FavoriteBorder,
  LibraryMusic,
  OpenInNew,
  Search,
  Star,
  TrendingUp,
  Videocam,
  ViewList,
  ViewModule,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspace/workspaceTheme';
import { WsPageTitle, WsTag } from '../workspace/ui';

interface GearNewsTabProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  className?: string;
  embedded?: boolean; // inne i Utstyr-fanen: ingen egen WsPageTitle-tittel
}

interface GearNewsArticle {
  id?: string;
  title?: string;
  summary?: string;
  content?: string;
  category?: string;
  brand?: string;
  rating?: number | string;
  source?: string;
  url?: string;
  imageUrl?: string;
  isNew?: boolean;
  isTrending?: boolean;
  isNorwegian?: boolean;
  norwegian_source?: boolean;
  international_source?: boolean;
  published_date?: string;
  publishedAt?: string;
  tags?: string[];
}

interface GearNewsApiResponse {
  success?: boolean;
  source?: string;
  total?: number;
  data?: GearNewsArticle[];
}

interface ProfessionConfig {
  title: string;
  icon: React.ReactElement;
  color: string;
  categories: string[];
  description: string;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

/** Relativ tid: «i dag HH:MM», «i går», «dd.mm HH:MM». */
const relTime = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dayDiff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (dayDiff === 0) return `i dag ${hm}`;
  if (dayDiff === 1) return 'i går';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
};


/** Deterministisk gradient-palett for kort uten bilde (hash av tittel). */
const THUMB_PALETTE = [
  ['#4f46e5', '#0891b2'], ['#9a3412', '#f59e0b'], ['#7c3aed', '#db2777'], ['#1d4ed8', '#22d3ee'],
  ['#047857', '#84cc16'], ['#b91c1c', '#fb7185'], ['#0f172a', '#3b82f6'], ['#713f12', '#facc15'],
];
const thumbGradient = (seed?: string) => {
  let h = 0;
  for (const c of seed || '') h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const [a, b] = THUMB_PALETTE[h % THUMB_PALETTE.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
};
const thumbInitial = (title?: string) => (title || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

function getProfessionConfig(profession: GearNewsTabProps['profession']): ProfessionConfig {
  switch (profession) {
    case 'photographer':
      return { title: 'Fotoutstyr Nyheter', icon: <CameraAlt />, color: '#f59e00', categories: ['Kameraer', 'Objektiver', 'Blits', 'Stativer', 'Tilbehør', 'Software'], description: 'Siste nytt innen fotografiutstyr og teknologi' };
    case 'videographer':
      return { title: 'Videoutstyr Nyheter', icon: <Videocam />, color: '#dc2620', categories: ['Kameraer', 'Gimbals', 'Lyd', 'Belysning', 'Editing', 'Droner'], description: 'Siste nytt innen videoproduksjon og utstyr' };
    case 'music_producer':
      return { title: 'Studioutstyr Nyheter', icon: <LibraryMusic />, color: '#7c3aed', categories: ['Audio Interface', 'Mikrofoner', 'Hodetelefoner', 'Software', 'Synthesizers'], description: 'Siste nytt innen lydproduksjon og studioutstyr' };
    case 'vendor':
      return { title: 'Leverandør Nyheter', icon: <Business />, color: '#2563eb', categories: ['AV-utstyr', 'Sceneteknikk', 'Lys', 'Lyd', 'Streaming', 'Installasjoner'], description: 'Siste nytt innen profesjonelt AV-utstyr og installasjoner' };
    default:
      return { title: 'Utstyr Nyheter', icon: <Article />, color: '#6b7280', categories: ['Generelt', 'Software', 'Tilbehør'], description: 'Generelle nyheter om utstyr og teknologi' };
  }
}

export function GearNewsTab({ profession, className, embedded }: GearNewsTabProps) {
  const config = useMemo(() => getProfessionConfig(profession), [profession]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [srcFilter, setSrcFilter] = useState<'all' | 'no' | 'intl'>('all');
  const [tabValue, setTabValue] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<GearNewsArticle | null>(null);
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastUpd, setLastUpd] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  // Bokmerker (localStorage): nøkkel = id || url || title.
  const [saved, setSaved] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem('gearnews.saved'); return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
  });
  const saveKey = (a: GearNewsArticle) => String(a.id || a.url || a.title || '');
  const toggleSave = (a: GearNewsArticle) => {
    const k = saveKey(a);
    setSaved((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k); else n.add(k);
      try { localStorage.setItem('gearnews.saved', JSON.stringify([...n])); } catch { /* */ }
      return n;
    });
  };

  const { data, isLoading, refetch, isFetching } = useQuery<GearNewsApiResponse>({
    queryKey: ['/api/gear-news', profession],
    queryFn: () => apiRequest(`/api/gear-news?profession=${profession}`),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
    onSuccess: () => setLastUpd(new Date()),
  });

  const articles = useMemo<GearNewsArticle[]>(() => {
    if (!data?.success || !Array.isArray(data.data)) return [];
    return [...data.data].sort((a, b) => {
      const ta = a.publishedAt || a.published_date ? new Date((a.publishedAt || a.published_date) as string).getTime() : 0;
      const tb = b.publishedAt || b.published_date ? new Date((b.publishedAt || b.published_date) as string).getTime() : 0;
      return tb - ta;
    });
  }, [data]);
  const feedSource = data?.source === 'live-rss' ? 'Live RSS' : 'Kompatibilitets-feed';
  const feedFallback = data?.source !== 'live-rss';
  const newCount = articles.filter((a) => a.isNew).length;
  const sourceCount = new Set(articles.map((a) => a.source).filter(Boolean)).size;
  const savedList = articles.filter((a) => saved.has(saveKey(a)));
  /** Dynamiske kategori-chips med tellinger (ekte RSS-kategorier, ikke statiske). */
  const catChips = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of articles) { const k = a.category || 'Annet'; m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).sort((x, y) => y[1] - x[1]);
  }, [articles]);

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((item) => {
      const matchesSearch = q.length === 0 || item.title?.toLowerCase().includes(q) || item.summary?.toLowerCase().includes(q) || item.brand?.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSrc = srcFilter === 'all' || (srcFilter === 'no' ? !!(item.isNorwegian || item.norwegian_source) : !!(item.international_source));
      return Boolean(matchesSearch && matchesCategory && matchesSrc);
    });
  }, [articles, searchQuery, selectedCategory, srcFilter]);

  const trendingNews = useMemo(() => filteredNews.filter((item) => item.isNew || (item.rating !== undefined && Number(item.rating) >= 4)), [filteredNews]);
  const reviewNews = useMemo(() => filteredNews.filter((item) => item.tags?.includes('review') || item.summary?.toLowerCase().includes('review')), [filteredNews]);
  const dealsNews = useMemo(() => filteredNews.filter((item) => item.tags?.includes('deal') || item.summary?.toLowerCase().includes('tilbud')), [filteredNews]);

  const renderArticles = (list: GearNewsArticle[]) => {
    if (list.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Article sx={{ fontSize: '3.4rem', color: ws.textFaint, mb: 2 }} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: ws.text, mb: 0.5 }}>Ingen nyheter funnet</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Prøv et annet søk eller en annen kategori.</Typography>
        </Box>
      );
    }
    if (viewMode === 'list') {
      return (
        <Stack spacing={0.75}>
          {list.map((article, index) => (
            <Stack key={`${article.title ?? 'a'}-${index}`} direction="row" spacing={1.25} alignItems="center" className="gn-fade" style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              onClick={() => { setSelectedArticle(article); setReadMoreOpen(true); }}
              sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, cursor: 'pointer', '&:hover': { borderColor: ws.accentBorder, bgcolor: 'rgba(255,255,255,0.04)' } }}>
              <Box sx={{ position: 'relative', width: 56, height: 56, borderRadius: 1, flexShrink: 0, background: thumbGradient(article.source + article.title), overflow: 'hidden' }}>
                {article.imageUrl
                  ? <Box component="img" src={article.imageUrl} alt="" loading="lazy" onError={(e: any) => { e.currentTarget.style.display = 'none'; }} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: 17, fontWeight: 900, color: 'rgba(255,255,255,.9)' }}>{thumbInitial(article.title)}</Typography></Box>}
                {article.isNew && <Box className="gn-dot" sx={{ position: 'absolute', top: 3, left: 3, width: 7, height: 7, borderRadius: '50%', bgcolor: '#f87171', boxShadow: '0 0 0 2px rgba(13,13,22,.8)' }} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, color: ws.text, flex: 1, minWidth: 0 }}>{article.title || 'Ny produktlansering'}</Typography>
                  {article.isTrending !== false && (article.isTrending || index < 3) && <TrendingUp sx={{ fontSize: 13, color: ws.amber, flexShrink: 0 }} />}
                </Stack>
                <Typography noWrap sx={{ fontSize: 11.5, color: ws.textDim, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{article.summary || ''}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.35, flexWrap: 'wrap', gap: 0.5 }}>
                  {article.category && <WsTag label={article.category} tone="accent" />}
                  {article.rating ? <WsTag label={`★ ${article.rating}`} tone="amber" /> : null}
                  <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{article.source ? `via ${article.source}` : ''}{(article.published_date || article.publishedAt) ? ` · ${relTime(article.published_date || article.publishedAt)}` : ''}</Typography>
                </Stack>
              </Box>
              <Box onClick={(e) => { e.stopPropagation(); toggleSave(article); }} sx={{ color: saved.has(saveKey(article)) ? '#f43f5e' : ws.textFaint, cursor: 'pointer', flexShrink: 0, '&:hover': { color: '#f43f5e' } }} title="Lagre/bokmerk">
                {saved.has(saveKey(article)) ? <Favorite sx={{ fontSize: 18 }} /> : <FavoriteBorder sx={{ fontSize: 18 }} />}
              </Box>
            </Stack>
          ))}
        </Stack>
      );
    }
    return (
      <Grid container spacing={2}>
        {list.map((article, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${article.title ?? 'article'}-${index}`} className="gn-fade" style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.borderSoft}`, borderRadius: `${ws.radius}px`, boxShadow: 'none', overflow: 'hidden', transition: 'border-color .12s, box-shadow .12s, transform .15s ease', '&:hover': { borderColor: ws.accentBorder, boxShadow: '0 4px 18px rgba(0,0,0,.35)', transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ flexGrow: 1, pb: 0, pt: 1.5 }}>
                <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ mb: 0.75 }}>
                  {/* Miniatyr (48px) */}
                  <Box sx={{ position: 'relative', width: 48, height: 48, borderRadius: 1.25, flexShrink: 0, background: thumbGradient(article.source + article.title), overflow: 'hidden' }}>
                    {article.imageUrl ? (
                      <Box component="img" src={article.imageUrl} alt="" loading="lazy" onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .25s ease', '&:hover': { transform: 'scale(1.12)' } }} />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', background: thumbGradient(article.source + article.title), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 900, color: 'rgba(255,255,255,.9)' }}>{thumbInitial(article.title)}</Typography>
                      </Box>
                    )}
                    {article.isNew && <Box className="gn-dot" sx={{ position: 'absolute', top: 3, left: 3, width: 7, height: 7, borderRadius: '50%', bgcolor: '#f87171', boxShadow: '0 0 0 2px rgba(13,13,22,.8)' }} />}
                    {(article.isNorwegian || article.norwegian_source) ? (
                      <Box sx={{ position: 'absolute', bottom: 2, right: 2, px: 0.35, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(34,197,94,.9)', color: '#fff', fontSize: 7.5, fontWeight: 900 }}>NO</Box>
                    ) : null}
                    <Box onClick={(e) => { e.stopPropagation(); toggleSave(article); }} sx={{ position: 'absolute', top: 1, right: 1, color: saved.has(saveKey(article)) ? '#f43f5e' : 'rgba(255,255,255,.85)', cursor: 'pointer', textShadow: '0 1px 3px rgba(0,0,0,.5)', '&:hover': { color: '#f43f5e' } }} title="Lagre/bokmerk">
                      {saved.has(saveKey(article)) ? <Favorite sx={{ fontSize: 15 }} /> : <FavoriteBorder sx={{ fontSize: 15 }} />}
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3, color: ws.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title || 'Ny produktlansering'}</Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.4 }}>
                      {article.published_date || article.publishedAt
                        ? <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{relTime(article.published_date || article.publishedAt)}</Typography>
                        : null}
                      {article.isTrending !== false && (article.isTrending || index < 3) && (
                        <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: ws.amber, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}><TrendingUp sx={{ fontSize: 11 }} />Trending</Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
                <Typography sx={{ fontSize: 12, color: ws.textDim, lineHeight: 1.55, mb: 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {article.summary || 'Oppdatering om nytt utstyr i markedet.'}
                </Typography>
                <Stack sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {article.category && <WsTag label={article.category} tone="accent" />}
                  {article.brand && article.brand !== 'Multi-brand' && <WsTag label={article.brand} tone="neutral" />}
                  {article.rating
                    ? <WsTag label={`★ ${article.rating}`} tone="amber" />
                    : null}
                  {article.source && <Typography sx={{ fontSize: 10, color: ws.textFaint }}>via {article.source}</Typography>}
                </Stack>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 1.25, pt: 0, justifyContent: 'space-between' }}>
                <Button size="small" onClick={() => { setSelectedArticle(article); setReadMoreOpen(true); }} sx={{ color: config.color, textTransform: 'none', fontWeight: 700 }}>Les mer</Button>
                {article.url && (
                  <Button size="small" href={article.url} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNew sx={{ fontSize: 15 }} />} sx={{ color: ws.textDim, textTransform: 'none' }}>
                    {article.source || 'Kilde'}
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const controls = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {([['all', 'Alle'], ['no', 'Norsk'], ['intl', 'Intl']] as const).map(([k, l]) => (
        <Box key={k} onClick={() => setSrcFilter(k)} sx={{ px: 0.9, py: 0.3, borderRadius: 999, fontSize: 11, fontWeight: srcFilter === k ? 800 : 500, cursor: 'pointer', color: srcFilter === k ? ws.accentContrast : ws.textDim, bgcolor: srcFilter === k ? ws.accent : 'transparent', border: `1px solid ${srcFilter === k ? ws.accent : ws.border}` }}>{l}</Box>
      ))}
      <Box onClick={() => setViewMode((v) => (v === 'cards' ? 'list' : 'cards'))} title="Visning" sx={{ display: 'inline-flex', alignItems: 'center', px: 0.9, py: 0.3, borderRadius: 999, cursor: 'pointer', color: ws.textDim, border: `1px solid ${ws.border}`, '&:hover': { color: ws.accent } }}>{viewMode === 'cards' ? <ViewList sx={{ fontSize: 15 }} /> : <ViewModule sx={{ fontSize: 15 }} />}</Box>
      <Button size="small" variant="contained" disabled={isFetching} onClick={() => refetch()} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{isFetching ? 'Oppdaterer…' : 'Frisk opp'}</Button>
    </Stack>
  );

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <style>{`
        @keyframes gnShimmer { 0%,100% { opacity: .5; } 50% { opacity: .92; } }
        @keyframes gnDot { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        @keyframes gnFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .gn-fade { animation: gnFade .35s cubic-bezier(.22,1,.36,1) both; }
        .gn-dot { animation: gnDot 1s ease-in-out infinite; }
        .gn-skel { animation: gnShimmer 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gn-fade, .gn-dot, .gn-skel { animation: none; } }
      `}</style>
      {!embedded && (
        <WsPageTitle
          icon={<Box component="span" sx={{ display: 'inline-flex' }}>{React.cloneElement(config.icon, { sx: { fontSize: 21, color: '#fff' } })}</Box>}
          title={config.title}
          sub={`${articles.length} artikler · ${feedSource}${sourceCount ? ` · fra ${sourceCount} kilder` : ''}${newCount ? ` · ${newCount} nye` : ''}${lastUpd ? ` · oppdatert ${lastUpd.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          children={<>{feedFallback && <WsTag label="Fallback-feed" tone="amber" />}</>}
          actions={controls}
        />
      )}

      {embedded && (
        <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: 17 } })}
            <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{config.title}</Typography>
            {feedFallback && <WsTag label="Fallback-feed" tone="amber" />}
            <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{articles.length} artikler{newCount ? ` · ${newCount} nye` : ''}{lastUpd ? ` · oppdatert ${lastUpd.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : ''}</Typography>
          </Stack>
          {controls}
        </Stack>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        <TextField fullWidth placeholder="Søk etter utstyr, merker eller nyheter..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} size="small" sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13, color: ws.text } }} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 17, color: ws.textFaint }} /></InputAdornment> }} />
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
        <Box onClick={() => setSelectedCategory('all')} sx={{ px: 1.15, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: selectedCategory === 'all' ? 700 : 500, color: selectedCategory === 'all' ? ws.accent : ws.textDim, bgcolor: selectedCategory === 'all' ? ws.accentSoft : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedCategory === 'all' ? ws.accentBorder : 'transparent'}` }}>Alle {articles.length}</Box>
        {catChips.map(([c, n]) => (
          <Box key={c} onClick={() => setSelectedCategory((f) => (f === c ? 'all' : c))} sx={{ px: 1.15, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: selectedCategory === c ? 700 : 500, color: selectedCategory === c ? ws.accent : ws.textDim, bgcolor: selectedCategory === c ? ws.accentSoft : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedCategory === c ? ws.accentBorder : 'transparent'}` }}>{c} {n}</Box>
        ))}
      </Stack>

      <Card sx={{ bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.borderSoft}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
        <Box sx={{ borderBottom: `1px solid ${ws.border}`, px: 1 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} aria-label="gear news tabs" sx={{ '& .MuiTab-root': { color: ws.textDim, textTransform: 'none', fontWeight: 700, fontSize: 13, '&.Mui-selected': { color: ws.accent } }, '& .MuiTabs-indicator': { bgcolor: ws.accent } }}>
            <Tab label="Siste nytt" />
            <Tab label="Trending" />
            <Tab label="Anmeldelser" />
            <Tab label="Tilbud" />
            <Tab label={`Lagrede${saved.size ? ` (${saved.size})` : ''}`} />
          </Tabs>
        </Box>
        <CustomTabPanel value={tabValue} index={0}>
          {isLoading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                  <Box className="gn-skel" sx={{ borderRadius: `${ws.radius}px`, overflow: 'hidden', border: `1px solid ${ws.borderSoft}`, p: 1.5 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: 1.25, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ height: 12, width: '90%', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.07)', mb: 0.6 }} />
                        <Box sx={{ height: 9, width: '55%', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)' }} />
                      </Box>
                    </Stack>
                    <Box sx={{ height: 9, width: '100%', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)', mb: 0.6 }} />
                    <Box sx={{ height: 9, width: '72%', borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)' }} />
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : renderArticles(filteredNews)}
        </CustomTabPanel>
        <CustomTabPanel value={tabValue} index={1}>{renderArticles(trendingNews)}</CustomTabPanel>
        <CustomTabPanel value={tabValue} index={2}>{renderArticles(reviewNews)}</CustomTabPanel>
        <CustomTabPanel value={tabValue} index={3}>{renderArticles(dealsNews)}</CustomTabPanel>
        <CustomTabPanel value={tabValue} index={4}>{renderArticles(savedList)}</CustomTabPanel>
      </Card>

      <Dialog open={readMoreOpen} onClose={() => setReadMoreOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${ws.border}` }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: ws.text, pr: 2 }}>{selectedArticle?.title}</Typography>
          <Button onClick={() => setReadMoreOpen(false)} sx={{ minWidth: 'auto', color: ws.textDim }}><Close /></Button>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedArticle && (
            <Box>
              {selectedArticle.imageUrl && (
                <Box sx={{ width: '100%', aspectRatio: '16 / 9', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', mb: 2, border: `1px solid ${ws.borderSoft}`, background: thumbGradient(selectedArticle.source + selectedArticle.title) }}>
                  <Box component="img" src={selectedArticle.imageUrl} alt="" onError={(e: any) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              )}
              <Stack direction="row" sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                {selectedArticle.source && <WsTag label={selectedArticle.source} tone="accent" />}
                {selectedArticle.category && <WsTag label={selectedArticle.category} tone="neutral" />}
                {(selectedArticle.isNorwegian || selectedArticle.norwegian_source) && <WsTag label="Norsk kilde" tone="green" />}
                {selectedArticle.international_source && <WsTag label="Internasjonal kilde" tone="blue" />}
                {selectedArticle.isNew && <WsTag label="NY" tone="red" />}
              </Stack>
              <Typography sx={{ fontSize: 13.5, color: ws.textDim, mb: 2, lineHeight: 1.6 }}>{selectedArticle.summary}</Typography>
              <Divider sx={{ my: 2, borderColor: ws.borderSoft }} />
              <Typography sx={{ fontSize: 13.5, color: ws.text, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{selectedArticle.content || selectedArticle.summary}</Typography>
              {(selectedArticle.published_date || selectedArticle.publishedAt) && (
                <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${ws.borderSoft}` }}>
                  <Typography sx={{ fontSize: 12, color: ws.textFaint }}>Publisert: {new Date(selectedArticle.published_date || selectedArticle.publishedAt).toLocaleDateString('no-NO', { year: 'numeric', month: 'long', day: 'numeric' })}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          {selectedArticle?.url && (
            <Button
              onClick={() => {
                const nav = navigator as any;
                const data = { title: selectedArticle.title || '', text: selectedArticle.summary || '', url: selectedArticle.url as string };
                if (nav.share) { nav.share(data).catch(() => {}); }
                else if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(data.url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }
              }}
              startIcon={copied ? undefined : <OpenInNew />}
              sx={{ color: copied ? ws.green : ws.textDim, textTransform: 'none', border: `1px solid ${ws.borderSoft}` }}
            >{copied ? '✓ Kopiert' : 'Del'}</Button>
          )}
          {selectedArticle?.url && <Button href={selectedArticle.url} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNew />} variant="outlined" sx={{ mr: 'auto', color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', '&:hover': { bgcolor: ws.accentSoft, borderColor: ws.accent } }}>Les hele artikkelen</Button>}
          <Button onClick={() => setReadMoreOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CustomTabPanel({ children, value, index }: TabPanelProps) {
  return <div role="tabpanel" hidden={value !== index}>{value === index && <Box sx={{ p: 2.5 }}>{children}</Box>}</div>;
}

export default GearNewsTab;
