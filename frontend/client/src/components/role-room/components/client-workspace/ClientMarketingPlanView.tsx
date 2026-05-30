/**
 * Klient-Markedsplan — shared workspace, ikke read-only.
 *
 * Markedsplanen er en delt arbeidsflate hvor både produsent og
 * klient kan endre. Backend sporer last_edited_by_kind ved hver
 * edit ('team' eller 'client'), og dashboardet viser en farget
 * badge slik at det alltid er klart hvem som endret hva.
 *
 * Klienten ser samme MarketingPlanWorkspace som produsenten —
 * KPI-tiles, pillar-fordeling, posts-tabell med inline-edit,
 * og activity-feed med både team- og klient-aktivitet.
 *
 * VersionPicker er fortsatt produsent-only (rollback er en
 * eier-handling), men selve redigeringen er åpen for begge.
 */

import { Stack, Typography, Chip } from '@mui/material';
import MarketingPlanWorkspace from '../producer/MarketingPlanWorkspace';

export default function ClientMarketingPlanView({ projectId }: { projectId: string }) {
  return (
    <Stack spacing={1.5}>
      <div>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
            Markedsplan
          </Typography>
          <Chip size="small" label="Delt arbeidsflate"
                sx={{
                  height: 18, fontSize: '0.66rem', fontWeight: 700,
                  bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9',
                }} />
        </Stack>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Pillars, posts, leveringskalender og aktivitetslogg.
          Endringer du gjør merkes som "Klient" — produsenten ser
          dem live i sin Arbeidsflate.
        </Typography>
      </div>
      <MarketingPlanWorkspace projectId={projectId} />
    </Stack>
  );
}
