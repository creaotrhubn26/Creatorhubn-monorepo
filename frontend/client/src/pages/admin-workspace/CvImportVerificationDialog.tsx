import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Step,
  StepButton,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

import {
  workspaceCvApi,
  type WorkspaceCvClaim,
  type WorkspaceCvDetail,
  type WorkspaceCvProfile,
  type WorkspaceCvVerificationStatus,
  type WorkspaceProject,
  type WorkspaceProjectFile,
} from '../../services/adminRoomApi';

const COLORS = {
  surface: '#180c2a',
  surfaceRaised: '#231237',
  border: 'rgba(167, 139, 250, 0.22)',
  borderStrong: 'rgba(167, 139, 250, 0.46)',
  text: '#f8fafc',
  muted: 'rgba(241, 245, 249, 0.72)',
  dim: 'rgba(241, 245, 249, 0.5)',
  accent: '#a78bfa',
  accentStrong: '#7c3aed',
};

const fieldSx = {
  '& .MuiInputBase-root': { color: COLORS.text },
  '& .MuiInputLabel-root': { color: COLORS.dim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.borderStrong },
  '& .MuiSvgIcon-root': { color: COLORS.dim },
};

const STEPS = ['Kilde', 'Fakta', 'Mangler', 'CV-dokument'];

const CATEGORY_LABELS: Record<WorkspaceCvClaim['category'], string> = {
  identity: 'Profil',
  experience: 'Erfaring',
  education: 'Utdanning',
  certification: 'Sertifisering',
  project: 'Prosjekt',
  skill: 'Kompetanse',
  language: 'Språk',
  award: 'Utmerkelse',
  other: 'Annet',
};

const STATUS_LABELS: Record<WorkspaceCvVerificationStatus, string> = {
  source_supported: 'Kildestøttet',
  user_confirmed: 'Bekreftet',
  needs_confirmation: 'Må avklares',
  rejected: 'Avvist',
};

const STATUS_COLORS: Record<WorkspaceCvVerificationStatus, 'default' | 'success' | 'warning' | 'error'> = {
  source_supported: 'default',
  user_confirmed: 'success',
  needs_confirmation: 'warning',
  rejected: 'error',
};

type ClaimDraft = Pick<WorkspaceCvClaim, 'label' | 'organization' | 'role_title' | 'start_value' | 'end_value' | 'description'>;

interface CvImportVerificationDialogProps {
  open: boolean;
  project: WorkspaceProject;
  files: WorkspaceProjectFile[];
  onClose: () => void;
  onGenerated?: (documentId: string) => void;
}

