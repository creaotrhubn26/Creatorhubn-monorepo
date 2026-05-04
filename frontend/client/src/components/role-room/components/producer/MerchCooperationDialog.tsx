/**
 * MerchCooperationDialog — Slice 3.
 *
 * Claude-drevet samarbeidsforslag-generator. Producer fyller inn
 * partner + avtaletype, vi kaller backend, og rendrer resultatet
 * som et profesjonelt forslag med tre-kolonne verdiutveksling,
 * nummererte avtaleparagrafer, risiko og neste steg.
 *
 * All output kan kopieres som markdown eller åpnes som e-post.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as MagicIcon,
  CheckCircle as CheckIcon,
  ContentCopy as CopyIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  Handshake as HandshakeIcon,
  WarningAmber as WarningIcon,
  PlaylistAddCheck as ChecklistIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  generateMerchCooperationDraft,
  MerchCooperationApiError,
  type MerchCooperationDraft,
  type MerchDealType,
  type MerchPartnerType,
} from '../../services/roleRoomAgentClaudeApi';
import type {
  RoleRoomAgentMerchSupplier,
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';

interface MerchCooperationDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  /** Optional pre-bound supplier — surfaces in "vi tilbyr" so the
   *  proposal references who would actually print the merch. */
  supplier?: RoleRoomAgentMerchSupplier | null;
}

const PARTNER_TYPES: ReadonlyArray<{ id: MerchPartnerType; label: string }> = [
  { id: 'sportsklubb', label: 'Sportsklubb' },
  { id: 'event', label: 'Event / arrangement' },
  { id: 'skole', label: 'Skole / utdanning' },
  { id: 'forening', label: 'Forening / lokallag' },
  { id: 'bedrift', label: 'Bedriftspartner' },
];

const DEAL_TYPES: ReadonlyArray<{ id: MerchDealType; label: string; hint: string }> = [
  { id: 'sponsor', label: 'Sponsoravtale', hint: 'Logo + synlighet i bytte mot støtte/produkter' },
  { id: 'kit_supplier', label: 'Kit-supplier', hint: '1-3 sesonger drakter/uniformer' },
  { id: 'cross_promo', label: 'Kryss-promotering', hint: 'Innhold begge veier, ingen direkte penger' },
  { id: 'give_away', label: 'Give-away / aktivering', hint: 'Engangs-aktivering på event eller kampanje' },
  { id: 'long_term_partnership', label: 'Langsiktig partnerskap', hint: 'Bredt samarbeid over flere år' },
];

function draftToMarkdown(d: MerchCooperationDraft, partnerName: string): string {
  const sections: string[] = [
    `# ${d.dealHeadline}`,
    ``,
    d.openingPitch,
    ``,
    `## Vi tilbyr ${partnerName}`,
    ...d.weProposeToOffer.map((x) => `- ${x}`),
    ``,
    `## ${partnerName} tilbyr oss`,
    ...d.theyOffer.map((x) => `- ${x}`),
    ``,
    `## Kommersiell ramme`,
    d.commercialFraming,
    ``,
    `## Avtaleutkast`,
    ...d.draftAgreementParagraphs.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## Risiko å sjekke før signering`,
    ...d.riskNotes.map((x) => `- ${x}`),
    ``,
    `## Neste steg`,
    ...d.nextSteps.map((x) => `- ${x}`),
  ];
  return sections.join('\n');
}

