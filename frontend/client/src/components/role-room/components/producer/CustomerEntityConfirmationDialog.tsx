/**
 * CustomerEntityConfirmationDialog — Slice 6 (kunde-confirmation).
 *
 * Multi-step flyt der producer eller kunde bekrefter:
 *   1. Bedrift  — "Stemmer det at det er Macks Invest AS?" + 5 Brreg-
 *                 kandidater når brand-navnet er tvetydig
 *   2. Adresse  — "Stemmer Lindebergåsen 23B, 1071 Oslo?" / endre
 *   3. Bydel    — "Driver dere fra Lindeberg?" / endre
 *   4. Nettside — "Stemmer holycrust.no?" / endre
 *
 * Lagres i localStorage per projectId så Slice 6's partner-discovery +
 * cooperation-generator kan bruke confirmed-data istedenfor
 * Brreg-defaults når sistnevnte er feil for mobile-aktører o.l.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Stack,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Language as WebIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import {
  findCustomerLegalEntities,
  type CustomerLegalEntityCandidate,
} from '../../services/roleRoomAgentClaudeApi';
import type {
  RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';

interface CustomerEntityConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  /** Called with confirmed entity data when producer saves. */
  onConfirm: (entity: ConfirmedCustomerEntity) => void;
}

export interface ConfirmedCustomerEntity {
  organizationNumber: string | null;
  legalName: string;
  registeredAddress: string | null;
  postalCode: string | null;
  postalCity: string | null;
  bydel: string | null;
  websiteUrl: string | null;
  confirmedAt: string;
}

const STEPS: ReadonlyArray<{ id: 'entity' | 'address' | 'bydel' | 'website'; label: string }> = [
  { id: 'entity', label: 'Bedrift' },
  { id: 'address', label: 'Adresse' },
  { id: 'bydel', label: 'Bydel' },
  { id: 'website', label: 'Nettside' },
];

const STORAGE_PREFIX = 'role-room-merch-customer-entity:';

export function loadConfirmedCustomerEntity(projectId: string | null): ConfirmedCustomerEntity | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + projectId);
    if (!raw) return null;
    return JSON.parse(raw) as ConfirmedCustomerEntity;
  } catch {
    return null;
  }
}

function saveConfirmedCustomerEntity(projectId: string, entity: ConfirmedCustomerEntity): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(entity));
  } catch {
    /* localStorage may be disabled */
  }
}

