import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Search,
  Refresh,
  Visibility,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Payment as PaymentIcon,
  TrendingUp,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { getPlanDisplayName } from '@shared/subscription-plans';
import PaymentMethodLogo from '../common/PaymentMethodLogo';

interface GooglePayTransaction {
  id: string;
  transactionId: string;
  userId?: string;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'google_pay';
  selectedPlan: 'basic' | 'pro' | 'enterprise';
  createdAt: string;
  completedAt?: string;
  metadata?: {
    inviteRequestId?: number;
    profession?: string;
    organizationNumber?: string;
  };
}

export default function GooglePayAdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<GooglePayTransaction | null>(null);
  const { auth } = useEnhancedMasterIntegration();

  // Fetch Google Pay transactions
  const {
    data: transactions = [],
    isLoading,
    refetch,
  } = useQuery<GooglePayTransaction[]>({
    queryKey: ['/api/admin/google-pay/transactions', statusFilter],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/google-pay/transactions?status=${statusFilter}`, { headers });
    },
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/admin/google-pay/stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/google-pay/stats', { headers });
    },
  });

  // Filter transactions
  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter((tx) => {
    const matchesSearch =
      tx.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.transactionId.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      case 'refunded': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle fontSize="small" />;
      case 'pending': return <HourglassEmpty fontSize="small" />;
      case 'failed': return <ErrorIcon fontSize="small" />;
      default: return <PaymentIcon fontSize="small" />;
    }
  };

  const formatAmount = (amount: number, currency: string = 'NOK') => {
    return `${amount.toLocaleString('nb-NO')} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('nb-NO');
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading Google Pay transactions...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Google Pay Transactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage Google Pay payments
          </Typography>
        </Box>

        <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Transactions
                    </Typography>
                    <Typography variant="h4">{stats.totalTransactions || 0}</Typography>
                  </Box>
                  <PaymentIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Completed
                    </Typography>
                    <Typography variant="h4" color="success.main">
                      {stats.completedTransactions || 0}
                    </Typography>
                  </Box>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Pending
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {stats.pendingTransactions || 0}
                    </Typography>
                  </Box>
                  <HourglassEmpty sx={{ fontSize: 40, color: 'warning.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5">{formatAmount(stats.totalRevenue || 0)}</Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={8}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by email, name, or transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )}}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="refunded">Refunded</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Transactions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Transaction ID</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Alert severity="info">No transactions found</Alert>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PaymentMethodLogo method="google_pay" size="small" />
                      <Typography variant="body2" fontFamily="monospace">
                        {transaction.transactionId.slice(0, 16)}...
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {transaction.userName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {transaction.userEmail}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={getPlanDisplayName(transaction.selectedPlan)}
                      size="small"
                      color="primary"
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {formatAmount(transaction.amount, transaction.currency)}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      icon={getStatusIcon(transaction.status)}
                      label={
                        transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)
                      }
                      size="small"
                      color={
                        getStatusColor(transaction.status) as
                          | 'success'
                          | 'warning'
                          | 'error'
                          | 'default'
                      }
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{formatDate(transaction.createdAt)}</Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => setSelectedTransaction(transaction)}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Transaction Detail Dialog would go here */}
      {selectedTransaction && (
        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Transaction Details
          </Typography>
          <pre>{JSON.stringify(selectedTransaction, null, 2)}</pre>
          <Button onClick={() => setSelectedTransaction(null) as void}>Close</Button>
        </Box>
      )}
    </Box>
  );
}
