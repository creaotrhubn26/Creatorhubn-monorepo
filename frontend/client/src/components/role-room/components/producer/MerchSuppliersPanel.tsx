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
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  CheckCircleOutline as CheckIcon,
  Handshake as HandshakeIcon,
  Language as WebIcon,
  Map as MapIcon,
  Mail as MailIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  roleRoomAgentDefaultHeaders,
  type RoleRoomAgentMerchProductCategory,
  type RoleRoomAgentMerchSupplier,
  type RoleRoomAgentMerchTechnique,
  type RoleRoomAgentProducerBootstrapResult,
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
  listMerchPartnerReplies,
  pollPartnerRepliesNow,
  type MerchPartnerEmailLogEntry,
  type MerchPartnerReplyEntry,
} from '../../services/roleRoomAgentClaudeApi';
import MerchPartnerReplyDialog from './MerchPartnerReplyDialog';

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

type MerchSupplierData = NonNullable<RoleRoomAgentProducerBootstrapResult['merchSuppliers']>;

function hasDocumentedSupplierCapabilities(supplier: RoleRoomAgentMerchSupplier): boolean {
  return supplier.websiteSignalsEnriched === true
    && (supplier.websiteConfirmedTechniques?.length ?? 0) > 0
    && (supplier.websiteConfirmedProductCategories?.length ?? 0) > 0;
}

function supplierDisplayScore(supplier: RoleRoomAgentMerchSupplier): number {
  const statusScore = supplier.status === 'verified'
    ? 200
    : supplier.status === 'likely'
      ? 100
      : supplier.status === 'needs_review'
        ? 20
        : 0;
  return (hasDocumentedSupplierCapabilities(supplier) ? 1_000 : 0)
    + statusScore
    + supplier.confidence
    + Math.min(25, supplier.userRatingCount ?? 0) / 5;
}

