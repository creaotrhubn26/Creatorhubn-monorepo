import React from 'react';
import {
  Box,
  TextField,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import UniversalFileUpload from '@/components/universal/UniversalFileUpload';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

async function api(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { 'Content-Type' : 'application/json' }, ...(options || {}) });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function ReceiptUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [merchant, setMerchant] = React.useState('');
  const [amount, setAmount] = React.useState<number | ''>('');
  const [date, setDate] = React.useState<string>(new Date().toISOString().slice(0, 10));

  const additionalMetadata: Record<string, unknown> = React.useMemo(() => {
    const normalizedAmount = typeof amount === 'number' ? amount : 0;
    return { module: 'receipts', merchant, amount: normalizedAmount, date };
  }, [merchant, amount, date]);

  return (
    <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Last opp kvittering</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
        <TextField
          label="Butikk"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          size="small"
        />
        <TextField
          label="Beløp"
          value={amount}
          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          size="small"
          type="number"
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          label="Dato"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          size="small"
          type="date"
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
      <UniversalFileUpload
        uploadEndpoint="/api/upload"
        additionalMetadata={additionalMetadata}
        allowedTypes="images"
        maxFiles={5}
        onUploadComplete={async (results: any[]) => {
          try {
            // Track as scanned with Drive fileId if available
            const first = Array.isArray(results) ? results[0] : null;
            const fileId = first?.result?.fileId;
            await api('/api/analytics/track', {
              method: 'POST',
              body: JSON.stringify({
                eventType: 'receipt_scanned',
                eventData: { id: fileId, merchant, amount: typeof amount === 'number' ? amount : 0, date },
              }),
            });
          } catch (error) {
            console.error('[Receipts] Failed to track receipt scan:', error);
          }
          onUploaded?.();
        }}
      />
	    </Box>
	  );
	}

export default withUniversalIntegration(ReceiptUploader, {
	componentId: 'receipt-uploader',
	componentName: 'Receipt Uploader',
	componentType: 'form',
	componentCategory: 'accounting',
	featureIds: ['receipt-capture'],
});








