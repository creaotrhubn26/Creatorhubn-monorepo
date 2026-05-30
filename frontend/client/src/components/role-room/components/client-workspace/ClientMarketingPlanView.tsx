/**
 * Klient-Markedsplan — read-only-versjon av MarketingPlanWorkspace.
 *
 * Innholdsprodusenten ser dashboardet med VersionPicker, "Endre plan"
 * og inline post-edit. Klienten ser samme oversikt men kan kun lese:
 * KPI-tiles, pillar-fordeling, posts-tabell og activity-feed.
 *
 * Read-only-modus håndteres av selve MarketingPlanWorkspace via
 * readOnly={true} — komponenten skjuler edit-affordanser automatisk.
 */

import { Stack, Typography } from '@mui/material';
import MarketingPlanWorkspace from '../producer/MarketingPlanWorkspace';

export default function ClientMarketingPlanView({ projectId }: { projectId: string }) {
  return (
    <Stack spacing={1.5}>
      <div>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
          Markedsplan
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Pillars, posts, leveringskalender og aktivitetslogg.
          Endringer gjøres av produsenten din.
        </Typography>
      </div>
      <MarketingPlanWorkspace projectId={projectId} readOnly />
    </Stack>
  );
}
