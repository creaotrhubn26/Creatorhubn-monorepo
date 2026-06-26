/**
 * LeadMapPermissionsMatrix.tsx
 *
 * Sammenligning-tabell: hver permission × hver rolle, med tydelig
 * ✓/✗ for hva hver rolle har og IKKE har.
 *
 * Brukes av admin/salgssjef/teamleder for å:
 *  - Forstå hva salgskonsulent ser/ikke ser
 *  - Verifisere RBAC før de inviterer noen til en rolle
 *  - Forklare permissions-modellen til nye ledere
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Chip, Dialog, DialogContent, DialogTitle, IconButton,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CloseIcon from '@mui/icons-material/Close';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Hvis satt: highlight denne kolonnen (typisk rollen man forhåndsviser som) */
  highlightRole?: string | null;
}

interface PermissionDef {
  key: string;
  category: string;
  description: string;
}

/** Hurtig-oppsummering øverst når en rolle er highlightet — viser
 *  hva denne rollen HAR og IKKE HAR, gruppert per kategori. */
function RoleSummaryHeader({
  highlightRole, roleDefaults, catalogSize, catalog,
}: {
  highlightRole: string;
  roleDefaults: Record<string, Set<string>>;
  catalogSize: number;
  catalog: PermissionDef[];
}) {
  const roleMeta = ROLE_COLUMNS.find((r) => r.key === highlightRole);
  const has = roleDefaults[highlightRole] ?? new Set<string>();
  const total = catalogSize;
  const granted = has.size;
  const missing = total - granted;
  // Gruppér missing per kategori for sammendrag
  const missingByCategory: Record<string, number> = {};
  const grantedByCategory: Record<string, number> = {};
  for (const p of catalog) {
    const target = has.has(p.key) ? grantedByCategory : missingByCategory;
    target[p.category] = (target[p.category] ?? 0) + 1;
  }
  return (
    <Alert
      severity={granted === total ? 'success' : 'info'}
      icon={false}
      sx={{
        mb: 2,
        bgcolor: `${roleMeta?.color ?? '#c084fc'}15`,
        border: `1px solid ${roleMeta?.color ?? '#c084fc'}66`,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: roleMeta?.color }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {roleMeta?.label ?? highlightRole}
          </Typography>
          <Chip
            size="small"
            icon={<CheckCircleOutlinedIcon />}
            label={`${granted} har tilgang`}
            sx={{ bgcolor: '#34d39922', color: '#34d399', fontWeight: 700 }}
          />
          {missing > 0 && (
            <Chip
              size="small"
              icon={<BlockOutlinedIcon />}
              label={`${missing} ikke tilgang`}
              sx={{ bgcolor: '#f8717122', color: '#f87171', fontWeight: 700 }}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          {Object.entries(grantedByCategory).slice(0, 6).map(([cat, n]) => (
            <Typography key={cat} variant="caption" color="text.secondary">
              ✓ {cat}: {n}
            </Typography>
          ))}
        </Stack>
        {Object.keys(missingByCategory).length > 0 && (
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {Object.entries(missingByCategory).slice(0, 6).map(([cat, n]) => (
              <Typography key={cat} variant="caption" sx={{ color: '#f87171' }}>
                ✗ {cat}: {n}
              </Typography>
            ))}
          </Stack>
        )}
      </Stack>
    </Alert>
  );
}

const ROLE_COLUMNS = [
  { key: 'admin', label: 'Admin', color: '#c084fc' },
  { key: 'salgssjef', label: 'Salgssjef', color: '#f97316' },
  { key: 'teamleder', label: 'Teamleder', color: '#fbbf24' },
  { key: 'salgskonsulent', label: 'Salgskonsulent', color: '#34d399' },
  { key: 'promotor', label: 'Promotør', color: '#60a5fa' },
  { key: 'member', label: 'Medlem', color: '#a78bfa' },
  { key: 'viewer', label: 'Leser', color: '#9ca3af' },
];

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rr_lead_map_active_org');
}

export default function LeadMapPermissionsMatrix({ open, onClose, highlightRole }: Props) {
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const token = getAuthToken();
    const orgId = getActiveOrgId();
    if (!token || !orgId) return;
    setLoading(true); setError(null);
    (async () => {
      try {
        const [catalogRes, defRes] = await Promise.all([
          fetch('/api/admin-room/lead-map/permissions/catalog', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/admin-room/lead-map/organizations/${orgId}/role-defaults`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (!catalogRes.ok) throw new Error(`Catalog HTTP ${catalogRes.status}`);
        if (!defRes.ok) throw new Error(`Defaults HTTP ${defRes.status}`);
        const catalogJson = await catalogRes.json();
        const defJson = await defRes.json();
        const permissions: PermissionDef[] = Array.isArray(catalogJson.permissions) ? catalogJson.permissions : [];
        setCatalog(permissions);
        const defs: Record<string, Set<string>> = {};
        for (const [role, perms] of Object.entries(defJson.defaults ?? {})) {
          defs[role] = new Set(Array.isArray(perms) ? (perms as string[]) : []);
        }
        // Admin har alltid alle — backend har sikkerhets-floor
        defs.admin = new Set(permissions.map((p) => p.key));
        setRoleDefaults(defs);
      } catch (err) {
        setError(String(err));
      } finally { setLoading(false); }
    })();
  }, [open]);

  // Gruppér permissions per kategori
  const groupedCatalog = useMemo(() => {
    const groups: Record<string, PermissionDef[]> = {};
    for (const p of catalog) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [catalog]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h6">Tillatelses-matrise</Typography>
          <Typography variant="caption" color="text.secondary">
            Hva hver rolle har og IKKE har tilgang til
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}
          aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {highlightRole && (
          <RoleSummaryHeader
            highlightRole={highlightRole}
            roleDefaults={roleDefaults}
            catalogSize={catalog.length}
            catalog={catalog}
          />
        )}
        {loading && <Typography color="text.secondary">Henter…</Typography>}

        <Table size="small" stickyHeader aria-label="Tillatelses-matrise">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 320, bgcolor: 'background.paper' }}>
                Tillatelse
              </TableCell>
              {ROLE_COLUMNS.map((r) => (
                <TableCell
                  key={r.key}
                  align="center"
                  sx={{
                    minWidth: 90,
                    bgcolor: highlightRole === r.key
                      ? `${r.color}22`
                      : 'background.paper',
                    fontWeight: highlightRole === r.key ? 700 : 500,
                  }}
                >
                  <Stack alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {r.label}
                    </Typography>
                  </Stack>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedCatalog).map(([category, perms]) => (
              <>
                <TableRow key={`${category}-header`}>
                  <TableCell
                    colSpan={ROLE_COLUMNS.length + 1}
                    sx={{
                      bgcolor: 'rgba(192,132,252,0.08)',
                      fontWeight: 700,
                      color: '#c084fc',
                      py: 0.5,
                    }}
                  >
                    {category}
                  </TableCell>
                </TableRow>
                {perms.map((perm) => (
                  <TableRow key={perm.key} hover>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{perm.description}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {perm.key}
                        </Typography>
                      </Stack>
                    </TableCell>
                    {ROLE_COLUMNS.map((r) => {
                      const has = roleDefaults[r.key]?.has(perm.key) ?? false;
                      return (
                        <TableCell
                          key={r.key}
                          align="center"
                          sx={{
                            bgcolor: highlightRole === r.key
                              ? `${r.color}11`
                              : undefined,
                          }}
                        >
                          {has ? (
                            <CheckCircleOutlinedIcon
                              sx={{ color: r.color, fontSize: 20 }}
                              aria-label={`${r.label} har ${perm.key}`}
                            />
                          ) : (
                            <BlockOutlinedIcon
                              sx={{ color: 'rgba(248,113,113,0.6)', fontSize: 18 }}
                              aria-label={`${r.label} har IKKE ${perm.key}`}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>

        <Stack direction="row" spacing={3} sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(192,132,252,0.06)', borderRadius: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <CheckCircleOutlinedIcon sx={{ color: '#34d399', fontSize: 18 }} />
            <Typography variant="caption" color="text.secondary">Har tilgang</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <BlockOutlinedIcon sx={{ color: 'rgba(248,113,113,0.6)', fontSize: 18 }} />
            <Typography variant="caption" color="text.secondary">Ikke tilgang</Typography>
          </Stack>
          <Box flexGrow={1} />
          <Chip
            label={`${catalog.length} tillatelser totalt`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
