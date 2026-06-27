import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { TableVirtuoso } from 'react-virtuoso';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Edit,
  Delete,
  Visibility,
  CheckCircle,
} from '@mui/icons-material';
import { AdminLoading, AdminEmpty } from './design-system';

interface PaymentMethod {
  id: number;
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  payment_type: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  created_at: string;
}

export default function PaymentMethodsTable() {
  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: [ '/api/admin/payment-methods'],
    queryFn: () => apiRequest('/api/admin/payment-methods'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return <AdminLoading />;
  }

  const methods = paymentMethods?.paymentMethods || [];

  if (methods.length === 0) {
    return (
      <AdminEmpty
        title="Ingen betalingsmetoder registrert ennå."
        description="Betalingsmetoder fra brukere vil vises her når de legger til dem."
      />
    );
  }

  const getPaymentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'google_pay':
        return '🔵 Google Pay';
      case 'visa':
        return '💳 Visa';
      case 'mastercard':
        return '💳 Mastercard';
      default:
        return `💳 ${type}`;
    }
  };

  return (
    <Paper style={{ height: 600, width: '100%' }}>
      <TableVirtuoso
        data={methods}
        components={{
          Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
            <TableContainer component={Paper} {...props} ref={ref} />
          )),
          Table: (props) => (
            <Table {...props} sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }} />
          ),
          TableHead: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
            <TableHead {...props} ref={ref} />
          )),
          TableRow: ({ item: _item, ...props }) => <TableRow {...props} />,
          TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
            <TableBody {...props} ref={ref} />
          ))}}
        fixedHeaderContent={() => (
          <TableRow>
            <TableCell sx={{ width: 200, fontWeight: 600}}>Bruker</TableCell>
            <TableCell sx={{ width: 180, fontWeight: 600}}>Betalingsmetode</TableCell>
            <TableCell sx={{ width: 120, fontWeight: 600}}>Siste 4 siffer</TableCell>
            <TableCell sx={{ width: 120, fontWeight: 600}}>Utløper</TableCell>
            <TableCell align="center" sx={{ width: 100, fontWeight: 600}}>Standard</TableCell>
            <TableCell sx={{ width: 150, fontWeight: 600}}>Opprettet</TableCell>
            <TableCell align="center" sx={{ width: 150, fontWeight: 600}}>Handlinger</TableCell>
          </TableRow>
        )}
        itemContent={(index, method) => (
          <>
            <TableCell>
              <Typography variant="body2" sx={{ fontWeight: 600}}>
                {method.first_name} {method.last_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {method.user_email}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">
                {getPaymentTypeIcon(method.payment_type)}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                •••• {method.last_four}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="caption">
                {method.expiry_month}/{method.expiry_year}
              </Typography>
            </TableCell>
            <TableCell align="center">
              {method.is_default && (
                <Chip 
                  label="Standard" 
                  size="small" 
                  color="success" 
                  icon={<CheckCircle />}
                />
              )}
            </TableCell>
            <TableCell>
              <Typography variant="caption">
                {new Date(method.created_at).toLocaleDateString('nb-NO', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Typography>
            </TableCell>
            <TableCell align="center">
              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                <IconButton
                  size="small"
                  color="primary"
                  title="Vis detaljer"
                >
                  <Visibility />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  title="Rediger"
                >
                  <Edit />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  title="Slett"
                >
                  <Delete />
                </IconButton>
              </Box>
            </TableCell>
          </>
        )}
      />
    </Paper>
  );
}