const MerchSuppliersPanel: React.FC<MerchSuppliersPanelProps> = ({ projectId, bootstrap, onRequestBootstrap }) => {
  const [refreshedMerch, setRefreshedMerch] = useState<MerchSupplierData | null>(null);
  const merch = refreshedMerch ?? bootstrap?.merchSuppliers ?? null;
  const [allSuppliersOpen, setAllSuppliersOpen] = useState(false);
  const [merchRefreshBusy, setMerchRefreshBusy] = useState(false);
  const [merchRefreshNotice, setMerchRefreshNotice] = useState<string | null>(null);
  const [merchRefreshError, setMerchRefreshError] = useState<string | null>(null);
  const effectiveBootstrap = useMemo(() => (
    bootstrap && merch ? { ...bootstrap, merchSuppliers: merch } : bootstrap
  ), [bootstrap, merch]);
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
  React.useEffect(() => {
    setRefreshedMerch(null);
    setMerchRefreshNotice(null);
    setMerchRefreshError(null);
    setAllSuppliersOpen(false);
  }, [projectId, bootstrap?.generatedAt]);


  // Fetch the project's send-history once so each supplier card can
  // surface "Sendt 4. mai" badges. Refreshes whenever a cooperation
  // dialog closes (cheapest hook to detect "user just sent").
  const [emailHistory, setEmailHistory] = useState<MerchPartnerEmailLogEntry[]>([]);
  const [emailReplies, setEmailReplies] = useState<MerchPartnerReplyEntry[]>([]);
  const [polling, setPolling] = useState(false);
  const [pollResultMessage, setPollResultMessage] = useState<string | null>(null);
  const [replyDialogTarget, setReplyDialogTarget] = useState<MerchPartnerEmailLogEntry | null>(null);

  const reloadEmailHistory = React.useCallback(() => {
    if (!projectId) return;
    void listMerchPartnerEmailHistory({ projectId, limit: 100 }).then((res) => {
      setEmailHistory(res.entries ?? []);
    });
    void listMerchPartnerReplies({ projectId, limit: 200 }).then((res) => {
      setEmailReplies(res.entries ?? []);
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

  const handlePollReplies = React.useCallback(async () => {
    if (!projectId) return;
    setPolling(true);
    setPollResultMessage(null);
    try {
      const r = await pollPartnerRepliesNow({ projectId, lookbackDays: 30 });
      if (r.ok) {
        setPollResultMessage(
          r.newReplies > 0
            ? `Fant ${r.newReplies} nye svar (skannet ${r.scanned} mail).`
            : `Ingen nye svar funnet (skannet ${r.scanned} mail mot ${r.pollableSentEmails} sendte forslag).`,
        );
        reloadEmailHistory();
      } else {
        setPollResultMessage(
          r.reason === 'missing_email_config'
            ? 'Gmail-konfig mangler i backend-env. Be admin sette GMAIL_USER + GMAIL_APP_PASSWORD.'
            : `IMAP-poll feilet: ${r.reason ?? 'ukjent feil'}`,
        );
      }
    } finally {
      setPolling(false);
    }
  }, [projectId, reloadEmailHistory]);

  const handleRefreshMerch = React.useCallback(async () => {
    if (!projectId || !bootstrap) return;
    setMerchRefreshBusy(true);
    setMerchRefreshNotice(null);
    setMerchRefreshError(null);
    try {
      const response = await fetch('/api/role-room/agent/producer-bootstrap/refresh-section', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({
          projectId,
          section: 'merch',
          websiteUrl: bootstrap.companyProfile?.websiteUrl ?? undefined,
          organizationNumber: bootstrap.brregCompany?.organizationNumber
            ?? bootstrap.companyProfile?.organizationNumber
            ?? undefined,
          companyName: bootstrap.brregCompany?.name
            ?? bootstrap.companyProfile?.companyName
            ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        data?: { merchSuppliers?: MerchSupplierData };
      } | null;
      const nextMerch = payload?.data?.merchSuppliers;
      if (!response.ok || !payload?.success || !nextMerch || !Array.isArray(nextMerch.suppliers)) {
        throw new Error(payload?.error || `Oppdatering feilet (${response.status}).`);
      }

      const nextSnapshot: RoleRoomAgentProducerBootstrapResult = {
        ...bootstrap,
        merchSuppliers: nextMerch,
      };
      await roleRoomAgentService.saveSnapshot(projectId, nextSnapshot);
      setRefreshedMerch(nextMerch);
      const documentedCount = nextMerch.suppliers.filter(hasDocumentedSupplierCapabilities).length;
      setMerchRefreshNotice(
        `Oppdatert og lagret uten ny research-versjon: ${documentedCount} leverandører har nettsidedokumenterte produksjonssignaler.`,
      );
    } catch (error) {
      setMerchRefreshError(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere merch-leverandørene.',
      );
    } finally {
      setMerchRefreshBusy(false);
    }
  }, [bootstrap, projectId]);

  const selectedSupplier = useMemo(() => {
    if (!merch || !selectedSupplierKey) return null;
    return merch.suppliers.find((s) => supplierKeyOf(s) === selectedSupplierKey) ?? null;
  }, [merch, selectedSupplierKey]);

  const recommendedSupplierKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const recommendation of merch?.recommendations ?? []) {
      const match = recommendation.supplierMatch;
      if (match) keys.add(match.placeId || match.organizationNumber || match.name);
    }
    return keys;
  }, [merch]);

  const rankedSuppliers = useMemo(() => {
    if (!merch) return [];
    return [...merch.suppliers].sort((a, b) => {
      const aScore = supplierDisplayScore(a) + (recommendedSupplierKeys.has(supplierKeyOf(a)) ? 500 : 0);
      const bScore = supplierDisplayScore(b) + (recommendedSupplierKeys.has(supplierKeyOf(b)) ? 500 : 0);
      return bScore - aScore || a.name.localeCompare(b.name, 'nb');
    });
  }, [merch, recommendedSupplierKeys]);

  const filteredSuppliers = useMemo(() => rankedSuppliers.filter((supplier) => {
    if (techniqueFilter && !supplier.techniques.includes(techniqueFilter)) return false;
    if (productFilter && !supplier.productCategories.includes(productFilter)) return false;
    return true;
  }), [productFilter, rankedSuppliers, techniqueFilter]);

  const topSuppliers = useMemo(
    () => filteredSuppliers.slice(0, 5),
    [filteredSuppliers],
  );
  const documentedSupplierCount = merch?.suppliers.filter(hasDocumentedSupplierCapabilities).length ?? 0;

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
              label={`${documentedSupplierCount}/${merch.suppliers.length} med nettsidebevis`}
              sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0', fontWeight: 700 }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={merchRefreshBusy ? <CircularProgress size={12} /> : <RefreshIcon fontSize="small" />}
              onClick={() => void handleRefreshMerch()}
              disabled={merchRefreshBusy}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {merchRefreshBusy ? 'Verifiserer …' : 'Oppdater og verifiser'}
            </Button>
            {emailHistory.length > 0 ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={polling ? <CircularProgress size={12} /> : <MailIcon fontSize="small" />}
                onClick={() => void handlePollReplies()}
                disabled={polling}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {polling ? 'Sjekker …' : 'Sjekk for svar'}
              </Button>
            ) : null}
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
        {pollResultMessage ? (
          <Alert severity="info" onClose={() => setPollResultMessage(null)} sx={{ mt: 1, fontSize: '0.82rem' }}>
            {pollResultMessage}
          </Alert>
        ) : null}
        {merchRefreshNotice ? (
          <Alert severity="success" onClose={() => setMerchRefreshNotice(null)} sx={{ mt: 1, fontSize: '0.82rem' }}>
            {merchRefreshNotice}
          </Alert>
        ) : null}
        {merchRefreshError ? (
          <Alert severity="error" onClose={() => setMerchRefreshError(null)} sx={{ mt: 1, fontSize: '0.82rem' }}>
            {merchRefreshError}
          </Alert>
        ) : null}
      </Box>

      {/* Mockup-preview — fotorealistisk render via Printful. Shows logo
          on a generic Printful product variant; supplier-aware so the
          product picker narrows to what the selected supplier actually
          carries (apparel/headwear/bags/drinkware). */}
      <MerchMockupPreview
        projectId={projectId}
        bootstrap={effectiveBootstrap}
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


      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>Topp 5 merch-leverandører</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.56)', fontSize: '0.76rem' }}>
            Rangert etter nettsidebevis, status, tillitsscore og anmeldelser. Kandidater uten bevis merkes for manuell kontroll.
          </Typography>
        </Box>
        {rankedSuppliers.length > 0 ? (
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.currentTarget.blur();
              setAllSuppliersOpen(true);
            }}
            sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
          >
            Se alle ({rankedSuppliers.length})
          </Button>
        ) : null}
      </Stack>
      {/* Supplier cards */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
        {filteredSuppliers.length === 0 ? (
          <Alert severity="info" sx={{ width: '100%' }}>
            Ingen leverandører matcher de valgte filtrene. Klikk på en chip for å fjerne filteret.
          </Alert>
        ) : null}
        {topSuppliers.map((supplier) => {
          const pill = STATUS_PILL[supplier.status];
          const key = supplierKeyOf(supplier);
          const isSelected = selectedSupplierKey === key;
          // Slice 7b history per partner — shown as a small "Sendt X
          // ganger"-badge in the card so producer immediately sees if
          // they've already pitched this supplier.
          const partnerSentEmails = supplier.organizationNumber
            ? emailHistory.filter((e) => e.partnerOrgnr === supplier.organizationNumber)
            : [];
          const sentCount = partnerSentEmails.length;
          const partnerReplies = partnerSentEmails.flatMap((sent) =>
            emailReplies.filter((rep) => rep.sentEmailId === sent.id),
          );
          const latestReply = partnerReplies[0] ?? null;
          const latestSent = partnerSentEmails[0] ?? null;
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
                    <Chip
                      size="small"
                      label={hasDocumentedSupplierCapabilities(supplier) ? 'Nettsidebevis' : 'Manuell kontroll'}
                      sx={{
                        bgcolor: hasDocumentedSupplierCapabilities(supplier) ? 'rgba(34,197,94,0.14)' : 'rgba(250,204,21,0.12)',
                        color: hasDocumentedSupplierCapabilities(supplier) ? '#bbf7d0' : '#fde68a',
                        fontWeight: 700,
                        height: 20,
                        fontSize: '0.66rem',
                      }}
                    />
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
                {/* Slice 7b/c: send + reply history */}
                {sentCount > 0 ? (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" onClick={(e) => e.stopPropagation()}>
                    <Chip
                      size="small"
                      label={`Sendt ${sentCount} ${sentCount === 1 ? 'gang' : 'ganger'}`}
                      sx={{ bgcolor: 'rgba(99,102,241,0.16)', color: '#c7d2fe', fontSize: '0.7rem', height: 22 }}
                    />
                    {latestReply ? (
                      <Chip
                        size="small"
                        label={`Svar mottatt ${new Date(latestReply.repliedAt).toLocaleDateString('nb-NO')} · ${
                          latestReply.sentiment === 'positive' ? 'positivt' :
                          latestReply.sentiment === 'negative' ? 'negativt' : 'nøytralt'
                        }`}
                        sx={{
                          bgcolor:
                            latestReply.sentiment === 'positive' ? 'rgba(34,197,94,0.16)' :
                            latestReply.sentiment === 'negative' ? 'rgba(239,68,68,0.14)' :
                            'rgba(250,204,21,0.14)',
                          color:
                            latestReply.sentiment === 'positive' ? '#bbf7d0' :
                            latestReply.sentiment === 'negative' ? '#fecaca' :
                            '#fde68a',
                          fontSize: '0.7rem',
                          height: 22,
                        }}
                      />
                    ) : latestSent ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setReplyDialogTarget(latestSent)}
                        sx={{ textTransform: 'none', fontSize: '0.72rem', minWidth: 0, p: 0.4 }}
                      >
                        Marker svar
                      </Button>
                    ) : null}
                  </Stack>
                ) : null}
                {/* Reply summary tooltip — shown inline when present */}
                {latestReply ? (
                  <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.74rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                    «{latestReply.replySummary.slice(0, 160)}{latestReply.replySummary.length > 160 ? '…' : ''}»
                  </Typography>
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

      <Dialog
        open={allSuppliersOpen}
        onClose={() => setAllSuppliersOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid rgba(148,163,184,0.22)',
            maxHeight: '88vh',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography sx={{ color: '#f8fafc', fontWeight: 850 }}>Alle merch-leverandører</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.78rem' }}>
                {rankedSuppliers.length} kandidater. Kun «Nettsidebevis»-merkede leverandører brukes som automatisk produktmatch.
              </Typography>
            </Box>
            <IconButton aria-label="Lukk leverandøroversikt" onClick={() => setAllSuppliersOpen(false)} sx={{ color: '#cbd5e1' }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(148,163,184,0.14)' }}>
          <Stack spacing={0.8}>
            {rankedSuppliers.map((supplier, index) => {
              const key = supplierKeyOf(supplier);
              const documented = hasDocumentedSupplierCapabilities(supplier);
              const pill = STATUS_PILL[supplier.status];
              const selected = selectedSupplierKey === key;
              return (
                <Box
                  key={key}
                  sx={{
                    p: 1.1,
                    borderRadius: 2,
                    border: selected
                      ? '1px solid rgba(99,102,241,0.7)'
                      : '1px solid rgba(148,163,184,0.16)',
                    bgcolor: selected ? 'rgba(49,46,129,0.3)' : 'rgba(15,23,42,0.62)',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                    <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.55} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.72rem', minWidth: 22 }}>
                          {index + 1}.
                        </Typography>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{supplier.name}</Typography>
                        <Chip
                          size="small"
                          label={documented ? 'Nettsidebevis' : 'Manuell kontroll'}
                          sx={{
                            height: 21,
                            bgcolor: documented ? 'rgba(34,197,94,0.14)' : 'rgba(250,204,21,0.12)',
                            color: documented ? '#bbf7d0' : '#fde68a',
                            fontSize: '0.66rem',
                          }}
                        />
                        <Chip size="small" label={pill.label} sx={{ height: 21, bgcolor: pill.bg, color: pill.fg, fontSize: '0.66rem' }} />
                      </Stack>
                      <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.74rem' }}>
                        {supplier.formattedAddress || 'Adresse må bekreftes'} · Tillitsscore {supplier.confidence}%
                      </Typography>
                      {supplier.offerings && supplier.offerings.length > 0 ? (
                        <Typography sx={{ color: '#a7f3d0', fontSize: '0.72rem' }}>
                          Fra nettsiden: {supplier.offerings.join(', ')}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
                      {supplier.websiteUrl ? (
                        <Button href={supplier.websiteUrl} target="_blank" rel="noreferrer" size="small" startIcon={<WebIcon />} sx={{ textTransform: 'none' }}>
                          Nettside
                        </Button>
                      ) : null}
                      {supplier.googleMapsUri ? (
                        <Button href={supplier.googleMapsUri} target="_blank" rel="noreferrer" size="small" startIcon={<MapIcon />} sx={{ textTransform: 'none' }}>
                          Google
                        </Button>
                      ) : null}
                      <Button
                        size="small"
                        variant={selected ? 'outlined' : 'contained'}
                        onClick={() => {
                          setSelectedSupplierKey(selected ? null : key);
                          setAllSuppliersOpen(false);
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        {selected ? 'Fjern valg' : 'Velg'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Outreach modal — pre-filled tilbudsforespørsel */}
      <MerchOutreachDialog
        open={Boolean(outreachSupplier)}
        onClose={() => setOutreachSupplier(null)}
        supplier={outreachSupplier}
        bootstrap={effectiveBootstrap}
        productCategory={
          outreachSupplier?.productCategories.find((c) => c !== 'unknown') ?? null
        }
      />

      {/* Cooperation draft dialog (Claude-drevet) */}
      <MerchCooperationDialog
        open={cooperationOpen}
        onClose={() => setCooperationOpen(false)}
        projectId={projectId}
        bootstrap={effectiveBootstrap}
        supplier={selectedSupplier}
        confirmedEntity={confirmedEntity}
      />

      {/* Customer entity confirmation (Slice 6 — multi-step) */}
      <CustomerEntityConfirmationDialog
        open={confirmEntityOpen}
        onClose={() => setConfirmEntityOpen(false)}
        projectId={projectId}
        bootstrap={effectiveBootstrap}
        onConfirm={(entity) => setConfirmedEntity(entity)}
      />

      {/* Slice 7c reply marker */}
      <MerchPartnerReplyDialog
        open={Boolean(replyDialogTarget)}
        onClose={() => setReplyDialogTarget(null)}
        onSaved={reloadEmailHistory}
        projectId={projectId}
        sentEmail={replyDialogTarget}
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
