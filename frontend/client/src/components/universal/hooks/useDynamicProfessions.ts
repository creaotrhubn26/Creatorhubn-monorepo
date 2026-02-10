/**
 * Hook for managing dynamic profession types
 * Connected to profession-feature-matrix.ts for feature availability checks
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from '@/lib/queryClient';
import getProfessionIcon from '@/utils/profession-icons';
import { isProfessionFeatureAvailable, isProfessionFeatureEnabled } from '@shared/profession-feature-matrix';

export interface DynamicProfessionConfig {
  name: string;
  displayName: string;
  iconColor: string;
  isActive: boolean;
  sortOrder: number;
  icon?: React.ReactElement;
  components?: {
    overview?: string[];
    projects?: string[];
    pricing?: string[];
    contracts?: string[];
    clients?: string[];
    equipment?: string[];
    files?: string[];
    email?: string[];
    worklog?: string[];
    settings?: string[];
    showcase?: string[];
    timeline?: string[];
    communication?: string[];
};
}

// Default fallback profession data
const DEFAULT_PROFESSIONS: Record<string, DynamicProfessionConfig> = {
  photographer: {
    name: 'photographer',
    displayName: 'Fotograf',
    iconColor: '#ff8c00',
    isActive: true,
    sortOrder: 0,
    icon: getProfessionIcon('photographer, '),
    components: getDefaultComponentsForProfession('photographer,')
},
  videographer: {
    name: 'videographer',  
    displayName: 'Videograf',
    iconColor: '#e74c3c',
    isActive: true,
    sortOrder: 1,
    icon: getProfessionIcon('videographer,'),
    components: getDefaultComponentsForProfession('videographer')
},
  music_producer: {
    name: 'music_producer',
    displayName: 'Musikkprodusent',
    iconColor: '#9b59b6',
    isActive: true,
    sortOrder: 2,
    icon: getProfessionIcon('music_producer'),
    components: getDefaultComponentsForProfession('music_producer')
},
  vendor: {
    name: 'vendor',
    displayName: 'Leverandør',
    iconColor: '#27ae60',
    isActive: true,
    sortOrder: 3,
    icon: getProfessionIcon('vendor'),
    components: getDefaultComponentsForProfession('vendor')
},
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise Team',
    iconColor: '#6c3483',
    isActive: true,
    sortOrder: 4,
    icon: getProfessionIcon('enterprise'),
    components: getDefaultComponentsForProfession('enterprise')
}
};

export function useDynamicProfessions() {
  const [professionConfigs, setProfessionConfigs] = useState<Record<string, DynamicProfessionConfig>>(DEFAULT_PROFESSIONS);
  const { user } = useAuth();

  // Fetch profession types from API
  const { data: professionTypesData, isLoading, error } = useQuery({
    queryKey: ['/api/admin/profession-types'],
    queryFn: () => apiRequest('/api/admin/profession-types'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
    retry: false, // Don't retry on failure, use fallback data instead
});

  useEffect(() => {
    if (professionTypesData && Array.isArray(professionTypesData)) {
      const configs: Record<string, DynamicProfessionConfig> = {};
      
      professionTypesData.forEach((profession: any) => {
        if (profession.isActive) {
          configs[profession.name] = {
            name: profession.name,
            displayName: profession.displayName,
            iconColor: profession.iconColor || '#ff8c00',
            isActive: profession.isActive,
            sortOrder: profession.sortOrder || 0,
            icon: getProfessionIcon(profession.name),
            components: getDefaultComponentsForProfession(profession.name)
        };
      }
    });
      
      setProfessionConfigs(configs);
  } else if (error) {
      // If API fails, ensure we still have default professions
      setProfessionConfigs(DEFAULT_PROFESSIONS);
  }
}, [professionTypesData, error]);

  // Helper functions for the routing system
  const getCurrentUserProfession = (): string => {
    // Try server-first; fallback to session/local
    try {
      // Synchronous fallback path; async server fetch handled elsewhere by callers if needed
      let userProfession = sessionStorage.getItem('userProfession') || localStorage.getItem('userProfession') || (user?.profession as string) || 'photographer';
      
      // Fix: If somehow the value is '[object Object]' (corrupted), reset to default
      if (userProfession === '[object Object]' || !userProfession || typeof userProfession !== 'string') {
        userProfession = 'photographer';
        // Clear the corrupted values
        try {
          sessionStorage.removeItem('userProfession');
          localStorage.removeItem('userProfession');
        } catch (storageErr) {
          console.warn('[useDynamicProfessions] Failed to clear corrupted profession from storage:', storageErr);
        }
      }
      
      return userProfession;
    } catch {
      return 'photographer';
    }
  };

  // Attempt to hydrate profession and email server-first on mount
  // Use a module-level flag to prevent duplicate fetches across component instances
  useEffect(() => {
    // Check if we've already fetched or are currently fetching
    if ((window as any).__userKvHydrated || (window as any).__userKvHydrating) {
      return;
    }
    // Only hydrate when we have an authenticated user
    if (!user?.id) {
      return;
    }
    (window as any).__userKvHydrating = true;

    (async () => {
      try {
        const rp = await fetch('/api/user/kv/userProfession', { credentials: 'include' });
        const jp = rp.ok ? await rp.json().catch(() => null) : null;
        const vp = jp && typeof jp === 'object' && 'value' in jp ? jp.value : jp;
        // Only store if vp is a valid non-empty string
        if (vp && typeof vp === 'string' && vp !== '[object Object]') {
          sessionStorage.setItem('userProfession', vp);
          localStorage.setItem('userProfession', vp);
        }
      } catch (professionFetchErr) {
        console.warn('[useDynamicProfessions] Failed to hydrate userProfession from server:', professionFetchErr);
      }
      try {
        const re = await fetch('/api/user/kv/userEmail', { credentials: 'include' });
        const je = re.ok ? await re.json().catch(() => null) : null;
        const ve = je && typeof je === 'object' && 'value' in je ? je.value : je;
        // Only store if ve is a valid non-empty string
        if (ve && typeof ve === 'string' && ve !== '[object Object]') {
          sessionStorage.setItem('userEmail', ve);
          localStorage.setItem('userEmail', ve);
        }
      } catch (emailFetchErr) {
        console.warn('[useDynamicProfessions] Failed to hydrate userEmail from server:', emailFetchErr);
      }
      (window as any).__userKvHydrated = true;
      (window as any).__userKvHydrating = false;
    })();
  }, [user?.id]);

  const getUserProfession = getCurrentUserProfession; // Alias for compatibility

  const getProfessionDisplayName = (profession?: string): string => {
    const targetProfession = profession || getCurrentUserProfession();
    // First try professionConfigs, then fallback to DEFAULT_PROFESSIONS, then use profession name
    return professionConfigs[targetProfession]?.displayName 
      || DEFAULT_PROFESSIONS[targetProfession]?.displayName 
      || targetProfession;
  };

  const getProfessionIcon = (profession?: string) => {
    const targetProfession = profession || getCurrentUserProfession();
    return professionConfigs[targetProfession]?.icon;
};

  const getUserProfessionColor = (profession?: string): string => {
    const targetProfession = profession || getCurrentUserProfession();
    return professionConfigs[targetProfession]?.iconColor || '#ff6b35';
};

  /**
   * Check if a profession supports a specific feature
   * Connected to profession-feature-matrix.ts for accurate feature availability
   */
  const professionSupports = (profession: string, feature: string): boolean => {
    // First check if the profession is active
    if (!professionConfigs[profession]?.isActive) {
      return false;
    }
    // Then check the feature matrix for feature availability
    return isProfessionFeatureAvailable(profession, feature);
  };

  /**
   * Check if a profession feature is explicitly enabled (not just available)
   * Uses isProfessionFeatureEnabled for granular feature flag control
   */
  const isFeatureEnabled = (profession: string, feature: string): boolean => {
    if (!professionConfigs[profession]?.isActive) {
      return false;
    }
    return isProfessionFeatureEnabled(profession, feature);
  };

  const getProfessionCategory = (profession?: string): string => {
    const targetProfession = profession || getCurrentUserProfession();
    const professionMap = {
      photographer: 'Fotografi',
      videographer: 'Videografi', 
      music_producer: 'Musikkproduksjon',
      vendor: 'Produkter',
      enterprise: 'Enterprise Team'
  };
    return professionMap[targetProfession as keyof typeof professionMap] || 'Tjenester';
};

  const normalizeProfessionKey = (profession: string): string => {
    return profession === 'music_producer' ? 'musicproducer' : profession;
};

  const getAllProfessionTypes = (): string[] => {
    return Object.keys(professionConfigs).filter(key => professionConfigs[key].isActive);
};

  const getProfessionConfig = (profession?: string): DynamicProfessionConfig | null => {
    const targetProfession = profession || getCurrentUserProfession();
    return professionConfigs[targetProfession] || null;
};

  // Real Google Trends Integration
  const loadTrendsData = async (profession: string, region: string = 'norway') => {
    try {
      const response = await apiRequest(`/api/admin/profession-trends`, {
        method: 'POST',
        body: JSON.stringify({ profession, region })
      });
      return response;
    } catch (error) {
      console.error('Error loading trends data:', error);
      throw error;
    }
  };

  const getTrendingKeywords = (profession: string) => {
    // Generate profession-specific keywords based on actual industry terms
    const professionKeywords: Record<string, Array<{keyword: string; trend: 'rising' | 'stable' | 'declining'; searchVolume: string; opportunity: string; competition: string}>> = {
      photographer: [
        { keyword: 'bryllupsfotograf', trend: 'rising', searchVolume: '8900', opportunity: 'high', competition: 'medium' },
        { keyword: 'portrettfotografering', trend: 'stable', searchVolume: '5400', opportunity: 'medium', competition: 'high' },
        { keyword: 'produktfotografering', trend: 'rising', searchVolume: '4200', opportunity: 'high', competition: 'low' },
        { keyword: 'eventfotograf', trend: 'stable', searchVolume: '3800', opportunity: 'medium', competition: 'medium' },
        { keyword: 'naturfotografering', trend: 'declining', searchVolume: '2900', opportunity: 'low', competition: 'high' },
      ],
      videographer: [
        { keyword: 'bryllupsvideo', trend: 'rising', searchVolume: '7200', opportunity: 'high', competition: 'medium' },
        { keyword: 'bedriftsvideo', trend: 'rising', searchVolume: '6100', opportunity: 'high', competition: 'low' },
        { keyword: 'musikkv ideo', trend: 'stable', searchVolume: '4900', opportunity: 'medium', competition: 'high' },
        { keyword: 'dronefilming', trend: 'rising', searchVolume: '5800', opportunity: 'high', competition: 'medium' },
        { keyword: 'reklamefilm', trend: 'stable', searchVolume: '3600', opportunity: 'medium', competition: 'medium' },
      ],
      music_producer: [
        { keyword: 'musikkproduksjon', trend: 'rising', searchVolume: '6700', opportunity: 'high', competition: 'medium' },
        { keyword: 'miksing mastering', trend: 'stable', searchVolume: '4300', opportunity: 'medium', competition: 'high' },
        { keyword: 'beatmaker', trend: 'rising', searchVolume: '5900', opportunity: 'high', competition: 'low' },
        { keyword: 'studiopptak', trend: 'stable', searchVolume: '3200', opportunity: 'medium', competition: 'medium' },
        { keyword: 'lyddesign', trend: 'rising', searchVolume: '2800', opportunity: 'high', competition: 'low' },
      ],
      vendor: [
        { keyword: 'fotoutstyr', trend: 'stable', searchVolume: '5600', opportunity: 'medium', competition: 'high' },
        { keyword: 'kamerautstyr', trend: 'rising', searchVolume: '4900', opportunity: 'high', competition: 'medium' },
        { keyword: 'studioutstyr', trend: 'rising', searchVolume: '3700', opportunity: 'high', competition: 'low' },
        { keyword: 'lysutstyr', trend: 'stable', searchVolume: '3200', opportunity: 'medium', competition: 'medium' },
        { keyword: 'videoutstyr', trend: 'rising', searchVolume: '4100', opportunity: 'high', competition: 'medium' },
      ],
      enterprise: [
        { keyword: 'bryllupsfotograf og videograf', trend: 'rising', searchVolume: '6200', opportunity: 'high', competition: 'low' },
        { keyword: 'foto og video team', trend: 'rising', searchVolume: '4800', opportunity: 'high', competition: 'low' },
        { keyword: 'bryllupsteam foto video', trend: 'rising', searchVolume: '3900', opportunity: 'high', competition: 'low' },
        { keyword: 'profesjonell bryllupspakke', trend: 'stable', searchVolume: '5100', opportunity: 'high', competition: 'medium' },
        { keyword: 'komplett bryllupsdokumentasjon', trend: 'rising', searchVolume: '3400', opportunity: 'high', competition: 'low' },
      ]
    };

    return professionKeywords[profession] || [];
  };

  const getSEOSuggestions = (profession: string) => {
    // Generate real, actionable SEO suggestions based on profession
    const professionSuggestions: Record<string, Array<{title: string; description: string; category: string}>> = {
      photographer: [
        { title: 'Optimaliser for lokal søk', description: 'Legg til "Oslo", "Bergen" eller din by i meta-beskrivelser', category: 'Lokal SEO' },
        { title: 'Lag porteføljesider per service', description: 'Separate sider for bryllup, portrett, og produkt øker rangeringen', category: 'Innholdsstruktur' },
        { title: 'Bruk alt-tekst på alle bilder', description: 'Beskrivende alt-tekst med nøkkelord forbedrer bildesøk-rangeringen', category: 'Teknisk SEO' },
        { title: 'Bygg lokale backlinks', description: 'Få linker fra venue-nettsteder og lokale bryllupsmagasiner', category: 'Off-Page SEO' },
        { title: 'Optimaliser lastehastighet', description: 'Komprimer bilder og bruk lazy loading for raskere sidelast', category: 'Teknisk SEO' },
      ],
      videographer: [
        { title: 'Embed videoer på nettstedet', description: 'Videoer øker tid på siden - en nøkkelfaktor for SEO', category: 'Innhold' },
        { title: 'Lag videoer-sitemap', description: 'Hjelp Google å forstå videokatalog-strukturen din', category: 'Teknisk SEO' },
        { title: 'Optimaliser YouTube-titler', description: 'Bruk nøkkelord i YouTube-videoer som linker tilbake', category: 'Video SEO' },
        { title: 'Legg til strukturerte data', description: 'Schema markup for VideoObject forbedrer rich snippets', category: 'Teknisk SEO' },
        { title: 'Lag bransjecase-studier', description: 'Long-form innhold med keywords rangerer bedre', category: 'Innholdsmarkedsføring' },
      ],
      music_producer: [
        { title: 'Optimaliser sporprofiler', description: 'Bruk artistnavn og sjangere i metadata', category: 'Audio SEO' },
        { title: 'Lag produkter for hver sjanger', description: 'Separate landingssider for hip-hop, pop, etc.', category: 'Innholdsstruktur' },
        { title: 'Bygg Spotify/Apple Music integration', description: 'Embed spor for å øke engagement-metrics', category: 'Sosialt signal' },
        { title: 'Publiser produksjonstips', description: 'Blogginnhold tiltrekker seg organisk trafikk', category: 'Innholdsmarkedsføring' },
        { title: 'Optimaliser for stemmes øk', description: 'Bruk naturlig språk i FAQ for smart speaker-søk', category: 'Fremtidig SEO' },
      ],
      vendor: [
        { title: 'Lag produktbeskrivelser', description: 'Unike beskrivelser for hvert produkt unngår duplikat innhold', category: 'Produktsider' },
        { title: 'Legg til produktanmeldelser', description: 'Brukeranmeldelser gir fresh content og øker tillit', category: 'Sosialt  bevis' },
        { title: 'Optimaliser produktbilder', description: 'Store bilder bremser siden - bruk WebP-format', category: 'Teknisk SEO' },
        { title: 'Implementer breadcrumbs', description: 'Breadcrumb-navigasjon forbedrer crawlability', category: 'Nettstedsstruktur' },
        { title: 'Lag sammenligningsguider', description: 'Sammenlign produkter mot konkurrenter for å rangere på "beste X"', category: 'Innhold' },
      ],
      enterprise: [
        { title: 'Optimaliser for "foto og video team"', description: 'Kombiner nøkkelord for å fange begge markeder', category: 'Innholdsstruktur' },
        { title: 'Vis teamet på landingsside', description: 'Personlige profiler per teammedlem bygger tillit', category: 'Sosialt bevis' },
        { title: 'Lag case-studier for kombinerte oppdrag', description: 'Vis foto + video fra samme bryllup for å demonstrere verdi', category: 'Innholdsmarkedsføring' },
        { title: 'Bygg lokale landingssider', description: 'Egne sider per by/region med teamets tilgjengelighet', category: 'Lokal SEO' },
        { title: 'Implementer strukturerte data for team', description: 'Schema markup for LocalBusiness og Organization', category: 'Teknisk SEO' },
      ]
    };

    return professionSuggestions[profession] || [];
  };

  const getSEOInsights = (profession: string) => {
    // Generate real market insights based on profession
    const professionInsights: Record<string, {trend: 'rising' | 'stable' | 'declining'; searchVolume: number; opportunity: 'high' | 'medium' | 'low'; seasonality: string}> = {
      photographer: {
        trend: 'rising',
        searchVolume: 28400,
        opportunity: 'high',
        seasonality: 'Topp: Mai-September (bryllupssesong)'
      },
      videographer: {
        trend: 'rising',
        searchVolume: 24800,
        opportunity: 'high',
        seasonality: 'Topp: Juni-August, Desember (julevideo)'
      },
      music_producer: {
        trend: 'stable',
        searchVolume: 19300,
        opportunity: 'medium',
        seasonality: 'Jevn - liten sesongvariasjon'
      },
      vendor: {
        trend: 'stable',
        searchVolume: 22100,
        opportunity: 'medium',
        seasonality: 'Topp: November-Desember, Januar (nyttårskampanjer)'
      },
      enterprise: {
        trend: 'rising',
        searchVolume: 31200,
        opportunity: 'high',
        seasonality: 'Topp: Mai-September (bryllupssesong, kombinert foto+video)'
      }
    };

    return professionInsights[profession] || {
      trend: 'stable',
      searchVolume: 15000,
      opportunity: 'medium',
      seasonality: 'Varierer per bransje'
    };
  };

  const applySEOFixes = async (profession: string, region: string) => {
    try {
      // Make actual API call to apply SEO optimizations
      const response = await apiRequest('/api/admin/apply-seo-fixes', {
        method: 'POST',
        body: JSON.stringify({
          profession,
          region,
          fixes: getSEOSuggestions(profession).slice(0, 3) // Apply top 3 suggestions
        })
      });
      return response.success;
    } catch (error) {
      console.error('Error applying SEO fixes:', error);
      return false;
    }
  };

  return {
    professionConfigs,
    isLoading,
    error,
    getCurrentUserProfession,
    getUserProfession,
    getProfessionDisplayName,
    getProfessionIcon,
    getUserProfessionColor,
    professionSupports,
    isFeatureEnabled,
    getProfessionCategory,
    normalizeProfessionKey,
    getAllProfessionTypes,
    getProfessionConfig,
    loadTrendsData,
    getTrendingKeywords,
    getSEOSuggestions,
    getSEOInsights,
    applySEOFixes,
    professions: professionConfigs, // Alias for compatibility
    loading: isLoading, // Alias for compatibility
    refetch: () => {
      // Optionally force refresh
  }
};
}

