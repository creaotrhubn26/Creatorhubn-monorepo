import { useState, useEffect, type FC, type ReactNode, type ReactElement } from 'react';
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
import { OffersIcon as LocalOfferIcon, ContractsIcon as DescriptionIcon } from './icons/CastingIcons';
import { useSnackbar } from 'notistack';
import {
  offersApi,
  contractsApi,
  CastingOffer,
  CastingContract,
} from '../services/castingApiService';

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

interface OffersContractsPanelProps {
  projectId: string;
  candidates?: Candidate[];
  roles?: Role[];
  onCandidateStatusChange?: (candidateId: string, status: string) => void;
}

const OffersContractsPanel: FC<OffersContractsPanelProps> = ({
  projectId,
  candidates = [],
  roles = [],
  onCandidateStatusChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
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

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [offersData, contractsData] = await Promise.all([
        offersApi.getAll(projectId),
        contractsApi.getAll(projectId),
      ]);
      setOffers(offersData);
      setContracts(contractsData);
    } catch (error) {
      enqueueSnackbar('Kunne ikke laste tilbud og kontrakter', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async () => {
    if (!selectedCandidate) {
      enqueueSnackbar('Velg en kandidat', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await offersApi.create({
        projectId,
        candidateId: selectedCandidate,
        roleId: selectedRole || undefined,
        compensation,
        terms,
        notes,
        responseDeadline: responseDeadline || undefined,
      });
      enqueueSnackbar('Tilbud sendt!', { variant: 'success' });
      setOfferDialogOpen(false);
      resetOfferForm();
      loadData();
      if (onCandidateStatusChange) {
        onCandidateStatusChange(selectedCandidate, 'offer_sent');
      }
    } catch (error) {
      enqueueSnackbar('Kunne ikke sende tilbud', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToOffer = async (offerId: string, status: 'accepted' | 'declined') => {
    try {
      await offersApi.respond(offerId, status);
      const offer = offers.find(o => o.id === offerId);
      enqueueSnackbar(
        status === 'accepted' ? 'Tilbud akseptert!' : 'Tilbud avslått',
        { variant: status === 'accepted' ? 'success' : 'info' }
      );
      loadData();
      if (offer && onCandidateStatusChange) {
        onCandidateStatusChange(offer.candidate_id, status === 'accepted' ? 'confirmed' : 'declined');
      }
    } catch (error) {
      enqueueSnackbar('Kunne ikke oppdatere tilbud', { variant: 'error' });
    }
  };

  const handleCreateContract = async () => {
    if (!selectedCandidate) {
      enqueueSnackbar('Velg en kandidat', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
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
      enqueueSnackbar('Kontrakt opprettet!', { variant: 'success' });
      setContractDialogOpen(false);
      resetContractForm();
      loadData();
    } catch (error) {
      enqueueSnackbar('Kunne ikke opprette kontrakt', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignContract = async (contractId: string) => {
    try {
      await contractsApi.sign(contractId);
      enqueueSnackbar('Kontrakt signert!', { variant: 'success' });
      loadData();
      const contract = contracts.find(c => c.id === contractId);
      if (contract && onCandidateStatusChange) {
        onCandidateStatusChange(contract.candidate_id, 'contracted');
      }
    } catch (error) {
      enqueueSnackbar('Kunne ikke signere kontrakt', { variant: 'error' });
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
      pending: { color: '#f59e0b', label: 'Venter', icon: <AccessTimeIcon sx={{ fontSize: 14 }} /> },
      accepted: { color: '#10b981', label: 'Akseptert', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
      declined: { color: '#ef4444', label: 'Avslått', icon: <CancelIcon sx={{ fontSize: 14 }} /> },
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
      draft: { color: '#9ca3af', label: 'Utkast' },
      pending: { color: '#f59e0b', label: 'Venter signatur' },
      signed: { color: '#10b981', label: 'Signert' },
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
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOfferIcon sx={{ color: '#8b5cf6' }} />
          Tilbud og Kontrakter
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<LocalOfferIcon />}
            onClick={() => setOfferDialogOpen(true)}
            sx={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
          >
            Nytt tilbud
          </Button>
          <Button
            variant="contained"
            startIcon={<DescriptionIcon />}
            onClick={() => setContractDialogOpen(true)}
            sx={{ bgcolor: '#8b5cf6' }}
          >
            Ny kontrakt
          </Button>
        </Box>
      </Box>

      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.87)' },
          '& .Mui-selected': { color: '#8b5cf6' },
          '& .MuiTabs-indicator': { bgcolor: '#8b5cf6' },
        }}
      >
        <Tab label={`Tilbud (${offers.length})`} icon={<LocalOfferIcon />} iconPosition="start" />
        <Tab label={`Kontrakter (${contracts.length})`} icon={<DescriptionIcon />} iconPosition="start" />
      </Tabs>

      {tabValue === 0 && (
        <Box>
          {offers.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
              Ingen tilbud sendt ennå. Klikk "Nytt tilbud" for å sende et tilbud til en kandidat.
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
                            <PersonIcon sx={{ color: '#8b5cf6' }} />
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                              {offer.candidate_name || 'Ukjent kandidat'}
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
                            Frist: {new Date(offer.response_deadline).toLocaleDateString('nb-NO')}
                          </Typography>
                        </Box>
                      )}

                      {offer.notes && (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                          {offer.notes}
                        </Typography>
                      )}

                      {offer.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleRespondToOffer(offer.id, 'accepted')}
                            sx={{ bgcolor: '#10b981', flex: 1 }}
                          >
                            Aksepter
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CancelIcon />}
                            onClick={() => handleRespondToOffer(offer.id, 'declined')}
                            sx={{ borderColor: '#ef4444', color: '#ef4444', flex: 1 }}
                          >
                            Avslå
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
              Ingen kontrakter opprettet ennå. Klikk "Ny kontrakt" for å opprette en kontrakt.
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
                              {contract.candidate_name || 'Ukjent kandidat'}
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
                          Rolle: {contract.role_name}
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

                      {contract.status !== 'signed' && (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<DrawIcon />}
                          onClick={() => handleSignContract(contract.id)}
                          sx={{ mt: 2, bgcolor: '#06b6d4' }}
                        >
                          Marker som signert
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

      <Dialog open={offerDialogOpen} onClose={() => setOfferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOfferIcon sx={{ color: '#8b5cf6' }} />
          Send tilbud
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Kandidat *</InputLabel>
              <Select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                label="Kandidat *"
              >
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Rolle</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label="Rolle"
              >
                <MenuItem value="">Ingen spesifikk rolle</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Kompensasjon"
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
              placeholder="F.eks. NOK 5000 per dag"
              fullWidth
            />

            <TextField
              label="Svarfrist"
              type="date"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Vilkår"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            <TextField
              label="Notater"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferDialogOpen(false)}>Avbryt</Button>
          <Button
            onClick={handleCreateOffer}
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
            disabled={submitting || !selectedCandidate}
            sx={{ bgcolor: '#8b5cf6' }}
          >
            Send tilbud
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={contractDialogOpen} onClose={() => setContractDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon sx={{ color: '#06b6d4' }} />
          Opprett kontrakt
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Kandidat *</InputLabel>
              <Select
                value={selectedCandidate}
                onChange={(e) => setSelectedCandidate(e.target.value)}
                label="Kandidat *"
              >
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Rolle</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label="Rolle"
              >
                <MenuItem value="">Ingen spesifikk rolle</MenuItem>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Kontrakttype"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              placeholder="F.eks. Dagengasjement, Prosjektkontrakt"
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Startdato"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Sluttdato"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <TextField
              label="Kompensasjon"
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
              placeholder="F.eks. NOK 5000 per dag"
              fullWidth
            />

            <TextField
              label="Vilkår"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContractDialogOpen(false)}>Avbryt</Button>
          <Button
            onClick={handleCreateContract}
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
            disabled={submitting || !selectedCandidate}
            sx={{ bgcolor: '#06b6d4' }}
          >
            Opprett kontrakt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OffersContractsPanel;
