/**
 * BusinessDnaOnboarding.tsx
 *
 * Samlende «lim inn URL → se merkevaren din + første kampanje»-onboarding.
 * Tynt lag oppå eksisterende motorer (carouselService): analyzeWebsite (Business
 * DNA) → generateDraft + getDraft (kampanje med DINE egne bilder fra siden).
 *
 * Poenget er FLYTEN: DNA-en avsløres mens den hentes, så bygges kampanjen med
 * nettsidens egne visuelle assets — progressiv avsløring, ikke spinner-så-dump.
 */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Fade,
  FormControl,
  Grow,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import {
  analyzeWebsite,
  generateDraft,
  getDraft,
  type BrandProfile,
  type CarouselPostRow,
  type CarouselSlideRow,
} from '../../../services/carouselService';
import { marketingCatalogApi, type CatalogItem } from '../../../services/adminRoomApi';

type Phase = 'idle' | 'analyzing' | 'dna' | 'generating' | 'done' | 'error';

function nextMondayISO(): string {
  const d = new Date();
  const diff = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function imageUrl(ref: CarouselSlideRow['image_ref']): string | null {
  if (ref.strategy === 'ai') return ref.generatedUrl;
  if (ref.strategy === 'color-only') return null;
  return ref.url;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const NARRATION: Record<Phase, string> = {
  idle: '',
  analyzing: 'Leser nettsiden din og trekker ut merkevaren …',
  dna: 'Fant merkevaren din ✓',
  generating: 'Henter dine egne bilder og bygger første kampanje …',
  done: 'Kampanjen din er klar ✓',
  error: '',
};

export function BusinessDnaOnboarding() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [posts, setPosts] = useState<CarouselPostRow[]>([]);
  const [slides, setSlides] = useState<CarouselSlideRow[]>([]);
  const [scannedUrl, setScannedUrl] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [focus, setFocus] = useState('');

  const coverByPost = useMemo(() => {
    const map = new Map<string, CarouselSlideRow>();
    for (const s of slides) {
      const existing = map.get(s.post_id);
      if (!existing || s.slide_index < existing.slide_index) map.set(s.post_id, s);
    }
    return map;
  }, [slides]);

  const generateCampaign = async (target: string, focusArg?: string) => {
    setPhase('generating');
    setPosts([]);
    setSlides([]);
    const { draft } = await generateDraft(target, nextMondayISO(), focusArg ? { focus: focusArg } : {});
    const full = await getDraft(draft.id);
    setPosts(full.posts);
    setSlides(full.slides);
    setPhase('done');
  };

  const run = async () => {
    const target = normalizeUrl(url);
    if (!target) return;
    setError(null);
    setBrand(null);
    setPosts([]);
    setSlides([]);
    setFocus('');
    try {
      // 1) Business DNA — avsløres først
      setPhase('analyzing');
      const { brandProfile } = await analyzeWebsite(target);
      setBrand(brandProfile);
      setScannedUrl(target);
      setPhase('dna');
      // Katalog for refokus-valg (fire-and-forget)
      void marketingCatalogApi
        .list()
        .then((items) => setCatalog(items.filter((i) => i.active)))
        .catch(() => {});
      // 2) Kampanje med sidens egne bilder
      await generateCampaign(target);
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  const refocus = async () => {
    if (!scannedUrl) return;
    try {
      await generateCampaign(scannedUrl, focus || undefined);
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  const downloadBrandbook = () => {
    if (!brand) return;
    const esc = (s: unknown): string =>
      String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
    const swatchRow = ([label, color]: readonly [string, string]): string =>
      `<div class="sw"><div class="chip" style="background:${esc(color)}"></div><div><b>${esc(label)}</b><br><code>${esc(color)}</code></div></div>`;
    const usps = brand.usps.map((u) => `<li>${esc(u)}</li>`).join('');
    const images = Array.from(
      new Set(slides.map((s) => imageUrl(s.image_ref)).filter((u): u is string => Boolean(u))),
    ).slice(0, 7);
    const moodboard = images.length
      ? `<h2>Bildeverden</h2><div class="grid">${images.map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>`
      : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Brandbook — ${esc(brand.businessName)}</title>
<style>
  @page { margin: 24mm; }
  body { font-family: ${esc(brand.fonts.body)}, system-ui, sans-serif; color: ${esc(brand.colors.text)}; margin: 0; }
  .cover { background: ${esc(brand.colors.primary)}; color: ${esc(brand.colors.background)}; padding: 64px 48px; }
  .cover h1 { font-family: ${esc(brand.fonts.heading)}, system-ui, sans-serif; font-size: 40px; margin: 0 0 8px; }
  .cover p { font-size: 18px; opacity: .9; margin: 0; }
  .body { padding: 40px 48px; }
  h2 { font-family: ${esc(brand.fonts.heading)}, system-ui, sans-serif; border-bottom: 2px solid ${esc(brand.colors.accent)}; padding-bottom: 6px; margin-top: 32px; }
  .sw { display: inline-flex; align-items: center; gap: 10px; width: 180px; margin: 6px 12px 6px 0; vertical-align: top; }
  .chip { width: 40px; height: 40px; border-radius: 8px; border: 1px solid rgba(0,0,0,.1); }
  code { font-family: ui-monospace, monospace; font-size: 13px; }
  .tone { display: inline-block; background: ${esc(brand.colors.accent)}; color: ${esc(brand.colors.background)}; padding: 4px 14px; border-radius: 999px; font-weight: 600; }
  ul { line-height: 1.7; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .grid img { width: 100%; height: 150px; object-fit: cover; border-radius: 8px; }
</style></head><body>
  <div class="cover">
    ${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="" style="height:48px;margin-bottom:16px">` : ''}
    <h1>${esc(brand.businessName)}</h1>
    <p>${esc(brand.tagline)}</p>
  </div>
  <div class="body">
    <h2>Tone of voice</h2>
    <p><span class="tone">${esc(brand.toneOfVoice)}</span></p>
    <p>${esc(brand.description)}</p>
    <h2>Fargepalett</h2>
    <div>${swatches.map(swatchRow).join('')}</div>
    <h2>Typografi</h2>
    <p style="font-family:${esc(brand.fonts.heading)},sans-serif;font-size:26px">Overskrift — ${esc(brand.fonts.heading)}</p>
    <p style="font-family:${esc(brand.fonts.body)},sans-serif;font-size:16px">Brødtekst — ${esc(brand.fonts.body)}. Rask brun rev hopper over den late hunden.</p>
    ${usps ? `<h2>Kjernebudskap (USP-er)</h2><ul>${usps}</ul>` : ''}
    <h2>Målgruppe</h2>
    <p>${esc(brand.targetAudience)}</p>
    ${moodboard}
    <p style="margin-top:40px;color:#888;font-size:12px">Generert automatisk fra ${esc(brand.url)} · Creatorhub Business DNA</p>
  </div>
</body></html>`;
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(blobUrl, '_blank');
  };

  const busy = phase === 'analyzing' || phase === 'generating';
  const swatches = brand
    ? ([
        ['Primær', brand.colors.primary],
        ['Sekundær', brand.colors.secondary],
        ['Aksent', brand.colors.accent],
        ['Bakgrunn', brand.colors.background],
        ['Tekst', brand.colors.text],
      ] as const)
    : [];

  return (
    <Box sx={{ p: 3, maxWidth: 940, mx: 'auto' }}>
      {/* Hero / input */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Se merkevaren din bli til en kampanje
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Lim inn nettadressen din. Vi leser merkevaren — farger, tone, bilder — og bygger den
          første kampanjen med dine egne visuelle assets.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center" sx={{ maxWidth: 620, mx: 'auto' }}>
          <TextField
            fullWidth
            placeholder="dinbedrift.no"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) void run();
            }}
            disabled={busy}
          />
          <Button
            variant="contained"
            size="large"
            disabled={!url.trim() || busy}
            onClick={() => void run()}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlinedIcon />}
            sx={{ whiteSpace: 'nowrap', px: 3 }}
          >
            {phase === 'idle' || phase === 'error' ? 'Generér' : 'På nytt'}
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Live narration */}
      {NARRATION[phase] && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
          {busy && <CircularProgress size={16} />}
          <Typography variant="body2" color={busy ? 'text.secondary' : 'success.main'} fontWeight={600}>
            {NARRATION[phase]}
          </Typography>
        </Stack>
      )}

      {/* Business DNA — avsløres når den er hentet */}
      <Fade in={Boolean(brand)} timeout={500} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
              {brand?.logoUrl && (
                <Box
                  component="img"
                  src={brand.logoUrl}
                  alt=""
                  sx={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 1 }}
                />
              )}
              <Box>
                <Typography fontWeight={700}>{brand?.businessName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {brand?.tagline}
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              {brand && <Chip size="small" color="primary" label={brand.toneOfVoice} />}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              {swatches.map(([label, color], i) => (
                <Grow in key={label} timeout={400} style={{ transitionDelay: `${i * 90}ms` }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: color,
                        border: '1px solid rgba(0,0,0,0.12)',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                  </Stack>
                </Grow>
              ))}
            </Stack>

            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {brand?.industry && <Chip size="small" variant="outlined" label={`Bransje: ${brand.industry}`} />}
              {brand?.targetAudience && (
                <Chip size="small" variant="outlined" label={`Målgruppe: ${brand.targetAudience}`} />
              )}
              {brand?.fonts?.heading && (
                <Chip size="small" variant="outlined" label={`Font: ${brand.fonts.heading}`} />
              )}
            </Stack>
            <Button size="small" variant="outlined" onClick={downloadBrandbook} sx={{ mt: 2 }}>
              Last ned brandbook
            </Button>
          </CardContent>
        </Card>
      </Fade>

      {/* Kampanje — avsløres slide for slide */}
      {(phase === 'generating' || phase === 'done') && (
        <>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Første kampanje {posts.length > 0 && `· ${posts.length} poster`}
          </Typography>
          {phase === 'generating' && posts.length === 0 && (
            <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
              {[0, 1, 2, 3].map((i) => (
                <Box
                  key={i}
                  sx={{
                    flex: '0 0 200px',
                    height: 240,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    animation: 'pulse 1.4s ease-in-out infinite',
                    '@keyframes pulse': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
                  }}
                />
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
            {posts.map((p, i) => {
              const cover = coverByPost.get(p.id);
              const img = cover ? imageUrl(cover.image_ref) : null;
              return (
                <Grow in key={p.id} timeout={500} style={{ transitionDelay: `${i * 120}ms` }}>
                  <Card variant="outlined" sx={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column' }}>
                    {img ? (
                      <Box
                        component="img"
                        src={img}
                        alt=""
                        sx={{ width: '100%', height: 150, objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: 150,
                          bgcolor: brand?.colors.primary ?? 'action.hover',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: brand?.colors.text ?? '#fff',
                        }}
                      >
                        <Typography variant="caption">{p.format}</Typography>
                      </Box>
                    )}
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Chip size="small" label={p.primary_platform} sx={{ mb: 1 }} />
                      <Typography variant="body2" fontWeight={700} gutterBottom>
                        {p.hook}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.caption?.[p.primary_platform]?.slice(0, 140)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grow>
              );
            })}
          </Stack>
          {phase === 'done' && catalog.length > 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <FormControl size="small" sx={{ minWidth: 280 }}>
                <InputLabel id="focus-label">Fokusér på et katalog-produkt</InputLabel>
                <Select
                  labelId="focus-label"
                  label="Fokusér på et katalog-produkt"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Ingen — bred kampanje</em>
                  </MenuItem>
                  {catalog.map((c) => (
                    <MenuItem key={c.id} value={c.description ? `${c.name} — ${c.description}` : c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" disabled={!focus} onClick={() => void refocus()}>
                Generér på nytt med fokus
              </Button>
            </Stack>
          )}
          {phase === 'done' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Bygget med dine egne bilder fra nettsiden (brand-assets), grunnet i merkevaren din — rediger og
              publiser i Content Planner / Feed.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

export default BusinessDnaOnboarding;
