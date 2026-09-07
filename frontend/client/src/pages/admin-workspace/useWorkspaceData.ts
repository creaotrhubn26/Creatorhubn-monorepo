/**
 * useWorkspaceData — delte React Query-hooks for AdminWorkspace.
 *
 * Flatene her gjorde rå `useEffect` + `fetch` med egen loading-, error-
 * og poll-state, mens 833 andre filer i appen bruker `useQuery`. Det ga
 * tre konkrete problemer:
 *
 *   1. Kalender-flaten og høyre kolonne hentet SAMME `upcoming-deadlines`
 *      uavhengig av hverandre — to kall for samme data på samme skjerm.
 *   2. Fire uavhengige poll-timere når workspacet stod åpent.
 *   3. ~40 linjer identisk tilstands-håndtering per flate.
 *
 * Nøklene under er hierarkiske, slik at en mutasjon kan invalidere
 * presist (`['workspace','cases']`) eller bredt (`['workspace']`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  workspaceAggregatorApi,
  workspaceAutomationsApi,
  workspaceCasesApi,
  workspaceCollabApi,
  workspaceModulesApi,
  workspaceNotificationsApi,
  type WorkspaceCaseListFilter,
  type WorkspaceProductScope,
  type WorkspaceTeamMemberInput,
} from '../../services/adminRoomApi';

export const workspaceKeys = {
  all: ['workspace'] as const,
  notifications: () => ['workspace', 'notifications'] as const,
  agenda: (product: WorkspaceProductScope) => ['workspace', 'agenda', product] as const,
  deadlines: (days: number, product: WorkspaceProductScope) =>
    ['workspace', 'deadlines', days, product] as const,
  cases: (filter: WorkspaceCaseListFilter) => ['workspace', 'cases', filter] as const,
  projects: (product: WorkspaceProductScope) => ['workspace', 'projects', product] as const,
  documents: (product: WorkspaceProductScope) => ['workspace', 'documents', product] as const,
  files: (product: WorkspaceProductScope) => ['workspace', 'files', product] as const,
  settings: () => ['workspace', 'settings'] as const,
  channels: () => ['workspace', 'channels'] as const,
  messages: (channelId: string | null) => ['workspace', 'messages', channelId] as const,
  team: (product: WorkspaceProductScope) => ['workspace', 'team', product] as const,
  clientProjects: () => ['workspace', 'client-projects'] as const,
  automations: () => ['workspace', 'automations'] as const,
  automationRuns: (id: string) => ['workspace', 'automations', id, 'runs'] as const,
};

/**
 * Varsler. `pollSeconds` styres av brukerens preferanse; React Query
 * deduper på tvers av innboksen og høyre kolonne, så det blir ÉN timer
 * uansett hvor mange komponenter som leser dem.
 */
export function useWorkspaceNotifications(pollSeconds: number) {
  return useQuery({
    queryKey: workspaceKeys.notifications(),
    queryFn: () => workspaceNotificationsApi.inbox(),
    refetchInterval: Math.max(15, pollSeconds) * 1000,
    // Behold forrige liste ved feil — en driftsflate skal ikke tømme
    // skjermen fordi ett poll-kall feilet.
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

export function useMarkNotificationSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspaceNotificationsApi.markSeen(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: workspaceKeys.notifications() });
      const previous = qc.getQueryData(workspaceKeys.notifications());
      qc.setQueryData(workspaceKeys.notifications(), (old: unknown) =>
        Array.isArray(old) ? old.filter((n) => (n as { id: string }).id !== id) : old,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(workspaceKeys.notifications(), ctx.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: workspaceKeys.notifications() });
    },
  });
}

/** Dagens møter. Delt mellom Kalender-flaten og høyre kolonne. */
export function useTodayAgenda(product: WorkspaceProductScope) {
  return useQuery({
    queryKey: workspaceKeys.agenda(product),
    queryFn: () => workspaceAggregatorApi.todayAgenda(product),
    refetchInterval: 60_000,
  });
}

/**
 * Kommende frister. Høyre kolonne bruker 14 dager, Kalender-flaten et
 * valgbart vindu — samme vindu gir nå ett kall, ikke to.
 */
export function useUpcomingDeadlines(days: number, product: WorkspaceProductScope) {
  return useQuery({
    queryKey: workspaceKeys.deadlines(days, product),
    queryFn: () => workspaceAggregatorApi.upcomingDeadlines(days, product),
    refetchInterval: 120_000,
  });
}

export function useWorkspaceCases(filter: WorkspaceCaseListFilter) {
  return useQuery({
    queryKey: workspaceKeys.cases(filter),
    queryFn: () => workspaceCasesApi.list(filter),
  });
}

