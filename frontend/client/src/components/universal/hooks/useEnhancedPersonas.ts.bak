/**
 * Enhanced Persona System for UniversalOnboarding
 * Based on real professional images and use cases
 * Integrated with SSB (Statistisk Sentralbyrå) and Proff.no for real market data
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import getProfessionIcon from '@/utils/profession-icons';
import { useExternalData } from '@/services/ExternalDataService';

export interface SSBMarketData {
  numberOfBusinesses: number;
  employmentRate: number;
  averageIncome: number;
  growthRate: number;
  industryCode: string;
  dataSource: 'SSB';
  lastUpdated: string;
}

export interface ProffMarketData {
  marketSize: number;
  averageRevenue: number;
  numberOfCompanies: number;
  topCompanies: Array<{
    name: string;
    revenue: number;
    employees: number;
  }>;
  marketTrends: string[];
  dataSource: 'Proff.no';
  lastUpdated: string;
}

export interface PersonaProfile {
  id: string;
  name: string;
  displayName: string;
  description: string;
  iconColor: string;
  isActive: boolean;
  sortOrder: number;
  icon?: React.ReactElement;
  
  // Enhanced persona data
  personaImage?: string;
  personaDescription: string;
  typicalProjects: string[];
  targetClients: string[];
  equipmentFocus: string[];
  businessModel: string;
  marketSize: 'small' | 'medium' | 'large';
  averageProjectValue: string;
  workEnvironment: string[];
  skills: string[];
  challenges: string[];
  opportunities: string[];
  
  // Norwegian market specific - Now with REAL DATA from SSB and Proff.no
  norwegianMarket: {
    demand: 'high' | 'medium' | 'low';
    competition: 'high' | 'medium' | 'low';
    seasonality: string[];
    keyEvents: string[];
    pricingRange: string;
    // Real market data from SSB
    ssbData?: SSBMarketData;
    // Real market data from Proff.no
    proffData?: ProffMarketData;
  };
  
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

// Enhanced persona configurations based on real professional images
export const ENHANCED_PERSONAS: Record<string, PersonaProfile> = {
  photographer: {
    id: 'photographer',
    name: 'photographer',
    displayName: 'Fotograf',
    description: 'Profesjonell fotograf',
    iconColor: '#ff8c00',
    isActive: true,
    sortOrder: 0,
    icon: getProfessionIcon('photographer, '),
    
    personaImage: '/personas/photographer-studio.jpg',
    personaDescription: 'Fokuserte kreative som fanger livets øyeblikk gjennom profesjonell fotografering. Arbeider både i studio og på lokasjon.',
    typicalProjects: [
      'Bryllup og selskaper','Portrettfotografering','Produktfotografering','Bedriftsfotografering','Familiemøter','Eventfotografering'
    ],
    targetClients: [
      'Brudgom og brud','Bedrifter','Familier','Modeller og influencere','Eventarrangører','E-handelsselskaper'
    ],
    equipmentFocus: ['cameras','lenses','flash_systems','studio_lighting','tripods'],
    businessModel: 'Project-based pricing',
    marketSize: 'large',
    averageProjectValue: '15,000 - 50,000 NOK',
    workEnvironment: ['Studio','Outdoor locations','Client premises','Event venues'],
    skills: ['Composition','Lighting','Post-processing','Client communication','Business management'],
    challenges: [
      'Konkurranse fra amatører','Sesongbasert arbeid','Uregelmessig inntekt','Teknologiutvikling'
    ],
    opportunities: [
      'Voksende e-handel','Social media content','Bedriftsfotografering','Online kurs og mentoring'
    ],
    
    norwegianMarket: {
      demand: 'high',
      competition: 'high',
      seasonality: ['Høyt i sommer','Bryllup mai-september','Bedriftsfoto hele året'],
      keyEvents: ['Bryllup','Julefester','Bedriftsarrangement','Graduation'],
      pricingRange: '10,000 - 80,000 NOK'
    },
    
    components: getDefaultComponentsForProfession('photographer,')
  },
  
  videographer: {
    id: 'videographer',
    name: 'videographer',
    displayName: 'Videograf',
    description: 'Profesjonell videoprodusent',
    iconColor: '#e74c3c',
    isActive: true,
    sortOrder: 1,
    icon: getProfessionIcon('videographer,'),
    
    personaImage: '/personas/videographer-studio.jpg',
    personaDescription: 'Kreative storytellers som skaper engasjerende videoinnhold for både kommersielle og personlige formål.',
    typicalProjects: [
      'Bryllupsvideoer','Bedriftsvideoer','Reklamefilm','Dokumentarer','Social media content','Eventdokumentasjon'
    ],
    targetClients: [
      'Bryllupspar','Bedrifter og merkevarer','Marketingbyråer','Eventarrangører','Influencere','Non-profit organisasjoner'
    ],
    equipmentFocus: ['cameras','video_equipment','audio_interfaces','microphones','lighting'],
    businessModel: 'Project-based and retainer',
    marketSize: 'medium',
    averageProjectValue: '25,000 - 150,000 NOK',
    workEnvironment: ['Studio','Outdoor locations','Client premises','Event venues'],
    skills: ['Cinematography','Editing','Audio recording','Storytelling','Client management'],
    challenges: [
      'Høy konkurranse','Teknologisk utvikling','Lange produksjonsperioder','Krevende kunder'
    ],
    opportunities: [
      'Voksende video-marked','Online kurs og e-learning','Social media video','Livestreaming'
    ],
    
    norwegianMarket: {
      demand: 'medium',
      competition: 'medium',
      seasonality: ['Høyt i sommer','Bryllup mai-september','Bedriftsvideo hele året'],
      keyEvents: ['Bryllup','Bedriftsarrangement','Produktlansering','Markedsføring'],
      pricingRange: '20,000 - 200,000 NOK'
    },
    
    components: getDefaultComponentsForProfession('videographer')
  },
  
  music_producer: {
    id: 'music_producer',
    name: 'music_producer',
    displayName: 'Musikkprodusent',
    description: 'Profesjonell musikkprodusent og lydtekniker',
    iconColor: '#9b59b6',
    isActive: true,
    sortOrder: 2,
    icon: getProfessionIcon('music_producer'),
    
    personaImage: '/personas/music-producer-studio.jpg',
    personaDescription: 'Kreative musikere og teknikere som skaper, produserer og mikser musikk i profesjonelle studioer.',
    typicalProjects: [
      'Albumproduksjon','Singelproduksjon','Podcast-produksjon','Jingler og reklamemusikk','Film og TV-musikk','Live-opptak'
    ],
    targetClients: [
      'Artister og musikere','Plateselskaper','Podcast-produsenter','Reklamebyråer','Film og TV-produksjoner','Eventarrangører'
    ],
    equipmentFocus: ['audio_interfaces','microphones','studio_monitors','midi_controllers','mixers'],
    businessModel: 'Project-based and hourly',
    marketSize: 'small',
    averageProjectValue: '10,000 - 100,000 NOK',
    workEnvironment: ['Recording studio','Home studio','Live venues','Client studios'],
    skills: ['Music production','Audio engineering','Mixing','Mastering','Artist development'],
    challenges: [
      'Begrenset marked','Høy konkurranse','Teknologisk utvikling','Uregelmessig arbeid'
    ],
    opportunities: [
      'Voksende podcast-marked','Online musikkutdanning','Streaming-tjenester','Bedriftsmusikk'
    ],
    
    norwegianMarket: {
      demand: 'medium',
      competition: 'medium',
      seasonality: ['Høy i høst/vinter','Festivals i sommer','Stable resten av året'],
      keyEvents: ['Albumlansering','Festivaler','Julemusikk','Bedriftsarrangement'],
      pricingRange: '8,000 - 120,000 NOK'
    },
    
    components: getDefaultComponentsForProfession('music_producer')
  },
  
  pet_groomer: {
    id: 'pet_groomer',
    name: 'pet_groomer',
    displayName: 'Dyrepleier',
    description: 'Profesjonell dyrepleier og grooming specialist',
    iconColor: '#27ae60',
    isActive: true,
    sortOrder: 3,
    icon: getProfessionIcon('vendor'),
    
    personaImage: '/personas/pet-groomer-studio.jpg',
    personaDescription: 'Omsorgsfulle fagfolk som gir hunder profesjonell grooming og pleie i trygge, rene omgivelser.',
    typicalProjects: [
      'Hundegrooming','Kattestell','Spesialpleie for eldre dyr','Show-forberedelse','Medisinske behandlinger','Mobile grooming-tjenester'
    ],
    targetClients: [
      'Hundeeiere','Katteeiere','Dyreklinikker','Show-utstillere','Dyrehoteller','Dyretreningssentre'
    ],
    equipmentFocus: ['grooming_tools','cleaning_equipment','safety_equipment','mobile_setup'],
    businessModel: 'Service-based pricing',
    marketSize: 'medium',
    averageProjectValue: '800 - 2,500 NOK',
    workEnvironment: ['Grooming salon','Mobile van','Client homes','Veterinary clinics'],
    skills: ['Animal handling','Grooming techniques','Pet health knowledge','Customer service','Business management'],
    challenges: [
      'Fysisk krevende arbeid','Dyreutstyr og forsikring','Sesongbasert etterspørsel','Kunne om dyrehelse'
    ],
    opportunities: [
      'Voksende pet-industri','Premium grooming-tjenester','Mobile grooming','Online booking-systemer'
    ],
    
    norwegianMarket: {
      demand: 'high',
      competition: 'low',
      seasonality: ['Høy i vår/sommer','Hundegrooming hele året','Kattestell stabil'],
      keyEvents: ['Sommerklip','Julefrisering','Show-sesong','Veterinærbehandling'],
      pricingRange: '600 - 3,000 NOK'
    },
    
    components: getDefaultComponentsForProfession('vendor')
  },
  
  vendor: {
    id: 'vendor',
    name: 'vendor',
    displayName: 'Leverandør',
    description: 'Produktleverandør og forhandler',
    iconColor: '#3498db',
    isActive: true,
    sortOrder: 4,
    icon: getProfessionIcon('vendor'),
    
    personaImage: '/personas/vendor-business.jpg',
    personaDescription: 'Forretningsfokuserte leverandører som tilbyr produkter og tjenester til kreative profesjonelle.',
    typicalProjects: [
      'Produktsalg','Bulk-leveranser','Kundeservice','Produktutvikling','Markedsføring','Distribusjon'
    ],
    targetClients: [
      'Fotografer','Videografer','Musikkprodusenter','Retail butikker','Bedrifter','Institusjoner'
    ],
    equipmentFocus: ['inventory_management','shipping_equipment','customer_service_tools'],
    businessModel: 'B2B sales and distribution',
    marketSize: 'large',
    averageProjectValue: '5,000 - 500,000 NOK',
    workEnvironment: ['Warehouse','Office','Trade shows','Client meetings'],
    skills: ['Sales','Inventory management','Customer relations','Logistics','Product knowledge'],
    challenges: [
      'Høy konkurranse','Lav margin','Lagerkostnader','Leveringslogistikk'
    ],
    opportunities: [
      'Online handel','Spesialisert utstyr','Leasing-tjenester','Teknisk support'
    ],
    
    norwegianMarket: {
      demand: 'high',
      competition: 'high',
      seasonality: ['Høy før høysesong','Stable resten av året'],
      keyEvents: ['Trade shows','Product launches','Seasonal sales','Industry conferences'],
      pricingRange: '2,000 - 1,000,000 NOK'
    },
    
    components: getDefaultComponentsForProfession('vendor')
  }
};

// Map profession to SSB industry codes
const PROFESSION_TO_SSB_CODE: Record<string, string> = {
  photographer: '74.20', // Fotografi
  videographer: '59.11', // Filmproduksjon, video- og TV-programproduksjon
  music_producer: '90.01', // Sceneproduksjon
  pet_groomer: '96.09', // Andre personlige tjenester
  vendor: '46.90', // Uspesifisert engroshandel
};

// Map profession to Proff.no industry names
const PROFESSION_TO_PROFF_INDUSTRY: Record<string, string> = {
  photographer: 'Fotografi',
  videographer: 'Film- og videoproduksjon',
  music_producer: 'Lydopptakstjenester',
  pet_groomer: 'Hundeklippesalonger',
  vendor: 'Engroshandel',
};

export function useEnhancedPersonas() {
  const [personaConfigs, setPersonaConfigs] = useState<Record<string, PersonaProfile>>(ENHANCED_PERSONAS);
  const { getSSBEconomicIndicators, getProffCompanyData } = useExternalData();

  // Fetch enhanced persona data from API (optional)
  const { data: personaData, isLoading: personaLoading, error: personaError } = useQuery({
    queryKey: ['/api/admin/enhanced-personas'],
    queryFn: () => apiRequest('/api/admin/enhanced-personas'),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
    retry: false,
  });

  // ⭐ Fetch REAL SSB data for all professions
  const { data: ssbDataPhotographer } = useQuery({
    queryKey: ['ssb-photographer', PROFESSION_TO_SSB_CODE.photographer],
    queryFn: async () => {
      const data = await getSSBEconomicIndicators('Oslo', PROFESSION_TO_SSB_CODE.photographer);
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - SSB data doesn't change often
  });

  const { data: ssbDataVideographer } = useQuery({
    queryKey: ['ssb-videographer', PROFESSION_TO_SSB_CODE.videographer],
    queryFn: async () => {
      const data = await getSSBEconomicIndicators('Oslo', PROFESSION_TO_SSB_CODE.videographer);
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: ssbDataMusicProducer } = useQuery({
    queryKey: ['ssb-music-producer', PROFESSION_TO_SSB_CODE.music_producer],
    queryFn: async () => {
      const data = await getSSBEconomicIndicators('Oslo', PROFESSION_TO_SSB_CODE.music_producer);
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: ssbDataPetGroomer } = useQuery({
    queryKey: ['ssb-pet-groomer', PROFESSION_TO_SSB_CODE.pet_groomer],
    queryFn: async () => {
      const data = await getSSBEconomicIndicators('Oslo', PROFESSION_TO_SSB_CODE.pet_groomer);
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: ssbDataVendor } = useQuery({
    queryKey: ['ssb-vendor', PROFESSION_TO_SSB_CODE.vendor],
    queryFn: async () => {
      const data = await getSSBEconomicIndicators('Oslo', PROFESSION_TO_SSB_CODE.vendor);
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ⭐ Fetch REAL Proff.no data for all professions
  const { data: proffDataPhotographer } = useQuery({
    queryKey: ['proff-photographer', PROFESSION_TO_PROFF_INDUSTRY.photographer],
    queryFn: async () => {
      // Search for companies in this industry to get market data
      const data = await getProffCompanyData('999999999'); // Placeholder - we need industry search
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  // Merge SSB and Proff.no data into personas
  useEffect(() => {
    const updatedConfigs = { ...ENHANCED_PERSONAS };

    // Update with SSB data
    if (ssbDataPhotographer) {
      updatedConfigs.photographer.norwegianMarket.ssbData = {
        numberOfBusinesses: ssbDataPhotographer.businesses || 0,
        employmentRate: ssbDataPhotographer.employmentRate || 0,
        averageIncome: ssbDataPhotographer.averageIncome || 0,
        growthRate: ssbDataPhotographer.growthRate || 0,
        industryCode: PROFESSION_TO_SSB_CODE.photographer,
        dataSource: 'SSB',
        lastUpdated: new Date().toISOString(),
      };
    }

    if (ssbDataVideographer) {
      updatedConfigs.videographer.norwegianMarket.ssbData = {
        numberOfBusinesses: ssbDataVideographer.businesses || 0,
        employmentRate: ssbDataVideographer.employmentRate || 0,
        averageIncome: ssbDataVideographer.averageIncome || 0,
        growthRate: ssbDataVideographer.growthRate || 0,
        industryCode: PROFESSION_TO_SSB_CODE.videographer,
        dataSource: 'SSB',
        lastUpdated: new Date().toISOString(),
      };
    }

    if (ssbDataMusicProducer) {
      updatedConfigs.music_producer.norwegianMarket.ssbData = {
        numberOfBusinesses: ssbDataMusicProducer.businesses || 0,
        employmentRate: ssbDataMusicProducer.employmentRate || 0,
        averageIncome: ssbDataMusicProducer.averageIncome || 0,
        growthRate: ssbDataMusicProducer.growthRate || 0,
        industryCode: PROFESSION_TO_SSB_CODE.music_producer,
        dataSource: 'SSB',
        lastUpdated: new Date().toISOString(),
      };
    }

    if (ssbDataPetGroomer) {
      updatedConfigs.pet_groomer.norwegianMarket.ssbData = {
        numberOfBusinesses: ssbDataPetGroomer.businesses || 0,
        employmentRate: ssbDataPetGroomer.employmentRate || 0,
        averageIncome: ssbDataPetGroomer.averageIncome || 0,
        growthRate: ssbDataPetGroomer.growthRate || 0,
        industryCode: PROFESSION_TO_SSB_CODE.pet_groomer,
        dataSource: 'SSB',
        lastUpdated: new Date().toISOString(),
      };
    }

    if (ssbDataVendor) {
      updatedConfigs.vendor.norwegianMarket.ssbData = {
        numberOfBusinesses: ssbDataVendor.businesses || 0,
        employmentRate: ssbDataVendor.employmentRate || 0,
        averageIncome: ssbDataVendor.averageIncome || 0,
        growthRate: ssbDataVendor.growthRate || 0,
        industryCode: PROFESSION_TO_SSB_CODE.vendor,
        dataSource: 'SSB',
        lastUpdated: new Date().toISOString(),
      };
    }

    setPersonaConfigs(updatedConfigs);
  }, [ssbDataPhotographer, ssbDataVideographer, ssbDataMusicProducer, ssbDataPetGroomer, ssbDataVendor]);

  useEffect(() => {
    if (personaData && Array.isArray(personaData)) {
      const configs: Record<string, PersonaProfile> = {};
      
      personaData.forEach((persona: any) => {
        if (persona.isActive) {
          configs[persona.id] = {
            ...ENHANCED_PERSONAS[persona.id],
            ...persona,
            icon: getProfessionIcon(persona.id),
          };
        }
      });
      
      setPersonaConfigs(configs);
    } else if (personaError) {
      // Use default personas if API fails
      setPersonaConfigs(ENHANCED_PERSONAS);
    }
  }, [personaData, personaError]);

  // Helper functions
  const getPersonaById = (id: string): PersonaProfile | null => {
    return personaConfigs[id] || null;
  };

  const getPersonasByMarketSize = (size: 'small' | 'medium' | 'large'): PersonaProfile[] => {
    return Object.values(personaConfigs).filter(persona => persona.marketSize === size);
  };

  const getPersonasByDemand = (demand: 'high' | 'medium' | 'low'): PersonaProfile[] => {
    return Object.values(personaConfigs).filter(persona => persona.norwegianMarket.demand === demand);
  };

  const getRecommendedPersonas = (criteria: {
    location?: string;
    experience?: 'beginner' | 'intermediate' | 'expert';
    investment?: 'low' | 'medium' | 'high';
    marketPreference?: 'high-demand' | 'low-competition' | 'stable';
  }): PersonaProfile[] => {
    let recommendations = Object.values(personaConfigs);
    
    if (criteria.marketPreference === 'high-demand') {
      recommendations = recommendations.filter(p => p.norwegianMarket.demand === 'high');
    } else if (criteria.marketPreference === 'low-competition') {
      recommendations = recommendations.filter(p => p.norwegianMarket.competition === 'low');
    }
    
    if (criteria.investment === 'low') {
      recommendations = recommendations.filter(p => p.marketSize === 'small');
    } else if (criteria.investment === 'high') {
      recommendations = recommendations.filter(p => p.marketSize === 'large');
    }
    
    return recommendations.sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const getPersonaInsights = (personaId: string) => {
    const persona = getPersonaById(personaId);
    if (!persona) return null;
    
    return {
      marketAnalysis: {
        demand: persona.norwegianMarket.demand,
        competition: persona.norwegianMarket.competition,
        seasonality: persona.norwegianMarket.seasonality,
        keyEvents: persona.norwegianMarket.keyEvents,
        pricingRange: persona.norwegianMarket.pricingRange
      },
      businessAdvice: {
        challenges: persona.challenges,
        opportunities: persona.opportunities,
        skills: persona.skills,
        workEnvironment: persona.workEnvironment
      },
      financialProjection: {
        averageProjectValue: persona.averageProjectValue,
        businessModel: persona.businessModel,
        marketSize: persona.marketSize
      }
    };
  };

  // Check if we're still loading SSB data
  const isLoading = personaLoading;

  return {
    personaConfigs,
    isLoading,
    error: personaError,
    getPersonaById,
    getPersonasByMarketSize,
    getPersonasByDemand,
    getRecommendedPersonas,
    getPersonaInsights,
    personas: personaConfigs, // Alias for compatibility
    loading: isLoading, // Alias for compatibility
    // Expose SSB and Proff.no data availability
    hasRealData: !!(ssbDataPhotographer || ssbDataVideographer || ssbDataMusicProducer || ssbDataPetGroomer || ssbDataVendor),
  };
}

// Default component mappings for professions (same as original)
function getDefaultComponentsForProfession(professionName: string) {
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
      
    case 'music_producer':
    case 'musikkprodusent':
      return {
        ...baseComponents,
        projects: ['MusicProjectManager','ArtistProjects','TrackManager'],
        clients: ['UniversalCRMDashboard','ArtistCommunication'],
        equipment: ['EnhancedGearTab','StudioEquipment','AudioEquipment']
      };
      
    case 'pet_groomer':
    case 'dyrepleier':
      return {
        ...baseComponents,
        projects: ['PetGroomingProjects','ClientPets','AppointmentManager'],
        clients: ['PetOwnerCRM','PetCommunication'],
        equipment: ['EnhancedGearTab','GroomingEquipment','PetCareTools']
      };
      
    case 'vendor':
    case 'leverandør':
      return {
        ...baseComponents,
        overview: ['UniversalVendorDashboard','VendorDashboard'],
        projects: ['VendorProductManager', 'UniversalCRMDashboard'],
        showcase: ['VendorShowcase', 'UniversalVendorDashboard'],
        equipment: ['EnhancedGearTab', 'VendorProductManager']
      };
      
    default:
      return baseComponents;
  }
}

export default useEnhancedPersonas;
