import {
  Favorite,
  Portrait,
  Event,
  Business,
  Movie,
  MusicNote,
  Group,
  ShoppingBag,
  Person,
  Work,
  Mic,
  CameraAlt,
  Campaign,
  School,
  AutoAwesome,
  Article,
  TheaterComedy,
  SportsEsports,
} from '@mui/icons-material';

// Project types with Material UI icons
export const PROJECT_TYPES = {
  wedding: { name: 'Bryllup', icon: Favorite },
  portrait: { name: 'Portrett', icon: Portrait },
  event: { name: 'Event', icon: Event },
  commercial: { name: 'Kommersiell', icon: Business },
  video: { name: 'Video', icon: Movie },
  music: { name: 'Musikk', icon: MusicNote },
  family: { name: 'Familie', icon: Group },
  product: { name: 'Produkt', icon: ShoppingBag },
  fashion: { name: 'Fashion/Modell', icon: Person },
  documentary: { name: 'Dokumentar', icon: Movie },
  corporate: { name: 'Corporate', icon: Work },
  interview: { name: 'Intervju', icon: Mic },
  photoshoot: { name: 'Photo Shoot', icon: CameraAlt },
  promo: { name: 'Promo/Reclame', icon: Campaign },
  workshop: { name: 'Workshop', icon: School },
  testshoot: { name: 'Test Shoot', icon: AutoAwesome },
  headshots: { name: 'Headshots', icon: Portrait },
  editorial: { name: 'Editorial', icon: Article },
  theater: { name: 'Teater/Scene', icon: TheaterComedy },
  sports: { name: 'Sport', icon: SportsEsports }
} as const;












