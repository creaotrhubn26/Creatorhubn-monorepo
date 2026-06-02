// Wave 3b (#28) — CSV/contact import: the biggest adoption blocker. Lets Simen
// bring his existing client list in, normalized + deduped by email.
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Button, Alert, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton,
  ToggleButtonGroup, Chip,
} from '@mui/material';
import { UploadFile as UploadIcon } from '@mui/icons-material';

// Minimal RFC-ish CSV parser (handles quoted fields + embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((c) => c.trim() !== '')) rows.push(row); }
  return rows;
}

const HEADER_MAP: Record<string, string> = {
  name: 'name', navn: 'name', fullname: 'name',
  email: 'email', 'e-post': 'email', epost: 'email', 'e-mail': 'email', mail: 'email',
  phone: 'phone', telefon: 'phone', tlf: 'phone', mobil: 'phone',
  company: 'company', firma: 'company', selskap: 'company',
  projecttype: 'projectType', type: 'projectType', prosjekttype: 'projectType',
  budget: 'budget', budsjett: 'budget',
  source: 'source', kilde: 'source',
};

interface Props { open: boolean; onClose: () => void; }

export default function CrmImportDialog({ open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'skip' | 'update'>('skip');
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<any>(null);

  const reset = () => { setRows([]); setFileName(''); setParseError(''); setResult(null); };

  const onFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) { setParseError('Fant ingen datarader.'); return; }
      const headers = grid[0].map((h) => HEADER_MAP[h.trim().toLowerCase()] || null);
      if (!headers.includes('name')) { setParseError('Fant ingen «navn»-kolonne. Headere må inkludere navn/name.'); return; }
      const parsed = grid.slice(1).map((cells) => {
        const obj: any = {};
        headers.forEach((key, idx) => { if (key) obj[key] = (cells[idx] || '').trim(); });
        return obj;
      }).filter((o) => o.name);
      setRows(parsed);
    } catch (e: any) {
      setParseError(e?.message || 'Kunne ikke lese filen.');
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => apiRequest('/api/universal-crm/customers/import', { method: 'POST', body: JSON.stringify({ rows, mode }) }),
    onSuccess: (r: any) => {
      setResult(r);
      queryClient.invalidateQueries({ queryKey: ['universal-crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['universal-crm-stats'] });
      toast({ title: `Import: ${r.created} nye, ${r.updated} oppdatert, ${r.skipped} hoppet over`, variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Import feilet', description: e?.message, variant: 'destructive' }),
  });

  const close = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>Importer kunder (CSV)</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            CSV med en header-rad. Gjenkjente kolonner: navn/name (påkrevd), e-post, telefon, firma, type, budsjett, kilde.
          </Alert>
          <Button component="label" variant="outlined" startIcon={<UploadIcon />} sx={{ alignSelf: 'flex-start' }}>
            Velg CSV-fil
            <input hidden type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </Button>
          {fileName && <Typography variant="caption" color="text.secondary">{fileName}</Typography>}
          {parseError && <Alert severity="error">{parseError}</Alert>}

          {rows.length > 0 && !result && (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`${rows.length} rader klare`} color="primary" />
                <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && setMode(v)}>
                  <ToggleButton value="skip">Hopp over duplikat</ToggleButton>
                  <ToggleButton value="update">Oppdater duplikat</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Box sx={{ maxHeight: 240, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell>Navn</TableCell><TableCell>E-post</TableCell><TableCell>Telefon</TableCell><TableCell>Firma</TableCell></TableRow></TableHead>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.email}</TableCell><TableCell>{r.phone}</TableCell><TableCell>{r.company}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 50 && <Typography variant="caption" color="text.secondary">…og {rows.length - 50} til</Typography>}
              </Box>
            </>
          )}

          {result && (
            <Alert severity={result.errors?.length ? 'warning' : 'success'}>
              Importert: <strong>{result.created}</strong> nye · {result.updated} oppdatert · {result.skipped} hoppet over
              {result.errors?.length ? ` · ${result.errors.length} feil (rad ${result.errors.slice(0, 3).map((e: any) => e.row).join(', ')}…)` : ''}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Lukk</Button>
        {rows.length > 0 && !result && (
          <Button variant="contained" disabled={importMutation.isPending} onClick={() => importMutation.mutate()}>
            {importMutation.isPending ? 'Importerer…' : `Importer ${rows.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
