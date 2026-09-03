/**
 * MerchMockupPreview — Slice 5b.
 *
 * Calls the backend /agent/merch-mockup endpoint, which wraps Printful's
 * Mockup Generator. Returns a photorealistic JPG of the customer's logo
 * on the chosen product. Supplier-aware: when a supplier is selected
 * upstream, the product picker narrows to only the categories that
 * supplier inferred-stocks (techniques + productCategories from
 * Slice 1+2 enrichment).
 *
 * States handled:
 *   - missing logo  → "trenger logo, kjør Research-fanen"
 *   - 503 from API  → "PRINTFUL_API_KEY mangler, sett i Render-env"
 *   - in-flight     → spinner with elapsed seconds
 *   - rendered      → <img> at native aspect, "cached" badge when cached
 *   - error         → inline alert with detail + retry
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import {
  generateMerchMockup,
  MerchMockupError,
  type MerchMockupProductId,
} from '../../services/roleRoomAgentClaudeApi';
import type {
  RoleRoomAgentMerchProductCategory,
  RoleRoomAgentMerchSupplier,
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';

interface MerchMockupPreviewProps {
  projectId: string | null;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  /** When set, the product picker narrows to categories this supplier
   *  carries (productCategories), and the heading shows their name. */
  selectedSupplier?: RoleRoomAgentMerchSupplier | null;
}

const PRODUCT_OPTIONS: ReadonlyArray<{
  id: MerchMockupProductId;
  label: string;
  /** Categories from the agent's classification that should map to this
   *  Printful product. Used to filter the picker by selected supplier. */
  categories: RoleRoomAgentMerchProductCategory[];
}> = [
  { id: 'tshirt', label: 'T-skjorte', categories: ['apparel'] },
  { id: 'hoodie', label: 'Hettegenser', categories: ['apparel'] },
  { id: 'polo', label: 'Polo', categories: ['apparel'] },
  { id: 'cap', label: 'Caps', categories: ['headwear'] },
  { id: 'totebag', label: 'Totebag', categories: ['bags'] },
  { id: 'mug', label: 'Krus', categories: ['drinkware'] },
];

const PRIORITY_LABEL = {
  primary: 'Start her',
  secondary: 'Nummer to',
  experimental: 'Testidé',
} as const;

const TECHNIQUE_LABEL = {
  screen_print: 'Silketrykk',
  dtg: 'DTG',
  embroidery: 'Broderi',
  sublimation: 'Sublimering',
  vinyl: 'Vinyl/transfer',
  promo_products: 'Promo-produkt',
  unknown: 'Teknikk må avklares',
} as const;

function MerchConceptVisual({
  productId,
  logoUrl,
  baseColor,
  companyName,
}: {
  productId: MerchMockupProductId;
  logoUrl: string;
  baseColor: string;
  companyName: string | null;
}) {
  const isCap = productId === 'cap';
  const isBag = productId === 'totebag';
  const isMug = productId === 'mug';
  const isGarment = productId === 'tshirt' || productId === 'hoodie' || productId === 'polo';
  return (
    <Box
      aria-label={`Konseptvisning av ${productId} for ${companyName ?? 'kunden'}`}
      sx={{
        position: 'relative',
        width: isMug ? 190 : isCap ? 250 : isBag ? 220 : 270,
        height: isMug ? 190 : isCap ? 145 : isBag ? 250 : 280,
        bgcolor: baseColor,
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 28px 60px rgba(2,6,23,0.38)',
        borderRadius: isMug ? '16px 16px 28px 28px' : isCap ? '50% 50% 38% 38%' : isBag ? 2 : 3,
        clipPath: isGarment
          ? 'polygon(25% 0, 38% 0, 42% 7%, 58% 7%, 62% 0, 75% 0, 100% 18%, 85% 38%, 75% 31%, 75% 100%, 25% 100%, 25% 31%, 15% 38%, 0 18%)'
          : undefined,
        '&::before': isBag ? {
          content: '""',
          position: 'absolute',
          width: '46%',
          height: 58,
          left: '27%',
          top: -35,
          border: `12px solid ${baseColor}`,
          borderBottom: 0,
          borderRadius: '40px 40px 0 0',
        } : isCap ? {
          content: '""',
          position: 'absolute',
          width: '58%',
          height: 34,
          right: -54,
          bottom: 3,
          bgcolor: baseColor,
          borderRadius: '0 100% 80% 0',
          transform: 'rotate(7deg)',
        } : undefined,
        '&::after': isMug ? {
          content: '""',
          position: 'absolute',
          width: 68,
          height: 88,
          right: -54,
          top: 42,
          border: `18px solid ${baseColor}`,
          borderLeft: 0,
          borderRadius: '0 50px 50px 0',
        } : undefined,
      }}
    >
      <Box
        component="img"
        src={logoUrl}
        alt=""
        sx={{
          position: 'absolute',
          zIndex: 2,
          width: isCap ? '38%' : isMug ? '58%' : '52%',
          maxHeight: isCap ? 55 : 105,
          objectFit: 'contain',
          left: '50%',
          top: isCap ? '44%' : isGarment ? '35%' : '43%',
          transform: 'translate(-50%, -50%)',
          filter: 'drop-shadow(0 2px 3px rgba(255,255,255,0.18))',
        }}
      />
    </Box>
  );
}

