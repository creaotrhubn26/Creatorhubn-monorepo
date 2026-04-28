/**
 * norway-kommune-permit-info.ts
 *
 * Statisk database over norske kommuner og deres kontaktinfo for
 * filming-tillatelser. For kommuner uten dedikert filmkommisjon, brukes
 * generisk servicetorg-kontakt + kommune.no-link.
 *
 * Datakilder:
 *   • Oslo Filmkommisjon (oslofilmkommisjon.no)
 *   • Bergen Filmkommisjon (visitbergen.com / bergenmediaby.no)
 *   • Andre kommuners servicetorg
 *
 * Vedlikehold: dette er hardkodet data — sjekk URLs ~årlig.
 */

export interface KommunePermitInfo {
  kommune: string;                     // Visningsnavn
  kommunenummer: string;               // 4-sifret SSB-kode
  filmingPermitUrl?: string;           // Direkte lenke til filming-info-side
  generalContactUrl?: string;          // Servicetorg / kontakt-side
  generalContactPhone?: string;
  generalContactEmail?: string;
  filmContactName?: string;            // Dedikert filmkontakt hvis finnes
  filmContactEmail?: string;
  filmContactPhone?: string;
  filmingFee?: string;                 // Tekstbeskrivelse av gebyrer
  noiseLimits?: string;                // Støy-restriksjoner
  notes?: string;                      // Generelle notater
}