const MerchCooperationDialog: React.FC<MerchCooperationDialogProps> = ({
  open,
  onClose,
  projectId,
  bootstrap,
  supplier,
}) => {
  const customerName = bootstrap?.companyProfile?.companyName ?? '';
  const customerIndustry = bootstrap?.companyProfile?.industry ?? '';
  const customerBrief = bootstrap?.companyProfile?.summary ?? '';

  const [partnerName, setPartnerName] = useState('');
  const [partnerType, setPartnerType] = useState<MerchPartnerType>('sportsklubb');
  const [partnerNotes, setPartnerNotes] = useState('');
  const [dealType, setDealType] = useState<MerchDealType>('sponsor');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MerchCooperationApiError | null>(null);
  const [draft, setDraft] = useState<MerchCooperationDraft | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!projectId) return;
    if (!customerName.trim() || !partnerName.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const result = await generateMerchCooperationDraft({
        projectId,
        customerName,
        customerIndustry: customerIndustry || null,
        customerBriefSummary: customerBrief || null,
        partnerName: partnerName.trim(),
        partnerType,
        partnerNotes: partnerNotes.trim() || null,
        dealType,
        supplierContext: supplier
          ? {
              name: supplier.name,
              techniques: supplier.techniques,
              productCategories: supplier.productCategories,
            }
          : null,
      });
      setDraft(result);
    } catch (err) {
      if (err instanceof MerchCooperationApiError) {
        setError(err);
      } else {
        setError(
          new MerchCooperationApiError({
            code: 'unknown',
            detail: err instanceof Error ? err.message : String(err),
            httpStatus: 0,
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, customerName, customerIndustry, customerBrief, partnerName, partnerType, partnerNotes, dealType, supplier]);

  const handleCopy = useCallback(
    async (label: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      } catch {
        /* clipboard may be unavailable */
      }
    },
    [],
  );

  const mailto = useMemo(() => {
    if (!draft) return null;
    const subject = encodeURIComponent(draft.dealHeadline);
    const body = encodeURIComponent(draftToMarkdown(draft, partnerName));
    return `mailto:?subject=${subject}&body=${body}`;
  }, [draft, partnerName]);

  const canGenerate = Boolean(projectId && customerName.trim() && partnerName.trim() && !loading);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HandshakeIcon sx={{ color: '#a5b4fc' }} />
        Samarbeidsforslag {customerName ? `· ${customerName}` : ''}
        <IconButton
          onClick={onClose}
          size="small"
          disabled={loading}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Lukk"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.4}>
          {/* Input form */}
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary', mb: 1 }}>
              Hvem skal vi foreslå et samarbeid med?
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4}>
              <TextField
                label="Motpartens navn"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="f.eks. FK Lyn, Øya-festivalen, NMBU Studentsamfunn"
                fullWidth
                size="small"
                disabled={loading}
              />
              <TextField
                select
                label="Type motpart"
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value as MerchPartnerType)}
                size="small"
                disabled={loading}
                sx={{ minWidth: 200 }}
              >
                {PARTNER_TYPES.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Type avtale"
                value={dealType}
                onChange={(e) => setDealType(e.target.value as MerchDealType)}
                size="small"
                disabled={loading}
                sx={{ minWidth: 240 }}
              >
                {DEAL_TYPES.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    <Stack>
                      <Typography sx={{ fontSize: '0.88rem' }}>{d.label}</Typography>
                      <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>{d.hint}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Notater om motparten (valgfritt)"
              value={partnerNotes}
              onChange={(e) => setPartnerNotes(e.target.value)}
              placeholder="f.eks. 'Klubben har 320 spillere, 4 lag, hjemmebane på Lyn stadion. Sponsoravtale går ut 2026-12.'"
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              size="small"
              disabled={loading}
              sx={{ mt: 1.4 }}
            />
            {supplier ? (
              <Chip
                size="small"
                label={`Tiltenkt leverandør: ${supplier.name}`}
                sx={{ mt: 1, bgcolor: 'rgba(99,102,241,0.16)', color: '#e0e7ff' }}
              />
            ) : null}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <MagicIcon />}
              disabled={!canGenerate}
              onClick={() => void generate()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {loading ? 'Genererer …' : draft ? 'Generer på nytt' : 'Lag forslag'}
            </Button>
            {!customerName ? (
              <Typography sx={{ color: 'warning.main', fontSize: '0.82rem' }}>
                Kjør Research-fanen først for å hente kunde-profilen.
              </Typography>
            ) : null}
          </Stack>

          {error ? (
            <Alert severity="error" action={
              <Button size="small" startIcon={<RefreshIcon />} onClick={() => void generate()}>
                Prøv igjen
              </Button>
            }>
              {error.detail}
            </Alert>
          ) : null}

          {draft ? (
            <Box>
              <Divider sx={{ mb: 2 }} />

              {/* Headline + opening pitch */}
              <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-start' }} justifyContent="space-between" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: 'text.primary', lineHeight: 1.3 }}>
                    {draft.dealHeadline}
                  </Typography>
                  <Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: '0.92rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {draft.openingPitch}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.6}>
                  <Button
                    size="small"
                    startIcon={copied === 'all' ? <CheckIcon /> : <CopyIcon />}
                    onClick={() => void handleCopy('all', draftToMarkdown(draft, partnerName))}
                    variant="outlined"
                    sx={{ textTransform: 'none' }}
                  >
                    {copied === 'all' ? 'Kopiert' : 'Kopier alt'}
                  </Button>
                  {mailto ? (
                    <Button size="small" startIcon={<EmailIcon />} variant="outlined" href={mailto} sx={{ textTransform: 'none' }}>
                      Åpne i e-post
                    </Button>
                  ) : null}
                </Stack>
              </Stack>

              {/* Three-column value exchange */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} sx={{ mt: 2.2 }}>
                <SectionCard
                  title={`Vi tilbyr ${partnerName}`}
                  items={draft.weProposeToOffer}
                  accentColor="rgba(34,197,94,0.36)"
                  bgColor="rgba(6,78,59,0.16)"
                  textColor="#bbf7d0"
                />
                <SectionCard
                  title={`${partnerName} tilbyr oss`}
                  items={draft.theyOffer}
                  accentColor="rgba(99,102,241,0.4)"
                  bgColor="rgba(30,27,75,0.32)"
                  textColor="#c7d2fe"
                />
                <SectionCard
                  title="Kommersiell ramme"
                  items={[draft.commercialFraming]}
                  accentColor="rgba(34,211,238,0.36)"
                  bgColor="rgba(8,47,73,0.24)"
                  textColor="#a5f3fc"
                  flowText
                />
              </Stack>

              {/* Numbered draft paragraphs */}
              <Box sx={{ mt: 2.2 }}>
                <SectionHeader
                  icon={<MagicIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                  title="Avtaleutkast — første utkast, ikke endelig juss"
                  onCopy={() =>
                    handleCopy(
                      'paragraphs',
                      draft.draftAgreementParagraphs.map((p, i) => `${i + 1}. ${p}`).join('\n\n'),
                    )
                  }
                  copied={copied === 'paragraphs'}
                />
                <Stack spacing={1.2} sx={{ mt: 1 }}>
                  {draft.draftAgreementParagraphs.map((para, i) => (
                    <Box
                      key={i}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        bgcolor: 'rgba(15,23,42,0.5)',
                        border: '1px solid rgba(148,163,184,0.16)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box
                          sx={{
                            minWidth: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: 'rgba(99,102,241,0.4)',
                            color: '#e0e7ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                          }}
                        >
                          §{i + 1}
                        </Box>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.55, flex: 1, whiteSpace: 'pre-wrap' }}>
                          {para}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {/* Risk + next steps side-by-side */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} sx={{ mt: 2.2 }}>
                <Box sx={{ flex: 1 }}>
                  <SectionHeader
                    icon={<WarningIcon sx={{ fontSize: 18, color: '#fde68a' }} />}
                    title="Risiko å sjekke før signering"
                    onCopy={() => handleCopy('risk', draft.riskNotes.map((x) => `• ${x}`).join('\n'))}
                    copied={copied === 'risk'}
                  />
                  <Stack spacing={0.7} sx={{ mt: 1 }}>
                    {draft.riskNotes.map((r, i) => (
                      <Box
                        key={i}
                        sx={{
                          p: 1,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(71,36,0,0.18)',
                          border: '1px solid rgba(250,204,21,0.24)',
                          display: 'flex',
                          gap: 0.8,
                          alignItems: 'flex-start',
                        }}
                      >
                        <WarningIcon sx={{ fontSize: 16, color: '#fde68a', mt: 0.3 }} />
                        <Typography sx={{ color: '#fde68a', fontSize: '0.86rem', lineHeight: 1.5 }}>
                          {r}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <SectionHeader
                    icon={<ChecklistIcon sx={{ fontSize: 18, color: '#a5f3fc' }} />}
                    title="Neste steg"
                    onCopy={() => handleCopy('next', draft.nextSteps.map((x, i) => `${i + 1}. ${x}`).join('\n'))}
                    copied={copied === 'next'}
                  />
                  <Stack spacing={0.7} sx={{ mt: 1 }}>
                    {draft.nextSteps.map((s, i) => (
                      <Box
                        key={i}
                        sx={{
                          p: 1,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(8,47,73,0.28)',
                          border: '1px solid rgba(34,211,238,0.22)',
                          display: 'flex',
                          gap: 0.8,
                          alignItems: 'flex-start',
                        }}
                      >
                        <Typography
                          sx={{
                            minWidth: 22,
                            height: 22,
                            borderRadius: '50%',
                            bgcolor: 'rgba(34,211,238,0.28)',
                            color: '#a5f3fc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </Typography>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.5 }}>
                          {s}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Stack>

              <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: '0.74rem', lineHeight: 1.5 }}>
                Generert av Claude {draft.model} · {new Date(draft.generatedAt).toLocaleString('nb-NO')}.
                Avtale-paragrafer er kun et første utkast — ved verdier over ~50 000 NOK skal endelig avtale gjennomgås av advokat.
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

interface SectionCardProps {
  title: string;
  items: string[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  flowText?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, items, bgColor, textColor, accentColor, flowText }) => (
  <Box
    sx={{
      flex: 1,
      p: 1.4,
      borderRadius: 2.4,
      bgcolor: bgColor,
      border: `1px solid ${accentColor}`,
    }}
  >
    <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: textColor, mb: 1 }}>
      {title}
    </Typography>
    {flowText ? (
      <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {items[0] ?? ''}
      </Typography>
    ) : (
      <Stack spacing={0.7}>
        {items.map((it, i) => (
          <Stack key={i} direction="row" spacing={0.7} alignItems="flex-start">
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: textColor,
                flexShrink: 0,
                mt: 0.7,
              }}
            />
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.55 }}>
              {it}
            </Typography>
          </Stack>
        ))}
      </Stack>
    )}
  </Box>
);

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  onCopy?: () => void | Promise<void>;
  copied?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, onCopy, copied }) => (
  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
    <Stack direction="row" spacing={0.7} alignItems="center">
      {icon}
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'text.secondary' }}>
        {title}
      </Typography>
    </Stack>
    {onCopy ? (
      <IconButton size="small" onClick={() => void onCopy()}>
        {copied ? <CheckIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}
      </IconButton>
    ) : null}
  </Stack>
);

export default MerchCooperationDialog;
