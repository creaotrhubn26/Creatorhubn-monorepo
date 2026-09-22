/**
 * Hvem får gjøre hva i et Role Room-prosjekt, som data.
 *
 * Reglene bor i CASTING_GRANT_RULES og håndheves av
 * resolveCastingProjectAccess. Fram til nå måtte man lese kildekoden for å
 * vite dem. Endepunktet eksponerer den samme tabellen — ikke en kopi av den —
 * slik at et nytt grant eller en ny rolle dukker opp i grensesnittet uten at
 * noen må huske å oppdatere en liste to steder.
 */
import type express from 'express';

import { CASTING_GRANTS, CASTING_GRANT_RULES } from './casting-project-ownership.js';

/** Norsk etikett per grant. Rene visningsnavn; reglene ligger i tabellen. */
const GRANT_LABELS: Record<string, string> = {
  canEditCasting: 'Rediger casting',
  canEditProduction: 'Rediger opptaksdag',
  canManageProduction: 'Dagskontroll',
  canCoordinateProduction: 'Koordinering',
  canManageLocations: 'Lokasjoner',
  canManageContinuity: 'Kontinuitet',
  canCommentContinuity: 'Kommenter kontinuitet',
  canManageArtDepartment: 'Produksjonsdesign og art department',
  canManageProductionSound: 'Opptakslyd og lydrapport',
  canPreparePostTurnover: 'Klargjør turnover til post',
  canReviewPostTurnover: 'Motta og QC-kontroller turnover',
};

export interface AccessMatrixDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
}

export function registerRoleRoomAccessMatrixRoutes(deps: AccessMatrixDeps): void {
  const { app, requireAdminSession } = deps;

  app.get('/api/role-room/admin/access-matrix', async (req, res) => {
    if (!requireAdminSession(req, res)) return;

    const grants = CASTING_GRANTS.map((grant) => {
      const rule = CASTING_GRANT_RULES[grant];
      return {
        grant,
        label: GRANT_LABELS[grant] ?? grant,
        roles: [...rule.roles],
        permissionKeys: [...rule.permissionKeys],
      };
    });

    // Radene i matrisen: hver rolle som gir minst ett grant, i den rekkefølgen
    // de først dukker opp. Eieren står utenfor tabellen — hen har alt.
    const roles: string[] = [];
    for (const entry of grants) {
      for (const role of entry.roles) {
        if (!roles.includes(role)) roles.push(role);
      }
    }

    res.json({
      grants,
      roles,
      matrix: roles.map((role) => ({
        role,
        grants: Object.fromEntries(
          grants.map((entry) => [
            entry.grant,
            (entry.roles as readonly string[]).includes(role),
          ]),
        ),
      })),
    });
  });
}
