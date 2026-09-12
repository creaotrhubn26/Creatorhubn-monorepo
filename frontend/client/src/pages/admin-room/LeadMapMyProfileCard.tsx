/**
 * LeadMapMyProfileCard.tsx
 *
 * "Min profil"-kort som vises for ALLE roller øverst i org-panelet.
 * Viser avatar + navn + rolle + en knapp som åpner full tillatelses-
 * matrise med deres egen rolle uthevet — så brukeren kjapt forstår
 * hva DE har og IKKE har tilgang til.
 *
 * Plassering: rett etter org-velger i LeadMapOrgPanel.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Button, Card, CardContent, Chip, Stack, Typography,
} from '@mui/material';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { usePermissions } from './usePermissions';
import LeadMapPermissionsMatrix from './LeadMapPermissionsMatrix';

const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  admin: { label: 'Administrator', color: '#c084fc', description: 'Full kontroll over org-en' },
  salgssjef: { label: 'Salgssjef', color: '#f97316', description: 'Leder hele salgsorganisasjonen' },
  teamleder: { label: 'Teamleder', color: '#fbbf24', description: 'Leder ett salgs-team' },
  salgskonsulent: { label: 'Salgskonsulent', color: '#34d399', description: 'Selger leads i ditt team' },
  promotor: { label: 'Promotør', color: '#60a5fa', description: 'Promoterer på event/feltarbeid' },
  member: { label: 'Medlem', color: '#a78bfa', description: 'Standard skrive-tilgang' },
  viewer: { label: 'Leser', color: '#9ca3af', description: 'Kun lese-tilgang' },
};

interface MeRow {
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
  territory: string | null;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rr_lead_map_active_org');
}

export default function LeadMapMyProfileCard() {
  const { role, permissions } = usePermissions();
  const [me, setMe] = useState<MeRow | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  const meta = role ? ROLE_META[role] : null;

  useEffect(() => {
    const orgId = getActiveOrgId();
    const token = getAuthToken();
    if (!orgId || !token) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/admin-room/lead-map/organizations/${orgId}/profiles`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!r.ok) return;
        const j = await r.json();
        // Backend returnerer alle medlemmer — vi finner brukeren via session
        const meRes = await fetch('/api/auth/user', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const meJson = meRes.ok ? await meRes.json() : null;
        const myEmail = meJson?.email ?? localStorage.getItem('userEmail');
        const row = (Array.isArray(j.profiles) ? j.profiles : []).find((p: Record<string, unknown>) =>
          (p.user_email as string)?.toLowerCase() === myEmail?.toLowerCase()
        );
        if (row) {
          setMe({
            user_id: row.user_id as string,
            user_email: (row.user_email as string | null) ?? null,
            user_name: (row.user_name as string | null) ?? null,
            display_name: (row.display_name as string | null) ?? null,
            avatar_url: (row.avatar_url as string | null) ?? null,
            title: (row.title as string | null) ?? null,
            territory: (row.territory as string | null) ?? null,
          });
        }
      } catch { /* noop */ }
    })();
  }, [role]);

  if (!role || !meta) return null;

  return (
    <>
      <Card sx={{ mb: 3, border: `1px solid ${meta.color}66`, bgcolor: `${meta.color}08` }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Avatar
              src={me?.avatar_url ?? undefined}
              sx={{
                width: 56, height: 56,
                border: `2px solid ${meta.color}`,
              }}
            >
              {(me?.display_name ?? me?.user_email ?? '?')[0]}
            </Avatar>
            <Stack flexGrow={1}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="h6">
                  {me?.display_name ?? me?.user_name ?? me?.user_email ?? 'Min profil'}
                </Typography>
                <Chip
                  label={meta.label}
                  size="small"
                  sx={{
                    bgcolor: `${meta.color}22`,
                    color: meta.color,
                    fontWeight: 700,
                  }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {me?.title ?? meta.description}
                {me?.territory && ` · ${me.territory}`}
              </Typography>
            </Stack>
            <Box textAlign={{ xs: 'left', sm: 'right' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Typography variant="caption" color="text.secondary">
                    Mine tillatelser
                  </Typography>
                  <Typography variant="h6" sx={{ color: meta.color, lineHeight: 1 }}>
                    {permissions.size}
                  </Typography>
                </Stack>
                <Button
                  variant="outlined"
                  startIcon={<VerifiedUserOutlinedIcon />}
                  onClick={() => setMatrixOpen(true)}
                  sx={{
                    color: meta.color,
                    borderColor: `${meta.color}66`,
                    '&:hover': { borderColor: meta.color, bgcolor: `${meta.color}11` },
                  }}
                >
                  Se mine tilganger
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
      <LeadMapPermissionsMatrix
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        highlightRole={role}
      />
    </>
  );
}
