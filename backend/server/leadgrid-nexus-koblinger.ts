/**
 * Hva henger sammen med dette notatet?
 *
 * Nexus skal være et koblingspunkt, ikke et arkiv. Forskjellen er at et
 * arkiv svarer når du spør, mens et koblingspunkt har svaret klart når du
 * åpner det.
 *
 * Den feile måten å bygge dette på er en wiki: selgeren skriver
 * [[Neras Direkte]] for å lage en lenke. Ingen gjør det med en Apple Pencil
 * midt i et møte. Det hever skuldrene i stedet for å senke dem.
 *
 * Den riktige måten er at koblingene allerede finnes. Et notat vet hvilket
 * lead det gjelder, hvor det ble skrevet, når, og av hvem. Fra det kan vi
 * utlede nesten alt som er verdt å vise:
 *
 *   samme lead     de forrige møtene med samme kunde
 *   samme sted     hva som ble skrevet på samme adresse
 *   samme dag      møteloggen fra samme besøk
 *   samme selskap  notater knyttet på navn før leadet fantes
 *
 * Null tastetrykk. Eksplisitte lenker finnes også, men de er unntaket —
 * koblingen et menneske ser og systemet ikke kan gjette.
 */
import type { Pool } from "pg";
import { getStoredEnrichment } from "./lead-brreg-service.js";

export type KoblingKilde =
  | "lead" | "sted" | "mote" | "selskap" | "manuell" | "person";

export interface Kobling {
  type: "notat" | "lead" | "mote";
  id: string;
  tittel: string;
  /** Hvorfor denne dukket opp. Vises til brukeren — en kobling uten
   *  begrunnelse er støy. */
  kilde: KoblingKilde;
  begrunnelse: string;
  tidspunkt: string | null;
  /** Sorteringsvekt. Høyere = nærmere. */
  styrke: number;
}

/**
 * Hvor nær «samme sted» er.
 *
 * Hundre meter, ikke ti: GPS på en iPad innendørs bommer med titalls meter,
 * og to notater fra samme kontorbygg skal finne hverandre. Ikke tusen: da
 * knytter vi sammen alt i et bysentrum, og listen blir verdiløs.
 */
export const SAMME_STED_METER = 100;

/**
 * Justerer en kildes basisstyrke etter hvor ofte den faktisk blir åpnet.
 *
 * Basistallene er gjetninger. «Samme kunde» fikk 100 fordi det hørtes
 * riktigst ut, ikke fordi noen målte det. Det kan godt vise seg at selgere
 * åpner «40 m unna» oftere enn «samme selskap» — stedet er et sterkere
 * minne enn navnet.
 *
 * Men en måling på fem visninger er ikke en måling. Derfor skrus effekten
 * gradvis på med antall observasjoner: `n / (n + MODNING)` er null i
 * starten og nærmer seg én når tallene er store nok til å bety noe. Uten
 * den ville den første tilfeldige åpningen kastet om på hele rekkefølgen.
 *
 * Utslaget er klemt til ±40 %. Læringen skal finjustere rekkefølgen, ikke
 * skru «samme kunde» ned under «samme selskap» fordi noen hadde en rar uke.
 *
 * @param basis      Utviklerens prior (50–120).
 * @param visninger  Hvor mange ganger kilden er vist.
 * @param aapninger  Hvor mange av dem som ble åpnet.
 * @param snittrate  Åpningsraten på tvers av alle kilder.
 */
export const MODNING = 30;

export function justertStyrke(
  basis: number,
  visninger: number,
  aapninger: number,
  snittrate: number,
): number {
  if (visninger <= 0 || snittrate <= 0) return basis;
  const rate = aapninger / visninger;
  const modenhet = visninger / (visninger + MODNING);
  // Relativt til snittet: en kilde som åpnes dobbelt så ofte som normalt
  // fortjener å stige, uavhengig av om totalnivået er høyt eller lavt.
  const relativt = rate / snittrate - 1;
  // Taket på utslaget vokser med modenheten — ikke bare effekten.
  //
  // Første forsøk ganget `relativt` med modenheten og klemte resultatet til
  // ±40 %. Det holdt ikke: tre visninger som alle ble åpnet gir `relativt`
  // på 4, og 4 × 0,09 er fortsatt 0,36. En kilde steg fra 60 til 82 på tre
  // observasjoner. Nå kan utslaget aldri overstige 40 % × modenhet, så tre
  // observasjoner flytter under to prosent uansett hvor ekstreme de er.
  const maksAvvik = 0.4 * modenhet;
  const faktor = 1 + Math.max(-maksAvvik, Math.min(maksAvvik, relativt));
  return Math.round(basis * faktor);
}