export function useWorkspaceProjects(product: WorkspaceProductScope) {
  return useQuery({
    queryKey: workspaceKeys.projects(product),
    queryFn: () => workspaceModulesApi.projects(product),
  });
}

export function useWorkspaceDocuments(product: WorkspaceProductScope) {
  return useQuery({
    queryKey: workspaceKeys.documents(product),
    queryFn: () => workspaceModulesApi.documents(product),
  });
}

export function useWorkspaceFiles(product: WorkspaceProductScope) {
  return useQuery({
    queryKey: workspaceKeys.files(product),
    queryFn: () => workspaceModulesApi.files(product),
  });
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: workspaceKeys.settings(),
    queryFn: () => workspaceModulesApi.settings(),
  });
}

export function useWorkspaceChannels() {
  return useQuery({
    queryKey: workspaceKeys.channels(),
    queryFn: () => workspaceCollabApi.channels(),
  });
}

export function useWorkspaceMessages(channelId: string | null) {
  return useQuery({
    queryKey: workspaceKeys.messages(channelId),
    queryFn: () => workspaceCollabApi.messages(channelId as string),
    enabled: Boolean(channelId),
    refetchInterval: 20_000,
  });
}

export function useWorkspaceTeam(product: WorkspaceProductScope) {
  return useQuery({
    queryKey: workspaceKeys.team(product),
    queryFn: () => workspaceCollabApi.team(product),
  });
}

export function useWorkspaceClientProjects() {
  return useQuery({
    queryKey: workspaceKeys.clientProjects(),
    queryFn: () => workspaceCollabApi.clientProjects(),
  });
}

export function useWorkspaceAutomations() {
  return useQuery({
    queryKey: workspaceKeys.automations(),
    queryFn: () => workspaceAutomationsApi.list(),
  });
}

export function useAutomationRuns(id: string | null) {
  return useQuery({
    queryKey: workspaceKeys.automationRuns(id ?? ''),
    queryFn: () => workspaceAutomationsApi.runs(id as string),
    enabled: Boolean(id),
  });
}

// ── Mutasjoner ────────────────────────────────────────────────────
// Alle invaliderer den delte nøkkelen, så hver leser av samme data
// oppdaterer seg — uten at komponentene må kjenne til hverandre.

export function useWorkspaceMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  invalidate: ReadonlyArray<readonly unknown[]>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidate) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useCompleteCase() {
  return useWorkspaceMutation(
    (id: string) => workspaceCasesApi.update(id, { status: 'done' }),
    // Saker og frister deler underlaget: en fullført sak forsvinner fra
    // begge, så begge må invalideres.
    [workspaceKeys.all],
  );
}

export function useSendMessage(channelId: string | null) {
  return useWorkspaceMutation(
    (body: string) => workspaceCollabApi.sendMessage(channelId as string, body),
    [workspaceKeys.messages(channelId), workspaceKeys.channels()],
  );
}

export function useDeleteMessage(channelId: string | null) {
  return useWorkspaceMutation(
    (id: string) => workspaceCollabApi.deleteMessage(id),
    [workspaceKeys.messages(channelId), workspaceKeys.channels()],
  );
}

export function useCreateChannel() {
  return useWorkspaceMutation(
    (input: { name: string; description?: string | null; productKey?: string | null }) =>
      workspaceCollabApi.createChannel(input),
    [workspaceKeys.channels()],
  );
}

export function useSaveTeamMember(product: WorkspaceProductScope) {
  return useWorkspaceMutation(
    async ({ id, input }: { id: string | null; input: WorkspaceTeamMemberInput }) => {
      if (id) await workspaceCollabApi.updateMember(id, input);
      else await workspaceCollabApi.createMember(input);
    },
    [workspaceKeys.team(product)],
  );
}

export function useDeleteTeamMember(product: WorkspaceProductScope) {
  return useWorkspaceMutation(
    (id: string) => workspaceCollabApi.deleteMember(id),
    [workspaceKeys.team(product)],
  );
}

export function useToggleAutomation() {
  return useWorkspaceMutation(
    (id: string) => workspaceAutomationsApi.toggle(id),
    [workspaceKeys.automations()],
  );
}

export function useRunAutomation() {
  return useWorkspaceMutation(
    (id: string) => workspaceAutomationsApi.run(id),
    [workspaceKeys.automations()],
  );
}

/** Feilmelding fra en query, som streng — flatene viser den ordrett. */
export function queryError(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return (error as Error).message || fallback;
}