const MerchMockupPreview: React.FC<MerchMockupPreviewProps> = ({
  projectId,
  bootstrap,
  selectedSupplier,
}) => {
  const logoUrl = useMemo(() => {
    return (
      bootstrap?.planningDraft?.brandGuide?.logoUrl
      || bootstrap?.companyProfile?.logoUrl
      || null
    );
  }, [bootstrap]);

  const companyName = bootstrap?.companyProfile?.companyName ?? null;
  const recommendations = bootstrap?.merchSuppliers?.recommendations ?? [];
  const brandColors = bootstrap?.planningDraft?.brandGuide?.colors ?? [];
  const validBrandColors = brandColors.filter((color) => /^#[0-9a-f]{6}$/i.test(color.hex));
  const conceptColor = validBrandColors.find((color) => /mørk|dark/i.test(color.label))?.hex
    || validBrandColors.find((color) => /primær|primary/i.test(color.label))?.hex
    || validBrandColors[0]?.hex
    || '#172554';

  // When a supplier is selected, narrow product options to ones whose
  // categories overlap. Supplier without productCategories falls back
  // to all (so we don't accidentally hide everything).
  const availableProducts = useMemo(() => {
    if (!selectedSupplier || selectedSupplier.productCategories.length === 0) {
      return PRODUCT_OPTIONS;
    }
    const supplierCats = new Set(selectedSupplier.productCategories);
    const filtered = PRODUCT_OPTIONS.filter((p) =>
      p.categories.some((c) => supplierCats.has(c)),
    );
    // If filter is too tight (e.g. supplier only does signage), fall
    // back to all so the producer can still preview and pick another
    // supplier if the catalog mismatch is real.
    return filtered.length > 0 ? filtered : PRODUCT_OPTIONS;
  }, [selectedSupplier]);

  const [productId, setProductId] = useState<MerchMockupProductId>(
    availableProducts[0]?.id ?? 'tshirt',
  );

  // Reset to the first available product when the selected supplier
  // changes and the current product is no longer in the catalog.
  useEffect(() => {
    if (!availableProducts.some((p) => p.id === productId)) {
      setProductId(availableProducts[0]?.id ?? 'tshirt');
    }
  }, [availableProducts, productId]);

  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MerchMockupError | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cache rendered mockups in component state so flipping back to an
  // already-rendered product is instant (the backend cache is also
  // hit, but local state avoids the round trip entirely).
  const localCacheRef = useRef<Map<string, string>>(new Map());
  const cacheKey = (pid: MerchMockupProductId, url: string) => `${pid}|${url}`;

  const runFetch = useCallback(
    async (force = false) => {
      if (!projectId) return;
      if (!logoUrl) return;
      const key = cacheKey(productId, logoUrl);
      if (!force && localCacheRef.current.has(key)) {
        setMockupUrl(localCacheRef.current.get(key)!);
        setCached(true);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      setMockupUrl(null);
      setCached(false);
      setElapsedSec(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(
        () => setElapsedSec((s) => s + 1),
        1000,
      );
      try {
        // force=true bypasses BOTH the local-state cache (above) and the
        // backend Postgres cache, so a broken render (e.g. favicon picked
        // up instead of real logo) can actually be re-rendered.
        const result = await generateMerchMockup({
          projectId,
          productId,
          designImageUrl: logoUrl,
          forceRefresh: force,
        });
        setMockupUrl(result.mockupUrl);
        setCached(result.cached);
        localCacheRef.current.set(key, result.mockupUrl);
      } catch (err) {
        if (err instanceof MerchMockupError) {
          setError(err);
        } else {
          setError(
            new MerchMockupError({
              code: 'mockup_generation_failed',
              detail: err instanceof Error ? err.message : String(err),
              httpStatus: 0,
            }),
          );
        }
      } finally {
        setLoading(false);
        if (elapsedTimerRef.current) {
          clearInterval(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
      }
    },
    [projectId, productId, logoUrl],
  );

  // The deterministic concept is immediate. Printful is intentionally
  // opt-in so an unconfigured provider never turns the whole Merch tab into
  // a failing request. Reuse a completed render when the producer returns.
  useEffect(() => {
    if (logoUrl) {
      const key = cacheKey(productId, logoUrl);
      const local = localCacheRef.current.get(key);
      setMockupUrl(local ?? null);
      setCached(Boolean(local));
      setError(null);
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [productId, logoUrl]);

  if (!bootstrap) {
    return null;
  }

  if (!logoUrl) {
    return (
      <Alert
        severity="info"
        sx={{
          bgcolor: 'rgba(34,211,238,0.08)',
          color: '#cbd5e1',
          border: '1px solid rgba(34,211,238,0.22)',
          '& .MuiAlert-icon': { color: '#a5f3fc' },
        }}
      >
        Mockup-preview krever en logo-URL fra Research-fanen. Kjør research, så vi har noe å trykke
        på produktet.
      </Alert>
    );
  }

  if (!projectId) {
    return null;
  }

  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: 3,
        border: '1px solid rgba(99,102,241,0.22)',
        bgcolor: 'rgba(30,27,75,0.36)',
      }}
    >
      <Stack spacing={1.2}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={0.6}>
          <Box>
            <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>
              Anbefalt merch og konsept{companyName ? ` · ${companyName}` : ''}
              {selectedSupplier ? (
                <Chip
                  size="small"
                  label={`for ${selectedSupplier.name}`}
                  sx={{ ml: 1, bgcolor: 'rgba(99,102,241,0.22)', color: '#e0e7ff', fontWeight: 700 }}
                />
              ) : null}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.82rem' }}>
              Rangert fra bedriftens verifiserte profil. Konseptet bruker logo-paletten; leverandøren må
              fortsatt bekrefte produkt, farge og prøvetrykk.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.6} alignItems="center">
            {cached ? (
              <Chip
                size="small"
                label="Lagret render"
                sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0', fontWeight: 600 }}
              />
            ) : null}
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => void runFetch(Boolean(mockupUrl || error))}
              disabled={loading || !logoUrl}
              sx={{
                textTransform: 'none',
                color: '#cbd5e1',
                borderColor: 'rgba(148,163,184,0.32)',
                fontSize: '0.78rem',
                py: 0.3,
              }}
            >
              {mockupUrl ? 'Rendre på nytt' : 'Lag fotorealistisk variant'}
            </Button>
          </Stack>
        </Stack>

        {recommendations.length > 0 ? (
          <Stack spacing={0.7}>
            <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Prioritert for denne bedriften
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} flexWrap="wrap" useFlexGap>
              {recommendations.map((recommendation) => {
                const active = productId === recommendation.productId;
                return (
                  <Box
                    component="button"
                    type="button"
                    key={recommendation.productId}
                    onClick={() => setProductId(recommendation.productId)}
                    sx={{
                      flex: '1 1 220px',
                      minWidth: 0,
                      p: 1,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'inherit',
                      borderRadius: 2,
                      border: active ? '1px solid rgba(99,102,241,0.7)' : '1px solid rgba(148,163,184,0.18)',
                      bgcolor: active ? 'rgba(49,46,129,0.34)' : 'rgba(15,23,42,0.45)',
                      '&:hover': { borderColor: 'rgba(99,102,241,0.58)' },
                    }}
                  >
                    <Stack spacing={0.45}>
                      <Stack direction="row" spacing={0.5} justifyContent="space-between" alignItems="center">
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.86rem' }}>
                          {recommendation.productLabel}
                        </Typography>
                        <Chip size="small" label={PRIORITY_LABEL[recommendation.priority]} sx={{ height: 20, color: '#c7d2fe', bgcolor: 'rgba(99,102,241,0.18)', fontSize: '0.65rem' }} />
                      </Stack>
                      <Typography sx={{ color: '#a5f3fc', fontSize: '0.74rem', fontWeight: 700 }}>
                        {recommendation.purpose}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.64)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                        {recommendation.rationale}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.68rem' }}>
                        {TECHNIQUE_LABEL[recommendation.recommendedTechnique]}
                        {recommendation.supplierMatch ? ` · Match: ${recommendation.supplierMatch.name} (${recommendation.supplierMatch.confidence}%)` : ' · Leverandør må matches manuelt'}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        ) : null}

        {/* Source-logo preview — shows EXACTLY what we're sending to Printful.
            Catches the most common failure mode: a favicon being scraped
            instead of the real logo, which then renders unrecognizable on
            the merch. If this thumbnail looks wrong, the mockup will too. */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            p: 0.9,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            bgcolor: 'rgba(15,23,42,0.4)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1,
              bgcolor: 'rgba(248,250,252,0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src={logoUrl}
              alt="Logo brukt for mockup"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.opacity = '0.2';
                target.title = 'Kunne ikke laste logo — Printful kan heller ikke nå denne URLen';
              }}
            />
          </Box>
          <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem' }}>
              Logo brukt for render
            </Typography>
            <Typography
              sx={{
                color: 'rgba(226,232,240,0.6)',
                fontSize: '0.72rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={logoUrl}
            >
              {logoUrl}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.46)', fontSize: '0.68rem' }}>
              Hvis dette ser feil ut (f.eks. favicon i stedet for ekte logo), klikk «Rendre på nytt»
              etter at research har plukket opp riktig bilde.
            </Typography>
          </Stack>
        </Box>

        {/* Product picker, filtered by selected supplier's catalog */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {availableProducts.map((p) => {
            const active = productId === p.id;
            return (
              <Chip
                key={p.id}
                size="small"
                clickable
                label={p.label}
                onClick={() => setProductId(p.id)}
                disabled={loading}
                sx={{
                  bgcolor: active ? 'rgba(99,102,241,0.32)' : 'rgba(15,23,42,0.6)',
                  color: active ? '#e0e7ff' : '#cbd5e1',
                  border: active ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(148,163,184,0.2)',
                  fontWeight: active ? 700 : 500,
                }}
              />
            );
          })}
          {availableProducts.length < PRODUCT_OPTIONS.length ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', alignSelf: 'center', ml: 0.5 }}>
              Kun produkter {selectedSupplier?.name} klassifiseres for
            </Typography>
          ) : null}
        </Stack>

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: 360,
            p: 2,
            borderRadius: 2,
            border: '1px solid rgba(34,211,238,0.2)',
            background: 'radial-gradient(circle at 50% 20%, rgba(34,211,238,0.14), transparent 48%), rgba(15,23,42,0.68)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.4,
          }}
        >
          <Chip
            size="small"
            label="Konsept · ikke produksjonsbevis"
            sx={{ position: 'absolute', top: 12, left: 12, color: '#a5f3fc', bgcolor: 'rgba(8,47,73,0.72)', fontWeight: 700 }}
          />
          <MerchConceptVisual
            productId={productId}
            logoUrl={logoUrl}
            baseColor={conceptColor}
            companyName={companyName}
          />
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap justifyContent="center">
            <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>
              Farger fra logo-paletten:
            </Typography>
            {validBrandColors.slice(0, 4).map((color) => (
              <Chip
                key={`${color.label}-${color.hex}`}
                size="small"
                label={`${color.label} ${color.hex}`}
                sx={{
                  height: 22,
                  bgcolor: color.hex,
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.32)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                  fontSize: '0.66rem',
                }}
              />
            ))}
          </Stack>
        </Box>

        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Valgfri fotorealistisk Printful-variant
        </Typography>
        <Box
          sx={{
            position: 'relative',
            bgcolor: 'rgba(15,23,42,0.6)',
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            p: 1.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 360,
          }}
        >
          {loading ? (
            <Stack spacing={1.2} alignItems="center">
              <CircularProgress size={32} sx={{ color: '#a5b4fc' }} />
              <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.86rem' }}>
                Renderer mockup hos Printful … {elapsedSec}s
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.76rem' }}>
                Første render tar 5–30 s; senere visninger er øyeblikkelige (cachet).
              </Typography>
            </Stack>
          ) : error ? (
            <Stack spacing={1} alignItems="flex-start" sx={{ width: '100%', maxWidth: 600 }}>
              <Alert
                severity={error.code === 'mockup_provider_unconfigured' ? 'warning' : 'error'}
                sx={{ width: '100%' }}
              >
                {error.code === 'mockup_provider_unconfigured' ? (
                  <>
                    Printful er ikke fullt konfigurert. Be admin sette både
                    <code> PRINTFUL_API_KEY</code> og <code>PRINTFUL_STORE_ID</code> i
                    backend-env (Render → environment). Store-ID hentes fra Printful
                    → Stores etter at en gratis "Manual / API"-store er opprettet.
                  </>
                ) : (
                  error.detail
                )}
              </Alert>
              {error.code !== 'mockup_provider_unconfigured' ? (
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => void runFetch(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Prøv igjen
                </Button>
              ) : null}
            </Stack>
          ) : mockupUrl ? (
            <Box
              component="img"
              src={mockupUrl}
              alt={`Mockup of ${productId}`}
              sx={{
                maxWidth: '100%',
                maxHeight: 480,
                objectFit: 'contain',
                borderRadius: 1,
              }}
            />
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.5)' }}>Ingen render</Typography>
          )}
        </Box>

        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', lineHeight: 1.5 }}>
          Generisk plagg fra Printful-katalogen — leverandørens faktiske produkt kan være tykkere stoff,
          annen passform eller annen trykk-teknikk. Bruk dette som visuell pitch, ikke som endelig spesifikasjon.
        </Typography>
      </Stack>
    </Box>
  );
};

export default MerchMockupPreview;
