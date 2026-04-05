import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AutoFixHigh as AutoFixHighIcon, Language as LanguageIcon } from '@mui/icons-material';
import type {
  RoleRoomAgentAccess,
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';

type RoleRoomAgentDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialWebsiteUrl?: string | null;
  initialOrganizationNumber?: string | null;
  initialCompanyName?: string | null;
  initialExtraContext?: string | null;
  initialResult?: RoleRoomAgentProducerBootstrapResult | null;
  access?: RoleRoomAgentAccess | null;
  generating?: boolean;
  applying?: boolean;
  error?: string | null;
  notice?: string | null;
  onGenerate: (input: {
    projectId: string;
    projectName: string;
    websiteUrl: string;
    organizationNumber: string;
    companyName: string;
    extraContext: string;
  }) => Promise<void> | void;
  onApply: (result: RoleRoomAgentProducerBootstrapResult) => Promise<void> | void;
};

function renderList(items: string[]) {
  if (items.length === 0) {
    return (
      <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.88rem' }}>
        Ingen forslag ennå.
      </Typography>
    );
  }

  return (
    <Stack component="ul" spacing={0.55} sx={{ pl: 2.2, m: 0 }}>
      {items.map((item) => (
        <Typography component="li" key={item} sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.9rem', lineHeight: 1.55 }}>
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

function renderClassificationChips(items: Array<string | null | undefined>) {
  const filtered = items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (filtered.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
      {filtered.map((item) => (
        <Chip
          key={item}
          label={item}
          size="small"
          variant="outlined"
          sx={{
            bgcolor: 'rgba(59,130,246,0.12)',
            color: '#dbeafe',
            borderColor: 'rgba(59,130,246,0.22)',
          }}
        />
      ))}
    </Stack>
  );
}

export default function RoleRoomAgentDialog({
  open,
  onClose,
  projectId,
  projectName,
  initialWebsiteUrl,
  initialOrganizationNumber,
  initialCompanyName,
  initialExtraContext,
  initialResult,
  access,
  generating = false,
  applying = false,
  error,
  notice,
  onGenerate,
  onApply,
}: RoleRoomAgentDialogProps) {
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? '');
  const [organizationNumber, setOrganizationNumber] = useState(initialOrganizationNumber ?? '');
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [extraContext, setExtraContext] = useState(initialExtraContext ?? '');

  useEffect(() => {
    if (!open) {
      return;
    }
    setWebsiteUrl(initialWebsiteUrl ?? '');
    setOrganizationNumber(initialOrganizationNumber ?? '');
    setCompanyName(initialCompanyName ?? '');
    setExtraContext(initialExtraContext ?? '');
  }, [initialCompanyName, initialExtraContext, initialOrganizationNumber, initialWebsiteUrl, open]);

  const result = initialResult ?? null;
  const canGenerate = companyName.trim().length > 0 || websiteUrl.trim().length > 0 || organizationNumber.trim().length > 0;
  const providerLabel = useMemo(() => {
    if (!result) return null;
    return result.provider === 'openai' ? `OpenAI · ${result.model}` : 'Fallback-analyse';
  }, [result]);
  const runtimeLabel = useMemo(() => {
    if (!access?.provider) {
      return null;
    }
    if (access.providerConfigured) {
      return `${access.provider === 'openai' ? 'OpenAI' : access.provider} · ${access.defaultModel || 'modell ikke satt'}`;
    }
    return 'OpenAI ikke konfigurert';
  }, [access]);
  const storyClassification = useMemo(() => {
    const classification = result?.storyLogicDraft?.classification;
    if (!classification || typeof classification !== 'object' || Array.isArray(classification)) {
      return null;
    }
    return classification as Record<string, unknown>;
  }, [result]);
  const contentStoryLogic = useMemo(() => {
    const value = result?.storyLogicDraft?.contentStoryLogic;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }, [result]);
  const googleReviewsLabel = useMemo(() => {
    if (!result?.businessSignals?.rating || !result.businessSignals.userRatingCount) {
      return null;
    }
    return `${result.businessSignals.rating.toFixed(1)} stjerner · ${result.businessSignals.userRatingCount} anmeldelser`;
  }, [result]);
  const retrievalLabel = useMemo(() => {
    if (!result?.retrievalMeta) {
      return null;
    }
    const meta = result.retrievalMeta;
    return `${meta.websitePagesSelected}/${meta.websitePagesReviewed} sider · ${meta.reviewsSelected}/${meta.reviewsReviewed} reviews`;
  }, [result]);

  return (
    <Dialog
      open={open}
      onClose={generating || applying ? undefined : onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid rgba(34,211,238,0.22)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)',
          boxShadow: '0 32px 90px rgba(0,0,0,0.48)',
        },
      }}
    >
      {(generating || applying) ? <LinearProgress sx={{ height: 3 }} /> : null}
      <DialogTitle
        sx={{
          pb: 1.2,
          borderBottom: '1px solid rgba(148,163,184,0.14)',
          background: 'radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, rgba(15,23,42,0) 48%)',
        }}
      >
        <Stack spacing={1.1}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2.5,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#22d3ee',
                  border: '1px solid rgba(34,211,238,0.26)',
                  bgcolor: 'rgba(8,47,73,0.22)',
                  boxShadow: '0 0 28px rgba(34,211,238,0.12)',
                }}
              >
                <AutoFixHighIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.15rem', md: '1.4rem' } }}>
                  The Role Room Agent
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.88rem' }}>
                  Admin-test for kundeprofil, brief, branding og story logikk i innholdsprodusent-flyt.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              <Chip label="Kun admin" size="small" sx={{ bgcolor: 'rgba(15,118,110,0.18)', color: '#99f6e4' }} />
              <Chip label="Innholdsprodusent" size="small" sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#f0abfc' }} />
              <Chip label={projectName} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
            </Stack>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 1.4, md: 2 } }}>
        <Stack spacing={1.4}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}
          {access && !access.providerConfigured ? (
            <Alert severity="warning">
              OpenAI er ikke konfigurert i backend ennå. Agenten fungerer fortsatt, men bruker fallback-regler i stedet for ekte <strong>{access.defaultModel || 'OpenAI-modell'}</strong>.
            </Alert>
          ) : null}
          {access?.providerConfigured ? (
            <Alert severity="info">
              Agenten er satt opp mot <strong>{runtimeLabel}</strong>. Dette er standardmotoren for analyse og forslag i denne admin-testen.
            </Alert>
          ) : null}
          {access && !access.googlePlacesConfigured ? (
            <Alert severity="info">
              Google Places/review enrichment er ikke konfigurert ennå. Agenten bruker fortsatt nettside og OpenAI, men henter ikke Google-rating, anmeldelser og stedssignaler før <strong>GOOGLE_PLACES_API_KEY</strong> er satt.
            </Alert>
          ) : null}
          {access?.googlePlacesConfigured ? (
            <Alert severity="success">
              Google Places enrichment er aktiv. Agenten kan bruke rating, anmeldelser, adresse og stedssignaler i brief og story logikk.
            </Alert>
          ) : null}
          {access && !access.cohereConfigured ? (
            <Alert severity="info">
              Cohere retrieval/rerank er ikke konfigurert ennå. Agenten fungerer fortsatt, men velger ikke automatisk de mest relevante nettsidene og reviews før <strong>COHERE_API_KEY</strong> er satt.
            </Alert>
          ) : null}
          {access?.cohereConfigured ? (
            <Alert severity="success">
              Cohere retrieval/rerank er aktiv med <strong>{access.cohereRerankModel || 'rerank-v3.5'}</strong>. Agenten bruker dette til å velge de mest relevante nettsidene og anmeldelsene før OpenAI genererer forslag.
            </Alert>
          ) : null}

          <Box
            sx={{
              p: 1.2,
              borderRadius: 3,
              border: '1px solid rgba(34,211,238,0.12)',
              bgcolor: 'rgba(15,23,42,0.52)',
            }}
          >
            <Stack spacing={1.1}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                Start med kundesignaler
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1}>
                <TextField
                  label="Nettside"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  fullWidth
                  placeholder="https://kunde.no"
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Org.nr"
                  value={organizationNumber}
                  onChange={(event) => setOrganizationNumber(event.target.value)}
                  fullWidth
                  placeholder="999 999 999"
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <TextField
                label="Firmanavn"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                fullWidth
                placeholder="Northwind Drilling"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Ekstra kontekst"
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
                fullWidth
                multiline
                minRows={3}
                placeholder="Legg inn kampanjemål, målgruppe, leveranser eller annet du vil at agenten skal ta hensyn til."
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Box>

          {result ? (
            <Stack spacing={1.2}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
                <Box
                  sx={{
                    flex: 1.25,
                    p: 1.25,
                    borderRadius: 3,
                    border: '1px solid rgba(56,189,248,0.16)',
                    bgcolor: 'rgba(15,23,42,0.48)',
                  }}
                >
                  <Stack spacing={0.9}>
                    <Stack direction="row" spacing={0.9} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Kundeprofil</Typography>
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                        {providerLabel ? (
                          <Chip label={providerLabel} size="small" sx={{ bgcolor: 'rgba(34,211,238,0.12)', color: '#a5f3fc' }} />
                        ) : null}
                        {retrievalLabel ? (
                          <Chip label={retrievalLabel} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#a7f3d0' }} />
                        ) : null}
                      </Stack>
                    </Stack>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.02rem' }}>
                      {result.companyProfile.companyName}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.84)', lineHeight: 1.65 }}>
                      {result.companyProfile.summary}
                    </Typography>
                    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                      {result.companyProfile.websiteUrl ? (
                        <Chip icon={<LanguageIcon sx={{ fontSize: '1rem !important' }} />} label={result.companyProfile.websiteUrl} size="small" />
                      ) : null}
                      {result.companyProfile.organizationNumber ? (
                        <Chip label={`Org.nr ${result.companyProfile.organizationNumber}`} size="small" />
                      ) : null}
                    </Stack>
                    {renderClassificationChips([
                      `Bransje: ${result.companyProfile.industry}`,
                      `Underbransje: ${result.companyProfile.subIndustry}`,
                      `Modell: ${result.companyProfile.businessModel}`,
                    ])}
                    <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Tilbud og målgruppe
                    </Typography>
                    {renderList([...result.companyProfile.offerings, ...result.companyProfile.targetAudience.map((entry) => `Målgruppe: ${entry}`)])}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    p: 1.25,
                    borderRadius: 3,
                    border: '1px solid rgba(244,114,182,0.18)',
                    bgcolor: 'rgba(30,41,59,0.5)',
                  }}
                >
                  <Stack spacing={0.9}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Branding og brief</Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.84)', lineHeight: 1.6 }}>
                      {result.intakeDraft.keyMessage}
                    </Typography>
                    <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      Tone og brand-signaler
                    </Typography>
                    {renderList(result.companyProfile.toneAndBrandSignals)}
                    {renderClassificationChips([
                      `Innholdskategori: ${result.companyProfile.contentCategory}`,
                      `Produksjonsgrep: ${result.companyProfile.productionApproach}`,
                    ])}
                    {result.planningDraft.brandGuide.logoUrl ? (
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        Logo funnet: {result.planningDraft.brandGuide.logoUrl}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>

              {result.businessSignals ? (
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(250,204,21,0.18)',
                    bgcolor: 'rgba(71,36,0,0.18)',
                  }}
                >
                  <Stack spacing={0.9}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent="space-between">
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Google-signaler og anmeldelser</Typography>
                      {googleReviewsLabel ? (
                        <Chip label={googleReviewsLabel} size="small" sx={{ bgcolor: 'rgba(250,204,21,0.12)', color: '#fde68a' }} />
                      ) : null}
                    </Stack>
                    {renderClassificationChips([
                      result.businessSignals.primaryTypeDisplayName ? `Kategori: ${result.businessSignals.primaryTypeDisplayName}` : null,
                      result.businessSignals.formattedAddress ? `Adresse: ${result.businessSignals.formattedAddress}` : null,
                    ])}
                    {result.businessSignals.reviewSummary ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.88)', lineHeight: 1.6 }}>
                        {result.businessSignals.reviewSummary}
                      </Typography>
                    ) : null}
                    {result.businessSignals.serviceSignals.length > 0 ? renderClassificationChips(result.businessSignals.serviceSignals) : null}
                    {result.businessSignals.topReviews.length > 0 ? (
                      <Box>
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Det kundene faktisk sier
                        </Typography>
                        {renderList(result.businessSignals.topReviews.map((review) => {
                          const prefix = review.author ? `${review.author}: ` : '';
                          return `${prefix}${review.text}`;
                        }))}
                      </Box>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2}>
                <Box
                  sx={{
                    flex: 1,
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(59,130,246,0.16)',
                    bgcolor: 'rgba(15,23,42,0.42)',
                  }}
                >
                  <Stack spacing={0.8}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Story logikk</Typography>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                      {String((result.storyLogicDraft.concept as Record<string, unknown> | undefined)?.corePremise || '')}
                    </Typography>
                    {renderClassificationChips([
                      typeof storyClassification?.industry === 'string'
                        ? `Bransje: ${storyClassification.industry}`
                        : result.planningDraft.contentLogic.industry
                          ? `Bransje: ${result.planningDraft.contentLogic.industry}`
                          : null,
                      typeof storyClassification?.subIndustry === 'string'
                        ? `Underbransje: ${storyClassification.subIndustry}`
                        : result.planningDraft.contentLogic.subIndustry
                          ? `Underbransje: ${result.planningDraft.contentLogic.subIndustry}`
                          : null,
                      typeof storyClassification?.contentCategory === 'string'
                        ? `Innhold: ${storyClassification.contentCategory}`
                        : result.planningDraft.contentLogic.contentCategory
                          ? `Innhold: ${result.planningDraft.contentLogic.contentCategory}`
                          : null,
                      typeof storyClassification?.productionApproach === 'string'
                        ? `Grep: ${storyClassification.productionApproach}`
                        : result.planningDraft.contentLogic.productionApproach
                          ? `Grep: ${result.planningDraft.contentLogic.productionApproach}`
                          : null,
                    ])}
                    <Typography sx={{ color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
                      Hovedbudskap: {result.intakeDraft.keyMessage}
                    </Typography>
                    {contentStoryLogic ? (
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2.4,
                          border: '1px solid rgba(34,211,238,0.14)',
                          bgcolor: 'rgba(8,47,73,0.14)',
                        }}
                      >
                        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.8 }}>
                          Klienten bør fylle ut
                        </Typography>
                        {renderList([
                          typeof contentStoryLogic.businessObjective === 'string' ? `Forretningsmål: ${contentStoryLogic.businessObjective}` : '',
                          typeof contentStoryLogic.audienceProblem === 'string' ? `Publikumsbehov: ${contentStoryLogic.audienceProblem}` : '',
                          typeof contentStoryLogic.keyPromise === 'string' ? `Hovedløfte: ${contentStoryLogic.keyPromise}` : '',
                          typeof contentStoryLogic.desiredAction === 'string' ? `Ønsket handling: ${contentStoryLogic.desiredAction}` : '',
                          typeof contentStoryLogic.visualFocus === 'string' ? `Visuell prioritet: ${contentStoryLogic.visualFocus}` : '',
                        ].filter(Boolean))}
                      </Box>
                    ) : null}
                    {renderList(result.nextRecommendedSteps)}
                  </Stack>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(16,185,129,0.18)',
                    bgcolor: 'rgba(6,78,59,0.14)',
                  }}
                >
                  <Stack spacing={0.8}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>Det agenten vil fylle ut</Typography>
                    {renderList([
                      `Prosjektmål: ${result.intakeDraft.projectGoal}`,
                      `Leveranser: ${result.intakeDraft.deliverables}`,
                      `Målgruppe: ${result.intakeDraft.targetAudience}`,
                      `Bransje: ${result.planningDraft.contentLogic.industry || result.companyProfile.industry}`,
                      `Kategori: ${result.planningDraft.contentLogic.contentCategory || result.companyProfile.contentCategory}`,
                      `Retning: ${String(result.planningDraft.activationPlan.direction || '')}`,
                      `Idé: ${String(result.planningDraft.activationPlan.idea || '')}`,
                    ])}
                  </Stack>
                </Box>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 1.4, md: 2 },
          pb: { xs: 1.4, md: 1.8 },
          pt: 0.4,
          justifyContent: 'space-between',
        }}
      >
        <Button onClick={onClose} disabled={generating || applying} sx={{ textTransform: 'none' }}>
          Lukk
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            disabled={!canGenerate || generating || applying}
            onClick={() => onGenerate({
              projectId,
              projectName,
              websiteUrl,
              organizationNumber,
              companyName,
              extraContext,
            })}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {generating ? 'Analyserer…' : access?.providerConfigured ? 'Analyser kunde med OpenAI' : 'Analyser kunde'}
          </Button>
          <Button
            variant="contained"
            disabled={!result || generating || applying}
            onClick={() => {
              if (result) {
                void onApply(result);
              }
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              px: 2.2,
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
            }}
          >
            {applying ? 'Bruker forslag…' : 'Bruk forslag'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
