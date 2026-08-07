// @ts-nocheck
import { useState, useEffect, useCallback, useMemo, type FC, type ReactNode, type ReactElement } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DrawIcon from '@mui/icons-material/Draw';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { OffersIcon as LocalOfferIcon, ContractsIcon as DescriptionIcon } from './icons/CastingIcons';
import { useSnackbar } from 'notistack';
import {
  type CastingContract,
  type CastingOffer,
  offersApi,
  contractsApi
} from '../services/castingApiService';
import settingsService from '../services/settingsService';
import { shouldUseRoleRoomLocalFallback } from '../utils/runtime';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useT } from '../../../i18n';

interface Candidate {
  id: string;
  name: string;
  photos?: string[];
  assignedRoles?: string[];
}

interface Role {
  id: string;
  name: string;
}

const LOCAL_OFFERS_NAMESPACE = 'role-room-offers';
const LOCAL_CONTRACTS_NAMESPACE = 'role-room-contracts';

interface OffersContractsPanelProps {
  projectId: string;
  candidates?: Candidate[];
  roles?: Role[];
  onCandidateStatusChange?: (candidateId: string, status: string) => void;
  readOnly?: boolean;
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

const generateLocalId = (prefix: string): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeIsoDate = (value?: string): string | undefined => {
  if (!value || !value.trim()) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00.000Z`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const sortOffers = (items: CastingOffer[]): CastingOffer[] => (
  [...items].sort((left, right) => {
    const leftDate = left.offer_date ?? '';
    const rightDate = right.offer_date ?? '';
    return rightDate.localeCompare(leftDate, 'nb-NO');
  })
);

const sortContracts = (items: CastingContract[]): CastingContract[] => (
  [...items].sort((left, right) => {
    const leftDate = left.signed_date ?? left.start_date ?? '';
    const rightDate = right.signed_date ?? right.start_date ?? '';
    return rightDate.localeCompare(leftDate, 'nb-NO');
  })
);

const OffersContractsPanel: FC<OffersContractsPanelProps> = ({
  projectId,
  candidates = [],
  roles = [],
  onCandidateStatusChange,
  readOnly = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const [tabValue, setTabValue] = useState(0);
  const [offers, setOffers] = useState<CastingOffer[]>([]);
  const [contracts, setContracts] = useState<CastingContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [compensation, setCompensation] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [contractType, setContractType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const useLocalFallback = shouldUseRoleRoomLocalFallback();

  const candidateNameById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate.name])),
    [candidates],
  );
  const roleNameById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  );
  const acceptedOffers = useMemo(
    () => offers.filter((offer) => offer.status === 'accepted'),
    [offers],
  );
  const selectableOffers = useMemo(
    () => acceptedOffers.filter((offer) => !selectedCandidate || offer.candidate_id === selectedCandidate),
    [acceptedOffers, selectedCandidate],
  );

  const hydrateOffer = useCallback((offer: CastingOffer): CastingOffer => ({
    ...offer,
    candidate_name: candidateNameById.get(offer.candidate_id) ?? offer.candidate_name ?? t('offers.unknownCandidate'),
    role_name: offer.role_id ? (roleNameById.get(offer.role_id) ?? offer.role_name) : offer.role_name,
  }), [candidateNameById, roleNameById, t]);

  const hydrateContract = useCallback((contract: CastingContract): CastingContract => ({
    ...contract,
    candidate_name: candidateNameById.get(contract.candidate_id) ?? contract.candidate_name ?? t('offers.unknownCandidate'),
    role_name: contract.role_id ? (roleNameById.get(contract.role_id) ?? contract.role_name) : contract.role_name,
  }), [candidateNameById, roleNameById, t]);

  const readLocalOffers = useCallback(async (): Promise<CastingOffer[]> => {
    const stored = await settingsService.getSetting<CastingOffer[]>(LOCAL_OFFERS_NAMESPACE, { projectId });
    return sortOffers((stored ?? []).map(hydrateOffer));
  }, [hydrateOffer, projectId]);

  const writeLocalOffers = useCallback(async (nextOffers: CastingOffer[]): Promise<CastingOffer[]> => {
    const hydratedOffers = sortOffers(nextOffers.map(hydrateOffer));
    await settingsService.setSetting(LOCAL_OFFERS_NAMESPACE, hydratedOffers, { projectId });
    return hydratedOffers;
  }, [hydrateOffer, projectId]);

  const readLocalContracts = useCallback(async (): Promise<CastingContract[]> => {
    const stored = await settingsService.getSetting<CastingContract[]>(LOCAL_CONTRACTS_NAMESPACE, { projectId });
    return sortContracts((stored ?? []).map(hydrateContract));
  }, [hydrateContract, projectId]);

  const writeLocalContracts = useCallback(async (nextContracts: CastingContract[]): Promise<CastingContract[]> => {
    const hydratedContracts = sortContracts(nextContracts.map(hydrateContract));
    await settingsService.setSetting(LOCAL_CONTRACTS_NAMESPACE, hydratedContracts, { projectId });
    return hydratedContracts;
  }, [hydrateContract, projectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [offersData, contractsData] = useLocalFallback
        ? await Promise.all([readLocalOffers(), readLocalContracts()])
        : await Promise.all([
            offersApi.getAll(projectId),
            contractsApi.getAll(projectId),
          ]);
      setOffers(offersData);
      setContracts(contractsData);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t('offers.loadError'),
        { variant: 'error' },
      );
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, projectId, readLocalContracts, readLocalOffers, useLocalFallback]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedOfferId) {
      return;
    }

    const selectedOffer = acceptedOffers.find((offer) => offer.id === selectedOfferId);
    if (!selectedOffer) {
      return;
    }

    setSelectedCandidate(selectedOffer.candidate_id);
    setSelectedRole(selectedOffer.role_id ?? '');
    setCompensation(selectedOffer.compensation ?? '');
    setTerms(selectedOffer.terms ?? '');
  }, [acceptedOffers, selectedOfferId]);

  useEffect(() => {
    if (!selectedCandidate) {
      return;
    }

    if (selectedOfferId) {
      const selectedOffer = acceptedOffers.find((offer) => offer.id === selectedOfferId);
      if (selectedOffer && selectedOffer.candidate_id !== selectedCandidate) {
        setSelectedOfferId('');
      }
    }
  }, [acceptedOffers, selectedCandidate, selectedOfferId]);

  const handleCreateOffer = async () => {
    if (!selectedCandidate) {
      enqueueSnackbar(t('offers.selectCandidate'), { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      if (useLocalFallback) {
        const createdOffer: CastingOffer = hydrateOffer({
          id: generateLocalId('offer'),
          project_id: projectId,
          candidate_id: selectedCandidate,
          role_id: selectedRole || undefined,
          offer_date: new Date().toISOString(),
          response_deadline: normalizeIsoDate(responseDeadline),
          status: 'pending',
          compensation: compensation || undefined,
          terms: terms || undefined,
          notes: notes || undefined,
          response_date: undefined,
        });
        const nextOffers = await writeLocalOffers([...offers, createdOffer]);
        setOffers(nextOffers);
      } else {
        await offersApi.create({
          projectId,
          candidateId: selectedCandidate,
          roleId: selectedRole || undefined,
          compensation,
          terms,
          notes,
          responseDeadline: responseDeadline || undefined,
        });
      }
      enqueueSnackbar(t('offers.offerSent'), { variant: 'success' });
      setOfferDialogOpen(false);
      resetOfferForm();
      if (!useLocalFallback) {
        void loadData();
      }
      if (onCandidateStatusChange) {
        onCandidateStatusChange(selectedCandidate, 'offer_sent');
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t('offers.sendError'),
        { variant: 'error' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToOffer = async (offerId: string, status: 'accepted' | 'declined') => {
    try {
      let updatedOffer: CastingOffer | undefined;
      if (useLocalFallback) {
        const nextOffers = offers.map((offer) => {
          if (offer.id !== offerId) {
            return offer;
          }
          updatedOffer = hydrateOffer({
            ...offer,
            status,
            response_date: new Date().toISOString(),
          });
          return updatedOffer;
        });
        setOffers(await writeLocalOffers(nextOffers));
      } else {
        await offersApi.respond(offerId, status);
      }
      const offer = offers.find(o => o.id === offerId);
      enqueueSnackbar(
        status === 'accepted' ? t('offers.offerAccepted') : t('offers.offerDeclined'),
        { variant: status === 'accepted' ? 'success' : 'info' }
      );
      if (!useLocalFallback) {
        void loadData();
      }
      const nextOffer = updatedOffer ?? offer;
      if (nextOffer && onCandidateStatusChange) {
        onCandidateStatusChange(nextOffer.candidate_id, status === 'accepted' ? 'confirmed' : 'declined');
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t('offers.updateError'),
        { variant: 'error' },
      );
    }
  };

  const handleCreateContract = async () => {
    if (!selectedCandidate) {
      enqueueSnackbar(t('offers.selectCandidate'), { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      if (useLocalFallback) {
        const createdContract: CastingContract = hydrateContract({
          id: generateLocalId('contract'),
          project_id: projectId,
          candidate_id: selectedCandidate,
          offer_id: selectedOfferId || undefined,
          role_id: selectedRole || undefined,
          contract_type: contractType || undefined,
          start_date: normalizeIsoDate(startDate),
          end_date: normalizeIsoDate(endDate),
          compensation: compensation || undefined,
          terms: terms || undefined,
          signed_date: undefined,
          status: 'pending',
          document_url: undefined,
        });
        const nextContracts = await writeLocalContracts([...contracts, createdContract]);
        setContracts(nextContracts);
      } else {
        await contractsApi.create({
          projectId,
          candidateId: selectedCandidate,
          offerId: selectedOfferId || undefined,
          roleId: selectedRole || undefined,
          contractType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          compensation,
          terms,
        });
      }
      enqueueSnackbar(t('offers.contractCreated'), { variant: 'success' });
      setContractDialogOpen(false);
      resetContractForm();
      if (!useLocalFallback) {
        void loadData();
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t('offers.createError'),
        { variant: 'error' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignContract = async (contractId: string) => {
    try {
      let updatedContract: CastingContract | undefined;
      if (useLocalFallback) {
        const nextContracts = contracts.map((contract) => {
          if (contract.id !== contractId) {
            return contract;
          }
          updatedContract = hydrateContract({
            ...contract,
            status: 'signed',
            signed_date: new Date().toISOString(),
          });
          return updatedContract;
        });
        setContracts(await writeLocalContracts(nextContracts));
      } else {
        await contractsApi.sign(contractId);
      }
      enqueueSnackbar(t('offers.contractSignedToast'), { variant: 'success' });
      if (!useLocalFallback) {
        void loadData();
      }
      const contract = contracts.find(c => c.id === contractId);
      const nextContract = updatedContract ?? contract;
      if (nextContract && onCandidateStatusChange) {
        onCandidateStatusChange(nextContract.candidate_id, 'contracted');
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t('offers.signError'),
        { variant: 'error' },
      );
    }
  };

  const resetOfferForm = () => {
    setSelectedCandidate('');
    setSelectedRole('');
    setCompensation('');
    setTerms('');
    setNotes('');
    setResponseDeadline('');
  };

  const resetContractForm = () => {
    setSelectedCandidate('');
    setSelectedRole('');
    setSelectedOfferId('');
    setContractType('');
    setStartDate('');
    setEndDate('');
    setCompensation('');
    setTerms('');
  };

  const getOfferStatusChip = (status: string) => {
    const configs: Record<string, { color: string; label: string; icon: ReactNode }> = {
      pending: { color: '#f59e0b', label: t('offers.statusPending'), icon: <AccessTimeIcon sx={{ fontSize: 14 }} /> },
      accepted: { color: '#10b981', label: t('offers.statusAccepted'), icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
      declined: { color: '#ef4444', label: t('offers.statusDeclined'), icon: <CancelIcon sx={{ fontSize: 14 }} /> },
    };
    const config = configs[status] || configs.pending;
    return (
      <Chip
        icon={config.icon as ReactElement}
        label={config.label}
        size="small"
        sx={{
          bgcolor: `${config.color}20`,
          color: config.color,
          fontWeight: 600,
          '& .MuiChip-icon': { color: config.color },
        }}
      />
    );
  };

  const getContractStatusChip = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      draft: { color: '#9ca3af', label: t('offers.contractDraft') },
      pending: { color: '#f59e0b', label: t('offers.contractPending') },
      signed: { color: '#10b981', label: t('offers.contractSigned') },
    };
    const config = configs[status] || configs.draft;
    return (
      <Chip
        label={config.label}
        size="small"
        sx={{
          bgcolor: `${config.color}20`,
          color: config.color,
          fontWeight: 600,
        }}
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalOfferIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />
            {t('offers.title')}
          </Typography>
          <Tooltip title={t('offers.refreshTooltip')}>
            <IconButton
              size="small"
              onClick={() => { void loadData(); }}
              sx={{ color: 'rgba(255,255,255,0.72)' }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {!readOnly ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<LocalOfferIcon />}
              onClick={() => setOfferDialogOpen(true)}
              sx={{ borderColor: 'var(--role-violet, #8b5cf6)', color: 'var(--role-violet, #8b5cf6)' }}
            >
              {t('offers.newOffer')}
            </Button>
            <Button
              variant="contained"
              startIcon={<DescriptionIcon />}
              onClick={() => setContractDialogOpen(true)}
              sx={{ bgcolor: 'var(--role-violet, #8b5cf6)' }}
            >
              {t('offers.newContract')}
            </Button>
          </Box>
        ) : null}
      </Box>

      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.87)' },
          '& .Mui-selected': { color: 'var(--role-violet, #8b5cf6)' },
          '& .MuiTabs-indicator': { bgcolor: 'var(--role-violet, #8b5cf6)' },
        }}
      >
        <Tab label={t('offers.tabOffers', { n: offers.length })} icon={<LocalOfferIcon />} iconPosition="start" />
        <Tab label={t('offers.tabContracts', { n: contracts.length })} icon={<DescriptionIcon />} iconPosition="start" />
      </Tabs>

      <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

      {tabValue === 0 && (
        <Box>
          {offers.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
              {t('offers.emptyOffers')}
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {offers.map((offer) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={offer.id}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'rgba(139,92,246,0.2)', width: 40, height: 40 }}>
                            <PersonIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                              {offer.candidate_name || t('offers.unknownCandidate')}
                            </Typography>
                            {offer.role_name && (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                                {offer.role_name}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        {getOfferStatusChip(offer.status)}
                      </Box>

                      {offer.compensation && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                          <AttachMoneyIcon sx={{ fontSize: 16, color: '#10b981' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            {offer.compensation}
                          </Typography>
                        </Box>
                      )}

                      {offer.response_deadline && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                          <AccessTimeIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            {t('offers.deadline', { date: new Date(offer.response_deadline).toLocaleDateString('nb-NO') })}
                          </Typography>
                        </Box>
                      )}

                      {offer.notes && (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                          {offer.notes}
                        </Typography>
                      )}

                      {!readOnly && offer.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleRespondToOffer(offer.id, 'accepted')}
                            sx={{ bgcolor: '#10b981', flex: 1 }}
                          >
                            {t('offers.accept')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CancelIcon />}
                            onClick={() => handleRespondToOffer(offer.id, 'declined')}
                            sx={{ borderColor: '#ef4444', color: '#ef4444', flex: 1 }}
                          >
                            {t('offers.decline')}
                          </Button>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {tabValue === 1 && (
        <Box>
          {contracts.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
              {t('offers.emptyContracts')}
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {contracts.map((contract) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={contract.id}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'rgba(6,182,212,0.2)', width: 40, height: 40 }}>
                            <DescriptionIcon sx={{ color: '#06b6d4' }} />
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                              {contract.candidate_name || t('offers.unknownCandidate')}
                            </Typography>
                            {contract.contract_type && (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                                {contract.contract_type}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        {getContractStatusChip(contract.status)}
                      </Box>

                      {contract.role_name && (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                          {t('offers.rolePrefix', { role: contract.role_name })}
                        </Typography>
                      )}

                      {(contract.start_date || contract.end_date) && (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                          {contract.start_date && new Date(contract.start_date).toLocaleDateString('nb-NO')}
                          {contract.start_date && contract.end_date && ' - '}
                          {contract.end_date && new Date(contract.end_date).toLocaleDateString('nb-NO')}
                        </Typography>
                      )}

                      {contract.compensation && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AttachMoneyIcon sx={{ fontSize: 16, color: '#10b981' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            {contract.compensation}
                          </Typography>
                        </Box>
                      )}

                      {!readOnly && contract.status !== 'signed' && (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<DrawIcon />}
                          onClick={() => handleSignContract(contract.id)}
                          sx={{ mt: 2, bgcolor: '#06b6d4' }}
                        >
                          {t('offers.markSigned')}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      <Dialog open={!readOnly && offerDialogOpen} onClose={() => setOfferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOfferIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />
          {t('offers.sendOffer')}
        </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>{t('offers.candidate')}</InputLabel>
              <Select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                label={t('offers.candidate')}
              >
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t('offers.role')}</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label={t('offers.role')}
              >
                <MenuItem value="">{t('offers.noSpecificRole')}</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t('offers.compensation')}
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
              placeholder={t('offers.compensationPlaceholder')}
              fullWidth
            />

            <TextField
              label={t('offers.responseDeadline')}
              type="date"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label={t('offers.terms')}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            <TextField
              label={t('offers.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
            <GlobalMentionHelper
              text={notes}
              localCandidates={[
                ...new Set(
                  [
                    ...candidates.map((candidate) => candidate.name),
                    ...roles.map((role) => role.name),
                  ]
                    .filter((value): value is string => typeof value === 'string')
                    .map((value) => value.trim())
                    .filter((value) => value.length >= 2),
                ),
              ]}
              onApplySuggestion={(name) => setNotes((prev) => applyMentionSuggestion(prev, name))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferDialogOpen(false)}>{t('offers.cancel')}</Button>
          <Button
            onClick={handleCreateOffer}
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
            disabled={submitting || !selectedCandidate}
            sx={{ bgcolor: 'var(--role-violet, #8b5cf6)' }}
          >
            {t('offers.sendOffer')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!readOnly && contractDialogOpen} onClose={() => setContractDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon sx={{ color: '#06b6d4' }} />
          {t('offers.createContract')}
        </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>{t('offers.basedOnOffer')}</InputLabel>
              <Select
                value={selectedOfferId}
                onChange={(e) => setSelectedOfferId(e.target.value)}
                label={t('offers.basedOnOffer')}
              >
                <MenuItem value="">{t('offers.createWithoutOffer')}</MenuItem>
                {selectableOffers.map((offer) => (
                  <MenuItem key={offer.id} value={offer.id}>
                    {`${offer.candidate_name || t('offers.unknownCandidate')}${offer.role_name ? ` · ${offer.role_name}` : ''}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t('offers.candidate')}</InputLabel>
              <Select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                label={t('offers.candidate')}
              >
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>{t('offers.role')}</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label={t('offers.role')}
              >
                <MenuItem value="">{t('offers.noSpecificRole')}</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t('offers.contractType')}
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              placeholder={t('offers.contractTypePlaceholder')}
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label={t('offers.startDate')}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label={t('offers.endDate')}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <TextField
              label={t('offers.compensation')}
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
              placeholder={t('offers.compensationPlaceholder')}
              fullWidth
            />

            <TextField
              label={t('offers.terms')}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContractDialogOpen(false)}>{t('offers.cancel')}</Button>
          <Button
            onClick={handleCreateContract}
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
            disabled={submitting || !selectedCandidate}
            sx={{ bgcolor: '#06b6d4' }}
          >
            {t('offers.createContract')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OffersContractsPanel;