export const KOMMUNE_PERMIT_DB: Record<string, KommunePermitInfo> = {
  '0301': {
    kommune: 'Oslo',
    kommunenummer: '0301',
    filmingPermitUrl: 'https://www.oslo.kommune.no/byutvikling/film-og-tv/',
    generalContactUrl: 'https://www.oslo.kommune.no/',
    generalContactPhone: '02180',
    filmContactName: 'Oslo Filmkommisjon',
    filmContactEmail: 'film@oslo.kommune.no',
    filmingFee: 'Kommunale arealer: typisk 0–5000 NOK/dag avhengig av størrelse. Trafikkstans/rigging krever egen avtale.',
    noiseLimits: 'Hverdager 07:00–22:00. Helg 09:00–22:00. Søkes dispensasjon utenfor.',
    notes: 'Oslo har dedikert filmkommisjon med rask saksbehandling for større produksjoner. Søk minst 2 uker i forveien.',
  },
  '4601': {
    kommune: 'Bergen',
    kommunenummer: '4601',
    filmingPermitUrl: 'https://www.bergen.kommune.no/innbyggerhjelpen/kultur-idrett-og-fritid/film',
    generalContactUrl: 'https://www.bergen.kommune.no/',
    generalContactPhone: '55565556',
    filmContactName: 'Bergen Media By',
    filmContactEmail: 'film@bergen.kommune.no',
    filmingFee: 'Kommunale arealer: vanligvis gratis for små produksjoner under 1 dag. Større produksjoner: kontakt kulturetaten.',
    noiseLimits: 'Hverdager 07:00–22:00. Søndag/helligdag krever dispensasjon.',
    notes: 'Bergen tilbyr support gjennom Bergen Media By for større produksjoner.',
  },
  '5001': {
    kommune: 'Trondheim',
    kommunenummer: '5001',
    filmingPermitUrl: 'https://www.trondheim.kommune.no/aktuelt/kultur-og-fritid/film/',
    generalContactUrl: 'https://www.trondheim.kommune.no/',
    generalContactPhone: '72540000',
    generalContactEmail: 'kontakt@trondheim.kommune.no',
    filmContactName: 'Midtnorsk Filmsenter',
    filmContactEmail: 'post@midtnorskfilmsenter.no',
    notes: 'Midtnorsk Filmsenter koordinerer regionale produksjoner.',
  },
  '1103': {
    kommune: 'Stavanger',
    kommunenummer: '1103',
    filmingPermitUrl: 'https://www.stavanger.kommune.no/kultur-og-fritid/film-og-medier/',
    generalContactUrl: 'https://www.stavanger.kommune.no/',
    generalContactPhone: '51507090',
    filmContactName: 'Filmkraft Rogaland',
    filmContactEmail: 'post@filmkraft.no',
    notes: 'Filmkraft er regionalt filmsenter som koordinerer Rogaland.',
  },
  '3005': {
    kommune: 'Drammen',
    kommunenummer: '3005',
    filmingPermitUrl: 'https://www.drammen.kommune.no/tjenester/kultur-idrett-og-fritid/',
    generalContactUrl: 'https://www.drammen.kommune.no/',
    generalContactPhone: '32049600',
    generalContactEmail: 'kommunepost@drammen.kommune.no',
  },
  '5401': {
    kommune: 'Tromsø',
    kommunenummer: '5401',
    filmingPermitUrl: 'https://tromso.kommune.no/kultur-fritid-og-idrett/',
    generalContactUrl: 'https://tromso.kommune.no/',
    generalContactPhone: '77790000',
    filmContactName: 'Filmkraft Nord (Nordnorsk Filmsenter)',
    filmContactEmail: 'post@nnfs.no',
    notes: 'Nord-Norge har sterk filmtradisjon og dedikert regionalt filmsenter.',
  },
  '4204': {
    kommune: 'Kristiansand',
    kommunenummer: '4204',
    filmingPermitUrl: 'https://www.kristiansand.kommune.no/navigasjon/kultur-frivillighet-og-fritid/',
    generalContactUrl: 'https://www.kristiansand.kommune.no/',
    generalContactPhone: '38075000',
    filmContactName: 'Sørnorsk Filmsenter',
    filmContactEmail: 'post@sornorskfilmsenter.no',
  },
  '1804': {
    kommune: 'Bodø',
    kommunenummer: '1804',
    generalContactUrl: 'https://bodo.kommune.no/',
    generalContactPhone: '75555000',
    filmContactName: 'Filmsenter Nord-Norge (Bodø-avd.)',
    notes: 'Bodø tilrettelegger gjerne for film-lokasjoner. Kontakt servicetorg.',
  },
  '3024': {
    kommune: 'Bærum',
    kommunenummer: '3024',
    generalContactUrl: 'https://www.baerum.kommune.no/',
    generalContactPhone: '67504000',
    notes: 'Forstadskommune til Oslo. Kommunale arealer kan kreve søknad om bruk.',
  },
  '3203': {
    kommune: 'Asker',
    kommunenummer: '3203',
    generalContactUrl: 'https://www.asker.kommune.no/',
    generalContactPhone: '66709000',
  },
  '3804': {
    kommune: 'Sandefjord',
    kommunenummer: '3804',
    generalContactUrl: 'https://www.sandefjord.kommune.no/',
    generalContactPhone: '33416000',
  },
  '3001': {
    kommune: 'Halden',
    kommunenummer: '3001',
    generalContactUrl: 'https://halden.kommune.no/',
    generalContactPhone: '69174500',
  },
  '3003': {
    kommune: 'Sarpsborg',
    kommunenummer: '3003',
    generalContactUrl: 'https://www.sarpsborg.com/',
    generalContactPhone: '69116500',
  },
  '3002': {
    kommune: 'Fredrikstad',
    kommunenummer: '3002',
    generalContactUrl: 'https://www.fredrikstad.kommune.no/',
    generalContactPhone: '69306000',
  },
  '3805': {
    kommune: 'Larvik',
    kommunenummer: '3805',
    generalContactUrl: 'https://www.larvik.kommune.no/',
    generalContactPhone: '33171000',
  },
  '3807': {
    kommune: 'Skien',
    kommunenummer: '3807',
    generalContactUrl: 'https://www.skien.kommune.no/',
    generalContactPhone: '35581000',
  },
  '3403': {
    kommune: 'Hamar',
    kommunenummer: '3403',
    generalContactUrl: 'https://www.hamar.kommune.no/',
    generalContactPhone: '62561000',
  },
  '3405': {
    kommune: 'Lillehammer',
    kommunenummer: '3405',
    generalContactUrl: 'https://www.lillehammer.kommune.no/',
    generalContactPhone: '61050500',
    filmContactName: 'Filminvest (Hedmark/Oppland)',
    filmContactEmail: 'post@filminvest.no',
    notes: 'Filminvest tilbyr finansiering + støtte for produksjoner i Innlandet.',
  },
  '3407': {
    kommune: 'Gjøvik',
    kommunenummer: '3407',
    generalContactUrl: 'https://www.gjovik.kommune.no/',
    generalContactPhone: '61189500',
  },
  '1833': {
    kommune: 'Rana',
    kommunenummer: '1833',
    generalContactUrl: 'https://www.rana.kommune.no/',
    generalContactPhone: '75145000',
    notes: 'Mo i Rana — populær for industri- og natur-locations i Nordland.',
  },
  '1507': {
    kommune: 'Ålesund',
    kommunenummer: '1507',
    generalContactUrl: 'https://alesund.kommune.no/',
    generalContactPhone: '70162000',
    filmContactName: 'Filmfondet Fuzz / Filmkraft Møre & Romsdal',
    notes: 'Ålesund/Sunnmøre har spektakulære fjord-locations.',
  },
  '1506': {
    kommune: 'Molde',
    kommunenummer: '1506',
    generalContactUrl: 'https://www.molde.kommune.no/',
    generalContactPhone: '71114000',
  },
  '1505': {
    kommune: 'Kristiansund',
    kommunenummer: '1505',
    generalContactUrl: 'https://www.kristiansund.kommune.no/',
    generalContactPhone: '71570000',
  },
  '4203': {
    kommune: 'Arendal',
    kommunenummer: '4203',
    generalContactUrl: 'https://www.arendal.kommune.no/',
    generalContactPhone: '37013000',
  },
  '1106': {
    kommune: 'Haugesund',
    kommunenummer: '1106',
    generalContactUrl: 'https://www.haugesund.kommune.no/',
    generalContactPhone: '52743100',
  },
  '3806': {
    kommune: 'Porsgrunn',
    kommunenummer: '3806',
    generalContactUrl: 'https://www.porsgrunn.kommune.no/',
    generalContactPhone: '35547100',
  },
  '3803': {
    kommune: 'Tønsberg',
    kommunenummer: '3803',
    generalContactUrl: 'https://www.tonsberg.kommune.no/',
    generalContactPhone: '33348000',
  },
  '3103': {
    kommune: 'Moss',
    kommunenummer: '3103',
    generalContactUrl: 'https://www.moss.kommune.no/',
    generalContactPhone: '69248100',
  },
  '5403': {
    kommune: 'Alta',
    kommunenummer: '5403',
    generalContactUrl: 'https://www.alta.kommune.no/',
    generalContactPhone: '78455000',
    notes: 'Finnmark — spektakulære nordlys/arktiske locations.',
  },
  '1806': {
    kommune: 'Narvik',
    kommunenummer: '1806',
    generalContactUrl: 'https://www.narvik.kommune.no/',
    generalContactPhone: '76912000',
  },
  '5006': {
    kommune: 'Steinkjer',
    kommunenummer: '5006',
    generalContactUrl: 'https://www.steinkjer.kommune.no/',
    generalContactPhone: '74169000',
  },
  '3411': {
    kommune: 'Ringsaker',
    kommunenummer: '3411',
    generalContactUrl: 'https://www.ringsaker.kommune.no/',
    generalContactPhone: '62336000',
  },
  '5601': {
    kommune: 'Hammerfest',
    kommunenummer: '5601',
    generalContactUrl: 'https://www.hammerfest.kommune.no/',
    generalContactPhone: '78402000',
  },
  '4623': {
    kommune: 'Voss',
    kommunenummer: '4623',
    generalContactUrl: 'https://www.voss.herad.no/',
    generalContactPhone: '40008500',
    notes: 'Hardanger/Voss-regionen — populært for fjord/fjell-shooting.',
  },
};

