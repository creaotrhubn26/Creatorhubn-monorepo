/**
 * DancerProfileGridConnected — fetches the project's dancer profiles and
 * derives the dancer roster from them, so DancerProfileGrid shows real data
 * instead of DEMO_DANCERS. Adding a dancer creates a fresh profile record
 * via the editor flow.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import { Stack, CircularProgress, Alert, Button, Box } from '@mui/material';
import { DancerProfileGrid, type DancerStatsSnapshot } from './DancerProfileGrid';
import { DancerProfileEditor } from './DancerProfileEditor';
import {
  listDancerProfiles,
  type DancerProfile,
} from './dancerProfileService';
import { listFormations } from './danceFormationService';
import { listRehearsals } from './danceRehearsalService';
import { listClips, listAnnotations } from './danceVideoService';
import type { Dancer } from './formationTypes';
import { getInitials } from './dancerProfile';

export interface DancerProfileGridConnectedProps {
  /** Når null, lister alle eierens danserprofiler på tvers av prosjekter. */
  projectId: string | null;
}

function generateDancerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `dancer_${crypto.randomUUID()}`;
  }
  return `dancer_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function profileToDancer(profile: DancerProfile): Dancer {
  const name = profile.displayName ?? profile.dancerId;
  return {
    id: profile.dancerId,
    name,
    initials: getInitials(name),
  };
}

export function DancerProfileGridConnected({
  projectId,
}: DancerProfileGridConnectedProps): React.ReactElement {
  const [dancers, setDancers] = React.useState<Dancer[]>([]);
  const [statsByDancerId, setStatsByDancerId] = React.useState<Map<string, DancerStatsSnapshot>>(
    () => new Map(),
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // For the "Legg til danser"-flyt: open editor on a brand-new dancerId.
  const [creatingDancerId, setCreatingDancerId] = React.useState<string | null>(null);
  const [creatingName, setCreatingName] = React.useState<string>('');

  const refresh = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const profiles = await listDancerProfiles(projectId ?? undefined);
      setDancers(profiles.map(profileToDancer));

      // F6-2: stats per danser (formasjons-count, rehearsal-count, annotation-count)
      void (async () => {
        try {
          const [formations, rehearsals, clips] = await Promise.all([
            listFormations(projectId ?? undefined),
            listRehearsals({ projectId: projectId ?? undefined, limit: 200 }),
            listClips({ projectId: projectId ?? undefined }),
          ]);
          // Annotation-count: bare for opp til 10 clips for å unngå N+1-fyrverkeri.
          const annotationsByDancer = new Map<string, number>();
          const clipSubset = clips.slice(0, 10);
          await Promise.all(clipSubset.map(async (c) => {
            try {
              const anns = await listAnnotations(c.id);
              for (const a of anns) {
                for (const id of a.targetDancerIds) {
                  annotationsByDancer.set(id, (annotationsByDancer.get(id) ?? 0) + 1);
                }
              }
            } catch { /* ignore */ }
          }));

          const map = new Map<string, DancerStatsSnapshot>();
          for (const p of profiles) {
            const formCount = formations.filter((f) => f.positions.some((pos) => pos.dancerId === p.dancerId)).length;
            const rehCount = rehearsals.filter((r) => r.invitedDancerIds.includes(p.dancerId)).length;
            const annCount = annotationsByDancer.get(p.dancerId) ?? 0;
            map.set(p.dancerId, {
              formationsCount: formCount,
              rehearsalsCount: rehCount,
              annotationsCount: annCount,
            });
          }
          setStatsByDancerId(map);
        } catch { /* stats er best-effort — la kort stå uten chips ved feil */ }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste dansere');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = React.useCallback(() => {
    const id = generateDancerId();
    setCreatingDancerId(id);
    setCreatingName('Ny danser');
  }, []);

  const handleCreatedSaved = React.useCallback(
    (saved: DancerProfile) => {
      setCreatingDancerId(null);
      setCreatingName('');
      // Insert the new dancer optimistically; refresh will reconcile if needed.
      setDancers((prev) => {
        const next = prev.filter((d) => d.id !== saved.dancerId);
        next.push(profileToDancer(saved));
        return next;
      });
    },
    [],
  );

  if (loading && dancers.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
        <CircularProgress size={28} sx={{ color: danceFlowColors.lavenderDark }} />
      </Stack>
    );
  }

  if (error && dancers.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void refresh()}>
              Prøv igjen
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <>
      <DancerProfileGrid
        dancers={dancers}
        projectId={projectId ?? undefined}
        onAddDancer={handleAdd}
        statsByDancerId={statsByDancerId}
      />
      {creatingDancerId ? (
        <DancerProfileEditor
          open
          dancer={{
            id: creatingDancerId,
            name: creatingName,
            initials: getInitials(creatingName),
          }}
          initialProfile={null}
          projectId={projectId}
          onClose={() => {
            setCreatingDancerId(null);
            setCreatingName('');
          }}
          onSaved={handleCreatedSaved}
        />
      ) : null}
    </>
  );
}

export default DancerProfileGridConnected;
