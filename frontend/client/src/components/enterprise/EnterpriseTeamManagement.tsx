/**
 * Enterprise Team Management
 * For enterprise plan users to manage their team members and see pricing
 */
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  Grid,
  Slider,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  PersonAdd,
  Delete,
  Email,
  People,
  AttachMoney,
  CheckCircle,
  Pending,
  Cancel,
  TrendingUp,
  Info,
  Security,
  Settings,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { SUBSCRIPTION_PLANS } from '@shared/subscription-plans';
import EnterpriseFeaturePermissions from './EnterpriseFeaturePermissions';

interface TeamMember {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'deactivated';
  invitedAt: string;
  joinedAt?: string;
}

interface EnterpriseTeamManagementProps {
  organizationId: string;
  currentUserCount?: number;
  profession?: string;
}

const enterprisePricing = SUBSCRIPTION_PLANS.enterprise.perUserPricing!;

// Calculate total price based on user count
function calculateEnterprisePrice(userCount: number, isAnnual: boolean = false) {
  const { basePrice, includedUsers, pricePerAdditionalUser, pricePerAdditionalUserAnnual, volumeDiscounts } = enterprisePricing;
  
  const additionalUsers = Math.max(0, userCount - includedUsers);
  const perUserPrice = isAnnual ? pricePerAdditionalUserAnnual : pricePerAdditionalUser;
  
  // Find applicable volume discount
  let discount = 0;
  for (const tier of volumeDiscounts || []) {
    if (userCount >= tier.minUsers) {
      discount = tier.discount;
    }
  }
  
  const additionalUsersCost = additionalUsers * perUserPrice * (1 - discount);
  const totalPrice = (isAnnual ? SUBSCRIPTION_PLANS.enterprise.priceAnnual : basePrice) + additionalUsersCost;
  
  return {
    basePrice: isAnnual ? SUBSCRIPTION_PLANS.enterprise.priceAnnual : basePrice,
    includedUsers,
    additionalUsers,
    perUserPrice,
    discount,
    discountPercent: Math.round(discount * 100),
    additionalUsersCost: Math.round(additionalUsersCost),
    totalPrice: Math.round(totalPrice),
    pricePerMonth: isAnnual ? Math.round(totalPrice / 12) : totalPrice,
  };
}