/**
 * Slår opp permit-info ved kommunenavn (case-insensitive) eller kommunenummer.
 * Returnerer null hvis ikke funnet — caller bør fallback til generisk
 * "kontakt kommunens servicetorg"-melding.
 */
export function lookupKommunePermit(query: string): KommunePermitInfo | null {
  const q = query.trim().toLowerCase();
  // Match by kommunenummer first
  if (KOMMUNE_PERMIT_DB[query]) return KOMMUNE_PERMIT_DB[query];
  // Match by name (case-insensitive)
  for (const info of Object.values(KOMMUNE_PERMIT_DB)) {
    if (info.kommune.toLowerCase() === q) return info;
  }
  // Loose match (e.g. "oslo kommune" → "Oslo")
  for (const info of Object.values(KOMMUNE_PERMIT_DB)) {
    const lower = info.kommune.toLowerCase();
    if (q.includes(lower) || lower.includes(q.replace(/\s+kommune$/i, '').trim())) {
      return info;
    }
  }
  return null;
}

/**
 * Generisk fallback når kommune ikke finnes i db. Returnerer info basert
 * på kommunenavn (typisk fra Kartverket-respons), bygger sannsynlig
 * kommune.no-URL.
 */
export function buildGenericKommuneInfo(kommunenavn: string, kommunenummer?: string): KommunePermitInfo {
  // Normaliser kommune-slug for URL: lowercase + ø→o → standard-fallback
  const slug = kommunenavn
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/\s+/g, '');
  return {
    kommune: kommunenavn,
    kommunenummer: kommunenummer ?? '',
    generalContactUrl: `https://www.${slug}.kommune.no/`,
    notes: `${kommunenavn} kommune har ikke en dedikert filmkommisjon i CreatorHubs database. Kontakt servicetorget direkte for filming-tillatelser.`,
  };
}

export const KOMMUNE_PERMIT_DB_SIZE = Object.keys(KOMMUNE_PERMIT_DB).length;