/** Grader breddegrad per meter. Godt nok på norske breddegrader. */
const METER_I_GRADER = 1 / 111_320;

/**
 * Hvor sannsynlig er det at denne personen er i rommet?
 *
 * Daglig leder tar møtet. Styreleder gjør det i små selskaper. Et vanlig
 * styremedlem gjør det nesten aldri. Rekkefølgen betyr noe fordi lista skal
 * kunne leses på et halvt sekund midt i en håndhilsning.
 */
export function personVekt(rolle: string): number {
  const r = rolle.toLowerCase();
  // Rollestrengene er BRREG sine egne, talt opp i produksjon:
  // Styremedlem 154, Styrets leder 108, Daglig leder 99, Varamedlem 26,
  // Innehaver 19, Kontaktperson 4, Deltaker med delt ansvar 3.
  if (r.includes("daglig leder") || r.includes("adm. dir")) return 100;
  if (r.includes("styrets leder") || r.includes("styreleder")) return 80;
  if (r.includes("innehaver") || r.includes("deltaker")) return 75;
  if (r.includes("kontaktperson")) return 70;
  // Varamedlem må sjekkes før styremedlem — en vara møter sjelden.
  if (r.includes("varamedlem")) return 10;
  if (r.includes("styremedlem")) return 40;
  return 20;
}

/** Maks antall personer vi viser. Et stort styre er ikke en møtedeltakerliste. */
const MAKS_PERSONER = 6;

