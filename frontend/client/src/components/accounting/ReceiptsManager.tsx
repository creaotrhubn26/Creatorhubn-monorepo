import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Chip, Button, Select, MenuItem } from '@mui/material';
import ReceiptUploader from './ReceiptUploader';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

async function api(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { 'Content-Type' : 'application/json' }, ...(options || {}) });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

const VAT_RATES = [25, 15, 12, 0];

function ReceiptsManager() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['/api/accounting/receipts'],
    queryFn: () => api('/api/accounting/receipts'),
    staleTime: 30_000,
  });

  const [selected, setSelected] = React.useState<Record<string, { vatRate: number }>>({});

  const registerMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(selected).map(([id, v]) => {
        const r = (data?.receipts || []).find((x: any) => x.id === id);
        return { id, amount: r?.amount, date: r?.date, merchant: r?.merchant, category: r?.category, vatRate: v.vatRate };
      });
      return api('/api/accounting/receipts/register-bulk', { method: 'POST', body: JSON.stringify({ items }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/receipts'] });
      setSelected({});
    },
  });

  const receipts = data?.receipts || [];
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Kvitteringer</Typography>
      <ReceiptUploader onUploaded={() => queryClient.invalidateQueries({ queryKey: ['/api/accounting/receipts'] })} />
      {isLoading ? (
        <Typography variant="body2">Laster…</Typography>
      ) : (
        <>
          <Box sx={{ mb: 1, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              disabled={Object.keys(selected).length === 0}
              onClick={() => registerMutation.mutate()}
            >
              Registrer valgte
            </Button>
            <Typography variant="caption" sx={{ alignSelf: 'center' }}>
              Valgt: {Object.keys(selected).length}
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Dato</TableCell>
                <TableCell>Beløp</TableCell>
                <TableCell>Butikk</TableCell>
                <TableCell>Kategori</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>MVA</TableCell>
                <TableCell>Velg</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receipts.map((r: any) => {
                const missing = (r.missing || []) as string[];
                const invalid = missing.length > 0;
                const selectedVat = selected[r.id]?.vatRate ?? 25;
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.date || <Chip label="Mangler dato" size="small" color="warning" />}</TableCell>
                    <TableCell>{r.amount > 0 ? r.amount : <Chip label="Mangler beløp" size="small" color="warning" />}</TableCell>
                    <TableCell>{r.merchant || <Chip label="Mangler butikk" size="small" color="warning" />}</TableCell>
                    <TableCell>{r.category || <Chip label="Mangler kategori" size="small" color="warning" />}</TableCell>
                    <TableCell>
                      {r.registered ? <Chip label="Registrert" size="small" color="success" /> : invalid ? <Chip label="Ufullstendig" size="small" color="error" /> : <Chip label="Ikke registrert" size="small" />}
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={selectedVat}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [r.id]: { vatRate: Number(e.target.value) } }))}
                        disabled={r.registered}
                      >
                        {VAT_RATES.map((v) => (
                          <MenuItem key={v} value={v}>{v}%</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={r.registered || invalid}
                        onClick={() => setSelected((prev) => ({ ...prev, [r.id]: { vatRate: selectedVat } }))}
                      >
                        Velg
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
	    </Box>
	  );
	}

export default withUniversalIntegration(ReceiptsManager, {
	componentId: 'receipts-manager',
	componentName: 'Receipts Manager',
	componentType: 'dashboard',
	componentCategory: 'accounting',
	featureIds: ['receipt-registration', 'vat-selection'],
});


