/**
 * useTeamAccess — én kilde for «har brukeren team-/samarbeidstilgang?».
 *
 * Team/samarbeid (band-roster, invitér bidragsytere, collaborator-sync,
 * review-invitasjoner, EaseVerse-band) er en Enterprise-funksjon. Individuelle
 * skapere beholder sitt eget workspace, men de team-iboende bitene gates bak
 * Enterprise (org-medlemskap eller enterprise-profesjonen).
 *
 * Speiler gaten i GettingStartedChecklist («Inviter team»-steget) og
 * useEnterpriseFeatureAccess (/api/enterprise/my-membership).
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';

export function useTeamAccess(): { hasTeamAccess: boolean; loading: boolean } {
  const { user } = useAuth();
  // VIKTIG: samme queryKey som useEnterpriseFeatureAccess/useEnterpriseMembership,
  // og de unwrapper til `response.membership`. Denne MÅ gjøre det samme, ellers
  // avhenger cache-formen av hvem som henter først → hasTeamAccess blir feil.
  const { data, isLoading } = useQuery({
    queryKey: ['/api/enterprise/my-membership'],
    queryFn: async () => {
      try {
        const res = await apiRequest('/api/enterprise/my-membership');
        return (res as any)?.membership ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const hasTeamAccess =
    !!(data as any)?.organizationId ||
    (user as any)?.profession === 'enterprise';
  return { hasTeamAccess, loading: isLoading };
}

export default useTeamAccess;