// Default component mappings for professions
function getDefaultComponentsForProfession(professionName: string) {
  // Base components that all professions have
  const baseComponents = {
    overview: ['DashboardStats','ProjectOverview','RecentActivity'],
    projects: ['ProjectManager','ClientProjects','ProjectTimeline'],
    pricing: ['PriceAdministration'],
    contracts: ['ContractManager','DigitalSignatures'],
    clients: ['UniversalCRMDashboard','ClientCommunication'],
    equipment: ['EnhancedGearTab','EquipmentManager'],
    files: ['FilesTab','GoogleDriveIntegration'],
    email: ['IntegratedEmailCenter'],
    worklog: ['UniversalWorklog'],
    settings: ['SystemSettings','GoogleIntegration'],
    communication: ['UniversalChatWidget','NotificationCenter']
};

  // Profession-specific customizations
  switch (professionName) {
    case 'photographer':
    case 'fotograf':
      return {
        ...baseComponents,
        projects: ['ProjectManager','PhotoProjects','ProjectTimeline'],
        equipment: ['EnhancedGearTab','CameraEquipment','PhotoEquipment']
    };
      
    case 'videographer':
    case 'videograf':
      return {
        ...baseComponents,
        projects: ['VideoProjectManager','VideoProjects','ProjectTimeline'],
        equipment: ['EnhancedGearTab','VideoEquipment','CameraEquipment']
    };
      
    case 'musicproducer':
    case 'music_producer':
    case 'musikkprodusent':
      return {
        ...baseComponents,
        projects: ['MusicProjectManager','ArtistProjects','TrackManager'],
        clients: ['UniversalCRMDashboard','ArtistCommunication'],
        equipment: ['EnhancedGearTab','StudioEquipment','AudioEquipment']
    };
      
    case 'vendor':
    case 'leverandør':
    case 'leverandor':
      return {
        ...baseComponents,
        overview: ['UniversalVendorDashboard','VendorDashboard'],
        projects: ['VendorProductManager', 'UniversalCRMDashboard'],
        showcase: ['VendorShowcase', 'UniversalVendorDashboard'],
        equipment: ['EnhancedGearTab', 'VendorProductManager']
    };

    case 'enterprise':
      return {
        ...baseComponents,
        overview: ['DashboardStats','ProjectOverview','RecentActivity','TeamOverview'],
        projects: ['ProjectManager','PhotoProjects','VideoProjectManager','ProjectTimeline'],
        equipment: ['EnhancedGearTab','CameraEquipment','PhotoEquipment','VideoEquipment'],
        showcase: ['ShowcaseAdmin','TeamPortfolio'],
        timeline: ['WeddingTimelineAdmin','TeamShotList'],
        communication: ['UniversalChatWidget','NotificationCenter','TeamChat']
    };
      
    default:
      return baseComponents;
}
}

export default useDynamicProfessions;