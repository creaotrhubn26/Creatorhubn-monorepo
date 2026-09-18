/**
 * AccessMatrixTab — hvem får gjøre hva i et Role Room-prosjekt.
 *
 * Reglene håndheves av resolveCastingProjectAccess på serveren og har fram til
 * nå bare vært lesbare i kildekoden. Fanen henter den samme tabellen fra
 * /api/role-room/admin/access-matrix, så et nytt grant dukker opp her uten at
 * noen må vedlikeholde en kopi.
 *
 * Alle states er tegnet: laster, feil (med retry), tom, og data. Ingen
 * halvferdig flate som forklarer seg selv med en feilmelding.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';

import {
  WORKSPACE_LENS_REGISTRY,
  type RoleWorkspaceLens,
} from '../production/workspaceLensRegistry';
import authSessionService from '../../services/authSessionService';

const API = '/api/role-room/admin/access-matrix';

interface GrantEntry {
  grant: string;
  label: string;
  roles: string[];
  permissionKeys: string[];
}

interface MatrixRow {
  role: string;
  grants: Record<string, boolean>;
}

interface AccessMatrixResponse {
  grants: GrantEntry[];
  roles: string[];
  matrix: MatrixRow[];
}

/** Hvilken arbeidsflate en prosjektrolle lander i, fra lens-registeret. */
function lensForRole(role: string): RoleWorkspaceLens | null {
  const entry = WORKSPACE_LENS_REGISTRY.find(
    (candidate) => (candidate.projectRoles as readonly string[]).includes(role),
  );
  return entry ? entry.lens : null;
}

export function AccessMatrixTab(): JSX.Element {
  const [data, setData] = useState<AccessMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API, { headers: authSessionService.getAuthHeadersSync() });
      if (!response.ok) {
        throw new Error(
          response.status === 403 || response.status === 401
            ? 'Krever produkteier-sesjon.'
            : `Serveren svarte ${response.status}.`,
        );
      }
      const body = await response.json() as AccessMatrixResponse;
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grants = useMemo(() => data?.grants ?? [], [data]);
  const rows = data?.matrix ?? [];
  const explicitKeys = useMemo(
    () => Array.from(new Set(grants.flatMap((g) => g.permissionKeys))).sort(),
    [grants],
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Tilgang per prosjektrolle
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.75)' }}>
            Hentet fra reglene serveren faktisk håndhever. Prosjekteier har alle
            rettigheter og står ikke i tabellen.
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          sx={{ color: '#93a4dc' }}
        >
          Oppdater
        </Button>
      </Stack>

      {error && (
        <Alert
          severity="warning"
          action={<Button size="small" onClick={() => void load()}>Prøv igjen</Button>}
        >
          Kunne ikke hente tilgangsmatrisen. {error}
        </Alert>
      )}

      {loading && !data && (
        <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)' }}>
          <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={28} sx={{ my: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
          ))}
        </Paper>
      )}

      {!loading && !error && rows.length === 0 && (
        <Alert severity="info">
          Ingen roller gir rettigheter ennå. Det betyr at grant-tabellen er tom —
          ikke at tilgangen er åpen.
        </Alert>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.04)', overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(203,213,225,0.9)', fontWeight: 700 }}>Prosjektrolle</TableCell>
                <TableCell sx={{ color: 'rgba(203,213,225,0.9)', fontWeight: 700 }}>Arbeidsflate</TableCell>
                {grants.map((g) => (
                  <TableCell key={g.grant} align="center" sx={{ color: 'rgba(203,213,225,0.9)', fontWeight: 700 }}>
                    <Tooltip title={g.grant}>
                      <span>{g.label}</span>
                    </Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const lens = lensForRole(row.role);
                return (
                  <TableRow key={row.role} hover>
                    <TableCell sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {row.role}
                    </TableCell>
                    <TableCell>
                      {lens
                        ? <Chip size="small" label={lens} sx={{ bgcolor: 'rgba(147, 164, 220,0.18)', color: '#dfe4f3' }} />
                        : <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.7)' }}>full</Typography>}
                    </TableCell>
                    {grants.map((g) => (
                      <TableCell key={g.grant} align="center">
                        {row.grants[g.grant]
                          ? <CheckCircleIcon fontSize="small" sx={{ color: '#34d399' }} />
                          : <Typography component="span" sx={{ color: 'rgba(148,163,184,0.45)' }}>—</Typography>}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {explicitKeys.length > 0 && (
        <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)' }}>
          <Typography variant="subtitle2" sx={{ color: 'rgba(203,213,225,0.9)', mb: 0.5 }}>
            Eksplisitte grants
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.7)', mb: 1 }}>
            Et medlemskap kan få en rettighet uten å ha rollen, ved at nøkkelen
            settes i <code>permissions</code> på raden.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {explicitKeys.map((k) => (
              <Chip key={k} size="small" label={k} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }} />
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default AccessMatrixTab;