export default function EnterpriseTeamManagement({ organizationId, currentUserCount = 3, profession = 'photographer' }: EnterpriseTeamManagementProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [simulatedUsers, setSimulatedUsers] = useState(currentUserCount);
  const [isAnnual, setIsAnnual] = useState(false);

  // Fetch team members
  const { data: teamData, isLoading } = useQuery({
    queryKey: ['/api/enterprise/team,', organizationId],
    queryFn: () => apiRequest(`/api/enterprise/team?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });

  const teamMembers: TeamMember[] = teamData?.members || [];
  const actualUserCount = teamMembers.filter(m => m.status !== 'deactivated').length || currentUserCount;

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest('/api/enterprise/team/invite', {
        method: 'POST',
        body: JSON.stringify({ ...data, organizationId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/team'] });
      setShowAddDialog(false);
      setNewMemberEmail(', ');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiRequest(`/api/enterprise/team/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/enterprise/team'] }),
  });

  const currentPricing = calculateEnterprisePrice(actualUserCount, isAnnual);
  const simulatedPricing = calculateEnterprisePrice(simulatedUsers, isAnnual);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'member': return 'primary';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle color="success" fontSize="small" />;
      case 'pending': return <Pending color="warning" fontSize="small" />;
      case 'deactivated': return <Cancel color="error" fontSize="small" />;
      default: return null;
    }
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <People color="primary" />
                <Typography variant="h6">Teammedlemmer</Typography>
              </Box>
              <Typography variant="h4" color="primary">{actualUserCount}</Typography>
              <Typography variant="body2" color="text.secondary">
                {enterprisePricing.includedUsers} inkludert i basispris
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AttachMoney color="success" />
                <Typography variant="h6">Månedlig kostnad</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {currentPricing.pricePerMonth.toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentPricing.additionalUsers > 0 && `+${currentPricing.additionalUsers} ekstra brukere`}
                {currentPricing.discountPercent > 0 && ` (${currentPricing.discountPercent}% rabatt)`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ cursor: 'pointer' }} onClick={() => setShowPricingDialog(true)}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp color="info" />
                <Typography variant="h6">Priskalkulator</Typography>
              </Box>
              <Typography variant="body1">Se hva det koster å legge til flere brukere</Typography>
              <Button size="small" sx={{ mt: 1 }}>Beregn pris →</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Teamoversikt</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Security />}
            onClick={() => setShowPermissionsDialog(true)}
            color="secondary"
          >
            Funksjonstilganger
          </Button>
          <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setShowAddDialog(true)}>
            Legg til bruker
          </Button>
        </Box>
      </Box>

      {/* Team Members Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bruker</TableCell>
              <TableCell>E-post</TableCell>
              <TableCell>Rolle</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Lagt til</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
            ) : teamMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">Ingen teammedlemmer ennå. Legg til din første bruker.</Typography>
                </TableCell>
              </TableRow>
            ) : teamMembers.map((member) => (
              <TableRow key={member.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {member.firstName} {member.lastName || member.email.split('@')[0]}
                  </Typography>
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Chip label={member.role} size="small" color={getRoleColor(member.role) as any} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getStatusIcon(member.status)}
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{member.status}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {new Date(member.invitedAt).toLocaleDateString('nb-NO')}
                </TableCell>
                <TableCell>
                  <Tooltip title="Fjern fra team">
                    <IconButton size="small" onClick={() => removeMemberMutation.mutate(member.id)} disabled={member.role === 'admin'}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til teammedlem</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Nye brukere faktureres fra {enterprisePricing.pricePerAdditionalUser} kr/mnd per bruker.
          </Alert>
          <TextField
            label="E-postadresse"
            type="email"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            fullWidth
            sx={{ mb: 2, mt: 1 }}
            placeholder="bruker@bedrift.no"
          />
          <Typography variant="subtitle2" gutterBottom>Rolle</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['admin', 'member', 'viewer'].map((role) => (
              <Chip
                key={role}
                label={role === 'admin' ? 'Administrator' : role === 'member' ? 'Medlem' : 'Leser'}
                onClick={() => setNewMemberRole(role as any)}
                color={newMemberRole === role ? 'primary' : 'default'}
                variant={newMemberRole === role ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => addMemberMutation.mutate({ email: newMemberEmail, role: newMemberRole })}
            disabled={!newMemberEmail || addMemberMutation.isPending}
          >
            {addMemberMutation.isPending ? <CircularProgress size={20} /> : 'Send invitasjon'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pricing Calculator Dialog */}
      <Dialog open={showPricingDialog} onClose={() => setShowPricingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoney color="primary" />
          Priskalkulator for Enterprise
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" icon={<Info />} sx={{ mb: 3 }}>
            Enterprise inkluderer {enterprisePricing.includedUsers} brukere i basisprisen.
            Ekstra brukere koster {enterprisePricing.pricePerAdditionalUser} kr/mnd.
          </Alert>

          <Typography variant="subtitle2" gutterBottom>Antall brukere</Typography>
          <Slider
            value={simulatedUsers}
            onChange={(_, val) => setSimulatedUsers(val as number)}
            min={enterprisePricing.includedUsers}
            max={enterprisePricing.maxUsers || 50}
            step={1}
            marks={[
              { value: 3, label: '3' },
              { value: 10, label: '10' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
            ]}
            valueLabelDisplay="on"
            sx={{ mt: 4, mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <Chip label="Månedlig" onClick={() => setIsAnnual(false)} color={!isAnnual ? 'primary' : 'default'} />
            <Chip label="Årlig (spar 17%)" onClick={() => setIsAnnual(true)} color={isAnnual ? 'primary' : 'default'} />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Basispris ({enterprisePricing.includedUsers} brukere)</Typography>
              <Typography variant="h6">{simulatedPricing.basePrice.toLocaleString('nb-NO')} kr</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Ekstra brukere ({simulatedPricing.additionalUsers})</Typography>
              <Typography variant="h6">+{simulatedPricing.additionalUsersCost.toLocaleString('nb-NO')} kr</Typography>
            </Grid>
            {simulatedPricing.discountPercent > 0 && (
              <Grid item xs={12}>
                <Chip label={`${simulatedPricing.discountPercent}% volum-rabatt`} color="success" size="small" />
              </Grid>
            )}
            <Grid item xs={12}>
              <Divider />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Total {isAnnual ? 'årlig' : 'månedlig'}</Typography>
                <Typography variant="h4" color="primary">{simulatedPricing.totalPrice.toLocaleString('nb-NO')} kr</Typography>
              </Box>
              {isAnnual && (
                <Typography variant="body2" color="text.secondary" textAlign="right">
                  ≈ {simulatedPricing.pricePerMonth.toLocaleString('nb-NO')} kr/mnd
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPricingDialog(false)}>Lukk</Button>
          <Button variant="contained" onClick={() => { setShowPricingDialog(false); setShowAddDialog(true); }}>
            Legg til brukere
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feature Permissions Dialog */}
      <Dialog
        open={showPermissionsDialog}
        onClose={() => setShowPermissionsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security color="secondary" />
          Administrer funksjonstilganger
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Konfigurer hvilke funksjoner dine teammedlemmer har tilgang til.
            Du kan begrense sensitive funksjoner til kun administratorer.
          </Typography>
          <EnterpriseFeaturePermissions
            organizationId={organizationId}
            profession={profession}
            onSave={() => setShowPermissionsDialog(false)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPermissionsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

