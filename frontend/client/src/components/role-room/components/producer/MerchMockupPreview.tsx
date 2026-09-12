/**
 * Role Room merch concept studio.
 *
 * Connects verified brand/logo data to a real Printful catalog variant,
 * product-specific production constraints, provider renders and persisted
 * project decisions. The deterministic concept stays available when the
 * optional provider is not configured.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArchiveOutlined as ArchiveIcon,
  CheckCircleOutline as ApproveIcon,
  Refresh as RefreshIcon,
  SaveOutlined as SaveIcon,
  ZoomIn as ZoomIcon,
} from '@mui/icons-material';
import {
  generateMerchMockup,
  getMerchCatalog,
  getMerchMockupStatus,
  listMerchConcepts,
  MerchMockupError,
  saveMerchConcept,
  setMerchConceptStatus,
  type MerchCatalogVariant,
  type MerchConceptRecord,
  type MerchLogoVariant,
  type MerchMockupProductId,
  type MerchProductSpec,
  type MerchProductionTechnique,
} from '../../services/roleRoomAgentClaudeApi';
import tshirtConceptImage from '../../../../assets/role-room/merch-concepts/blank-tshirt-cutout-v2.webp';
import hoodieConceptImage from '../../../../assets/role-room/merch-concepts/blank-hoodie-cutout-v2.webp';
import poloConceptImage from '../../../../assets/role-room/merch-concepts/blank-polo-cutout-v2.webp';
import capConceptImage from '../../../../assets/role-room/merch-concepts/blank-cap-cutout-v2.webp';
import totebagConceptImage from '../../../../assets/role-room/merch-concepts/blank-totebag-cutout-v2.webp';
import mugConceptImage from '../../../../assets/role-room/merch-concepts/blank-mug-cutout-v2.webp';
import type {
  RoleRoomAgentMerchProductCategory,
  RoleRoomAgentMerchRecommendation,
  RoleRoomAgentMerchSupplier,
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';

interface MerchMockupPreviewProps {
  projectId: string | null;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  selectedSupplier?: RoleRoomAgentMerchSupplier | null;
}

const PRODUCT_OPTIONS: ReadonlyArray<{
  id: MerchMockupProductId;
  label: string;
  categories: RoleRoomAgentMerchProductCategory[];
}> = [
  { id: 'tshirt', label: 'T-skjorte', categories: ['apparel'] },
  { id: 'hoodie', label: 'Hettegenser', categories: ['apparel'] },
  { id: 'polo', label: 'Polo', categories: ['apparel'] },
  { id: 'cap', label: 'Caps', categories: ['headwear'] },
  { id: 'totebag', label: 'Totebag', categories: ['bags'] },
  { id: 'mug', label: 'Krus', categories: ['drinkware'] },
];

const CONCEPT_PRODUCT_IMAGES: Record<MerchMockupProductId, string> = {
  tshirt: tshirtConceptImage,
  hoodie: hoodieConceptImage,
  polo: poloConceptImage,
  cap: capConceptImage,
  totebag: totebagConceptImage,
  mug: mugConceptImage,
};

const CONCEPT_LOGO_LAYOUT: Record<MerchMockupProductId, { left: string; top: string; width: string; height: string }> = {
  tshirt: { left: '39%', top: '34%', width: '22%', height: '17%' },
  hoodie: { left: '40%', top: '33%', width: '20%', height: '15%' },
  polo: { left: '56%', top: '35%', width: '13%', height: '11%' },
  cap: { left: '41%', top: '38%', width: '18%', height: '13%' },
  totebag: { left: '38%', top: '43%', width: '24%', height: '19%' },
  mug: { left: '33%', top: '40%', width: '22%', height: '20%' },
};

const STANDARD_CONCEPT_COLORS = [
  { label: 'Hvit', hex: '#F7F4ED' },
  { label: 'Sort', hex: '#171717' },
  { label: 'Marine', hex: '#172554' },
  { label: 'Gråmelert', hex: '#9CA3AF' },
] as const;

const PRIORITY_LABEL = {
  primary: 'Start her',
  secondary: 'Nummer to',
  experimental: 'Testidé',
} as const;

const TECHNIQUE_LABEL: Record<MerchProductionTechnique, string> = {
  screen_print: 'Silketrykk',
  dtg: 'DTG',
  dtfilm: 'DTF/DTFlex',
  embroidery: 'Broderi',
  cut_sew: 'All-over / cut & sew',
  sublimation: 'Sublimering',
  vinyl: 'Vinyl/transfer',
  promo_products: 'Promo-produkt',
};

const LOGO_VARIANT_LABEL: Record<MerchLogoVariant, string> = {
  original: 'Original logo',
  light: 'Hvit logo',
  dark: 'Mørk logo',
};

const FALLBACK_PRODUCT_SPECS: Record<MerchMockupProductId, MerchProductSpec> = {
  tshirt: {
    productId: 'tshirt', label: 'T-skjorte', provider: 'printful', providerProductId: 71,
    defaultVariantId: 4011, defaultColorName: 'White', defaultColorHex: '#FFFFFF',
    techniques: ['dtg', 'dtfilm', 'embroidery'],
    placements: [
      { id: 'front', label: 'Front', maxWidthMm: 300, maxHeightMm: 400, defaultWidthMm: 220, defaultHeightMm: 180, techniques: ['dtg', 'dtfilm'] },
      { id: 'back', label: 'Rygg', maxWidthMm: 300, maxHeightMm: 400, defaultWidthMm: 250, defaultHeightMm: 220, techniques: ['dtg', 'dtfilm'] },
      { id: 'left_chest', label: 'Venstre bryst', maxWidthMm: 100, maxHeightMm: 100, defaultWidthMm: 75, defaultHeightMm: 55, techniques: ['embroidery'] },
    ],
  },
  hoodie: {
    productId: 'hoodie', label: 'Hettegenser', provider: 'printful', providerProductId: 146,
    defaultVariantId: 5523, defaultColorName: 'White', defaultColorHex: '#FFFFFF',
    techniques: ['dtg', 'dtfilm', 'embroidery'],
    placements: [
      { id: 'front', label: 'Front', maxWidthMm: 300, maxHeightMm: 360, defaultWidthMm: 220, defaultHeightMm: 170, techniques: ['dtg', 'dtfilm'] },
      { id: 'back', label: 'Rygg', maxWidthMm: 300, maxHeightMm: 400, defaultWidthMm: 250, defaultHeightMm: 220, techniques: ['dtg', 'dtfilm'] },
      { id: 'left_chest', label: 'Venstre bryst', maxWidthMm: 100, maxHeightMm: 100, defaultWidthMm: 75, defaultHeightMm: 55, techniques: ['embroidery'] },
    ],
  },
  polo: {
    productId: 'polo', label: 'Polo', provider: 'printful', providerProductId: 670,
    defaultVariantId: 16753, defaultColorName: 'Black', defaultColorHex: '#171717',
    techniques: ['embroidery', 'dtfilm'],
    placements: [
      { id: 'left_chest', label: 'Venstre bryst', maxWidthMm: 100, maxHeightMm: 100, defaultWidthMm: 75, defaultHeightMm: 55, techniques: ['embroidery', 'dtfilm'] },
    ],
  },
  cap: {
    productId: 'cap', label: 'Caps', provider: 'printful', providerProductId: 92,
    defaultVariantId: 4622, defaultColorName: 'Black', defaultColorHex: '#171717',
    techniques: ['embroidery'],
    placements: [
      { id: 'front', label: 'Frontpanel', maxWidthMm: 100, maxHeightMm: 50, defaultWidthMm: 75, defaultHeightMm: 35, techniques: ['embroidery'] },
      { id: 'back', label: 'Bak', maxWidthMm: 100, maxHeightMm: 50, defaultWidthMm: 60, defaultHeightMm: 30, techniques: ['embroidery'] },
    ],
  },
  totebag: {
    productId: 'totebag', label: 'Totebag', provider: 'printful', providerProductId: 84,
    defaultVariantId: 4533, defaultColorName: 'Black', defaultColorHex: '#171717',
    techniques: ['cut_sew'],
    placements: [
      { id: 'default', label: 'All-over', maxWidthMm: 300, maxHeightMm: 300, defaultWidthMm: 220, defaultHeightMm: 180, techniques: ['cut_sew'] },
    ],
  },
  mug: {
    productId: 'mug', label: 'Krus', provider: 'printful', providerProductId: 19,
    defaultVariantId: 1320, defaultColorName: 'White', defaultColorHex: '#FFFFFF',
    techniques: ['sublimation'],
    placements: [
      { id: 'default', label: 'Side / omslag', maxWidthMm: 210, maxHeightMm: 85, defaultWidthMm: 90, defaultHeightMm: 55, techniques: ['sublimation'] },
    ],
  },
};

interface ProductionSelection {
  placement: string;
  printWidthMm: number;
  printHeightMm: number;
  technique: MerchProductionTechnique;
}

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

function supplierKeyOf(supplier: RoleRoomAgentMerchSupplier | null | undefined): string | null {
  if (!supplier) return null;
  return supplier.placeId || supplier.organizationNumber || supplier.name;
}

function parseHex(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '000000';
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number];
}

function colorDistance(left: string, right: string): number {
  const [lr, lg, lb] = parseHex(left);
  const [rr, rg, rb] = parseHex(right);
  return Math.sqrt((lr - rr) ** 2 + (lg - rg) ** 2 + (lb - rb) ** 2);
}

function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(left: string, right: string): number {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function closestCatalogVariant(variants: MerchCatalogVariant[], targetHex: string): MerchCatalogVariant | null {
  return variants.reduce<MerchCatalogVariant | null>((best, candidate) => {
    if (!best) return candidate;
    return colorDistance(candidate.colorHex, targetHex) < colorDistance(best.colorHex, targetHex) ? candidate : best;
  }, null);
}

function transparencySignal(logoUrl: string): 'likely' | 'unlikely' | 'unknown' {
  try {
    const pathname = new URL(logoUrl).pathname.toLowerCase();
    if (/\.(svg|png|webp)$/.test(pathname)) return 'likely';
    if (/\.(jpe?g)$/.test(pathname)) return 'unlikely';
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

function defaultProduction(spec: MerchProductSpec, recommendation?: RoleRoomAgentMerchRecommendation): ProductionSelection {
  const placement = spec.placements[0];
  const recommended = recommendation?.recommendedTechnique as MerchProductionTechnique | undefined;
  return {
    placement: placement.id,
    printWidthMm: placement.defaultWidthMm,
    printHeightMm: placement.defaultHeightMm,
    technique: recommended && placement.techniques.includes(recommended) ? recommended : placement.techniques[0],
  };
}

function MerchConceptVisual({
  productId,
  logoUrl,
  baseColor,
  companyName,
  providerImageUrl,
  logoVariant,
  detailView,
  placement,
  printScale,
}: {
  productId: MerchMockupProductId;
  logoUrl: string;
  baseColor: string;
  companyName: string | null;
  providerImageUrl: string | null;
  logoVariant: MerchLogoVariant;
  detailView: boolean;
  placement: string;
  printScale: number;
}) {
  const productImage = providerImageUrl || CONCEPT_PRODUCT_IMAGES[productId];
  const baseLayout = CONCEPT_LOGO_LAYOUT[productId];
  const backPlacement = placement === 'back';
  const logoFilter = logoVariant === 'light'
    ? 'brightness(0) invert(1) drop-shadow(0 2px 4px rgba(2,6,23,0.55))'
    : logoVariant === 'dark'
      ? 'brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.8))'
      : 'drop-shadow(0 0 1.5px rgba(255,255,255,0.85)) drop-shadow(0 2px 4px rgba(2,6,23,0.42))';

  return (
    <Box
      role="img"
      aria-label={`Fotorealistisk konsept av ${productId} i ${baseColor} for ${companyName ?? 'kunden'}`}
      data-testid="merch-photoreal-concept"
      data-product={productId}
      data-color={baseColor}
      data-source={providerImageUrl ? 'printful-catalog' : 'concept-asset'}
      sx={{ position: 'relative', width: 'min(100%, 580px)', aspectRatio: '1 / 1', isolation: 'isolate', overflow: 'hidden' }}
    >
      <Box
        sx={{
          position: 'absolute', inset: 0,
          transform: detailView ? 'scale(1.72)' : 'scale(1)',
          transformOrigin: `${baseLayout.left} ${baseLayout.top}`,
          transition: 'transform 180ms ease',
        }}
      >
        <Box
          component="img"
          src={productImage}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
            filter: providerImageUrl ? 'drop-shadow(0 24px 22px rgba(2,6,23,0.28))' : 'grayscale(1) contrast(1.04) drop-shadow(0 24px 22px rgba(2,6,23,0.34))',
            userSelect: 'none',
          }}
        />
        {!providerImageUrl ? (
          <Box
            aria-hidden
            sx={{
              position: 'absolute', inset: 0, bgcolor: baseColor,
              WebkitMaskImage: `url(${productImage})`, maskImage: `url(${productImage})`,
              WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center', maskPosition: 'center',
              WebkitMaskSize: 'contain', maskSize: 'contain',
              mixBlendMode: 'multiply', opacity: 0.9, pointerEvents: 'none',
            }}
          />
        ) : null}
        <Box
          sx={{
            position: 'absolute',
            ...baseLayout,
            top: backPlacement ? '37%' : baseLayout.top,
            transform: `scale(${Math.max(0.55, Math.min(1.5, printScale))})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none',
          }}
        >
          <Box
            component="img"
            data-testid="merch-concept-logo"
            src={logoUrl}
            alt=""
            aria-hidden
            sx={{ width: '100%', height: '100%', objectFit: 'contain', filter: logoFilter, opacity: 0.97 }}
          />
        </Box>
      </Box>
    </Box>
  );
}

const MerchMockupPreview: React.FC<MerchMockupPreviewProps> = ({ projectId, bootstrap, selectedSupplier }) => {
  const logoUrl = useMemo(() => (
    bootstrap?.planningDraft?.brandGuide?.logoUrl || bootstrap?.companyProfile?.logoUrl || null
  ), [bootstrap]);
  const companyName = bootstrap?.companyProfile?.companyName ?? null;
  const recommendations = bootstrap?.merchSuppliers?.recommendations ?? [];
  const brandColors = bootstrap?.planningDraft?.brandGuide?.colors ?? [];
  const suppliers = bootstrap?.merchSuppliers?.suppliers ?? [];
  const validBrandColors = brandColors.filter((color) => /^#[0-9a-f]{6}$/i.test(color.hex));
  const brandPrimaryColor = validBrandColors.find((color) => /primær|primary/i.test(color.label))?.hex
    || validBrandColors.find((color) => /mørk|dark/i.test(color.label))?.hex
    || validBrandColors[0]?.hex
    || '#172554';
  const conceptColorOptions = [...validBrandColors, ...STANDARD_CONCEPT_COLORS]
    .filter((color, index, colors) => colors.findIndex((candidate) => candidate.hex.toLowerCase() === color.hex.toLowerCase()) === index);

  const availableProducts = useMemo(() => {
    if (!selectedSupplier || selectedSupplier.productCategories.length === 0) return PRODUCT_OPTIONS;
    const supplierCategories = new Set(selectedSupplier.productCategories);
    const filtered = PRODUCT_OPTIONS.filter((product) => product.categories.some((category) => supplierCategories.has(category)));
    return filtered.length > 0 ? filtered : PRODUCT_OPTIONS;
  }, [selectedSupplier]);
  const preferredProductId = recommendations.find((entry) => entry.priority === 'primary')?.productId;
  const initialProductId = availableProducts.find((entry) => entry.id === preferredProductId)?.id
    ?? availableProducts[0]?.id ?? 'tshirt';

  const [productId, setProductId] = useState<MerchMockupProductId>(initialProductId);
  const [productSpecs, setProductSpecs] = useState<MerchProductSpec[]>(Object.values(FALLBACK_PRODUCT_SPECS));
  const [printfulConfigured, setPrintfulConfigured] = useState<boolean | null>(null);
  const [targetColorOverrides, setTargetColorOverrides] = useState<Partial<Record<MerchMockupProductId, string>>>({});
  const [variantOverrides, setVariantOverrides] = useState<Partial<Record<MerchMockupProductId, number>>>({});
  const [productionOverrides, setProductionOverrides] = useState<Partial<Record<MerchMockupProductId, ProductionSelection>>>({});
  const [logoVariant, setLogoVariant] = useState<MerchLogoVariant>('original');
  const [detailView, setDetailView] = useState(false);
  const [catalogVariants, setCatalogVariants] = useState<MerchCatalogVariant[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [mockupUrls, setMockupUrls] = useState<string[]>([]);
  const [activeMockupIndex, setActiveMockupIndex] = useState(0);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MerchMockupError | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [savedConcepts, setSavedConcepts] = useState<MerchConceptRecord[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localCacheRef = useRef<Map<string, string[]>>(new Map());

  const productSpec = productSpecs.find((spec) => spec.productId === productId) ?? FALLBACK_PRODUCT_SPECS[productId];
  const recommendation = recommendations.find((entry) => entry.productId === productId);
  const production = productionOverrides[productId] ?? defaultProduction(productSpec, recommendation);
  const placementSpec = productSpec.placements.find((entry) => entry.id === production.placement) ?? productSpec.placements[0];
  const targetColor = (targetColorOverrides[productId] ?? brandPrimaryColor).toUpperCase();
  const manualVariant = catalogVariants.find((variant) => variant.id === variantOverrides[productId]);
  const selectedCatalogVariant = manualVariant ?? closestCatalogVariant(catalogVariants, targetColor);
  const displayedColor = selectedCatalogVariant?.colorHex ?? targetColor;
  const matchScore = selectedCatalogVariant
    ? (() => {
      const distance = colorDistance(targetColor, selectedCatalogVariant.colorHex);
      return distance === 0 ? 100 : Math.min(99, Math.max(0, Math.round(100 - (distance / 441.67) * 100)));
    })()
    : null;
  const isLogoMatchedColor = targetColorOverrides[productId] === undefined && variantOverrides[productId] === undefined;
  const originalLogoRepresentative = validBrandColors.find((color) => color.hex.toUpperCase() !== targetColor)?.hex
    ?? validBrandColors[0]?.hex ?? '#FFFFFF';
  const effectiveLogoColor = logoVariant === 'light' ? '#FFFFFF' : logoVariant === 'dark' ? '#111827' : originalLogoRepresentative;
  const logoContrast = contrastRatio(displayedColor, effectiveLogoColor);
  const transparency = logoUrl ? transparencySignal(logoUrl) : 'unknown';
  const providerImageUrl = selectedCatalogVariant?.imageUrl ?? null;
  const printScale = production.printWidthMm / Math.max(1, placementSpec.defaultWidthMm);

  const setProduction = useCallback((next: ProductionSelection) => {
    setProductionOverrides((current) => ({ ...current, [productId]: next }));
  }, [productId]);

  useEffect(() => {
    if (!availableProducts.some((product) => product.id === productId)) {
      setProductId(availableProducts[0]?.id ?? 'tshirt');
    }
  }, [availableProducts, productId]);

  useEffect(() => {
    const currentPlacement = productSpec.placements.find((entry) => entry.id === production.placement);
    if (!currentPlacement) {
      setProduction(defaultProduction(productSpec, recommendation));
      return;
    }
    if (!currentPlacement.techniques.includes(production.technique)) {
      setProduction({ ...production, technique: currentPlacement.techniques[0] });
    }
  }, [productSpec, production, recommendation, setProduction]);

  useEffect(() => {
    let active = true;
    setPrintfulConfigured(null);
    if (!projectId) return () => { active = false; };
    void getMerchMockupStatus(projectId)
      .then((status) => {
        if (!active) return;
        setPrintfulConfigured(status.configured);
        if (status.products.length > 0) setProductSpecs(status.products);
      })
      .catch(() => { if (active) setPrintfulConfigured(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setCatalogVariants([]);
    setCatalogError(null);
    if (!projectId || printfulConfigured !== true) return () => { active = false; };
    setCatalogLoading(true);
    void getMerchCatalog({ projectId, productId })
      .then((result) => { if (active) setCatalogVariants(result.variants); })
      .catch((catalogFailure) => {
        if (active) setCatalogError(catalogFailure instanceof Error ? catalogFailure.message : 'Kunne ikke hente katalogfarger.');
      })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [printfulConfigured, productId, projectId]);

  const reloadConcepts = useCallback(async () => {
    if (!projectId) return;
    setConceptsLoading(true);
    try {
      setSavedConcepts(await listMerchConcepts(projectId));
    } catch (conceptFailure) {
      setSaveError(conceptFailure instanceof Error ? conceptFailure.message : 'Kunne ikke hente lagrede konsepter.');
    } finally {
      setConceptsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reloadConcepts(); }, [reloadConcepts]);

  const cacheKey = useMemo(() => [
    productId, logoUrl, selectedCatalogVariant?.id ?? 'concept', production.placement,
    production.technique, production.printWidthMm, production.printHeightMm,
  ].join('|'), [logoUrl, productId, production, selectedCatalogVariant?.id]);

  useEffect(() => {
    const local = localCacheRef.current.get(cacheKey) ?? [];
    setMockupUrls(local);
    setActiveMockupIndex(0);
    setCached(local.length > 0);
    setError(null);
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); };
  }, [cacheKey]);

  const runFetch = useCallback(async (force = false) => {
    if (!projectId || !logoUrl || printfulConfigured !== true || logoVariant !== 'original') return;
    if (!force && localCacheRef.current.has(cacheKey)) {
      const local = localCacheRef.current.get(cacheKey)!;
      setMockupUrls(local);
      setCached(true);
      return;
    }
    setLoading(true);
    setError(null);
    setMockupUrls([]);
    setElapsedSec(0);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => setElapsedSec((seconds) => seconds + 1), 1000);
    try {
      const result = await generateMerchMockup({
        projectId,
        productId,
        designImageUrl: logoUrl,
        variantId: selectedCatalogVariant?.id ?? productSpec.defaultVariantId,
        placement: production.placement,
        technique: production.technique,
        printWidthMm: production.printWidthMm,
        printHeightMm: production.printHeightMm,
        forceRefresh: force,
      });
      const urls = result.mockupUrls.length > 0 ? result.mockupUrls : [result.mockupUrl];
      setMockupUrls(urls);
      setCached(result.cached);
      setActiveMockupIndex(0);
      localCacheRef.current.set(cacheKey, urls);
    } catch (mockupFailure) {
      setError(mockupFailure instanceof MerchMockupError
        ? mockupFailure
        : new MerchMockupError({
          code: 'mockup_generation_failed',
          detail: mockupFailure instanceof Error ? mockupFailure.message : String(mockupFailure),
          httpStatus: 0,
        }));
    } finally {
      setLoading(false);
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
  }, [cacheKey, logoUrl, logoVariant, printfulConfigured, productId, productSpec.defaultVariantId, production, projectId, selectedCatalogVariant?.id]);

  const saveCurrentConcept = useCallback(async () => {
    if (!projectId || !logoUrl) return;
    setSaveBusy(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const usesProviderVariant = printfulConfigured === true && Boolean(selectedCatalogVariant);
      const result = await saveMerchConcept(projectId, {
        productId,
        supplierKey: supplierKeyOf(selectedSupplier),
        supplierName: selectedSupplier?.name ?? null,
        provider: usesProviderVariant ? 'printful' : 'concept',
        providerProductId: usesProviderVariant ? productSpec.providerProductId : null,
        providerVariantId: usesProviderVariant ? selectedCatalogVariant?.id ?? null : null,
        providerColorName: usesProviderVariant ? selectedCatalogVariant?.colorName ?? null : null,
        providerColorHex: usesProviderVariant ? selectedCatalogVariant?.colorHex ?? null : null,
        requestedColorHex: targetColor,
        logoUrl,
        logoVariant,
        placement: production.placement,
        printWidthMm: production.printWidthMm,
        printHeightMm: production.printHeightMm,
        technique: production.technique,
        mockupUrls,
      });
      setSavedConcepts((current) => [result.concept, ...current.filter((entry) => entry.id !== result.concept.id)]);
      setSaveNotice(result.deduplicated ? 'Identisk konsept fantes allerede og ble oppdatert uten duplikat.' : 'Konseptet er lagret i prosjektet.');
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Kunne ikke lagre konseptet.');
    } finally {
      setSaveBusy(false);
    }
  }, [logoUrl, logoVariant, mockupUrls, printfulConfigured, productId, productSpec.providerProductId, production, projectId, selectedCatalogVariant, selectedSupplier, targetColor]);

  const changeConceptStatus = useCallback(async (conceptId: string, status: 'approved' | 'archived') => {
    if (!projectId) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      const updated = await setMerchConceptStatus({ projectId, conceptId, status });
      setSavedConcepts((current) => current.map((entry) => {
        if (status === 'approved' && entry.productId === updated.productId && entry.id !== updated.id && entry.status === 'approved') {
          return { ...entry, status: 'draft', approvedAt: null, approvedByUserId: null };
        }
        return entry.id === updated.id ? updated : entry;
      }));
      setSaveNotice(status === 'approved' ? 'Konseptet er godkjent som produksjonsvalg.' : 'Konseptet er arkivert.');
    } catch (statusFailure) {
      setSaveError(statusFailure instanceof Error ? statusFailure.message : 'Kunne ikke endre konseptstatus.');
    } finally {
      setSaveBusy(false);
    }
  }, [projectId]);

  if (!bootstrap) return null;
  if (!logoUrl) {
    return <Alert severity="info">Mockup-preview krever en logo fra Research-fanen. Kjør research før merch-konseptet bygges.</Alert>;
  }
  if (!projectId) return null;

  const selectedProductLabel = PRODUCT_OPTIONS.find((product) => product.id === productId)?.label ?? productId;
  const visibleConcepts = savedConcepts.filter((concept) => concept.status !== 'archived').slice(0, 6);

  return (
    <Box sx={{ p: 1.4, borderRadius: 3, border: '1px solid rgba(99,102,241,0.22)', bgcolor: 'rgba(30,27,75,0.36)' }}>
      <Stack spacing={1.4}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={0.8}>
          <Box>
            <Typography sx={{ color: '#f8fafc', fontWeight: 850 }}>
              Merch-konseptstudio{companyName ? ` · ${companyName}` : ''}
              {selectedSupplier ? <Chip size="small" label={`for ${selectedSupplier.name}`} sx={{ ml: 1, bgcolor: 'rgba(99,102,241,0.22)', color: '#e0e7ff', fontWeight: 700 }} /> : null}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.82rem' }}>
              Faktisk logo, merkevarefarge, nærmeste katalogvariant og produksjonsvalg i én prosjektlagret flyt.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.6} alignItems="center">
            <Chip
              size="small"
              label={printfulConfigured === null ? 'Sjekker Printful …' : printfulConfigured ? 'Printful-katalog tilkoblet' : 'Konseptmodus'}
              sx={{ bgcolor: printfulConfigured ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.14)', color: printfulConfigured ? '#bbf7d0' : '#cbd5e1' }}
            />
            <Button size="small" variant="contained" startIcon={saveBusy ? <CircularProgress size={13} /> : <SaveIcon />} onClick={() => void saveCurrentConcept()} disabled={saveBusy} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Lagre konsept
            </Button>
          </Stack>
        </Stack>

        {saveNotice ? <Alert severity="success" onClose={() => setSaveNotice(null)}>{saveNotice}</Alert> : null}
        {saveError ? <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert> : null}

        {recommendations.length > 0 ? (
          <Stack spacing={0.7}>
            <Typography sx={{ color: '#cbd5e1', fontWeight: 800, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Anbefalt merch-pakke for denne bedriften
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} flexWrap="wrap" useFlexGap>
              {recommendations.map((entry) => {
                const active = productId === entry.productId;
                const documented = hasWebsiteDocumentedSupplierMatch(entry, suppliers);
                return (
                  <Box
                    component="button"
                    type="button"
                    key={entry.productId}
                    onClick={() => setProductId(entry.productId)}
                    sx={{
                      flex: { xs: '0 0 auto', md: '1 1 220px' }, minWidth: 0, p: 1, textAlign: 'left', cursor: 'pointer', color: 'inherit', borderRadius: 2,
                      border: active ? '1px solid rgba(99,102,241,0.7)' : '1px solid rgba(148,163,184,0.18)',
                      bgcolor: active ? 'rgba(49,46,129,0.34)' : 'rgba(15,23,42,0.45)',
                    }}
                  >
                    <Stack spacing={0.4}>
                      <Stack direction="row" spacing={0.5} justifyContent="space-between" alignItems="center">
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.86rem' }}>{entry.productLabel}</Typography>
                        <Chip size="small" label={PRIORITY_LABEL[entry.priority]} sx={{ height: 20, color: '#c7d2fe', bgcolor: 'rgba(99,102,241,0.18)', fontSize: '0.65rem' }} />
                      </Stack>
                      <Typography sx={{ color: '#a5f3fc', fontSize: '0.74rem', fontWeight: 700 }}>{entry.purpose}</Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.7rem', lineHeight: 1.4 }}>{entry.rationale}</Typography>
                      <Typography sx={{ color: documented ? '#bbf7d0' : '#fde68a', fontSize: '0.68rem' }}>
                        {documented && entry.supplierMatch ? `Nettsidebekreftet hos ${entry.supplierMatch.name}` : 'Leverandør må bekrefte produkt og teknikk'}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        ) : null}

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {availableProducts.map((product) => (
            <Chip key={product.id} size="small" clickable label={product.label} onClick={() => setProductId(product.id)} disabled={loading}
              sx={{ bgcolor: productId === product.id ? 'rgba(99,102,241,0.32)' : 'rgba(15,23,42,0.6)', color: productId === product.id ? '#e0e7ff' : '#cbd5e1', fontWeight: productId === product.id ? 800 : 500 }} />
          ))}
        </Stack>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2} alignItems="stretch">
          <Stack spacing={1.1} sx={{ flex: '1 1 360px', minWidth: 0 }}>
            <Box sx={{ p: 1, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', bgcolor: 'rgba(15,23,42,0.4)' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 62, height: 62, borderRadius: 1.2, bgcolor: '#fff', backgroundImage: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)', backgroundSize: '12px 12px', backgroundPosition: '0 0,0 6px,6px -6px,-6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  <Box component="img" src={logoUrl} alt="Logo brukt på merch" sx={{ maxWidth: '94%', maxHeight: '94%', objectFit: 'contain' }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.82rem' }}>Faktisk kundelogo</Typography>
                  <Typography title={logoUrl} sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{logoUrl}</Typography>
                  <Typography sx={{ color: transparency === 'likely' ? '#bbf7d0' : '#fde68a', fontSize: '0.68rem' }}>
                    {transparency === 'likely' ? 'Formatet kan støtte transparent bakgrunn' : transparency === 'unlikely' ? 'JPG har ikke transparent bakgrunn – bruk SVG/PNG/WebP før produksjon' : 'Transparent bakgrunn må kontrolleres visuelt'}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.9 }}>
                {(Object.keys(LOGO_VARIANT_LABEL) as MerchLogoVariant[]).map((variant) => (
                  <Chip key={variant} size="small" clickable label={LOGO_VARIANT_LABEL[variant]} onClick={() => setLogoVariant(variant)}
                    sx={{ bgcolor: logoVariant === variant ? 'rgba(34,211,238,0.22)' : 'rgba(15,23,42,0.52)', color: logoVariant === variant ? '#a5f3fc' : '#cbd5e1' }} />
                ))}
              </Stack>
            </Box>

            <Box sx={{ p: 1, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', bgcolor: 'rgba(15,23,42,0.4)' }} data-testid="merch-concept-color-picker">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.4} justifyContent="space-between">
                <Typography sx={{ color: '#cbd5e1', fontWeight: 800, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Merkevarefarge</Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.7rem' }}>{isLogoMatchedColor ? 'Matchet fra logo-paletten' : `Valgt · ${targetColor}`}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
                <Chip size="small" clickable label="Match logo" onClick={() => {
                  setTargetColorOverrides((current) => { const next = { ...current }; delete next[productId]; return next; });
                  setVariantOverrides((current) => { const next = { ...current }; delete next[productId]; return next; });
                }} sx={{ color: isLogoMatchedColor ? '#e0e7ff' : '#cbd5e1', bgcolor: isLogoMatchedColor ? 'rgba(99,102,241,0.32)' : 'rgba(15,23,42,0.62)', fontWeight: isLogoMatchedColor ? 800 : 600 }} />
                {conceptColorOptions.map((color) => (
                  <Box component="button" type="button" key={`${color.label}-${color.hex}`} aria-label={`Velg ${color.label} ${color.hex}`} onClick={() => {
                    setTargetColorOverrides((current) => ({ ...current, [productId]: color.hex.toUpperCase() }));
                    setVariantOverrides((current) => { const next = { ...current }; delete next[productId]; return next; });
                  }} sx={{ height: 30, px: 0.65, display: 'inline-flex', alignItems: 'center', gap: 0.55, borderRadius: 999, cursor: 'pointer', color: '#e2e8f0', bgcolor: targetColor === color.hex.toUpperCase() && !isLogoMatchedColor ? 'rgba(99,102,241,0.28)' : 'rgba(15,23,42,0.62)', border: '1px solid rgba(148,163,184,0.24)' }}>
                    <Box aria-hidden sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: color.hex, border: '1px solid rgba(255,255,255,0.5)' }} />
                    <Typography component="span" sx={{ fontSize: '0.66rem', fontWeight: 700 }}>{color.label} · {color.hex.toUpperCase()}</Typography>
                  </Box>
                ))}
                <Box component="label" title="Velg egen farge" sx={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', background: 'conic-gradient(#ef4444,#facc15,#22c55e,#06b6d4,#6366f1,#d946ef,#ef4444)', border: '1px solid rgba(255,255,255,0.48)' }}>
                  <Box component="input" type="color" aria-label="Velg egen plaggfarge" value={targetColor} onChange={(event) => {
                    setTargetColorOverrides((current) => ({ ...current, [productId]: event.target.value.toUpperCase() }));
                    setVariantOverrides((current) => { const next = { ...current }; delete next[productId]; return next; });
                  }} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </Box>
              </Stack>

              <Divider sx={{ my: 1, borderColor: 'rgba(148,163,184,0.14)' }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#cbd5e1', fontWeight: 800, fontSize: '0.74rem' }}>Reell Printful-variant</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.68rem' }}>
                    {catalogLoading ? 'Henter katalogfarger …' : selectedCatalogVariant ? `${selectedCatalogVariant.colorName} · ${selectedCatalogVariant.colorHex} · match ${matchScore}%` : 'Ikke tilgjengelig – konseptfargen brukes'}
                  </Typography>
                </Box>
                {catalogLoading ? <CircularProgress size={18} /> : catalogVariants.length > 0 ? (
                  <TextField select SelectProps={{ native: true }} size="small" label="Katalogfarge" value={selectedCatalogVariant?.id ?? ''} onChange={(event) => {
                    const id = Number(event.target.value);
                    const variant = catalogVariants.find((entry) => entry.id === id);
                    if (!variant) return;
                    setVariantOverrides((current) => ({ ...current, [productId]: variant.id }));
                    setTargetColorOverrides((current) => ({ ...current, [productId]: variant.colorHex }));
                  }} sx={{ minWidth: 210, '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}>
                    {catalogVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.colorName} · {variant.colorHex}</option>)}
                  </TextField>
                ) : null}
              </Stack>
              {catalogError ? <Alert severity="warning" sx={{ mt: 0.8 }}>{catalogError}</Alert> : null}
              {selectedCatalogVariant && targetColor !== selectedCatalogVariant.colorHex ? (
                <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
                  <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.7rem' }}><Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', bgcolor: targetColor, mr: 0.5 }} />Ønsket {targetColor}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.7rem' }}><Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', bgcolor: selectedCatalogVariant.colorHex, mr: 0.5 }} />Tilgjengelig {selectedCatalogVariant.colorHex}</Typography>
                </Stack>
              ) : null}
            </Box>

            <Box sx={{ p: 1, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', bgcolor: 'rgba(15,23,42,0.4)' }}>
              <Typography sx={{ color: '#cbd5e1', fontWeight: 800, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Produksjonskontroll</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
                {productSpec.placements.map((placement) => (
                  <Chip key={placement.id} size="small" clickable label={placement.label} onClick={() => setProduction({ ...production, placement: placement.id, technique: placement.techniques.includes(production.technique) ? production.technique : placement.techniques[0], printWidthMm: placement.defaultWidthMm, printHeightMm: placement.defaultHeightMm })}
                    sx={{ bgcolor: production.placement === placement.id ? 'rgba(34,211,238,0.22)' : 'rgba(15,23,42,0.52)', color: production.placement === placement.id ? '#a5f3fc' : '#cbd5e1' }} />
                ))}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} sx={{ mt: 0.9 }}>
                <TextField size="small" type="number" label="Bredde (mm)" value={production.printWidthMm} inputProps={{ min: 10, max: placementSpec.maxWidthMm }} onChange={(event) => setProduction({ ...production, printWidthMm: Math.max(10, Math.min(placementSpec.maxWidthMm, Number(event.target.value) || 10)) })} sx={{ flex: 1, '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }} />
                <TextField size="small" type="number" label="Høyde (mm)" value={production.printHeightMm} inputProps={{ min: 10, max: placementSpec.maxHeightMm }} onChange={(event) => setProduction({ ...production, printHeightMm: Math.max(10, Math.min(placementSpec.maxHeightMm, Number(event.target.value) || 10)) })} sx={{ flex: 1, '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: '#94a3b8' } }} />
              </Stack>
              <Typography sx={{ color: 'rgba(226,232,240,0.48)', fontSize: '0.67rem', mt: 0.35 }}>Maks {placementSpec.maxWidthMm} × {placementSpec.maxHeightMm} mm på {placementSpec.label.toLowerCase()}.</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
                {placementSpec.techniques.map((technique) => (
                  <Chip key={technique} size="small" clickable label={TECHNIQUE_LABEL[technique]} onClick={() => setProduction({ ...production, technique })}
                    sx={{ bgcolor: production.technique === technique ? 'rgba(99,102,241,0.28)' : 'rgba(15,23,42,0.52)', color: production.technique === technique ? '#e0e7ff' : '#cbd5e1' }} />
                ))}
              </Stack>
            </Box>

            {logoContrast < 3 ? <Alert severity="warning">{logoVariant === 'original' ? 'Estimert ' : ''}logo-/plaggkontrast ({logoContrast.toFixed(1)}:1). Velg lys/mørk logovariant eller en annen produktfarge.</Alert> : <Alert severity="success">{logoVariant === 'original' ? 'Estimert ' : ''}logo-/plaggkontrast: {logoContrast.toFixed(1)}:1.</Alert>}
            {logoVariant !== 'original' ? <Alert severity="info">Hvit/mørk logo er en lokal konseptvariant. Printful-render krever en ferdig eksportert logofil i valgt variant.</Alert> : null}
            {production.placement === 'back' ? <Alert severity="info">Lokalvisningen simulerer plasseringen. Bruk Printful-renderen under for å kontrollere faktisk ryggtrykk.</Alert> : null}
          </Stack>

          <Stack spacing={0.8} sx={{ flex: '1.25 1 480px', minWidth: 0 }}>
            <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: 420, p: 2, borderRadius: 2, border: '1px solid rgba(34,211,238,0.2)', backgroundColor: 'rgba(15,23,42,0.82)', backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(99,102,241,0.3), transparent 42%),linear-gradient(rgba(148,163,184,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.045) 1px,transparent 1px)', backgroundSize: 'auto,28px 28px,28px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ position: 'absolute', top: 12, left: 12, right: 12, justifyContent: 'space-between', zIndex: 3 }}>
                <Chip size="small" label={providerImageUrl ? 'Reell katalogvariant · konsepttrykk' : 'Fotorealistisk konsept · ikke produksjonsbevis'} sx={{ height: 'auto', maxWidth: '100%', color: '#a5f3fc', bgcolor: 'rgba(8,47,73,0.78)', fontWeight: 700, '& .MuiChip-label': { display: 'block', whiteSpace: 'normal', py: 0.35 } }} />
                <Button size="small" variant="outlined" startIcon={<ZoomIcon />} onClick={() => setDetailView((current) => !current)} sx={{ textTransform: 'none', color: '#e2e8f0', borderColor: 'rgba(226,232,240,0.3)' }}>{detailView ? 'Helhet' : 'Trykkdetalj'}</Button>
              </Stack>
              <MerchConceptVisual productId={productId} logoUrl={logoUrl} baseColor={displayedColor} companyName={companyName} providerImageUrl={providerImageUrl} logoVariant={logoVariant} detailView={detailView} placement={production.placement} printScale={printScale} />
              <Stack direction="row" spacing={0.65} alignItems="center" justifyContent="center">
                <Box data-testid="merch-concept-exact-color" data-color={displayedColor} aria-label={`Eksakt valgt farge ${displayedColor}`} sx={{ width: 16, height: 16, flexShrink: 0, borderRadius: '50%', bgcolor: displayedColor, border: '1px solid rgba(255,255,255,0.64)' }} />
                <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.72rem', textAlign: 'center' }}>{selectedProductLabel} · {displayedColor} · {placementSpec.label} · {production.printWidthMm} × {production.printHeightMm} mm · {TECHNIQUE_LABEL[production.technique]}</Typography>
              </Stack>
            </Box>

            <Box sx={{ p: 1, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', bgcolor: 'rgba(15,23,42,0.55)' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={0.7}>
                <Box>
                  <Typography sx={{ color: '#cbd5e1', fontWeight: 800, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Printful-leverandørmockup</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.68rem' }}>Faktisk variant, plassering og trykkmål. Fortsatt ikke et godkjent prøvetrykk.</Typography>
                </Box>
                <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => void runFetch(mockupUrls.length > 0 || Boolean(error))} disabled={loading || printfulConfigured !== true || logoVariant !== 'original'} sx={{ textTransform: 'none' }}>
                  {loading ? `Renderer … ${elapsedSec}s` : mockupUrls.length > 0 ? 'Rendre på nytt' : 'Lag leverandørmockup'}
                </Button>
              </Stack>
              <Box sx={{ minHeight: 280, mt: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, bgcolor: 'rgba(2,6,23,0.45)', overflow: 'hidden' }}>
                {printfulConfigured === false ? <Alert severity="info">Printful er ikke koblet. Konsept, produksjonsvalg og prosjektlagring fungerer fortsatt.</Alert>
                  : loading ? <CircularProgress size={30} />
                    : error ? <Alert severity="error">{error.detail}</Alert>
                      : mockupUrls[activeMockupIndex] ? <Box component="img" src={mockupUrls[activeMockupIndex]} alt={`Printful-mockup ${activeMockupIndex + 1}`} sx={{ width: '100%', maxHeight: 430, objectFit: 'contain' }} />
                        : <Typography sx={{ color: 'rgba(226,232,240,0.44)' }}>Ingen leverandørmockup laget ennå</Typography>}
              </Box>
              {mockupUrls.length > 1 ? (
                <Stack direction="row" spacing={0.6} sx={{ mt: 0.7, overflowX: 'auto' }}>
                  {mockupUrls.map((url, index) => <Box component="button" type="button" key={url} onClick={() => setActiveMockupIndex(index)} sx={{ p: 0, width: 72, height: 72, borderRadius: 1, overflow: 'hidden', cursor: 'pointer', border: index === activeMockupIndex ? '2px solid #67e8f9' : '1px solid rgba(148,163,184,0.24)', bgcolor: '#0f172a' }}><Box component="img" src={url} alt={`Mockup-visning ${index + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Box>)}
                </Stack>
              ) : null}
              {cached ? <Chip size="small" label="Hentet fra deduplisert render-cache" sx={{ mt: 0.7, color: '#bbf7d0', bgcolor: 'rgba(34,197,94,0.12)' }} /> : null}
            </Box>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
        <Stack spacing={0.8}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography sx={{ color: '#f8fafc', fontWeight: 850 }}>Lagrede konsepter · sammenlign og godkjenn</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.52)', fontSize: '0.72rem' }}>Identiske produksjonsvalg oppdateres, de dupliseres ikke. Ett godkjent konsept per produkttype.</Typography>
            </Box>
            {conceptsLoading ? <CircularProgress size={18} /> : <Chip size="small" label={`${visibleConcepts.length} aktive`} sx={{ color: '#cbd5e1', bgcolor: 'rgba(148,163,184,0.14)' }} />}
          </Stack>
          {visibleConcepts.length === 0 && !conceptsLoading ? <Alert severity="info">Lagre første konsept for å sammenligne farge, variant, plassering og produksjonsteknikk.</Alert> : null}
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} flexWrap="wrap" useFlexGap>
            {visibleConcepts.map((concept) => (
              <Box key={concept.id} sx={{ flex: '1 1 270px', minWidth: 0, p: 1, borderRadius: 2, border: concept.status === 'approved' ? '1px solid rgba(34,197,94,0.55)' : '1px solid rgba(148,163,184,0.18)', bgcolor: concept.status === 'approved' ? 'rgba(6,78,59,0.16)' : 'rgba(15,23,42,0.45)' }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                    <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{PRODUCT_OPTIONS.find((entry) => entry.id === concept.productId)?.label ?? concept.productId}</Typography>
                    <Chip size="small" label={concept.status === 'approved' ? 'Godkjent' : 'Utkast'} sx={{ color: concept.status === 'approved' ? '#bbf7d0' : '#cbd5e1', bgcolor: concept.status === 'approved' ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.12)' }} />
                  </Stack>
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: concept.providerColorHex || concept.requestedColorHex, border: '1px solid rgba(255,255,255,0.55)' }} />
                    <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.72rem' }}>{concept.providerColorName || 'Konseptfarge'} · {concept.providerColorHex || concept.requestedColorHex}</Typography>
                  </Stack>
                  <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.7rem' }}>{concept.placement} · {concept.printWidthMm} × {concept.printHeightMm} mm · {TECHNIQUE_LABEL[concept.technique]}</Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.48)', fontSize: '0.68rem' }}>{LOGO_VARIANT_LABEL[concept.logoVariant]}{concept.supplierName ? ` · ${concept.supplierName}` : ''}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    {concept.status !== 'approved' ? <Button size="small" startIcon={<ApproveIcon />} onClick={() => void changeConceptStatus(concept.id, 'approved')} disabled={saveBusy} sx={{ textTransform: 'none' }}>Godkjenn</Button> : null}
                    <Button size="small" color="inherit" startIcon={<ArchiveIcon />} onClick={() => void changeConceptStatus(concept.id, 'archived')} disabled={saveBusy} sx={{ textTransform: 'none', color: '#94a3b8' }}>Arkiver</Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>

        <Alert severity="info" icon={false} sx={{ bgcolor: 'rgba(14,116,144,0.09)', color: '#cbd5e1', border: '1px solid rgba(34,211,238,0.18)' }}>
          <Typography sx={{ color: '#e0f2fe', fontWeight: 800, fontSize: '0.78rem', mb: 0.25 }}>Produksjonsgrense</Typography>
          <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.55 }}>Katalogvariant, fargekode og trykkmål gjør konseptet etterprøvbart, men leverandøren må fortsatt bekrefte artikkelnummer, lagerstatus, materiale, stoffvekt, passform, dekorflate og prøvetrykk skriftlig før bestilling.</Typography>
        </Alert>
      </Stack>
    </Box>
  );
};

export default MerchMockupPreview;
