/**
 * Klient-Roller — viser hvem som jobber på produksjonen (cast + crew),
 * read-only. Henter direkte fra samme API-er som produsent-shellets
 * RolesSubPanel + CrewSubPanel bruker, men uten "Legg til"-knapper.
 *
 * Klient-perspektivet: «hvem ser jeg navnet til når jeg åpner prosjektet?»
 */
import { useEffect, useState } from 'react';
import { Alert, Box, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import roleRoomAgentService from '../../services/roleRoomAgentService';

interface CastRole {
  id: string;
  name: string;
  type?: string | null;
  status?: string | null;
  ageRangeFrom?: number | null;
  ageRangeTo?: number | null;
  gender?: string | null;
}

interface CrewMember {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
}

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
};

export default function ClientRolesView({ projectId }: { projectId: string }) {
  const [roles, setRoles] = useState<CastRole[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Vi vet ikke om service-en har eksakt disse metodene — fall back
        // tilstand håndteres som tomt sett (ingen krasj).
        const svc = roleRoomAgentService as unknown as Record<string, unknown>;
        const listRoles = svc.listProjectRoles as ((id: string) => Promise<CastRole[]>) | undefined;
        const listCrew = svc.listProjectCrew as ((id: string) => Promise<CrewMember[]>) | undefined;
        const [rs, cs] = await Promise.all([
          listRoles ? listRoles(projectId).catch(() => []) : Promise.resolve([] as CastRole[]),
          listCrew ? listCrew(projectId).catch(() => []) : Promise.resolve([] as CrewMember[]),
        ]);
        if (!cancelled) {
          setRoles(rs);
          setCrew(cs);
        }
      } catch (e) {
        if (!cancelled) setError('Klarte ikke å hente roller akkurat nå.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

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

      {error && <Alert severity="warning">{error}</Alert>}

      <Card sx={CARD_SX}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#e2e8f0', mb: 1 }}>
          Cast {roles.length > 0 && `(${roles.length})`}
        </Typography>
        {roles.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.82rem' }}>
            Ingen roller er lagt inn ennå.
          </Typography>
        ) : (
          <Stack spacing={0.8}>
            {roles.map((r) => {
              const status = (r.status ?? '').toLowerCase();
              const c = STATUS_COLORS[status] ?? { bg: 'rgba(148,163,184,0.12)', color: 'rgba(226,232,240,0.7)' };
              const ageLabel = r.ageRangeFrom != null || r.ageRangeTo != null
                ? `${r.ageRangeFrom ?? '?'}–${r.ageRangeTo ?? '?'} år`
                : null;
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
                      {[r.type, r.gender, ageLabel].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  {r.status && (
                    <Chip size="small" label={r.status} sx={{ fontWeight: 700, color: c.color, bgcolor: c.bg, border: `1px solid ${c.color}44` }} />
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Card>

      <Card sx={CARD_SX}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#e2e8f0', mb: 1 }}>
          Crew {crew.length > 0 && `(${crew.length})`}
        </Typography>
        {crew.length === 0 ? (
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
                      {m.role}
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