function tekst(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function dato(v: unknown): string | null {
  return v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null;
}

/**
 * Hvem du sannsynligvis sitter overfor.
 *
 * LinkedIn-innlogging svarer ikke på dette. Den gir `openid profile email`,
 * altså din egen profil — navn, e-post, bilde. Motpartens tittel og selskap
 * ligger bak `r_basicprofile`, som er forbeholdt LinkedIns partnerprogram,
 * og selv med den må vi kjenne profil-URL-en hans på forhånd.
 *
 * Foretaksregisteret svarer derimot allerede. Roller-API-et gir daglig leder
 * og styret med navn og rolle, og vi henter det inn i enrichment_data hver
 * gang et lead berikes. Dataen har ligget der hele tiden — den har bare
 * aldri blitt vist i notatet.
 */
export interface Person {
  navn: string;
  rolle: string;
  /** Rangering: daglig leder først, så styreleder, så resten. */
  vekt: number;
}

export interface KoblingInput {
  organizationId: string;
  projectId: string;
  /** Eier av arbeidsflaten — brukes kun som fallback-scope mot lead-raden. */
  userId: string;
  notatId: string;
  /** Maks per kategori, så ett lead med hundre notater ikke tar hele listen. */
  perKategori?: number;
}

/**
 * Finner alt som henger sammen med notatet.
 *
 * Hver spørring er avgrenset til organisasjon og prosjekt. Et notat skal
 * aldri koble seg til noe i en annen kundes data.
 */
export async function koblingerFor(
  pool: Pool,
  input: KoblingInput,
): Promise<{
  koblinger: Kobling[];
  personer: Person[];
  notat: { id: string; tittel: string } | null;
}> {
  const grense = Math.min(Math.max(input.perKategori ?? 5, 1), 20);

  const notatRad = await pool.query<{
    id: string; tittel: string; lead_id: string | null; selskap: string | null;
    lat: number | null; lon: number | null; created_at: Date;
  }>(
    `SELECT id::text, tittel, lead_id, selskap, lat, lon, created_at
       FROM leadgrid_canvas_notater
      WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
        AND slettet_at IS NULL`,
    [input.notatId, input.organizationId, input.projectId],
  );
  const notat = notatRad.rows[0];
  if (!notat) return { koblinger: [], personer: [], notat: null };

  const ut: Kobling[] = [];

  // 1. Samme lead — de sterkeste koblingene. Dette er historikken med
  //    kunden du sitter hos akkurat nå.
  if (notat.lead_id) {
    const r = await pool.query<{ id: string; tittel: string; created_at: Date }>(
      `SELECT id::text, tittel, created_at
         FROM leadgrid_canvas_notater
        WHERE lead_id = $1 AND id <> $2::uuid
          AND organization_id = $3 AND project_id = $4 AND slettet_at IS NULL
        ORDER BY created_at DESC LIMIT $5`,
      [notat.lead_id, notat.id, input.organizationId, input.projectId, grense],
    );
    for (const rad of r.rows) {
      ut.push({
        type: "notat", id: rad.id, tittel: tekst(rad.tittel) || "Uten tittel",
        kilde: "lead", begrunnelse: "Samme kunde",
        tidspunkt: dato(rad.created_at), styrke: 100,
      });
    }

    // Møteloggen for samme lead. Notatet er skissen; loggen er avtalen.
    const m = await pool.query<{ id: string; notat: string | null; created_at: Date }>(
      `SELECT id::text, notat, created_at
         FROM leadgrid_mote_logg
        WHERE lead_id = $1 AND organization_id = $2 AND project_id = $3
        ORDER BY created_at DESC LIMIT $4`,
      [notat.lead_id, input.organizationId, input.projectId, grense],
    );
    for (const rad of m.rows) {
      ut.push({
        type: "mote", id: rad.id,
        tittel: (tekst(rad.notat).split("\n")[0] || "Møte").slice(0, 90),
        kilde: "mote", begrunnelse: "Møte med samme kunde",
        tidspunkt: dato(rad.created_at), styrke: 80,
      });
    }
  }

  // 2. Samme sted. Fanger det leadkoblingen ikke gjør: to selskaper i samme
  //    bygg, eller et notat skrevet før leadet var opprettet.
  if (notat.lat != null && notat.lon != null) {
    const d = SAMME_STED_METER * METER_I_GRADER;
    const r = await pool.query<{ id: string; tittel: string; created_at: Date; meter: number }>(
      `SELECT id::text, tittel, created_at,
              round((point($1, $2) <-> point(lon, lat)) / $6) AS meter
         FROM leadgrid_canvas_notater
        WHERE id <> $3::uuid AND organization_id = $4 AND project_id = $5
          AND slettet_at IS NULL AND lat IS NOT NULL AND lon IS NOT NULL
          AND lat BETWEEN $7 - $8 AND $7 + $8
          AND lon BETWEEN $1 - $9 AND $1 + $9
        ORDER BY point($1, $2) <-> point(lon, lat) LIMIT $10`,
      [notat.lon, notat.lat, notat.id, input.organizationId, input.projectId,
       METER_I_GRADER, notat.lat, d, d / Math.max(Math.cos(notat.lat * Math.PI / 180), 0.01),
       grense],
    );
    for (const rad of r.rows) {
      const meter = Number(rad.meter);
      if (!Number.isFinite(meter) || meter > SAMME_STED_METER) continue;
      ut.push({
        type: "notat", id: rad.id, tittel: tekst(rad.tittel) || "Uten tittel",
        kilde: "sted",
        begrunnelse: meter < 10 ? "Samme adresse" : `${Math.round(meter)} m unna`,
        tidspunkt: dato(rad.created_at), styrke: 60,
      });
    }
  }

  // 3. Samme selskapsnavn, uten lead. Fanger notater skrevet før kunden
  //    ble opprettet som lead — der den første skissen ofte ligger.
  if (notat.selskap) {
    const r = await pool.query<{ id: string; tittel: string; created_at: Date }>(
      `SELECT id::text, tittel, created_at
         FROM leadgrid_canvas_notater
        WHERE selskap = $1 AND id <> $2::uuid AND lead_id IS NULL
          AND organization_id = $3 AND project_id = $4 AND slettet_at IS NULL
        ORDER BY created_at DESC LIMIT $5`,
      [notat.selskap, notat.id, input.organizationId, input.projectId, grense],
    );
    for (const rad of r.rows) {
      ut.push({
        type: "notat", id: rad.id, tittel: tekst(rad.tittel) || "Uten tittel",
        kilde: "selskap", begrunnelse: `Samme selskap: ${notat.selskap}`,
        tidspunkt: dato(rad.created_at), styrke: 50,
      });
    }
  }

  // 4. Eksplisitte lenker, begge veier. Et menneske så en sammenheng
  //    systemet ikke kan gjette — den skal veie tyngst av alt.
  const lenker = await pool.query<{
    id: string; til_type: string; til_id: string; merknad: string | null;
    created_at: Date; retning: string;
  }>(
    `SELECT id::text, til_type, til_id, merknad, created_at, 'ut' AS retning
       FROM leadgrid_nexus_lenker
      WHERE fra_notat_id = $1::uuid AND organization_id = $2
     UNION ALL
     SELECT id::text, 'notat', fra_notat_id::text, merknad, created_at, 'inn'
       FROM leadgrid_nexus_lenker
      WHERE til_type = 'notat' AND til_id = $1::text AND organization_id = $2`,
    [input.notatId, input.organizationId],
  );
  for (const rad of lenker.rows) {
    ut.push({
      type: (rad.til_type as Kobling["type"]) ?? "notat",
      id: rad.til_id,
      tittel: tekst(rad.merknad) || "Koblet manuelt",
      kilde: "manuell",
      begrunnelse: rad.retning === "inn" ? "Peker hit" : "Koblet av deg",
      tidspunkt: dato(rad.created_at),
      styrke: 120,
    });
  }

  // 5. Samme person, annet selskap.
  //
  //    Dette er den eneste koblingen på lista et menneske ikke kunne funnet
  //    selv. Roller-API-et gir navn, og folk sitter i flere styrer: sitter
  //    daglig leder hos kunden du besøker nå også i styret hos et annet lead
  //    du har notater på, er det den samme personen du skal snakke med to
  //    ganger — og han husker hva du sa forrige gang.
  //
  //    Identiteten avgjøres av et fingeravtrykk: BRREG oppgir fødselsdato
  //    for rolleinnehavere, og navn pluss dato er entydig. Fingeravtrykket
  //    er hashet, så vi kan sammenligne uten å lagre datoen.
  //
  //    Finnes fingeravtrykket på begge sider, ER det samme menneske, og
  //    koblingen er like sterk som «samme kunde». Mangler det — eldre
  //    berikelser, eller en rolle uten oppgitt dato — faller vi tilbake til
  //    navnematching, som kan slå sammen to personer som deler navn. Da er
  //    styrken lavere og begrunnelsen sier at det er navnet vi går på.
  if (notat.lead_id) {
    const r = await pool.query<{
      id: string; tittel: string; created_at: Date;
      navn: string; selskap: string | null; bekreftet: boolean | null;
    }>(
      `WITH mine AS (
         SELECT DISTINCT TRIM(k->>'name') AS navn,
                NULLIF(TRIM(COALESCE(k->>'pid', '')), '') AS pid
           FROM crm_customers c,
                LATERAL jsonb_array_elements(
                  COALESCE(c.enrichment_data->'contacts', '[]'::jsonb)) k
          WHERE c.id = $1 AND c.organization_id = $2::uuid
            AND c.project_id = $3
            AND COALESCE(TRIM(k->>'name'), '') <> ''
       ),
       meg AS (
         SELECT enrichment_org_nr, LOWER(TRIM(name)) AS navnenokkel
           FROM crm_customers
          WHERE id = $1 AND organization_id = $2::uuid AND project_id = $3
       ),
       andre AS (
         SELECT DISTINCT c.id AS lead_id, c.name AS selskap, m.navn,
                -- Bekreftet når begge sider har samme fingeravtrykk.
                (m.pid IS NOT NULL
                 AND m.pid = NULLIF(TRIM(COALESCE(k->>'pid', '')), ''))
                  AS bekreftet
           FROM crm_customers c
           JOIN LATERAL jsonb_array_elements(
                  COALESCE(c.enrichment_data->'contacts', '[]'::jsonb)) k
                ON TRUE
           JOIN mine m
             ON (m.pid IS NOT NULL
                 AND m.pid = NULLIF(TRIM(COALESCE(k->>'pid', '')), ''))
             OR (m.pid IS NULL AND m.navn = TRIM(k->>'name'))
           CROSS JOIN meg
          WHERE c.organization_id = $2::uuid AND c.project_id = $3
            AND c.id <> $1
            -- Samme selskap duplisert som to leads er ikke en personkobling.
            -- Produksjon har «Lillestrøm Regnskap Og Økonomi AS» og
            -- «Lillestrøm regnskap og økonomi AS» som to rader; uten denne
            -- sjekken ville vi meldt at daglig leder «også sitter i» sitt
            -- eget selskap.
            AND (meg.enrichment_org_nr IS NULL
                 OR c.enrichment_org_nr IS NULL
                 OR c.enrichment_org_nr <> meg.enrichment_org_nr)
            AND LOWER(TRIM(c.name)) <> meg.navnenokkel
       )
       SELECT n.id::text, n.tittel, n.created_at, a.navn, a.selskap, a.bekreftet
         FROM leadgrid_canvas_notater n
         JOIN andre a ON a.lead_id = n.lead_id
        WHERE n.id <> $4::uuid AND n.organization_id = $2
          AND n.project_id = $3 AND n.slettet_at IS NULL
        ORDER BY n.created_at DESC
        LIMIT $5`,
      [notat.lead_id, input.organizationId, input.projectId, notat.id, grense],
    );
    for (const rad of r.rows) {
      const bekreftet = rad.bekreftet === true;
      ut.push({
        type: "notat", id: rad.id, tittel: tekst(rad.tittel) || "Uten tittel",
        kilde: "person",
        begrunnelse: bekreftet
          ? (rad.selskap
              ? `${rad.navn} sitter også i ${rad.selskap}`
              : `Samme person: ${rad.navn}`)
          // Sier at vi går på navnet, så selgeren vet at han må se etter.
          : (rad.selskap
              ? `Samme navn som i ${rad.selskap}: ${rad.navn}`
              : `Samme navn: ${rad.navn}`),
        tidspunkt: dato(rad.created_at),
        styrke: bekreftet ? 100 : 55,
      });
    }
  }

  // 6. Hvem du snakker med. Ikke en kobling mellom notater, men svaret på
  //    det samme spørsmålet: hva henger sammen med dette notatet?
  //    Rollene ligger allerede i enrichment_data fra da leadet ble beriket.
  const personer: Person[] = [];
  if (notat.lead_id) {
    try {
      const beriket = await getStoredEnrichment(pool, {
        leadId: notat.lead_id,
        workspaceOwnerUserId: input.userId,
        organizationId: input.organizationId,
        projectId: input.projectId,
      });
      for (const kontakt of beriket?.contacts ?? []) {
        const navn = tekst(kontakt?.name).trim();
        const rolle = tekst(kontakt?.role).trim();
        if (!navn) continue;
        personer.push({ navn, rolle: rolle || "Rolle", vekt: personVekt(rolle) });
      }
      personer.sort((a, b) => b.vekt - a.vekt || a.navn.localeCompare(b.navn, "nb"));
      personer.splice(MAKS_PERSONER);
    } catch (e) {
      // Et notat skal åpne seg selv om berikelsen er borte. Koblingene er
      // hovedsaken; personlisten er et tillegg.
      console.warn("[nexus] kunne ikke hente roller for lead", notat.lead_id, e);
    }
  }

  // Lær rekkefølgen av hva folk faktisk åpner. Er tabellen tom eller ny,
  // gjør dette ingenting — basistallene står.
  try {
    const bruk = await pool.query<{ kilde: string; visninger: string; aapninger: string }>(
      `SELECT kilde, visninger::text, aapninger::text
         FROM leadgrid_nexus_kobling_bruk
        WHERE organization_id = $1 AND project_id = $2`,
      [input.organizationId, input.projectId],
    );
    if (bruk.rows.length > 0) {
      let sumV = 0, sumA = 0;
      const perKilde = new Map<string, { v: number; a: number }>();
      for (const rad of bruk.rows) {
        const v = Number(rad.visninger) || 0;
        const a = Number(rad.aapninger) || 0;
        perKilde.set(rad.kilde, { v, a });
        sumV += v; sumA += a;
      }
      const snitt = sumV > 0 ? sumA / sumV : 0;
      for (const k of ut) {
        const t = perKilde.get(k.kilde);
        if (t) k.styrke = justertStyrke(k.styrke, t.v, t.a, snitt);
      }
    }
  } catch (e) {
    // Migrasjonen kan mangle i et miljø. Rekkefølgen skal da være
    // utviklerens gjetning, ikke en feilmelding.
    console.warn("[nexus] kunne ikke lese koblingsbruk:", (e as Error).message);
  }

  // Samme mål kan dukke opp fra flere kilder — behold den sterkeste
  // begrunnelsen, ikke fire linjer om samme notat.
  const beste = new Map<string, Kobling>();
  for (const k of ut) {
    const nøkkel = `${k.type}:${k.id}`;
    const finnes = beste.get(nøkkel);
    if (!finnes || k.styrke > finnes.styrke) beste.set(nøkkel, k);
  }

  return {
    notat: { id: notat.id, tittel: tekst(notat.tittel) || "Uten tittel" },
    personer,
    koblinger: [...beste.values()].sort(
      (a, b) => b.styrke - a.styrke || (b.tidspunkt ?? "").localeCompare(a.tidspunkt ?? ""),
    ),
  };
}

/**
 * Teller at koblinger ble vist, og eventuelt at én ble åpnet.
 *
 * Ingen notat-ID, ingen bruker-ID: bare kilden. Nok til å rangere, for lite
 * til å lese ut hvem som så på hva.
 */
export async function tellKoblingsbruk(
  pool: Pool,
  input: {
    organizationId: string; projectId: string;
    vist: KoblingKilde[]; aapnet?: KoblingKilde | null;
  },
): Promise<void> {
  const teller = new Map<string, { v: number; a: number }>();
  for (const k of input.vist) {
    const t = teller.get(k) ?? { v: 0, a: 0 };
    t.v += 1;
    teller.set(k, t);
  }
  if (input.aapnet) {
    const t = teller.get(input.aapnet) ?? { v: 0, a: 0 };
    t.a += 1;
    teller.set(input.aapnet, t);
  }
  if (teller.size === 0) return;
  for (const [kilde, t] of teller) {
    await pool.query(
      `INSERT INTO leadgrid_nexus_kobling_bruk
         (organization_id, project_id, kilde, visninger, aapninger)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, project_id, kilde) DO UPDATE
         SET visninger = leadgrid_nexus_kobling_bruk.visninger + EXCLUDED.visninger,
             aapninger = leadgrid_nexus_kobling_bruk.aapninger + EXCLUDED.aapninger,
             oppdatert_at = now()`,
      [input.organizationId, input.projectId, kilde, t.v, t.a],
    );
  }
}

/** Lager en eksplisitt kobling. Idempotent — samme kobling to ganger er én. */
export async function lagKobling(
  pool: Pool,
  input: {
    organizationId: string; fraNotatId: string;
    tilType: "notat" | "lead" | "mote"; tilId: string;
    merknad?: string | null; brukerId: string;
  },
): Promise<{ id: string; nyopprettet: boolean }> {
  if (input.tilType === "notat" && input.tilId === input.fraNotatId) {
    throw new Error("et_notat_kan_ikke_peke_paa_seg_selv");
  }
  const r = await pool.query<{ id: string; nyopprettet: boolean }>(
    `INSERT INTO leadgrid_nexus_lenker
       (organization_id, fra_notat_id, til_type, til_id, merknad, laget_av)
     VALUES ($1, $2::uuid, $3, $4, $5, $6)
     ON CONFLICT (fra_notat_id, til_type, til_id)
       DO UPDATE SET merknad = COALESCE(EXCLUDED.merknad, leadgrid_nexus_lenker.merknad)
     RETURNING id::text, (xmax = 0) AS nyopprettet`,
    [input.organizationId, input.fraNotatId, input.tilType, input.tilId,
     input.merknad ?? null, input.brukerId],
  );
  return r.rows[0];
}
