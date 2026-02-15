/**
 * Profession Tabs Hook
 * Dynamically provides tab configurations based on profession type
 * Works seamlessly with existing UniversalDashboard.tsx WITHOUT refactoring
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getProfessionTypeById } from '../../../shared/profession-type-registry';

export interface ProfessionTab {
  id: string;
  label: string;
  icon: any;
  component?: string;
  isActive?: boolean;
}

export interface ProfessionTabConfig {
  professionId: string;
  professionName: string;
  color: string;
  tabs: ProfessionTab[];
  projectTypes: string[];
  stats: Array<{
    key: string;
    label: string;
    icon: any;
  }>;
}

/**
 * Hook that returns profession-specific tab configuration
 * Merges static config from UniversalDashboard with dynamic registry data
 */
export function useProfessionTabs(profession: string) {
  
  // Fetch profession type from registry
  const { data: professionType, isLoading } = useQuery({
    queryKey: ['/api/admin/profession-types', profession],
    queryFn: async () => {
      // Try to get from backend registry
      const result = await apiRequest(`/api/admin/profession-types/${profession}`);
      return result;
    },
    retry: false,
    staleTime: 60 * 60 * 1000, // 1 hour - profession configs don't change often
  });

  // Generate tabs based on profession type
  const getTabsForProfession = (professionId: string): ProfessionTab[] => {
    // Base tabs that ALL professions get
    const baseTabs: ProfessionTab[] = [
      { id: 'overview', label: 'Oversikt', icon: 'dashboard' },
      { id: 'projects', label: 'Prosjekter', icon: 'folder' },
      { id: 'contracts', label: 'Kontrakter', icon: 'article' },
    ];

    // Profession-specific tabs
    const professionSpecificTabs: Record<string, ProfessionTab[]> = {
      photographer: [
        { id: 'wedding-timeline', label: 'Bryllupstidslinje', icon: 'event' },
        { id: 'showcase-admin', label: 'Showcase Admin', icon: 'collections' },
        { id: 'photo-enhancement', label: 'AI Forbedring', icon: 'auto-fix' },
      ],
      
      videographer: [
        { id: 'showcase-admin', label: 'Showcase Admin', icon: 'collections' },
        { id: 'video-enhancement', label: 'Video AI', icon: 'movie' },
        { id: 'story-arc', label: 'Story Arc Studio', icon: 'timeline' },
      ],
      
      music_producer: [
        { id: 'music-showcase', label: 'Musikk Showcase', icon: 'library-music' },
        { id: 'audio-enhancement', label: 'Audio AI', icon: 'equalizer' },
        { id: 'artist-management', label: 'Artister', icon: 'people' },
      ],
      
      vendor: [
        { id: 'product-manager', label: 'Produkter', icon: 'inventory' },
        { id: 'orders', label: 'Bestillinger', icon: 'shopping-cart' },
        { id: 'vendor-type-manager', label: 'Vendor Typer', icon: 'category' },
      ],
      
      // ⭐ NEW PROFESSIONS - Automatically configured
      
      pet_hotel: [
        { id: 'booking-calendar', label: 'Bookingkalender', icon: 'calendar' },
        { id: 'pet-profiles', label: 'Dyreprofiler', icon: 'pets' },
        { id: 'live-cameras', label: 'Live Kameraer', icon: 'videocam' },
        { id: 'daily-logs', label: 'Daglige Logger', icon: 'note' },
        { id: 'facility-management', label: 'Fasilitet', icon: 'hotel' },
      ],
      
      yoga_studio: [
        { id: 'class-schedule', label: 'Timeplan', icon: 'schedule' },
        { id: 'memberships', label: 'Medlemskap', icon: 'card-membership' },
        { id: 'instructor-management', label: 'Instruktører', icon: 'person' },
        { id: 'studio-booking', label: 'Rombestilling', icon: 'room' },
      ],
      
      tattoo_artist: [
        { id: 'portfolio', label: 'Portfolio', icon: 'photo-library' },
        { id: 'appointments', label: 'Avtaler', icon: 'event' },
        { id: 'design-gallery', label: 'Design Galleri', icon: 'brush' },
        { id: 'aftercare', label: 'Etterbehandling', icon: 'healing' },
      ],
      
      hairdresser: [
        { id: 'appointments', label: 'Avtaler', icon: 'event' },
        { id: 'client-history', label: 'Kundehistorikk', icon: 'history' },
        { id: 'product-sales', label: 'Produktsalg', icon: 'shopping-bag' },
        { id: 'stylist-portfolio', label: 'Portfolio', icon: 'photo-library' },
      ],
      
      personal_trainer: [
        { id: 'client-programs', label: 'Treningsprogram', icon: 'fitness-center' },
        { id: 'progress-tracking', label: 'Fremgang', icon: 'trending-up' },
        { id: 'nutrition-plans', label: 'Kosthold', icon: 'restaurant' },
        { id: 'session-booking', label: 'Øktbestilling', icon: 'event' },
      ],
      
      restaurant: [
        { id: 'reservations', label: 'Reservasjoner', icon: 'event' },
        { id: 'menu-management', label: 'Meny', icon: 'restaurant-menu' },
        { id: 'table-management', label: 'Bordadministrasjon', icon: 'table-chart' },
        { id: 'inventory', label: 'Varelager', icon: 'inventory' },
      ],
      
      florist: [
        { id: 'event-orders', label: 'Arrangement', icon: 'event' },
        { id: 'flower-inventory', label: 'Blomsterlager', icon: 'local-florist' },
        { id: 'delivery-schedule', label: 'Leveranser', icon: 'local-shipping' },
        { id: 'design-portfolio', label: 'Designportfolio', icon: 'photo-library' },
      ],
      
      childcare: [
        { id: 'enrollment', label: 'Påmelding', icon: 'person-add' },
        { id: 'daily-activities', label: 'Daglige Aktiviteter', icon: 'event-note' },
        { id: 'parent-communication', label: 'Foreldrekontakt', icon: 'chat' },
        { id: 'meal-planning', label: 'Måltidsplan', icon: 'restaurant' },
      ],
      
      psychologist: [
        { id: 'patient-sessions', label: 'Samtaler', icon: 'event' },
        { id: 'patient-notes', label: 'Journaler', icon: 'note' },
        { id: 'telehealth', label: 'Videokonsultasjon', icon: 'videocam' },
        { id: 'treatment-plans', label: 'Behandlingsplan', icon: 'assessment' },
      ],
      
      driving_school: [
        { id: 'lesson-schedule', label: 'Timeoversikt', icon: 'schedule' },
        { id: 'student-progress', label: 'Elevfremgang', icon: 'trending-up' },
        { id: 'vehicle-management', label: 'Kjøretøy', icon: 'directions-car' },
        { id: 'theory-tests', label: 'Teorikurs', icon: 'quiz' },
      ],
      
      spa_wellness: [
        { id: 'treatment-booking', label: 'Behandlinger', icon: 'spa' },
        { id: 'client-preferences', label: 'Kundepreferanser', icon: 'favorite' },
        { id: 'product-inventory', label: 'Produkter', icon: 'inventory' },
        { id: 'membership-packages', label: 'Medlemskap', icon: 'card-membership' },
      ],
    };

    // Common tabs that most professions get
    const commonTabs: ProfessionTab[] = [
      { id: 'equipment', label: 'Utstyr', icon: 'build' },
      { id: 'files', label: 'Filer', icon: 'folder-open' },
      { id: 'email-center', label: 'E-post', icon: 'email' },
      { id: 'worklog', label: 'Worklog', icon: 'access-time' },
      { id: 'clients', label: 'Kunder', icon: 'people' },
      { id: 'role-room', label: 'The Role Room', icon: 'theater-comedy' },
      { id: 'settings', label: 'Innstillinger', icon: 'settings' },
      { id: 'communication', label: 'Kommunikasjon', icon: 'chat' },
    ];

    // Combine tabs
    const specificTabs = professionSpecificTabs[professionId] || [];
    return [...baseTabs, ...specificTabs, ...commonTabs];
  };

  // Generate project types based on profession
  const getProjectTypesForProfession = (professionId: string): string[] => {
    const projectTypes: Record<string, string[]> = {
      photographer: ['bryllup','commercial','portrett','produkt'],
      videographer: ['bryllup','reklame','dokumentar','musikkvideo'],
      music_producer: ['album','singel','podcast','jingle'],
      vendor: ['utleie','salg','service','konsultasjon'],
      pet_hotel: ['overnatting','dagpass','langtidsopphold','spesialpleie'],
      yoga_studio: ['gruppe','privat','workshop','retreat'],
      tattoo_artist: ['custom','flash','cover-up','touch-up'],
      hairdresser: ['klipp','farge','styling','bryllup'],
      personal_trainer: ['vektnedgang','muskelbygging','rehabilitering','gruppe'],
      restaurant: ['reservasjon','catering','event','takeaway'],
      florist: ['bryllup','begravelse','event','abonnement'],
      childcare: ['heltid','deltid','drop-in','spesial'],
      psychologist: ['individualterapi','parterapi','gruppeterapi','utredning'],
      driving_school: ['klasse-b','klasse-a','oppfriskingskurs','teori'],
      spa_wellness: ['massasje','ansiktsbehandling','kroppsbehandling','pakke'],
    };

    return projectTypes[professionId] || ['standard','custom'];
  };

  // Generate stats based on profession
  const getStatsForProfession = (professionId: string) => {
    const baseStats = [
      { key: 'projects', label: 'Aktive Prosjekter', icon: 'assessment' },
      { key: 'clients', label: 'Nye Kunder', icon: 'people' },
      { key: 'revenue', label: 'Månedens Inntekt', icon: 'attach-money' },
    ];

    const professionSpecificStat: Record<string, any> = {
      photographer: { key: 'rating', label: 'Gjennomsnittsvurdering', icon: 'star' },
      videographer: { key: 'hours', label: 'Timer Redigert', icon: 'access-time' },
      music_producer: { key: 'streams', label: 'Totale Streams', icon: 'trending-up' },
      vendor: { key: 'inventory', label: 'Lagerstatus', icon: 'inventory' },
      pet_hotel: { key: 'occupancy', label: 'Belegg %', icon: 'hotel' },
      yoga_studio: { key: 'classes', label: 'Timer Holdt', icon: 'event' },
      tattoo_artist: { key: 'tattoos', label: 'Tatoveringer', icon: 'brush' },
      hairdresser: { key: 'appointments', label: 'Avtaler', icon: 'event' },
      personal_trainer: { key: 'sessions', label: 'Økter', icon: 'fitness-center' },
      restaurant: { key: 'covers', label: 'Kuverter', icon: 'restaurant' },
      florist: { key: 'arrangements', label: 'Arrangementer', icon: 'local-florist' },
      childcare: { key: 'children', label: 'Barn', icon: 'child-care' },
      psychologist: { key: 'sessions', label: 'Samtaler', icon: 'psychology' },
      driving_school: { key: 'students', label: 'Elever', icon: 'school' },
      spa_wellness: { key: 'treatments', label: 'Behandlinger', icon: 'spa' },
    };

    return [...baseStats, professionSpecificStat[professionId] || baseStats[0]];
  };

  // Return tab configuration
  return {
    tabs: getTabsForProfession(profession),
    projectTypes: getProjectTypesForProfession(profession),
    stats: getStatsForProfession(profession),
    professionType,
    isLoading,
    
    // Helper functions
    getTabLabel: (tabId: string, professionId: string) => {
      const tabs = getTabsForProfession(professionId);
      return tabs.find(t => t.id === tabId)?.label || tabId;
    },
    
    getTabIcon: (tabId: string, professionId: string) => {
      const tabs = getTabsForProfession(professionId);
      return tabs.find(t => t.id === tabId)?.icon || 'circle';
    },
    
    hasTab: (tabId: string, professionId: string) => {
      const tabs = getTabsForProfession(professionId);
      return tabs.some(t => t.id === tabId);
    },
    
    getProjectTypeLabel: (professionId: string) => {
      const labels: Record<string, string> = {
        photographer: 'Fotografiprosjekt',
        videographer: 'Videoprosjekt',
        music_producer: 'Musikkprosjekt',
        vendor: 'Produkt',
        pet_hotel: 'Booking',
        yoga_studio: 'Klasse',
        tattoo_artist: 'Tatovering',
        hairdresser: 'Avtale',
        personal_trainer: 'Økt',
        restaurant: 'Reservasjon',
        florist: 'Bestilling',
        childcare: 'Barn',
        psychologist: 'Samtale',
        driving_school: 'Kjøretime',
        spa_wellness: 'Behandling',
      };
      
      return labels[professionId] || 'Prosjekt';
    },
    
    getClientLabel: (professionId: string) => {
      const labels: Record<string, string> = {
        photographer: 'Kunder',
        videographer: 'Kunder',
        music_producer: 'Artister',
        vendor: 'Bestillinger',
        pet_hotel: 'Dyreeiere',
        yoga_studio: 'Medlemmer',
        tattoo_artist: 'Klienter',
        hairdresser: 'Kunder',
        personal_trainer: 'Klienter',
        restaurant: 'Gjester',
        florist: 'Kunder',
        childcare: 'Foreldre',
        psychologist: 'Pasienter',
        driving_school: 'Elever',
        spa_wellness: 'Klienter',
      };
      
      return labels[professionId] || 'Kunder';
    },
    
    getEquipmentLabel: (professionId: string) => {
      const labels: Record<string, string> = {
        photographer: 'Utstyr',
        videographer: 'Utstyr',
        music_producer: 'Studio',
        vendor: 'Lager',
        pet_hotel: 'Fasiliteter',
        yoga_studio: 'Studio',
        tattoo_artist: 'Utstyr',
        hairdresser: 'Utstyr',
        personal_trainer: 'Treningsutstyr',
        restaurant: 'Kjøkken',
        florist: 'Utstyr',
        childcare: 'Lekeområde',
        psychologist: 'Kontorfasiliteter',
        driving_school: 'Kjøretøy',
        spa_wellness: 'Behandlingsrom',
      };
      
      return labels[professionId] ||'Utstyr';
    }
  };
}

export default useProfessionTabs;

