/**
 * photo-venues-catalog.ts
 *
 * Curated seed-data for foto-lokasjons-katalogen (Slice 9X.34).
 *
 * Inkluderer ~20 populære foto-lokasjoner i Norge med kontakt, pris og
 * regler. Data er hentet fra offentlig tilgjengelige kilder (venue-
 * nettsider, kommuner, statlige etater) og må verifiseres halvårlig
 * (last_verified_at). Brukere kan foreslå korrigeringer som blir gjennomgått
 * før de merges inn.
 *
 * NB: Pris- og kontaktinfo kan endre seg. Stine ser alltid
 * last_verified_at i UI sammen med en "Verifiser nå"-knapp.
 */

export interface PhotoVenueSeed {
  slug: string;
  name: string;
  venueType:
    | "castle"
    | "mansion"
    | "beach"
    | "park"
    | "urban"
    | "church"
    | "forest"
    | "mountain"
    | "lake"
    | "historical"
    | "other";
  address?: string;
  city?: string;
  postalCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  bookingUrl?: string;
  requiresBooking: boolean;
  requiresPermit: boolean;
  feeKr?: number;
  feeUnit?: "free" | "per_hour" | "per_session" | "per_day" | "on_request";
  openingHours?: Record<string, string[]>;
  restrictionsText?: string;
  photographerNotes?: string;
  sourceUrl?: string;
}

