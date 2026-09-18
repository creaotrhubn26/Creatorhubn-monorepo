/**
 * Harness for LocationAnalysisDialog.
 *
 * Dialogen er den flaten en location scout åpner i felt, og den er meldt med
 * horisontal overflyt ved 390 px siden 14. september. Den trenger ingen
 * backend når lokasjonen allerede bærer sin `propertyAnalysis`, så harnessen
 * mater den med et realistisk Troll-datasett og lar dialogen stå åpen.
 */
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { LocationAnalysisDialog } from './components/role-room/components/LocationAnalysisDialog';
import type { Location } from './components/role-room/models/casting';

const theme = createTheme({ palette: { mode: 'dark' } });

const location = {
  id: 'dovrefjell',
  name: 'Dovrefjell — Hjerkinn',
  address: 'Hjerkinnhusvegen 33, 2661 Hjerkinn',
  propertyId: '3432-1-1',
  coordinates: { lat: 62.221369748446335, lng: 9.545710818134248 },
  contactInfo: { name: 'Kari Grunneier', phone: '+47 900 00 000', email: 'kari@example.test' },
  propertyAnalysis: {
    photographySpots: [
      { name: 'Viewpoint Snøhetta', description: 'Panorama mot Snøhetta, best i motlys tidlig morgen.', lighting: 'Motlys ved soloppgang, flatt lys etter kl. 11', bestTimes: ['06:00–08:30', '18:00–20:00'], accessibility: 'moderate', restrictions: ['Villreinhensyn i kalvingsperioden'], coordinates: { lat: 62.2213, lng: 9.5457 } },
      { name: 'Hjerkinn stasjon', description: 'Dekning mot sør, eksponert for vind fra vest.', lighting: 'Sidelys ettermiddag', bestTimes: ['15:00–17:00'], accessibility: 'easy', coordinates: { lat: 62.2189, lng: 9.5402 } },
    ],
    droneRestrictions: {
      allowed: false,
      maxAltitude: 0,
      restrictions: ['Nasjonalpark — søknad til Statsforvalteren kreves', 'Villreinområde med ferdselsforbud i kalvingsperioden'],
      noFlyZones: [{ lat: 62.2213, lng: 9.5457 }],
    },
    weatherExposure: {
      windExposure: 'high',
      sunExposure: 'all-day',
      shelterOptions: ['Hjerkinnhus', 'Unit base i telt ved parkering'],
      droneSafety: 'Ikke forsvarlig ved vind over 12 m/s',
      windSpeedKmh: 43,
      sunrise: '06:41',
      sunset: '19:52',
      daylightHours: 13.2,
    },
    accessAnalysis: {
      accessibility: 'limited',
      walkingDistance: 350,
      publicTransport: ['Hjerkinn stasjon, 1,2 km', 'Buss 4 mot Dombås, 900 m'],
      parkingSpots: [
        { name: 'Parkering Viewpoint', address: 'Hjerkinnhusvegen 33, 2661 Hjerkinn', coordinates: { lat: 62.2211, lng: 9.5449 }, distance: 350, spaces: 40, description: 'Grus, tåler unit-kjøretøy' },
      ],
      evParkingSpots: [],
      evChargingSpots: [
        { name: 'Hjerkinn lading', address: 'Hjerkinnhusvegen 12, 2661 Hjerkinn', coordinates: { lat: 62.2195, lng: 9.5431 }, distance: 700, spaces: 2 },
      ],
    },
    manualNotes: 'Adkomstvei kan stenges på kort varsel av hensyn til villrein. Avklares med Statsforvalteren i forkant av hver opptaksdag.',
    analysisMeta: {
      operationalStatus: 'user_confirmed',
      propertySource: 'kartverket',
      verifiedAt: '2026-09-15T09:00:00Z',
      verifiedBy: 'Location manager',
      warnings: ['Villreinhensyn kan stenge adkomstveien på kort varsel.'],
    },
  },
} as unknown as Location;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <LocationAnalysisDialog open location={location} onClose={() => {}} />
  </ThemeProvider>,
);