function nameFromFile(file?: WorkspaceProjectFile): string {
  if (!file) return '';
  const base = file.file_name.replace(/\.[^.]+$/u, '').replace(/[_-]+/gu, ' ').trim();
  const withoutCvWords = base
    .replace(/\b(linkedin|cv|curriculum vitae|kilde|source)\b/giu, ' ')
    .replace(/\b20\d{2}\b/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return withoutCvWords
    .split(' ')
    .slice(0, 4)
    .map((part) => part ? `${part[0].toLocaleUpperCase('nb-NO')}${part.slice(1)}` : '')
    .join(' ');
}

function profileStatus(profile: WorkspaceCvProfile): { label: string; color: 'default' | 'warning' | 'success' } {
  if (profile.import_status === 'verified') return { label: 'Verifisert', color: 'success' };
  if (profile.import_status === 'review') return { label: 'Til gjennomgang', color: 'warning' };
  return { label: 'Utkast', color: 'default' };
}

export function CvImportVerificationDialog({
  open,
  project,
  files,
  onClose,
  onGenerated,
}: CvImportVerificationDialogProps) {
  const readyFiles = useMemo(() => files.filter((file) => file.extraction_status === 'ready'), [files]);
  const suggestedFile = useMemo(
    () => readyFiles.find((file) => /(?:linkedin|\bcv\b)/iu.test(file.file_name)) ?? readyFiles[0],
    [readyFiles],
  );
  const [step, setStep] = useState(0);
  const [profiles, setProfiles] = useState<WorkspaceCvProfile[]>([]);
  const [detail, setDetail] = useState<WorkspaceCvDetail | null>(null);
  const [personName, setPersonName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceFileId, setSourceFileId] = useState('');
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [claimDrafts, setClaimDrafts] = useState<Record<string, ClaimDraft>>({});
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyDetail = useCallback((next: WorkspaceCvDetail): void => {
    setDetail(next);
    setHeadline(next.profile.headline ?? '');
    setSummary(next.profile.professional_summary ?? '');
    setPersonName(next.profile.person_name);
    setSourceUrl(next.profile.source_url ?? '');
    setSourceFileId(next.profile.source_project_file_id);
    setClaimDrafts(Object.fromEntries(next.claims.map((claim) => [claim.id, {
      label: claim.label,
      organization: claim.organization,
      role_title: claim.role_title,
      start_value: claim.start_value,
      end_value: claim.end_value,
      description: claim.description,
    }])));
    setQuestionDrafts(Object.fromEntries(next.questions.map((question) => [question.id, question.answer ?? ''])));
  }, []);

  const loadProfiles = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const items = await workspaceCvApi.list(project.id);
      setProfiles(items);
      if (items.length) {
        const current = detail && items.some((profile) => profile.id === detail.profile.id)
          ? detail.profile.id
          : items[0].id;
        applyDetail(await workspaceCvApi.get(project.id, current));
      } else {
        setDetail(null);
        setSourceFileId(suggestedFile?.id ?? '');
        setPersonName(nameFromFile(suggestedFile));
      }
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente CV-arbeidsflaten');
    } finally {
      setLoading(false);
    }
  }, [applyDetail, detail, project.id, suggestedFile]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setNotice(null);
    void loadProfiles();
    // loadProfiles intentionally refreshes when the dialog opens, not while fields are edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  async function selectProfile(profileId: string): Promise<void> {
    setBusy(`profile:${profileId}`);
    setError(null);
    try {
      applyDetail(await workspaceCvApi.get(project.id, profileId));
      setStep(1);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke åpne CV-profilen');
    } finally {
      setBusy(null);
    }
  }

  async function importSource(): Promise<void> {
    if (!personName.trim() || !sourceFileId) return;
    setBusy('import');
    setError(null);
    setNotice(null);
    try {
      const next = await workspaceCvApi.importFromProjectFile(project.id, {
        personName: personName.trim(),
        sourceProjectFileId: sourceFileId,
        sourceUrl: sourceUrl.trim() || null,
      });
      applyDetail(next);
      setProfiles(await workspaceCvApi.list(project.id));
      setNotice(`${next.claims.length} fakta ble hentet. Kontroller dem før CV-en brukes.`);
      setStep(1);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke analysere CV-kilden');
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile(): Promise<void> {
    if (!detail) return;
    setBusy('profile-save');
    setError(null);
    try {
      applyDetail(await workspaceCvApi.updateProfile(project.id, detail.profile.id, {
        personName: personName.trim(),
        headline: headline.trim() || null,
        professionalSummary: summary.trim() || null,
      }));
      setNotice('Profilteksten er lagret.');
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre profilteksten');
    } finally {
      setBusy(null);
    }
  }

  async function updateClaim(
    claim: WorkspaceCvClaim,
    verificationStatus?: WorkspaceCvVerificationStatus,
  ): Promise<void> {
    if (!detail) return;
    const draft = claimDrafts[claim.id];
    setBusy(`claim:${claim.id}`);
    setError(null);
    try {
      applyDetail(await workspaceCvApi.updateClaim(project.id, detail.profile.id, claim.id, {
        label: draft?.label ?? claim.label,
        organization: draft?.organization ?? null,
        roleTitle: draft?.role_title ?? null,
        startValue: draft?.start_value ?? null,
        endValue: draft?.end_value ?? null,
        description: draft?.description ?? null,
        ...(verificationStatus ? { verificationStatus } : {}),
      }));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre CV-faktaet');
    } finally {
      setBusy(null);
    }
  }

  async function saveQuestion(questionId: string): Promise<void> {
    if (!detail) return;
    setBusy(`question:${questionId}`);
    setError(null);
    try {
      applyDetail(await workspaceCvApi.answerQuestion(
        project.id,
        detail.profile.id,
        questionId,
        questionDrafts[questionId]?.trim() || null,
      ));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre svaret');
    } finally {
      setBusy(null);
    }
  }

  async function generateDocument(): Promise<void> {
    if (!detail) return;
    setBusy('generate');
    setError(null);
    try {
      const next = await workspaceCvApi.generateDocument(project.id, detail.profile.id);
      applyDetail(next);
      setProfiles(await workspaceCvApi.list(project.id));
      setNotice(next.connected_document_count
        ? `CV-dokumentet er oppdatert og koblet som kilde i ${next.connected_document_count} andre dokumenter.`
        : 'CV-dokumentet er oppdatert og klart i dokumentarbeidsflaten.');
      if (next.profile.generated_document_id) onGenerated?.(next.profile.generated_document_id);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke generere CV-dokumentet');
    } finally {
      setBusy(null);
    }
  }

  const activeProfileStatus = detail ? profileStatus(detail.profile) : null;
  const canContinue = detail !== null;

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      fullWidth
      maxWidth="lg"
      data-testid="cv-import-dialog"
      PaperProps={{
        sx: {
          bgcolor: COLORS.surface,
          color: COLORS.text,
          border: `1px solid ${COLORS.border}`,
          minHeight: { xs: '92vh', md: 720 },
          maxHeight: '94vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <FactCheckOutlinedIcon sx={{ color: COLORS.accent }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" fontWeight={760}>Bygg en sporbar CV</Typography>
            <Typography sx={{ color: COLORS.dim, fontSize: 12.5 }}>{project.title}</Typography>
          </Box>
          {activeProfileStatus && <Chip size="small" label={activeProfileStatus.label} color={activeProfileStatus.color} variant="outlined" />}
        </Stack>
      </DialogTitle>
      {busy && <LinearProgress sx={{ bgcolor: 'rgba(167,139,250,.12)', '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent } }} />}
      <DialogContent sx={{ px: { xs: 2, md: 3 }, pt: 2.5 }}>
        <Stepper nonLinear activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label, index) => (
            <Step key={label} completed={Boolean(detail) && index < step}>
              <StepButton onClick={() => (index === 0 || canContinue) && setStep(index)} disabled={index > 0 && !canContinue}>
                <Typography sx={{ color: index === step ? COLORS.text : COLORS.dim, fontSize: 12 }}>{label}</Typography>
              </StepButton>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

        {loading ? (
          <Stack alignItems="center" py={12} spacing={1}><CircularProgress sx={{ color: COLORS.accent }} /><Typography sx={{ color: COLORS.dim }}>Henter CV-arbeidsflaten…</Typography></Stack>
        ) : step === 0 ? (
          <Stack spacing={2.2} data-testid="cv-source-step">
            {profiles.length > 0 && (
              <Box>
                <Typography fontWeight={700} mb={1}>Eksisterende CV-profiler</Typography>
                <Stack spacing={1}>
                  {profiles.map((profile) => {
                    const status = profileStatus(profile);
                    return (
                      <Stack key={profile.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1} sx={{ p: 1.4, border: `1px solid ${COLORS.border}`, borderRadius: 2, bgcolor: COLORS.surfaceRaised }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={0.8} flexWrap="wrap">
                            <Typography fontWeight={680}>{profile.person_name}</Typography>
                            <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 21, fontSize: 10 }} />
                          </Stack>
                          <Typography noWrap sx={{ color: COLORS.dim, fontSize: 12, mt: 0.3 }}>{profile.source_file_name} · {profile.claim_count ?? 0} fakta · {profile.open_question_count ?? 0} åpne spørsmål</Typography>
                        </Box>
                        <Button size="small" onClick={() => void selectProfile(profile.id)} disabled={Boolean(busy)}>Fortsett</Button>
                      </Stack>
                    );
                  })}
                </Stack>
                <Divider sx={{ borderColor: COLORS.border, my: 2.5 }}>eller les kilden på nytt</Divider>
              </Box>
            )}

            <Alert severity="info" icon={<LinkedInIcon />} sx={{ bgcolor: 'rgba(56,189,248,.09)', color: COLORS.text }}>
              LinkedIn-lenken lagres som proveniens. Systemet henter ikke hele profilen fra lenken. Last ned din egen profil som PDF fra LinkedIn og legg den i prosjektets filer, eller bruk en annen CV-fil du har rett til å behandle.
            </Alert>
            {readyFiles.length === 0 ? (
              <Alert severity="warning">Ingen ferdig behandlede prosjektfiler er tilgjengelige. Lukk veiviseren, last opp CV/PDF under «Filer og kunnskap», og prøv igjen.</Alert>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <TextField
                  required
                  label="Personens navn"
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                  sx={fieldSx}
                  inputProps={{ 'data-testid': 'cv-person-name' }}
                />
                <FormControl sx={fieldSx}>
                  <InputLabel id="cv-source-file-label">CV-kilde i prosjektet</InputLabel>
                  <Select
                    labelId="cv-source-file-label"
                    label="CV-kilde i prosjektet"
                    value={sourceFileId}
                    onChange={(event) => {
                      setSourceFileId(event.target.value);
                      if (!personName) setPersonName(nameFromFile(readyFiles.find((file) => file.id === event.target.value)));
                    }}
                    data-testid="cv-source-file"
                  >
                    {readyFiles.map((file) => <MenuItem key={file.id} value={file.id}>{file.file_name} · v{file.version_no}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  label="LinkedIn-profil (valgfritt)"
                  placeholder="https://www.linkedin.com/in/.../"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  sx={{ ...fieldSx, gridColumn: { md: '1 / -1' } }}
                  inputProps={{ 'data-testid': 'cv-source-url' }}
                />
              </Box>
            )}
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={busy === 'import' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlinedIcon />}
                disabled={Boolean(busy) || !personName.trim() || !sourceFileId}
                onClick={() => void importSource()}
                data-testid="cv-import-source"
                sx={{ bgcolor: COLORS.accentStrong }}
              >
                Analyser og finn fakta
              </Button>
            </Stack>
          </Stack>
        ) : step === 1 && detail ? (
          <Stack spacing={2} data-testid="cv-facts-step">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={720}>Kontroller hvert faktum</Typography>
                <Typography sx={{ color: COLORS.dim, fontSize: 12.5 }}>«Kildestøttet» betyr at teksten finnes i filen. Trykk «Bekreft» når du vet at opplysningen stemmer.</Typography>
              </Box>
              {(['user_confirmed', 'source_supported', 'needs_confirmation', 'rejected'] as const).map((status) => (
                <Chip key={status} size="small" color={STATUS_COLORS[status]} variant="outlined" label={`${STATUS_LABELS[status]} ${detail.counts[status]}`} />
              ))}
            </Stack>

            <Box sx={{ p: 1.6, bgcolor: COLORS.surfaceRaised, border: `1px solid ${COLORS.border}`, borderRadius: 2 }}>
              <Typography fontWeight={680} mb={1}>CV-overskrift og kort profil</Typography>
              <Stack spacing={1.2}>
                <TextField size="small" label="Overskrift" placeholder="F.eks. Gründer, salgsleder og produktutvikler" value={headline} onChange={(event) => setHeadline(event.target.value)} sx={fieldSx} />
                <TextField multiline minRows={2} label="Profesjonelt sammendrag" value={summary} onChange={(event) => setSummary(event.target.value)} sx={fieldSx} />
                <Stack direction="row" justifyContent="flex-end"><Button size="small" onClick={() => void saveProfile()} disabled={Boolean(busy) || !personName.trim()}>Lagre profiltekst</Button></Stack>
              </Stack>
            </Box>

            <Stack spacing={1.2}>
              {detail.claims.map((claim) => {
                const draft = claimDrafts[claim.id];
                const isBusy = busy === `claim:${claim.id}`;
                return (
                  <Box key={claim.id} data-testid={`cv-claim-${claim.id}`} sx={{ p: 1.5, border: `1px solid ${COLORS.border}`, borderRadius: 2, opacity: claim.verification_status === 'rejected' ? 0.62 : 1 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-start' }} spacing={1.2}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" mb={1}>
                          <Chip size="small" label={CATEGORY_LABELS[claim.category]} sx={{ height: 20, fontSize: 10, color: COLORS.accent }} />
                          <Chip size="small" label={STATUS_LABELS[claim.verification_status]} color={STATUS_COLORS[claim.verification_status]} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                          <Typography sx={{ color: COLORS.dim, fontSize: 11 }}>{Math.round(claim.confidence * 100)} % kildekonfidens</Typography>
                        </Stack>
                        <Stack spacing={1}>
                          <TextField size="small" fullWidth label="Fakta / tittel" value={draft?.label ?? claim.label} onChange={(event) => setClaimDrafts((current) => ({ ...current, [claim.id]: { ...(draft ?? claim), label: event.target.value } }))} sx={fieldSx} />
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
                            <TextField size="small" label="Rolle" value={draft?.role_title ?? ''} onChange={(event) => setClaimDrafts((current) => ({ ...current, [claim.id]: { ...(draft ?? claim), role_title: event.target.value || null } }))} sx={fieldSx} />
                            <TextField size="small" label="Organisasjon" value={draft?.organization ?? ''} onChange={(event) => setClaimDrafts((current) => ({ ...current, [claim.id]: { ...(draft ?? claim), organization: event.target.value || null } }))} sx={fieldSx} />
                            <TextField size="small" label="Fra" value={draft?.start_value ?? ''} onChange={(event) => setClaimDrafts((current) => ({ ...current, [claim.id]: { ...(draft ?? claim), start_value: event.target.value || null } }))} sx={fieldSx} />
                            <TextField size="small" label="Til" value={draft?.end_value ?? ''} onChange={(event) => setClaimDrafts((current) => ({ ...current, [claim.id]: { ...(draft ?? claim), end_value: event.target.value || null } }))} sx={fieldSx} />
                          </Box>
                          <TextField size="small" multiline minRows={2} label="Beskrivelse" value={draft?.description ?? ''} onChange={(event) => setClaimDrafts((current) => ({ ...current, [claim.id]: { ...(draft ?? claim), description: event.target.value || null } }))} sx={fieldSx} />
                          <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', color: COLORS.muted, '&:before': { display: 'none' } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: COLORS.dim }} />} sx={{ minHeight: 32, px: 0 }}>
                              <Typography sx={{ fontSize: 11.5, color: COLORS.dim }}>Vis nøyaktig kildeutdrag</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: 1.2, py: 1, borderLeft: `2px solid ${COLORS.borderStrong}`, bgcolor: 'rgba(167,139,250,.06)', whiteSpace: 'pre-wrap', fontSize: 12 }}>
                              {claim.evidence_text}
                            </AccordionDetails>
                          </Accordion>
                        </Stack>
                      </Box>
                      <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.6} flexWrap="wrap">
                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />} disabled={Boolean(busy)} onClick={() => void updateClaim(claim, 'user_confirmed')}>Bekreft</Button>
                        <Button size="small" color="warning" disabled={Boolean(busy)} onClick={() => void updateClaim(claim, 'needs_confirmation')}>Avklar</Button>
                        <Button size="small" color="error" disabled={Boolean(busy)} onClick={() => void updateClaim(claim, 'rejected')}>Avvis</Button>
                        <Tooltip title="Lagre tekstendringene uten å endre kontrollstatus"><Button size="small" disabled={Boolean(busy)} onClick={() => void updateClaim(claim)}>{isBusy ? 'Lagrer…' : 'Lagre'}</Button></Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        ) : step === 2 && detail ? (
          <Stack spacing={2} data-testid="cv-gaps-step">
            <Box>
              <Typography variant="h6" fontWeight={720}>Fyll hullene som kilden ikke kan svare på</Typography>
              <Typography sx={{ color: COLORS.dim, fontSize: 12.5 }}>Svarene lagres separat fra kildefaktaene og merkes som supplerende, brukerbekreftet informasjon i CV-en.</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip icon={<HelpOutlineOutlinedIcon />} label={`${detail.counts.open_questions} åpne`} color={detail.counts.open_questions ? 'warning' : 'success'} variant="outlined" />
              <Chip label={`${detail.counts.required_open_questions} obligatoriske mangler`} color={detail.counts.required_open_questions ? 'error' : 'success'} variant="outlined" />
            </Stack>
            {detail.questions.map((question) => (
              <Box key={question.id} data-testid={`cv-question-card-${question.field_key}`} sx={{ p: 1.6, border: `1px solid ${COLORS.border}`, borderRadius: 2, bgcolor: question.status === 'answered' ? 'rgba(34,197,94,.05)' : COLORS.surfaceRaised }}>
                <Stack direction="row" alignItems="flex-start" spacing={1} mb={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={650}>{question.question}</Typography>
                    <Typography sx={{ color: COLORS.dim, fontSize: 11.5 }}>{question.required ? 'Må besvares for verifisert status' : 'Valgfritt, men styrker CV-en'}</Typography>
                  </Box>
                  <Chip size="small" label={question.status === 'answered' ? 'Besvart' : 'Åpen'} color={question.status === 'answered' ? 'success' : 'warning'} variant="outlined" />
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  value={questionDrafts[question.id] ?? ''}
                  onChange={(event) => setQuestionDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Skriv et konkret, etterprøvbart svar…"
                  sx={fieldSx}
                  inputProps={{ 'data-testid': `cv-question-${question.field_key}` }}
                />
                <Stack direction="row" justifyContent="flex-end" mt={1}>
                  <Button size="small" data-testid={`cv-question-save-${question.field_key}`} onClick={() => void saveQuestion(question.id)} disabled={Boolean(busy)}>{busy === `question:${question.id}` ? 'Lagrer…' : 'Lagre svar'}</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : step === 3 && detail ? (
          <Stack spacing={2} data-testid="cv-document-step">
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={1}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={720}>Forhåndsvis og opprett CV-dokumentet</Typography>
                <Typography sx={{ color: COLORS.dim, fontSize: 12.5 }}>Dokumentet får versjonshistorikk og kobles automatisk som kilde til de andre dokumentene i prosjektet.</Typography>
              </Box>
              <Button variant="contained" startIcon={busy === 'generate' ? <CircularProgress size={16} color="inherit" /> : <DescriptionOutlinedIcon />} onClick={() => void generateDocument()} disabled={Boolean(busy)} data-testid="cv-generate-document" sx={{ bgcolor: COLORS.accentStrong }}>
                {detail.profile.generated_document_id ? 'Oppdater CV-dokument' : 'Opprett CV-dokument'}
              </Button>
            </Stack>
            {(detail.counts.required_open_questions > 0 || detail.counts.needs_confirmation > 0) && (
              <Alert severity="warning">CV-en kan opprettes nå, men vil stå «Til gjennomgang» fordi {detail.counts.required_open_questions} obligatoriske spørsmål og {detail.counts.needs_confirmation} fakta fortsatt må avklares.</Alert>
            )}
            {detail.profile.generated_document_id && (
              <Alert severity="success" action={
                <Button
                  color="inherit"
                  size="small"
                  endIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => window.location.assign(`/admin-workspace?view=documents&product=${project.product_key === 'leadgrid' ? 'leadgrid' : 'roleroom'}&document=${encodeURIComponent(detail.profile.generated_document_id || '')}`)}
                >
                  Åpne
                </Button>
              }>
                CV-dokumentet finnes i dokumentarbeidsflaten og kan brukes inline som prosjektkilde.
              </Alert>
            )}
            <Box
              component="pre"
              aria-label="Forhåndsvisning av CV"
              sx={{
                m: 0,
                p: { xs: 2, md: 4 },
                bgcolor: '#fff',
                color: '#1f2937',
                borderRadius: 2,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontFamily: 'Georgia, Cambria, serif',
                fontSize: 14,
                lineHeight: 1.7,
                boxShadow: '0 18px 50px rgba(0,0,0,.25)',
              }}
            >
              {detail.preview_markdown}
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${COLORS.border}` }}>
        <Button onClick={onClose} disabled={Boolean(busy)}>Lukk</Button>
        <Box sx={{ flex: 1 }} />
        {step > 0 && <Button onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={Boolean(busy)}>Tilbake</Button>}
        {step < STEPS.length - 1 && (
          <Button variant="contained" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} disabled={Boolean(busy) || !canContinue} sx={{ bgcolor: COLORS.accentStrong }}>Neste</Button>
        )}
        {detail && (
          <Tooltip title="Les kildefilen på nytt og behold fakta du allerede har bekreftet">
            <Button startIcon={<RefreshOutlinedIcon />} onClick={() => setStep(0)} disabled={Boolean(busy)}>Oppdater kilde</Button>
          </Tooltip>
        )}
      </DialogActions>
    </Dialog>
  );
}
