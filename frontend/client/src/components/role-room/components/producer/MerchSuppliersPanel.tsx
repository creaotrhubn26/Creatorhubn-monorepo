/**
 * MerchSuppliersPanel — renders the merch-suppliers slice of the
 * Role Room agent bootstrap result.
 *
 * Data is fetched server-side as part of the bootstrap pipeline
 * (Brreg same-NACE for printing/apparel/promo + Google Places shop
 * search). This panel is a pure renderer: pick filters, sort, show.
 *
 * Slice scope: discovery + classification only. Mockup preview and
 * Claude-powered cooperation drafts come in later slices.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CheckCircleOutline as CheckIcon,
  Handshake as HandshakeIcon,
  Language as WebIcon,
  Map as MapIcon,
  Mail as MailIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import type {
  RoleRoomAgentMerchProductCategory,
  RoleRoomAgentMerchSupplier,
  RoleRoomAgentMerchTechnique,
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';
import MerchMockupPreview from './MerchMockupPreview';
import MerchOutreachDialog from './MerchOutreachDialog';
import MerchCooperationDialog from './MerchCooperationDialog';
import CustomerEntityConfirmationDialog, {
  loadConfirmedCustomerEntity,
  type ConfirmedCustomerEntity,
} from './CustomerEntityConfirmationDialog';
import {
  listMerchPartnerEmailHistory,
  type MerchPartnerEmailLogEntry,
} from '../../services/roleRoomAgentClaudeApi';

interface MerchSuppliersPanelProps {
  projectId: string | null;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  onRequestBootstrap?: () => void;
}

function supplierKeyOf(s: RoleRoomAgentMerchSupplier): string {
  return s.placeId || s.organizationNumber || s.name;
}

const TECHNIQUE_LABEL: Record<RoleRoomAgentMerchTechnique, string> = {
  screen_print: 'Silketrykk',
  dtg: 'DTG',
  embroidery: 'Broderi',
  sublimation: 'Sublimering',
  vinyl: 'Vinyl/transfer',
  promo_products: 'Promo-produkter',
  unknown: 'Ukjent teknikk',
};

const PRODUCT_LABEL: Record<RoleRoomAgentMerchProductCategory, string> = {
  apparel: 'Klær',
  headwear: 'Caps/lue',
  bags: 'Bag',
  drinkware: 'Krus/flaske',
  stationery: 'Notatbok/penn',
  sports_kits: 'Sportsdrakter',
  promotional: 'Promo',
  vehicle_wrap: 'Bilprofilering',
  signage: 'Skilt/banner',
  unknown: 'Ukjent',
};

const STATUS_PILL: Record<RoleRoomAgentMerchSupplier['status'], { label: string; bg: string; fg: string }> = {
  verified: { label: 'Verifisert', bg: 'rgba(16,185,129,0.18)', fg: '#bbf7d0' },
  likely: { label: 'Sannsynlig', bg: 'rgba(59,130,246,0.16)', fg: '#bfdbfe' },
  needs_review: { label: 'Manuell sjekk', bg: 'rgba(250,204,21,0.16)', fg: '#fde68a' },
  rejected: { label: 'Avvist', bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1' },
};

const MerchSuppliersPanel: React.FC<MerchSuppliersPanelProps> = ({ projectId, bootstrap, onRequestBootstrap }) => {
  const merch = bootstrap?.merchSuppliers ?? null;
  const [techniqueFilter, setTechniqueFilter] = useState<RoleRoomAgentMerchTechnique | null>(null);
  const [productFilter, setProductFilter] = useState<RoleRoomAgentMerchProductCategory | null>(null);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(null);
  const [outreachSupplier, setOutreachSupplier] = useState<RoleRoomAgentMerchSupplier | null>(null);
  const [cooperationOpen, setCooperationOpen] = useState(false);
  const [confirmEntityOpen, setConfirmEntityOpen] = useState(false);
  const [confirmedEntity, setConfirmedEntity] = useState<ConfirmedCustomerEntity | null>(() =>
    loadConfirmedCustomerEntity(projectId),
  );

  // Reload confirmed entity when projectId changes.
  React.useEffect(() => {
    setConfirmedEntity(loadConfirmedCustomerEntity(projectId));
  }, [projectId]);

  // Fetch the project's send-history once so each supplier card can
  // surface "Sendt 4. mai" badges. Refreshes whenever a cooperation
  // dialog closes (cheapest hook to detect "user just sent").
  const [emailHistory, setEmailHistory] = useState<MerchPartnerEmailLogEntry[]>([]);
  const reloadEmailHistory = React.useCallback(() => {
    if (!projectId) return;
    void listMerchPartnerEmailHistory({ projectId, limit: 100 }).then((res) => {
      setEmailHistory(res.entries ?? []);
    });
  }, [projectId]);
  React.useEffect(() => {
    reloadEmailHistory();
  }, [reloadEmailHistory]);
  // Re-fetch when cooperation dialog closes — most likely cause of new
  // history entries.
  React.useEffect(() => {
    if (!cooperationOpen) reloadEmailHistory();
  }, [cooperationOpen, reloadEmailHistory]);

  const selectedSupplier = useMemo(() => {
    if (!merch || !selectedSupplierKey) return null;
    return merch.suppliers.find((s) => supplierKeyOf(s) === selectedSupplierKey) ?? null;
  }, [merch, selectedSupplierKey]);

  const filteredSuppliers = useMemo(() => {
    if (!merch) return [];
    return merch.suppliers.filter((s) => {
      if (techniqueFilter && !s.techniques.includes(techniqueFilter)) return false;
      if (productFilter && !s.productCategories.includes(productFilter)) return false;
      return true;
    });
  }, [merch, techniqueFilter, productFilter]);

  if (!bootstrap) {
    return (
      <Alert
        severity="info"
        action={
          onRequestBootstrap ? (
            <Button size="small" onClick={onRequestBootstrap}>
              Kjør research
            </Button>
          ) : undefined
        }
        sx={{
          bgcolor: 'rgba(34,211,238,0.08)',
          color: '#cbd5e1',
          border: '1px solid rgba(34,211,238,0.22)',
          '& .MuiAlert-icon': { color: '#a5f3fc' },
        }}
      >
        Kjør Research-fanen først så bygger vi merch-leverandørliste basert på kundens NACE-kode og marked.
      </Alert>
    );
  }

  if (!merch || merch.suppliers.length === 0) {
    return (
      <Alert
        severity="warning"
        sx={{
          bgcolor: 'rgba(250,204,21,0.12)',
          color: '#fde68a',
          border: '1px solid rgba(250,204,21,0.28)',
          '& .MuiAlert-icon': { color: '#fde68a' },
        }}
      >
        {merch?.marketContext ?? 'Ingen merch-leverandører er hentet enda.'}
      </Alert>
    );
  }

  const techniqueChips = (Object.keys(merch.techniqueCounts) as RoleRoomAgentMerchTechnique[])
    .filter((t) => merch.techniqueCounts[t] > 0)
    .sort((a, b) => merch.techniqueCounts[b] - merch.techniqueCounts[a]);

  const productChips = (Object.keys(merch.productCounts) as RoleRoomAgentMerchProductCategory[])
    .filter((c) => merch.productCounts[c] > 0)
    .sort((a, b) => merch.productCounts[b] - merch.productCounts[a]);

  return (
    <Stack spacing={1.6}>
      {/* Customer entity confirmation banner — surfaces confirmed
          orgnr/bydel so partner-discovery and cooperation use real data
          when Brreg's juridisk hovedsete differs from operating area. */}
      {confirmedEntity ? (
        <Alert
          severity="success"
          icon={<BusinessIcon fontSize="small" />}
          action={
            <Button size="small" onClick={() => setConfirmEntityOpen(true)} sx={{ textTransform: 'none' }}>
              Endre
            </Button>
          }
          sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#bbf7d0', border: '1px solid rgba(34,197,94,0.2)', '& .MuiAlert-icon': { color: '#bbf7d0' } }}
        >
          Bekreftet kunde: <strong>{confirmedEntity.legalName}</strong>
          {confirmedEntity.organizationNumber ? ` (${confirmedEntity.organizationNumber})` : ''}
          {confirmedEntity.bydel ? ` · driver fra ${confirmedEntity.bydel}` : ''}
        </Alert>
      ) : (
        <Alert
          severity="info"
          icon={<BusinessIcon fontSize="small" />}
          action={
            <Button size="small" variant="contained" onClick={() => setConfirmEntityOpen(true)} sx={{ textTransform: 'none' }}>
              Bekreft kunde
            </Button>
          }
        >
          Bekreft hvilken juridisk bedrift dette er + bydel dere driver fra. Da blir partner-forslag og samarbeidsutkast
          basert på riktig data.
        </Alert>
      )}

      {/* Header / market context */}
      <Box
        sx={{
          p: 1.2,
          borderRadius: 3,
          border: merch.status === 'ready'
            ? '1px solid rgba(34,197,94,0.22)'
            : '1px solid rgba(250,204,21,0.2)',
          bgcolor: merch.status === 'ready' ? 'rgba(6,78,59,0.14)' : 'rgba(71,36,0,0.16)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>Merch-leverandører</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {merch.marketContext}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`${merch.verifiedSupplierCount}/${merch.suppliers.length} klare for forespørsel`}
              sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0', fontWeight: 700 }}
            />
            <Button
              size="small"
              variant="contained"
              startIcon={<HandshakeIcon fontSize="small" />}
              onClick={() => setCooperationOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: 'rgba(99,102,241,0.4)',
                '&:hover': { bgcolor: 'rgba(99,102,241,0.6)' },
              }}
            >
              Lag samarbeidsforslag
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Mockup-preview — fotorealistisk render via Printful. Shows logo
          on a generic Printful product variant; supplier-aware so the
          product picker narrows to what the selected supplier actually
          carries (apparel/headwear/bags/drinkware). */}
      <MerchMockupPreview
        projectId={projectId}
        bootstrap={bootstrap}
        selectedSupplier={selectedSupplier}
      />

      {/* Filters: technique + product. Click to toggle. */}
      {(techniqueChips.length > 0 || productChips.length > 0) ? (
        <Stack spacing={0.6}>
          {techniqueChips.length > 0 ? (
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>
                Teknikk
              </Typography>
              {techniqueChips.map((t) => {
                const active = techniqueFilter === t;
                return (
                  <Chip
                    key={t}
                    size="small"
                    clickable
                    label={`${TECHNIQUE_LABEL[t]} · ${merch.techniqueCounts[t]}`}
                    onClick={() => setTechniqueFilter(active ? null : t)}
                    sx={{
                      bgcolor: active ? 'rgba(34,211,238,0.22)' : 'rgba(15,23,42,0.6)',
                      color: active ? '#a5f3fc' : '#cbd5e1',
                      border: active ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(148,163,184,0.2)',
                    }}
                  />
                );
              })}
            </Stack>
          ) : null}
          {productChips.length > 0 ? (
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mr: 0.5 }}>
                Produkt
              </Typography>
              {productChips.map((c) => {
                const active = productFilter === c;
                return (
                  <Chip
                    key={c}
                    size="small"
                    clickable
                    label={`${PRODUCT_LABEL[c]} · ${merch.productCounts[c]}`}
                    onClick={() => setProductFilter(active ? null : c)}
                    sx={{
                      bgcolor: active ? 'rgba(34,211,238,0.22)' : 'rgba(15,23,42,0.6)',
                      color: active ? '#a5f3fc' : '#cbd5e1',
                      border: active ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(148,163,184,0.2)',
                    }}
                  />
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {/* Supplier cards */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
        {filteredSuppliers.length === 0 ? (
          <Alert severity="info" sx={{ width: '100%' }}>
            Ingen leverandører matcher de valgte filtrene. Klikk på en chip for å fjerne filteret.
          </Alert>
        ) : null}
        {filteredSuppliers.map((supplier) => {
          const pill = STATUS_PILL[supplier.status];
          const key = supplierKeyOf(supplier);
          const isSelected = selectedSupplierKey === key;
          // Slice 7b history per partner — shown as a small "Sendt X
          // ganger"-badge in the card so producer immediately sees if
          // they've already pitched this supplier.
          const sentCount = supplier.organizationNumber
            ? emailHistory.filter((e) => e.partnerOrgnr === supplier.organizationNumber).length
            : 0;
          return (
            <Box
              key={key}
              onClick={() => setSelectedSupplierKey(isSelected ? null : key)}
              sx={{
                flex: '1 1 280px',
                minWidth: 0,
                p: 1,
                borderRadius: 2.4,
                cursor: 'pointer',
                border: isSelected
                  ? '2px solid rgba(99,102,241,0.7)'
                  : supplier.status === 'verified'
                    ? '1px solid rgba(16,185,129,0.26)'
                    : '1px solid rgba(148,163,184,0.16)',
                bgcolor: isSelected ? 'rgba(30,27,75,0.5)' : 'rgba(15,23,42,0.48)',
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': { borderColor: isSelected ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.4)' },
              }}
            >
              <Stack spacing={0.7}>
                <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.92rem' }}>
                      {supplier.name}
                    </Typography>
                    {isSelected ? (
                      <Chip
                        size="small"
                        label="Valgt"
                        sx={{ bgcolor: 'rgba(99,102,241,0.22)', color: '#e0e7ff', fontWeight: 700, height: 20, fontSize: '0.66rem' }}
                      />
                    ) : null}
                  </Stack>
                  <Chip
                    size="small"
                    label={pill.label}
                    title={`Konfidens: ${supplier.confidence}%`}
                    sx={{ bgcolor: pill.bg, color: pill.fg, fontWeight: 700 }}
                  />
                </Stack>
                {/* Source + classification chips on one row */}
                <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={
                      supplier.source === 'brreg_nace'
                        ? `Brreg NACE ${supplier.naceCode ?? ''}`.trim()
                        : 'Google Places'
                    }
                    sx={{
                      bgcolor: supplier.source === 'brreg_nace' ? 'rgba(34,197,94,0.14)' : 'rgba(59,130,246,0.14)',
                      color: supplier.source === 'brreg_nace' ? '#bbf7d0' : '#bfdbfe',
                      fontSize: '0.7rem',
                    }}
                  />
                  {supplier.techniques
                    .filter((t) => t !== 'unknown')
                    .map((t) => (
                      <Chip
                        key={`t-${t}`}
                        size="small"
                        label={TECHNIQUE_LABEL[t]}
                        variant="outlined"
                        sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.3)', fontSize: '0.7rem' }}
                      />
                    ))}
                  {supplier.productCategories
                    .filter((c) => c !== 'unknown')
                    .map((c) => (
                      <Chip
                        key={`p-${c}`}
                        size="small"
                        label={PRODUCT_LABEL[c]}
                        variant="outlined"
                        sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.3)', fontSize: '0.7rem' }}
                      />
                    ))}
                  {typeof supplier.rating === 'number' && typeof supplier.userRatingCount === 'number' ? (
                    <Chip
                      size="small"
                      label={`★ ${supplier.rating.toFixed(1)} (${supplier.userRatingCount})`}
                      sx={{ bgcolor: 'rgba(250,204,21,0.12)', color: '#fde68a', fontSize: '0.7rem' }}
                    />
                  ) : null}
                </Stack>
                {/* Slice 2: scraped offerings — actual keywords found on
                    the supplier's homepage. Most informative signal we
                    have without manual contact. */}
                {supplier.offerings && supplier.offerings.length > 0 ? (
                  <Box>
                    <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4 }}>
                      Tilbyr (fra nettsiden)
                    </Typography>
                    <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                      {supplier.offerings.map((offering) => (
                        <Chip
                          key={offering}
                          size="small"
                          label={offering}
                          sx={{
                            bgcolor: 'rgba(34,197,94,0.12)',
                            color: '#bbf7d0',
                            fontSize: '0.7rem',
                            height: 20,
                            border: '1px solid rgba(34,197,94,0.2)',
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                <Typography sx={{ color: 'rgba(226,232,240,0.74)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                  {supplier.relevanceReason}
                </Typography>
                {supplier.formattedAddress ? (
                  <Typography sx={{ color: 'rgba(226,232,240,0.56)', fontSize: '0.76rem', lineHeight: 1.4 }}>
                    {supplier.formattedAddress}
                  </Typography>
                ) : null}
                <Typography sx={{ color: '#a5f3fc', fontSize: '0.78rem', lineHeight: 1.45 }}>
                  → {supplier.outreachHint}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.7}
                  flexWrap="wrap"
                  useFlexGap
                  onClick={(e) => e.stopPropagation()}
                >
                  {supplier.websiteUrl ? (
                    <Button
                      href={supplier.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      size="small"
                      variant="outlined"
                      startIcon={<WebIcon fontSize="small" />}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Nettside
                    </Button>
                  ) : null}
                  {supplier.googleMapsUri ? (
                    <Button
                      href={supplier.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      size="small"
                      variant="outlined"
                      startIcon={<MapIcon fontSize="small" />}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Google
                    </Button>
                  ) : null}
                  {supplier.organizationNumber ? (
                    <Button
                      href={`https://www.brreg.no/enhet/${supplier.organizationNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      size="small"
                      variant="outlined"
                      startIcon={<MailIcon fontSize="small" />}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Brreg
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SendIcon fontSize="small" />}
                    onClick={() => setOutreachSupplier(supplier)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: 'rgba(99,102,241,0.4)',
                      '&:hover': { bgcolor: 'rgba(99,102,241,0.6)' },
                    }}
                  >
                    Send tilbudsforespørsel
                  </Button>
                </Stack>
                {/* Slice 7b: send-history badge */}
                {sentCount > 0 ? (
                  <Chip
                    size="small"
                    label={`Sendt ${sentCount} ${sentCount === 1 ? 'gang' : 'ganger'} fra dette prosjektet`}
                    sx={{
                      alignSelf: 'flex-start',
                      bgcolor: 'rgba(99,102,241,0.16)',
                      color: '#c7d2fe',
                      fontSize: '0.7rem',
                      height: 22,
                    }}
                  />
                ) : null}
                {/* Scraped contact info — chip row only when something was found */}
                {(supplier.contact?.email || supplier.contact?.phone) ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    flexWrap="wrap"
                    useFlexGap
                    onClick={(e) => e.stopPropagation()}
                  >
                    {supplier.contact?.email ? (
                      <Chip
                        size="small"
                        icon={<MailIcon sx={{ fontSize: 14, color: '#bbf7d0 !important' }} />}
                        label={supplier.contact.email}
                        component="a"
                        clickable
                        href={`mailto:${supplier.contact.email}`}
                        sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#bbf7d0', fontSize: '0.72rem' }}
                      />
                    ) : null}
                    {supplier.contact?.phone ? (
                      <Chip
                        size="small"
                        label={supplier.contact.phone}
                        sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#bfdbfe', fontSize: '0.72rem' }}
                      />
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      {/* Outreach modal — pre-filled tilbudsforespørsel */}
      <MerchOutreachDialog
        open={Boolean(outreachSupplier)}
        onClose={() => setOutreachSupplier(null)}
        supplier={outreachSupplier}
        bootstrap={bootstrap}
        productCategory={
          outreachSupplier?.productCategories.find((c) => c !== 'unknown') ?? null
        }
      />

      {/* Cooperation draft dialog (Claude-drevet) */}
      <MerchCooperationDialog
        open={cooperationOpen}
        onClose={() => setCooperationOpen(false)}
        projectId={projectId}
        bootstrap={bootstrap}
        supplier={selectedSupplier}
        confirmedEntity={confirmedEntity}
      />

      {/* Customer entity confirmation (Slice 6 — multi-step) */}
      <CustomerEntityConfirmationDialog
        open={confirmEntityOpen}
        onClose={() => setConfirmEntityOpen(false)}
        projectId={projectId}
        bootstrap={bootstrap}
        onConfirm={(entity) => setConfirmedEntity(entity)}
      />

      {/* Cooperation angles + outreach checklist */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
        {merch.cooperationAngles.length > 0 ? (
          <Box
            sx={{
              flex: 1,
              p: 1.2,
              borderRadius: 3,
              border: '1px solid rgba(99,102,241,0.22)',
              bgcolor: 'rgba(30,27,75,0.36)',
            }}
          >
            <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
              Samarbeidsforslag
            </Typography>
            <Stack spacing={0.5}>
              {merch.cooperationAngles.map((angle) => (
                <Stack key={angle} direction="row" spacing={0.6} alignItems="flex-start">
                  <CheckIcon sx={{ color: '#a5b4fc', fontSize: 14, mt: 0.3 }} />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', lineHeight: 1.5 }}>{angle}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ) : null}
        {merch.outreachChecklist.length > 0 ? (
          <Box
            sx={{
              flex: 1,
              p: 1.2,
              borderRadius: 3,
              border: '1px solid rgba(34,211,238,0.18)',
              bgcolor: 'rgba(8,47,73,0.32)',
            }}
          >
            <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
              Send med i tilbudsforespørsel
            </Typography>
            <Stack spacing={0.5}>
              {merch.outreachChecklist.map((item) => (
                <Stack key={item} direction="row" spacing={0.6} alignItems="flex-start">
                  <CheckIcon sx={{ color: '#a5f3fc', fontSize: 14, mt: 0.3 }} />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', lineHeight: 1.5 }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>

      {merch.limitations.length > 0 ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.76rem', lineHeight: 1.5 }}>
          Begrensning: {merch.limitations.join(' · ')}
        </Typography>
      ) : null}
    </Stack>
  );
};

export default MerchSuppliersPanel;
