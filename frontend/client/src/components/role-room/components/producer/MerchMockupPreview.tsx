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

  // Fetch on product change (and on mount when logo + project both exist).
  useEffect(() => {
    void runFetch();
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [runFetch]);

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
              Fotorealistisk mockup{companyName ? ` · ${companyName}` : ''}
              {selectedSupplier ? (
                <Chip
                  size="small"
                  label={`for ${selectedSupplier.name}`}
                  sx={{ ml: 1, bgcolor: 'rgba(99,102,241,0.22)', color: '#e0e7ff', fontWeight: 700 }}
                />
              ) : null}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.82rem' }}>
              Logo rendret av Printful Mockup Generator. Bruk i pitch — leverandøren leverer eget prøvetrykk
              før produksjon.
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
              onClick={() => void runFetch(true)}
              disabled={loading || !logoUrl}
              sx={{
                textTransform: 'none',
                color: '#cbd5e1',
                borderColor: 'rgba(148,163,184,0.32)',
                fontSize: '0.78rem',
                py: 0.3,
              }}
            >
              Rendre på nytt
            </Button>
          </Stack>
        </Stack>

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

        {/* Stage */}
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
