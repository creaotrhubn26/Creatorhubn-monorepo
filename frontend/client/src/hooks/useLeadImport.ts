/**
 * CreatorHub Norge - Lead Import Hook
 * Importerer data fra kundeforespørsler til prosjekt-oppsett
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface LeadData {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectType: string;
  culture?: string;
  location?: string;
  preferredDate?: string;
  estimatedBudget?: number;
  guestCount?: number;
  duration?: string;
  specialRequests?: string;
  packageInterest?: string;
  source?: string;
}

interface ImportedProjectData {
  projectName: string;
  projectType: string;
  clientName: string;
  culture?: string;
  location?: string;
  projectDate?: string;
  estimatedDuration?: string;
  totalDays?: number;
  selectedPackage?: any;
  totalPrice?: number;
  customCategories?: string[];
  specialRequests?: string;
}

interface ImportHistory {
  id: string;
  leadTitle: string;
  leadSource?: string;
  importCount: number;
  lastImported: string;
  extractedData: any;
}

export function useLeadImport() {
  const queryClient = useQueryClient();

  // Hent tilgjengelige leads for import
  const { data: availableLeads, isLoading: isLoadingLeads } = useQuery<{
    leads: LeadData[];
}>({
    queryKey: ['/import/leads'],
    staleTime: 5 * 60 * 1000, // 5 minutter cache
});

  // Hent import-historikk
  const { data: importHistory, isLoading: isLoadingHistory } = useQuery<{
    history: ImportHistory[];
}>({
    queryKey: ['/import/history'],
    staleTime: 10 * 60 * 1000, // 10 minutter cache
});

  // Import fra lead
  const importFromLeadMutation = useMutation({
    mutationFn: async (leadId: string): Promise<{ projectData: ImportedProjectData }> => {
      return await apiRequest(`/import/lead/${leadId}`, {
        method: 'POST',
    });
  },
    onSuccess: () => {
      // Oppdater cache etter vellykket import
      queryClient.invalidateQueries({ queryKey: ['/import/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/import/history'] });
  },
});

  return {
    // Data
    availableLeads: availableLeads?.leads || [],
    importHistory: importHistory?.history || [],

    // Loading states
    isLoadingLeads,
    isLoadingHistory,
    isImporting: importFromLeadMutation.isPending,

    // Actions
    importFromLead: importFromLeadMutation.mutateAsync,

    // Error state
    importError: importFromLeadMutation.error,
};
}
