/**
 * Klient-Roller — viser hvem som jobber på produksjonen (cast + crew),
 * read-only. Bruker samme React Query-hooks som producer-shellet
 * (useCastingRoles + useCrew), så data er naturlig synket.
 */
import { Alert, Box, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useCastingRoles, useCrew } from '@/hooks/useRoleRoom';

const CARD_SX = {
  p: 1.5,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open: { bg: 'rgba(252,211,77,0.12)', color: '#fcd34d' },
  filled: { bg: 'rgba(134,239,172,0.12)', color: '#86efac' },
  cast: { bg: 'rgba(134,239,172,0.12)', color: '#86efac' },
  pending: { bg: 'rgba(147,197,253,0.12)', color: '#93c5fd' },
  active: { bg: 'rgba(134,239,172,0.12)', color: '#86efac' },
};

export default function ClientRolesView({ projectId }: { projectId: string }) {
  const { data: roles, isLoading: rolesLoading, error: rolesError } = useCastingRoles(projectId);
  const { data: crew, isLoading: crewLoading, error: crewError } = useCrew(projectId);
  const loading = rolesLoading || crewLoading;
  const error = rolesError || crewError;

  if (loading) {
    return (
      <Stack direction="row" justifyContent="center" sx={{ py: 4 }}>
        <CircularProgress size={24} sx={{ color: '#22d3ee' }} />
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
          Roller på produksjonen
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Hvem er knyttet til prosjektet — cast og crew. Produsenten oppdaterer
          denne listen.
        </Typography>
      </Box>

      {error ? (
        <Alert severity="warning">Klarte ikke å hente roller akkurat nå.</Alert>
      ) : null}

      <Card sx={CARD_SX}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#e2e8f0', mb: 1 }}>
          Cast {roles && roles.length > 0 ? `(${roles.length})` : ''}
        </Typography>
        {!roles || roles.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.82rem' }}>
            Ingen roller er lagt inn ennå.
          </Typography>
        ) : (
          <Stack spacing={0.8}>
            {roles.map((r) => {
              const status = (r.status ?? '').toLowerCase();
              const c = STATUS_COLORS[status] ?? { bg: 'rgba(148,163,184,0.12)', color: 'rgba(226,232,240,0.7)' };
              return (
                <Stack
                  key={r.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ p: 0.8, borderRadius: 1.2, bgcolor: 'rgba(148,163,184,0.05)' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                      {r.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem' }} noWrap>
                      {[r.role_type, r.gender, r.age_range].filter(Boolean).join(' · ') || 'Detaljer kommer'}
                    </Typography>
                  </Box>
                  {r.status && (
                    <Chip
                      size="small"
                      label={r.status}
                      sx={{ fontWeight: 700, color: c.color, bgcolor: c.bg, border: `1px solid ${c.color}44` }}
                    />
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Card>

      <Card sx={CARD_SX}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#e2e8f0', mb: 1 }}>
          Crew {crew && crew.length > 0 ? `(${crew.length})` : ''}
        </Typography>
        {!crew || crew.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.82rem' }}>
            Ingen crew-medlemmer er lagt inn ennå.
          </Typography>
        ) : (
          <Stack spacing={0.8}>
            {crew.map((m) => (
              <Stack
                key={m.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ p: 0.8, borderRadius: 1.2, bgcolor: 'rgba(148,163,184,0.05)' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                    {m.name}
                  </Typography>
                  {m.role && (
                    <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem' }} noWrap>
                      {typeof m.role === 'string' ? m.role : (m.role as { name?: string }).name ?? ''}
                    </Typography>
                  )}
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
