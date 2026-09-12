/**
 * CsvImportPanel.tsx
 *
 * Manuell CSV-import (integrasjonsplanen steg 4): lim inn eller last opp
 * CSV → forhåndsvisning (preset-deteksjon, foreslått mapping, sample +
 * avviste rader) → importer. Google Trends-eksport gjenkjennes automatisk
 * og blir relative_interest-signaler (Imported-merket i all visning).
 */

import { useCallback, useState } from 'react';
import {
  Alert, Box, Button, Chip, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PreviewIcon from '@mui/icons-material/Preview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface PreviewResult {
  preset: string;
  headers: string[];
  suggestedMapping: Record<string, string> | null;
  rowCount: number;
  sampleSignals: Array<{ topic: string; metricType: string; metricValue: number; unit: string; periodStart: string }>;
  rejectedRows: number;
  errors: string[];
}

interface CommitResult {
  batchId: string;
  preset: string;
  rowCount: number;
  inserted: number;
  skippedDuplicates: number;
  rejectedRows: number;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem('creatorhub_auth_token') ?? localStorage.getItem('token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CsvImportPanel() {
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState<string | undefined>();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(async (file: File) => {
    setFilename(file.name);
    setCsv(await file.text());
    setPreview(null);
    setCommitted(null);
  }, []);

  const call = useCallback(async (endpoint: 'preview' | 'commit') => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/integrations/import/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, filename }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${r.status}`);
        return;
      }
      if (endpoint === 'preview') setPreview(body as PreviewResult);
      else { setCommitted(body as CommitResult); setPreview(null); }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [csv, filename]);

  return (
    <Box sx={{ border: '1px solid rgba(148,163,184,0.14)', borderRadius: 2, p: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <UploadFileIcon sx={{ color: '#34d399' }} />
        <Typography sx={{ color: '#fff', fontWeight: 800 }}>
          Manuell CSV-import
        </Typography>
        <Chip label="Imported-merkes" size="small" sx={{ bgcolor: '#60a5fa22', color: '#60a5fa', fontSize: 10 }} />
      </Stack>
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.85rem', mb: 2 }}>
        Google Trends-eksport gjenkjennes automatisk (relativ interesse per uke).
        Generisk CSV trenger kolonner for søkeord/tema, dato og verdi.
        Importerte data blir førsteklasses signaler med full lineage — aldri
        blandet med live-data uten merking.
      </Typography>

      <Stack spacing={1.5}>
        <Button component="label" variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
          Velg CSV-fil
          <input
            type="file" hidden accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          />
        </Button>
        <TextField
          multiline minRows={4} maxRows={10} fullWidth
          placeholder="…eller lim inn CSV-innhold her"
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setPreview(null); setCommitted(null); }}
          sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.78rem' } }}
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined" size="small" startIcon={<PreviewIcon />}
            disabled={busy || !csv.trim()}
            onClick={() => void call('preview')}
          >
            Forhåndsvis
          </Button>
          <Button
            variant="contained" size="small" startIcon={<CheckCircleIcon />}
            disabled={busy || !preview || preview.rowCount === 0}
            onClick={() => void call('commit')}
            sx={{ bgcolor: '#34d399', color: '#052e1c', '&:hover': { bgcolor: '#6ee7b7' } }}
          >
            Importer {preview ? `${preview.rowCount} signaler` : ''}
          </Button>
        </Stack>

        {error && <Alert severity="warning">{error}</Alert>}

        {preview && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
              <Chip label={preview.preset === 'google-trends-csv' ? 'Google Trends-format' : 'Generisk CSV'} size="small" />
              <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.8rem' }}>
                {preview.rowCount} gyldige signaler
                {preview.rejectedRows > 0 && ` · ${preview.rejectedRows} rader avvist`}
              </Typography>
            </Stack>
            {preview.errors.length > 0 && (
              <Alert severity="info" sx={{ mb: 1 }}>{preview.errors.join(' · ')}</Alert>
            )}
            {preview.sampleSignals.length > 0 && (
              <TableContainer sx={{ maxHeight: 220 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tema</TableCell>
                      <TableCell>Metrikk</TableCell>
                      <TableCell align="right">Verdi</TableCell>
                      <TableCell>Enhet</TableCell>
                      <TableCell>Periode</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.sampleSignals.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.topic}</TableCell>
                        <TableCell>{s.metricType}</TableCell>
                        <TableCell align="right">{s.metricValue}</TableCell>
                        <TableCell>{s.unit}</TableCell>
                        <TableCell>{s.periodStart.slice(0, 10)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {committed && (
          <Alert severity="success">
            Importert: {committed.inserted} nye signaler
            {committed.skippedDuplicates > 0 && `, ${committed.skippedDuplicates} duplikater hoppet over`}
            {committed.rejectedRows > 0 && `, ${committed.rejectedRows} rader avvist`}
            {' '}(batch {committed.batchId.slice(0, 8)}…)
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
