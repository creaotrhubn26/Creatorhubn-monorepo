/**
 * LeadMapMemberPins.tsx
 *
 * Renderer live posisjons-pins for selgere på Lead Map-kartet.
 * Brukes inni react-leaflet MapContainer i LeadMapPanel.
 *
 * Hver pin er en sirkulær profil-avatar med:
 *   - Grønn ring + Activity-prikk for online (oppdatert siste 5 min)
 *   - Rolle-farge på ytre ring (salgssjef oransje, teamleder gul,
 *     salgskonsulent grønn, promotør blå)
 *   - Popup ved klikk: navn + tittel + team + activity + sist sett
 */

import { useEffect, useMemo, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import { renderToStaticMarkup } from 'react-dom/server';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

const ROLE_COLOR: Record<string, string> = {
  admin: '#c084fc',
  salgssjef: '#f97316',
  teamleder: '#fbbf24',
  salgskonsulent: '#34d399',
  promotor: '#60a5fa',
  member: '#a78bfa',
  viewer: '#9ca3af',
};

interface MemberLocation {
  user_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  activity: string;
  current_lead_id: string | null;
  current_visit_id: string | null;
  updated_at: string;
  display_name: string | null;
  title: string | null;
  avatar_url: string | null;
  role: string;
  team_name: string | null;
}

interface Props {
  organizationId: string | null;
  authToken: string;
}

/** Bygger en Leaflet DivIcon med profilbilde + rolle-farget ring */
function buildMemberIcon(loc: MemberLocation): L.DivIcon {
  const color = ROLE_COLOR[loc.role] ?? '#a78bfa';
  const sinceMs = Date.now() - new Date(loc.updated_at).getTime();
  const isFresh = sinceMs < 5 * 60 * 1000;
  const initial = (loc.display_name ?? '?')[0]?.toUpperCase() ?? '?';
  const inner = loc.avatar_url
    ? `<img src="${loc.avatar_url}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:block" />`
    : `<div style="width:36px;height:36px;border-radius:50%;background:#1f1f2a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${initial}</div>`;
  const html = `
    <div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:0;border-radius:50%;border:3px solid ${color};box-shadow:0 0 0 2px rgba(0,0,0,0.55), 0 0 18px ${color}66;background:#0a0a0f;display:flex;align-items:center;justify-content:center;">
        ${inner}
      </div>
      ${isFresh ? `<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:#34d399;border:2px solid #0a0a0f;"></div>` : ''}
    </div>
  `;
  return L.divIcon({
    html,
    className: 'member-pin',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'akkurat nå';
  if (mins < 60) return `${mins} min siden`;
  return `${Math.floor(mins / 60)} t siden`;
}

const ACTIVITY_LABEL: Record<string, string> = {
  idle: 'Tilgjengelig',
  visit: 'På besøk',
  driving: 'Underveis',
  event: 'På event',
};

export default function LeadMapMemberPins({ organizationId, authToken }: Props) {
  const [locations, setLocations] = useState<MemberLocation[]>([]);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${authToken}` }),
    [authToken],
  );

  useEffect(() => {
    if (!organizationId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/admin-room/lead-map/organizations/${organizationId}/member-locations`,
          { headers },
        );
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setLocations(j.locations ?? []);
      } catch { /* noop */ }
    };
    void load();
    const t = setInterval(load, 30 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [organizationId, headers]);

  return (
    <>
      {locations.map((loc) => (
        <Marker
          key={loc.user_id}
          position={[loc.lat, loc.lng]}
          icon={buildMemberIcon(loc)}
        >
          <Popup>
            <Box sx={{ minWidth: 200 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                <Avatar src={loc.avatar_url ?? undefined} sx={{ width: 40, height: 40 }}>
                  <PersonOutlineIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2">
                    {loc.display_name ?? loc.user_id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {loc.title ?? loc.role}
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={0.5}>
                <Chip
                  size="small"
                  label={ACTIVITY_LABEL[loc.activity] ?? loc.activity}
                  sx={{
                    bgcolor: `${ROLE_COLOR[loc.role] ?? '#a78bfa'}22`,
                    color: ROLE_COLOR[loc.role] ?? '#a78bfa',
                    alignSelf: 'flex-start',
                  }}
                />
                {loc.team_name && (
                  <Typography variant="caption" color="text.secondary">
                    Team: <strong>{loc.team_name}</strong>
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Sist sett: {formatLastSeen(loc.updated_at)}
                </Typography>
                {loc.accuracy_m && (
                  <Typography variant="caption" color="text.secondary">
                    Presisjon: ±{Math.round(loc.accuracy_m)} m
                  </Typography>
                )}
              </Stack>
            </Box>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
