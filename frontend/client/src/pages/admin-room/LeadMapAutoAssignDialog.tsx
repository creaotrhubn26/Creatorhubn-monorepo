/**
 * LeadMapAutoAssignDialog.tsx
 *
 * Salgssjef-knapp som triggrer auto-tildeling av ventende leads.
 * Velg strategi (territorium vs round-robin) + max-leads-cap.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField,
  Typography,
} from '@mui/material';
import RotateLeftOutlinedIcon from '@mui/icons-material/RotateLeftOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';

interface Props {
  open: boolean;
  organizationId: string | null;
  onClose: () => void;
  onAssigned?: (count: number) => void;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

export default function LeadMapAutoAssignDialog({ open, organizationId, onClose, onAssigned }: Props) {
  const [strategy, setStrategy] = useState<'territory' | 'round_robin'>('territory');
  const [limit, setLimit] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ assigned: number; per_match_type: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo<HeadersInit>(
    () => ({ Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' }),
    [],
  );

  const handleAssign = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch('/api/admin-room/lead-map/leads/auto-assign', {
        method: 'POST', headers,
        body: JSON.stringify({ organization_id: organizationId, strategy, limit }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const counts: Record<string, number> = {};
      for (const a of (j.assignments ?? [])) {
        counts[a.matchType] = (counts[a.matchType] ?? 0) + 1;
      }
      setResult({ assigned: j.assigned ?? 0, per_match_type: counts });
      onAssigned?.(j.assigned ?? 0);
    } catch (err) {
      setError(String(err));
    } finally { setLoading(false); }
  }, [organizationId, strategy, limit, headers, onAssigned]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Auto-tildel ventende leads</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {result.assigned} leads tildelt
            </Typography>
            {Object.entries(result.per_match_type).map(([key, n]) => (
              <Typography key={key} variant="body2">
                · {labelFor(key)}: {n}
              </Typography>
            ))}
          </Alert>
        ) : (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Tildeler alle ikke-tildelte leads i organisasjonen til
              salgskonsulenter/promotører basert på valgt strategi.
            </Typography>

            <FormControl>
              <Typography variant="subtitle2" gutterBottom>Strategi</Typography>
              <RadioGroup value={strategy} onChange={(e) => setStrategy(e.target.value as 'territory' | 'round_robin')}>
                <FormControlLabel
                  value="territory"
                  control={<Radio />}
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <MapOutlinedIcon fontSize="small" sx={{ color: 'success.main' }} />
                      <Stack>
                        <Typography variant="body2">Territorium</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Matcher lead.city/address mot user_profiles.territory.
                          Fall-back: round-robin hvis ingen match.
                        </Typography>
                      </Stack>
                    </Stack>
                  }
                />
                <FormControlLabel
                  value="round_robin"
                  control={<Radio />}
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <RotateLeftOutlinedIcon fontSize="small" sx={{ color: 'info.main' }} />
                      <Stack>
                        <Typography variant="body2">Round-robin</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Jevn fordeling — neste lead går til neste konsulent i listen.
                        </Typography>
                      </Stack>
                    </Stack>
                  }
                />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Max leads å tildele i denne runden"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              inputProps={{ min: 1, max: 200 }}
              helperText="Begrenser én batch — kjør igjen for flere"
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={onClose}>Ferdig</Button>
        ) : (
          <>
            <Button onClick={onClose}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={handleAssign}
              disabled={loading || !organizationId}
            >
              {loading ? 'Tildeler…' : 'Tildel'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function labelFor(matchType: string): string {
  switch (matchType) {
    case 'auto_territory': return 'Territorium-match';
    case 'auto_round_robin': return 'Round-robin';
    case 'manual': return 'Manuell';
    default: return matchType;
  }
}