const CustomerEntityConfirmationDialog: React.FC<CustomerEntityConfirmationDialogProps> = ({
  open,
  onClose,
  projectId,
  bootstrap,
  onConfirm,
}) => {
  const initialBrandName = bootstrap?.companyProfile?.companyName ?? '';
  const initialWebsite = bootstrap?.companyProfile?.websiteUrl ?? '';

  const [stepIdx, setStepIdx] = useState(0);
  const [candidates, setCandidates] = useState<CustomerLegalEntityCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedCandidate, setPickedCandidate] = useState<CustomerLegalEntityCandidate | null>(null);

  // Editable fields — default from picked candidate, can be overridden
  // at any step.
  const [legalName, setLegalName] = useState('');
  const [orgnr, setOrgnr] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [postalCity, setPostalCity] = useState('');
  const [bydel, setBydel] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [editAddress, setEditAddress] = useState(false);
  const [editBydel, setEditBydel] = useState(false);
  const [editWebsite, setEditWebsite] = useState(false);

  // Auto-load candidates when dialog opens.
  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setStepIdx(0);
    setEditAddress(false);
    setEditBydel(false);
    setEditWebsite(false);
    void findCustomerLegalEntities({
      projectId,
      brandName: initialBrandName || initialWebsite || '',
      websiteUrl: initialWebsite || null,
    })
      .then((res) => {
        if (cancelled) return;
        setCandidates(res.candidates ?? []);
        // Auto-pick the top-scored candidate as default.
        if (res.candidates && res.candidates.length > 0) {
          const top = res.candidates[0];
          setPickedCandidate(top);
          setLegalName(top.name);
          setOrgnr(top.organizationNumber);
          setRegisteredAddress(top.registeredAddress ?? '');
          setPostalCode(top.postalCode ?? '');
          setPostalCity(top.postalCity ?? '');
          setBydel(extractBydelFromPostalCode(top.postalCode));
          setWebsiteUrl(top.website || initialWebsite || '');
        } else {
          setLegalName(initialBrandName);
          setWebsiteUrl(initialWebsite);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, initialBrandName, initialWebsite]);

  const handlePickCandidate = useCallback((c: CustomerLegalEntityCandidate) => {
    setPickedCandidate(c);
    setLegalName(c.name);
    setOrgnr(c.organizationNumber);
    setRegisteredAddress(c.registeredAddress ?? '');
    setPostalCode(c.postalCode ?? '');
    setPostalCity(c.postalCity ?? '');
    setBydel(extractBydelFromPostalCode(c.postalCode));
    if (c.website) setWebsiteUrl(c.website);
  }, []);

  const next = useCallback(() => setStepIdx((s) => Math.min(s + 1, STEPS.length - 1)), []);
  const back = useCallback(() => setStepIdx((s) => Math.max(s - 1, 0)), []);

  const isLast = stepIdx === STEPS.length - 1;

  const handleSave = useCallback(() => {
    if (!projectId) return;
    const entity: ConfirmedCustomerEntity = {
      organizationNumber: orgnr.trim() || null,
      legalName: legalName.trim(),
      registeredAddress: registeredAddress.trim() || null,
      postalCode: postalCode.trim() || null,
      postalCity: postalCity.trim() || null,
      bydel: bydel.trim().toLowerCase() || null,
      websiteUrl: websiteUrl.trim() || null,
      confirmedAt: new Date().toISOString(),
    };
    saveConfirmedCustomerEntity(projectId, entity);
    onConfirm(entity);
    onClose();
  }, [projectId, orgnr, legalName, registeredAddress, postalCode, postalCity, bydel, websiteUrl, onConfirm, onClose]);

  const stepBody = useMemo(() => {
    if (loading) {
      return (
        <Stack alignItems="center" sx={{ py: 4 }} spacing={1}>
          <CircularProgress size={24} />
          <Typography sx={{ color: 'text.secondary', fontSize: '0.86rem' }}>
            Henter Brreg-kandidater for {initialBrandName || initialWebsite}…
          </Typography>
        </Stack>
      );
    }

    switch (STEPS[stepIdx].id) {
      case 'entity':
        return (
          <Stack spacing={1.4}>
            <Typography sx={{ color: 'text.primary', fontSize: '0.96rem', fontWeight: 600 }}>
              Stemmer det at bedriften er <strong>{legalName || '(ikke valgt)'}</strong>?
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.84rem' }}>
              Vi fant {candidates.length} mulige Brreg-bedrifter for "{initialBrandName}". Velg den riktige eller endre under.
            </Typography>
            <Stack spacing={0.8}>
              {candidates.map((c) => {
                const isSelected = pickedCandidate?.organizationNumber === c.organizationNumber;
                return (
                  <Box
                    key={c.organizationNumber}
                    onClick={() => handlePickCandidate(c)}
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: isSelected
                        ? '2px solid rgba(99,102,241,0.7)'
                        : '1px solid rgba(148,163,184,0.2)',
                      bgcolor: isSelected ? 'rgba(30,27,75,0.5)' : 'rgba(15,23,42,0.5)',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: 'rgba(99,102,241,0.5)' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={0.6}>
                          <Typography sx={{ fontSize: '0.94rem', fontWeight: 700, color: 'text.primary' }}>
                            {c.name}
                          </Typography>
                          {c.scrapedFromBrandWebsite ? (
                            <Chip size="small" label="Orgnr fra nettsiden" sx={{ height: 18, fontSize: '0.66rem', bgcolor: 'rgba(34,197,94,0.16)', color: '#bbf7d0' }} />
                          ) : null}
                          {c.websiteHostMatch ? (
                            <Chip size="small" label="Nettside-match" sx={{ height: 18, fontSize: '0.66rem', bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                          ) : null}
                        </Stack>
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontFamily: 'monospace', mt: 0.2 }}>
                          {c.organizationNumber}
                        </Typography>
                        {c.registeredAddress ? (
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.2 }}>
                            {c.registeredAddress}, {c.postalCode} {c.postalCity}
                          </Typography>
                        ) : null}
                        {c.industryCode.description ? (
                          <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', mt: 0.2 }}>
                            NACE {c.industryCode.code} · {c.industryCode.description}
                          </Typography>
                        ) : null}
                        {c.matchReasons.length > 0 ? (
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic', mt: 0.4 }}>
                            {c.matchReasons.join(' · ')}
                          </Typography>
                        ) : null}
                      </Box>
                      <Chip
                        size="small"
                        label={`${c.score}`}
                        sx={{
                          bgcolor: c.score >= 80 ? 'rgba(34,197,94,0.16)' : c.score >= 50 ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.16)',
                          color: c.score >= 80 ? '#bbf7d0' : c.score >= 50 ? '#bfdbfe' : '#cbd5e1',
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
            <Divider sx={{ my: 0.5 }}>eller</Divider>
            <TextField
              label="Skriv inn juridisk navn manuelt"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Organisasjonsnummer (9 siffer, valgfritt)"
              value={orgnr}
              onChange={(e) => setOrgnr(e.target.value.replace(/\D/g, '').slice(0, 9))}
              size="small"
              fullWidth
              placeholder="933469395"
              InputProps={{ sx: { fontFamily: 'monospace' } }}
            />
          </Stack>
        );
      case 'address': {
        const display = registeredAddress
          ? `${registeredAddress}, ${postalCode} ${postalCity}`.trim()
          : '(ingen adresse)';
        return (
          <Stack spacing={1.4}>
            <Typography sx={{ color: 'text.primary', fontSize: '0.96rem', fontWeight: 600 }}>
              Stemmer adressen <strong>{display}</strong>?
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.84rem' }}>
              Brregs forretningsadresse er ofte juridisk hovedsete. Hvis dere driver fra et annet sted (mobile aktører,
              ny lokasjon), endre her.
            </Typography>
            {!editAddress ? (
              <Button
                onClick={() => setEditAddress(true)}
                startIcon={<EditIcon fontSize="small" />}
                sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                size="small"
                variant="outlined"
              >
                Endre adresse
              </Button>
            ) : (
              <Stack spacing={1}>
                <TextField label="Gateadresse" value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} size="small" fullWidth />
                <Stack direction="row" spacing={1}>
                  <TextField label="Postnummer" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4))} size="small" sx={{ maxWidth: 140 }} />
                  <TextField label="Poststed" value={postalCity} onChange={(e) => setPostalCity(e.target.value)} size="small" sx={{ flex: 1 }} />
                </Stack>
              </Stack>
            )}
          </Stack>
        );
      }
      case 'bydel':
        return (
          <Stack spacing={1.4}>
            <Typography sx={{ color: 'text.primary', fontSize: '0.96rem', fontWeight: 600 }}>
              Driver dere fra <strong>{bydel || '(ingen bydel valgt)'}</strong>?
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.84rem' }}>
              Bydel-keyword styrer hvilke lokale klubber, skoler og foreninger vi viser som potensielle samarbeidspartnere.
              Auto-detektert fra postnummer {postalCode || '(?)'}.
            </Typography>
            {!editBydel ? (
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {['lindeberg', 'manglerud', 'grorud', 'lambertseter', 'østensjø', 'tøyen', 'sinsen', 'torshov', 'skøyen', 'bjørndal'].map((b) => (
                  <Chip
                    key={b}
                    label={b}
                    onClick={() => setBydel(b)}
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      bgcolor: bydel === b ? 'rgba(99,102,241,0.32)' : 'rgba(15,23,42,0.6)',
                      color: bydel === b ? '#e0e7ff' : 'text.primary',
                      border: bydel === b ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(148,163,184,0.2)',
                    }}
                  />
                ))}
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setEditBydel(true)}
                  startIcon={<EditIcon fontSize="small" />}
                  sx={{ textTransform: 'none' }}
                >
                  Annen bydel…
                </Button>
              </Stack>
            ) : (
              <TextField
                label="Bydel / nabolag"
                value={bydel}
                onChange={(e) => setBydel(e.target.value.toLowerCase())}
                size="small"
                fullWidth
                placeholder="f.eks. furuset, bryn, ammerud"
                helperText="Brukes som søke-keyword mot Brreg-klubber. Småbokstaver."
              />
            )}
          </Stack>
        );
      case 'website':
        return (
          <Stack spacing={1.4}>
            <Typography sx={{ color: 'text.primary', fontSize: '0.96rem', fontWeight: 600 }}>
              Stemmer nettsiden <strong>{websiteUrl || '(ingen)'}</strong>?
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.84rem' }}>
              Brand-nettsiden brukes når vi henter logo, brand-farger og scraper kontakt-informasjon.
            </Typography>
            {!editWebsite ? (
              <Button
                onClick={() => setEditWebsite(true)}
                startIcon={<EditIcon fontSize="small" />}
                sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                size="small"
                variant="outlined"
              >
                Endre nettside
              </Button>
            ) : (
              <TextField
                label="Nettside"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                size="small"
                fullWidth
                placeholder="https://holycrust.no"
              />
            )}
          </Stack>
        );
    }
  }, [
    loading,
    stepIdx,
    candidates,
    initialBrandName,
    initialWebsite,
    pickedCandidate,
    legalName,
    orgnr,
    registeredAddress,
    postalCode,
    postalCity,
    bydel,
    websiteUrl,
    editAddress,
    editBydel,
    editWebsite,
    handlePickCandidate,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BusinessIcon sx={{ color: '#a5b4fc' }} />
        Bekreft kunde-data
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Lukk"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={stepIdx} alternativeLabel sx={{ mb: 2 }}>
          {STEPS.map((s, i) => (
            <Step key={s.id}>
              <StepLabel
                StepIconProps={{
                  icon:
                    s.id === 'entity' ? <BusinessIcon fontSize="small" />
                    : s.id === 'address' ? <PlaceIcon fontSize="small" />
                    : s.id === 'bydel' ? <PlaceIcon fontSize="small" />
                    : <WebIcon fontSize="small" />,
                }}
              >
                {s.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
        {stepBody}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Avbryt</Button>
        <Button onClick={back} disabled={stepIdx === 0}>Tilbake</Button>
        {!isLast ? (
          <Button onClick={next} variant="contained" startIcon={<CheckIcon fontSize="small" />}>
            Stemmer — videre
          </Button>
        ) : (
          <Button onClick={handleSave} variant="contained" startIcon={<CheckIcon fontSize="small" />}>
            Lagre kundeprofil
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

/** Map a Norwegian postal code prefix to a bydel keyword. Mirrors the
 *  backend POSTAL_AREA_HINTS table. Used to default the "bydel" step. */
function extractBydelFromPostalCode(postalCode: string | null): string {
  if (!postalCode) return '';
  const HINTS: Array<[string[], string]> = [
    [['1066', '1067', '1068', '1069', '1071'], 'lindeberg'],
    [['1051', '1052', '1053', '1054'], 'ellingsrud'],
    [['1086', '1087', '1088', '1089'], 'grorud'],
    [['0975', '0977', '0980', '0981'], 'stovner'],
    [['0671', '0672', '0673', '0691', '0692', '0694', '0695'], 'manglerud'],
    [['1166', '1167', '1168', '1169'], 'bjørndal'],
    [['1188', '1187'], 'lambertseter'],
    [['0190', '0191', '0192'], 'tøyen'],
    [['0560', '0561'], 'carl berner'],
    [['0566', '0567'], 'sinsen'],
    [['0455', '0456', '0457'], 'torshov'],
    [['0277', '0278'], 'skøyen'],
    [['0750', '0751', '0752'], 'østensjø'],
  ];
  for (const [prefixes, keyword] of HINTS) {
    if (prefixes.includes(postalCode)) return keyword;
  }
  return '';
}

export default CustomerEntityConfirmationDialog;
