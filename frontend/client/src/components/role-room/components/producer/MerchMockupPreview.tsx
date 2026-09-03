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
  RoleRoomAgentMerchRecommendation,
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
function hasWebsiteDocumentedSupplierMatch(
  recommendation: RoleRoomAgentMerchRecommendation,
  suppliers: RoleRoomAgentMerchSupplier[],
): boolean {
  const match = recommendation.supplierMatch;
  if (!match) return false;
  const supplier = suppliers.find((candidate) => (
    (Boolean(match.organizationNumber) && candidate.organizationNumber === match.organizationNumber)
    || (Boolean(match.placeId) && candidate.placeId === match.placeId)
    || candidate.name === match.name
  ));
  return supplier?.websiteSignalsEnriched === true
    && supplier.websiteConfirmedProductCategories?.includes(recommendation.productCategory) === true
    && supplier.websiteConfirmedTechniques?.includes(recommendation.recommendedTechnique) === true;
}

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
  const gradientId = `merch-fabric-${productId}`;
  const shadowId = `merch-shadow-${productId}`;
  const isGarment = productId === 'tshirt' || productId === 'hoodie' || productId === 'polo';
  const logoPlacement = productId === 'cap'
    ? { x: 159, y: 126, width: 105, height: 48 }
    : productId === 'mug'
      ? { x: 147, y: 125, width: 112, height: 72 }
      : productId === 'totebag'
        ? { x: 145, y: 155, width: 130, height: 82 }
        : productId === 'polo'
          ? { x: 166, y: 132, width: 88, height: 64 }
          : { x: 152, y: 132, width: 116, height: 76 };

  return (
    <Box
      component="svg"
      viewBox="0 0 420 360"
      role="img"
      aria-label={`Konseptvisning av ${productId} for ${companyName ?? 'kunden'}`}
      sx={{
        width: 'min(100%, 420px)',
        height: 'auto',
        overflow: 'visible',
        filter: 'drop-shadow(0 28px 28px rgba(2,6,23,0.38))',
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="25%" stopColor={baseColor} />
          <stop offset="76%" stopColor={baseColor} />
          <stop offset="100%" stopColor="#020617" stopOpacity="0.45" />
        </linearGradient>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#020617" floodOpacity="0.45" />
        </filter>
      </defs>

      <ellipse cx="210" cy="332" rx="125" ry="15" fill="#020617" opacity="0.3" />

      {productId === 'mug' ? (
        <g filter={`url(#${shadowId})`}>
          <path d="M108 84 H287 V278 Q287 310 255 316 H143 Q108 311 108 278 Z" fill={`url(#${gradientId})`} stroke="#fff" strokeOpacity="0.22" strokeWidth="2" />
          <path d="M286 126 H313 Q360 126 360 181 V219 Q360 273 313 273 H286" fill="none" stroke={baseColor} strokeWidth="27" strokeLinecap="round" />
          <ellipse cx="198" cy="85" rx="89" ry="15" fill="#f8fafc" opacity="0.2" />
          <path d="M121 104 V272" stroke="#fff" strokeOpacity="0.14" strokeWidth="7" strokeLinecap="round" />
        </g>
      ) : productId === 'cap' ? (
        <g filter={`url(#${shadowId})`}>
          <path d="M91 206 Q91 86 209 76 Q328 88 329 211 Q259 231 91 206 Z" fill={`url(#${gradientId})`} stroke="#fff" strokeOpacity="0.22" strokeWidth="2" />
          <path d="M207 78 V210" stroke="#fff" strokeOpacity="0.16" strokeWidth="2" />
          <path d="M102 200 Q205 224 326 204 Q368 207 389 231 Q315 266 205 236 Q133 218 102 200 Z" fill={baseColor} stroke="#fff" strokeOpacity="0.18" strokeWidth="2" />
          <circle cx="209" cy="77" r="7" fill={baseColor} stroke="#fff" strokeOpacity="0.25" />
        </g>
      ) : productId === 'totebag' ? (
        <g filter={`url(#${shadowId})`}>
          <path d="M112 98 H308 L329 316 H91 Z" fill={`url(#${gradientId})`} stroke="#fff" strokeOpacity="0.22" strokeWidth="2" />
          <path d="M154 112 V73 Q154 35 210 35 Q266 35 266 73 V112" fill="none" stroke={baseColor} strokeWidth="16" strokeLinecap="round" />
          <path d="M154 112 V73 Q154 35 210 35 Q266 35 266 73 V112" fill="none" stroke="#fff" strokeOpacity="0.17" strokeWidth="2" />
          <path d="M112 99 H308 M105 278 H315" stroke="#fff" strokeOpacity="0.13" strokeWidth="2" />
        </g>
      ) : (
        <g filter={`url(#${shadowId})`}>
          <path
            d={productId === 'hoodie'
              ? 'M132 79 L164 55 Q210 76 256 55 L288 79 L347 118 L316 172 L285 151 L282 320 H138 L135 151 L104 172 L73 118 Z'
              : 'M145 65 L178 45 Q210 68 242 45 L275 65 L343 107 L313 163 L282 143 L280 320 H140 L138 143 L107 163 L77 107 Z'}
            fill={`url(#${gradientId})`}
            stroke="#fff"
            strokeOpacity="0.22"
            strokeWidth="2"
          />
          {productId === 'hoodie' ? (
            <>
              <path d="M164 56 Q171 17 210 17 Q249 17 256 56 Q242 91 210 96 Q178 91 164 56 Z" fill={baseColor} stroke="#fff" strokeOpacity="0.2" strokeWidth="2" />
              <path d="M196 84 L191 142 M224 84 L229 142" stroke="#e2e8f0" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
              <circle cx="191" cy="143" r="4" fill="#e2e8f0" opacity="0.62" />
              <circle cx="229" cy="143" r="4" fill="#e2e8f0" opacity="0.62" />
              <path d="M167 270 Q210 246 253 270 V310 H167 Z" fill="#020617" opacity="0.12" stroke="#fff" strokeOpacity="0.12" />
            </>
          ) : (
            <path d="M178 46 Q210 82 242 46 Q237 89 210 94 Q183 89 178 46 Z" fill="#020617" opacity="0.2" stroke="#fff" strokeOpacity="0.18" />
          )}
          {productId === 'polo' ? (
            <>
              <path d="M178 46 L210 92 L194 111 L165 60 Z M242 46 L210 92 L226 111 L255 60 Z" fill="#f8fafc" opacity="0.16" stroke="#fff" strokeOpacity="0.18" />
              <path d="M210 92 V145" stroke="#020617" strokeOpacity="0.28" strokeWidth="5" />
              <circle cx="210" cy="109" r="3" fill="#e2e8f0" opacity="0.75" />
              <circle cx="210" cy="127" r="3" fill="#e2e8f0" opacity="0.75" />
            </>
          ) : null}
          {isGarment ? (
            <>
              <path d="M140 298 H280" stroke="#fff" strokeOpacity="0.15" strokeWidth="2" />
              <path d="M139 143 Q210 169 281 143" stroke="#fff" strokeOpacity="0.06" strokeWidth="2" />
            </>
          ) : null}
        </g>
      )}

      <image
        href={logoUrl}
        x={logoPlacement.x}
        y={logoPlacement.y}
        width={logoPlacement.width}
        height={logoPlacement.height}
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(255,255,255,0.72)) drop-shadow(0 2px 4px rgba(2,6,23,0.28))' }}
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
  const suppliers = bootstrap?.merchSuppliers?.suppliers ?? [];
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
  const preferredProductId = recommendations.find((entry) => entry.priority === 'primary')?.productId;
  const initialProductId = availableProducts.find((entry) => entry.id === preferredProductId)?.id
    ?? availableProducts[0]?.id ?? 'tshirt';

  const [productId, setProductId] = useState<MerchMockupProductId>(initialProductId);

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
                const hasDocumentedMatch = hasWebsiteDocumentedSupplierMatch(recommendation, suppliers);
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
                        {hasDocumentedMatch && recommendation.supplierMatch
                          ? ` · Nettsidebekreftet: ${recommendation.supplierMatch.name} (${recommendation.supplierMatch.confidence}%)`
                          : ' · Leverandør må matches manuelt'}
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
            minHeight: 390,
            p: 2,
            borderRadius: 2,
            border: '1px solid rgba(34,211,238,0.2)',
            backgroundColor: 'rgba(15,23,42,0.82)',
            backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(99,102,241,0.3), transparent 42%), linear-gradient(rgba(148,163,184,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px)',
            backgroundSize: 'auto, 28px 28px, 28px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.4,
          }}
        >
          <Chip
            size="small"
            label="Konseptskisse · ikke produksjonsklar"
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

        <Alert
          severity="info"
          icon={false}
          sx={{ bgcolor: 'rgba(14,116,144,0.09)', color: '#cbd5e1', border: '1px solid rgba(34,211,238,0.18)' }}
        >
          <Typography sx={{ color: '#e0f2fe', fontWeight: 800, fontSize: '0.78rem', mb: 0.25 }}>
            Hva Printful-visningen faktisk viser
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.55 }}>
            Renderen viser logo og farge på ett generisk katalogprodukt. Den er ikke et tilbud, prøvetrykk eller en produktspesifikasjon fra valgt leverandør. Før bestilling må artikkelnummer, materiale og stoffvekt, passform og størrelser, faktisk farge, dekorflate og produksjonsteknikk bekreftes skriftlig — og med prøvetrykk.
          </Typography>
        </Alert>
      </Stack>
    </Box>
  );
};

export default MerchMockupPreview;