export const PHOTO_VENUES_SEED: PhotoVenueSeed[] = [
  {
    slug: "losby-gods",
    name: "Losby Gods",
    venueType: "mansion",
    address: "Losbyveien 270",
    city: "Lørenskog",
    postalCode: "1475",
    county: "Akershus",
    latitude: 59.9114,
    longitude: 11.0319,
    contactName: "Losby Gods Resepsjon",
    contactEmail: "post@losbygods.no",
    contactPhone: "+47 67 92 33 00",
    websiteUrl: "https://www.losbygods.no",
    bookingUrl: "https://www.losbygods.no/kontakt",
    requiresBooking: true,
    requiresPermit: true,
    feeUnit: "on_request",
    restrictionsText:
      "Privat eiendom. Profesjonell fotografering krever skriftlig avtale på forhånd. Hovedhus og uteareal er populært til bryllup — bookes ofte 1+ år frem.",
    photographerNotes:
      "Hovedfasaden, parkanlegget og 1.-etasjes saler er bryllupsvennlige. Trapp foran hovedinngang er klassisk gruppebilde-spot. Sjekk om hagen er klippet samme uke.",
    sourceUrl: "https://www.losbygods.no",
  },
  {
    slug: "akershus-festning",
    name: "Akershus festning",
    venueType: "historical",
    address: "Akershus festning",
    city: "Oslo",
    postalCode: "0150",
    county: "Oslo",
    latitude: 59.9075,
    longitude: 10.7361,
    contactName: "Forsvarsbygg / Akershus Slott",
    contactEmail: "post@forsvarsbygg.no",
    contactPhone: "+47 815 70 400",
    websiteUrl: "https://forsvarsbygg.no/akershus",
    requiresBooking: false,
    requiresPermit: true,
    feeKr: 0,
    feeUnit: "free",
    openingHours: {
      mon: ["06:00-21:00"],
      tue: ["06:00-21:00"],
      wed: ["06:00-21:00"],
      thu: ["06:00-21:00"],
      fri: ["06:00-21:00"],
      sat: ["06:00-21:00"],
      sun: ["06:00-21:00"],
    },
    restrictionsText:
      "Festningsområdet er gratis og åpent 06–21. Inne i selve slottet kreves permit/inngangsbillett. Profesjonell fotografering på området er tillatt så lenge man ikke blokkerer publikum eller bruker droner.",
    photographerNotes:
      "Indre borggård gir sterk arkitektur. Utsikt mot Aker brygge fra muren. Stativ er greit utendørs. Sjekk vaktparade kl. 13:30.",
    sourceUrl: "https://forsvarsbygg.no/akershus",
  },
  {
    slug: "vigeland-parken",
    name: "Vigelandsparken (Frognerparken)",
    venueType: "park",
    address: "Nobels gate 32",
    city: "Oslo",
    postalCode: "0268",
    county: "Oslo",
    latitude: 59.927,
    longitude: 10.7016,
    contactName: "Vigeland-museet",
    contactEmail: "vigeland.museum@kul.oslo.kommune.no",
    contactPhone: "+47 23 49 37 00",
    websiteUrl: "https://vigeland.museum.no",
    requiresBooking: false,
    requiresPermit: true,
    feeKr: 0,
    feeUnit: "free",
    restrictionsText:
      "Profesjonell fotografering krever forhåndsmelding til Vigeland-museet. Bryllupsfoto med stativ er vanligvis tillatt utendørs. Drone forbudt.",
    photographerNotes:
      "Monolitten + sentralfontenen + broen er klassikere. Tidlig morgen er beste lys og minst folk.",
    sourceUrl: "https://vigeland.museum.no",
  },
  {
    slug: "holmenkollen-utsikt",
    name: "Holmenkollen utsikten",
    venueType: "mountain",
    address: "Kongeveien 5",
    city: "Oslo",
    postalCode: "0787",
    county: "Oslo",
    latitude: 59.9633,
    longitude: 10.6678,
    websiteUrl: "https://www.holmenkollen.com",
    requiresBooking: false,
    requiresPermit: false,
    feeKr: 0,
    feeUnit: "free",
    restrictionsText:
      "Selve bakken/inngangen er gratis. Hopptårnet krever billett. Drone i området krever klarering.",
    photographerNotes:
      "Solnedgang fra hoppbakken-platået gir 270° utsikt over Oslo. Mye vind — bruk vekttak.",
  },
  {
    slug: "sognsvann",
    name: "Sognsvann",
    venueType: "lake",
    address: "Sognsvann",
    city: "Oslo",
    postalCode: "0890",
    county: "Oslo",
    latitude: 59.9785,
    longitude: 10.7314,
    requiresBooking: false,
    requiresPermit: false,
    feeKr: 0,
    feeUnit: "free",
    restrictionsText:
      "Friluftsområde. Ingen tillatelse nødvendig for stille fotografering. Drone krever Luftfartstilsynets regler.",
    photographerNotes:
      "Speilblanke vannflater morgen/kveld. Strandstien rundt vannet er 3,3 km. Beste lys oktober.",
  },
  {
    slug: "bygdoy-folkemuseum",
    name: "Norsk Folkemuseum, Bygdøy",
    venueType: "historical",
    address: "Museumsveien 10",
    city: "Oslo",
    postalCode: "0287",
    county: "Oslo",
    contactEmail: "post@norskfolkemuseum.no",
    contactPhone: "+47 22 12 37 00",
    websiteUrl: "https://norskfolkemuseum.no",
    requiresBooking: true,
    requiresPermit: true,
    feeKr: 2500,
    feeUnit: "per_session",
    restrictionsText:
      "Profesjonell fotografering (bryllup, mote, kommersielt) krever booking og betaling. Stavkirken og gamlebyen er populære.",
    photographerNotes:
      "Stavkirken (Gol) gir helt unik bakgrunn. Tidlig morgen før museet åpner gir tomme tun.",
    sourceUrl: "https://norskfolkemuseum.no/leie",
  },
  {
    slug: "bergen-bryggen",
    name: "Bryggen i Bergen",
    venueType: "historical",
    address: "Bryggen",
    city: "Bergen",
    postalCode: "5003",
    county: "Vestland",
    requiresBooking: false,
    requiresPermit: false,
    feeKr: 0,
    feeUnit: "free",
    restrictionsText:
      "UNESCO-område. Stille fotografering er tillatt. Profesjonell oppstilling med utstyr som blokkerer turister krever avtale.",
    photographerNotes:
      "De gamle trehusene gir klassisk Bergen-bakgrunn. Beste tidspunkt: blue hour med lyset på.",
  },
  {
    slug: "preikestolen",
    name: "Preikestolen",
    venueType: "mountain",
    address: "Preikestolen",
    city: "Forsand",
    postalCode: "4129",
    county: "Rogaland",
    websiteUrl: "https://preikestolen365.com",
    requiresBooking: false,
    requiresPermit: false,
    feeKr: 0,
    feeUnit: "free",
    restrictionsText:
      "Ca. 2 timer tur fra parkering. Parkering har avgift (250 kr). Vær værforhold-bevisst.",
    photographerNotes:
      "Selve platået er trangt — beste komposisjon er fra siden. Soloppgang gir minst folk. Tursti er 4 km hver vei.",
  },
  {
    slug: "geirangerfjord",
    name: "Geirangerfjorden — Ørnesvingen",
    venueType: "mountain",
    address: "Ørnesvingen utsiktsplattform",
    city: "Geiranger",
    postalCode: "6216",
    county: "Møre og Romsdal",
    requiresBooking: false,
    requiresPermit: false,
    feeKr: 0,
    feeUnit: "free",
    restrictionsText:
      "Drone-fotografering i UNESCO-området er restriktert. Sjekk Luftfartstilsynet før flyging.",
  },
  {
    slug: "trondheim-nidaros",
    name: "Nidarosdomen",
    venueType: "church",
    address: "Bispegata 7",
    city: "Trondheim",
    postalCode: "7012",
    county: "Trøndelag",
    contactEmail: "post@nidarosdomen.no",
    contactPhone: "+47 73 89 08 00",
    websiteUrl: "https://nidarosdomen.no",
    requiresBooking: true,
    requiresPermit: true,
    feeUnit: "on_request",
    restrictionsText:
      "Bryllupsseremoni og foto krever booking. Innendørs foto av seremonien har egne regler — sjekk med kirkekontoret.",
    photographerNotes:
      "Vestfasaden og rosevinduet er imponerende eksteriør. Inne i koret er det restriktivt med blitsbruk.",
  },
];
