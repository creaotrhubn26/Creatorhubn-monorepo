/**
 * Pondus-maler som fyller seg selv fra leadet.
 *
 * Malene har til nå hatt plassholdere et menneske måtte fylle ut:
 * «Vi hjalp {kunde} med å {konkret resultat}». Det er et skjelett, og de
 * fleste fyller det aldri ut — malen leses én gang og glemmes.
 *
 * Leadgrid vet allerede omsetning, driftsresultat, daglig leder og antall
 * ansatte for hvert lead. De to tingene snakket bare ikke sammen. Her gjør
 * de det: {{lead.omsetningMNOK}} blir til 51,7 når selgeren åpner Neras.
 *
 * To deler:
 *
 *   fletteInn()   bytter {{felt}} mot verdien fra leadet
 *   oppfyller()   avgjør om et steg skal vises i det hele tatt
 *
 * Den andre er den som gjør malen til en samtalepartner i stedet for et
 * manus: Neras taper penger, så tapsåpningen vises. Coloplast tjener 41,6
 * MNOK, så vekståpningen vises. Samme mal, ulik inngang, valgt av data.
 */

/** Feltene en mal kan flette inn. Låst liste — ikke fri tilgang til raden. */
export interface PondusLeadKontekst {
  navn: string | null;
  selskap: string | null;
  kontaktperson: string | null;
  poststed: string | null;
  ansatte: number | null;
  /** Kroner, som de står i Regnskapsregisteret. */
  omsetning: number | null;
  driftsresultat: number | null;
  orgnr: string | null;
  dagligLeder: string | null;
  styreleder: string | null;
}

/** Tom kontekst — alt ukjent. Gjør kallere slipper å bygge den selv. */
export const TOM_KONTEKST: PondusLeadKontekst = {
  navn: null, selskap: null, kontaktperson: null, poststed: null,
  ansatte: null, omsetning: null, driftsresultat: null,
  orgnr: null, dagligLeder: null, styreleder: null,
};

function millioner(kroner: number | null): string | null {
  if (kroner == null || !Number.isFinite(kroner)) return null;
  const m = kroner / 1_000_000;
  // Norsk desimalkomma og hardt mellomrom som tusenskille: «1 135», ikke
  // «1135». Tallet skal leses høyt i en telefonsamtale, og «ett tusen ett
  // hundre og trettifem» er noe annet enn «tusenhundreogtrettifem».
  const tall = Math.abs(m) >= 100 ? m.toFixed(0) : m.toFixed(1);
  const [hel, desimal] = tall.split(".");
  const medSkille = hel.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return desimal ? `${medSkille},${desimal}` : medSkille;
}

function fornavn(fulltNavn: string | null): string | null {
  const n = (fulltNavn ?? "").trim();
  return n ? n.split(/\s+/)[0] : null;
}

/**
 * Hva hvert felt blir til i teksten.
 *
 * Verdien er det selgeren skal SI, ikke det som står i basen: beløp i
 * millioner med komma, navn som fornavn. Leser man opp «986330682 kroner»
 * har flettingen gjort vondt verre.
 */
export function feltverdier(k: PondusLeadKontekst): Record<string, string | null> {
  const drift = millioner(k.driftsresultat);
  return {
    "lead.navn": k.navn,
    "lead.selskap": k.selskap ?? k.navn,
    "lead.kontaktperson": k.kontaktperson,
    "lead.fornavn": fornavn(k.kontaktperson ?? k.dagligLeder),
    "lead.poststed": k.poststed,
    "lead.orgnr": k.orgnr,
    "lead.ansatte": k.ansatte == null ? null : String(k.ansatte),
    "lead.omsetningMNOK": millioner(k.omsetning),
    // Fortegnet er en del av setningen: «med −3,7 i driftsresultat».
    "lead.driftsresultatMNOK":
      drift == null ? null : (k.driftsresultat! >= 0 ? `+${drift}` : `−${drift.replace("-", "")}`),
    "lead.dagligLeder": k.dagligLeder,
    "lead.styreleder": k.styreleder,
  };
}

const FELT = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g;

export interface FletteResultat {
  tekst: string;
  /** Felt malen ba om som leadet ikke hadde. Vises til selgeren, ikke skjules. */
  mangler: string[];
}

/**
 * Bytter {{felt}} mot verdien.
 *
 * Mangler verdien, blir feltet stående som «⟨omsetning⟩» i stedet for å
 * forsvinne. En setning med et synlig hull er til å oppdage; en setning der
 * tallet stille er borte leses høyt som den er.
 */
export function fletteInn(mal: string, k: PondusLeadKontekst): FletteResultat {
  const verdier = feltverdier(k);
  const mangler: string[] = [];
  const tekst = mal.replace(FELT, (_treff, felt: string) => {
    if (!(felt in verdier)) {
      mangler.push(felt);
      return `⟨ukjent felt: ${felt}⟩`;
    }
    const v = verdier[felt];
    if (v == null || v === "") {
      mangler.push(felt);
      return `⟨${felt.replace("lead.", "")}⟩`;
    }
    return v;
  });
  return { tekst, mangler: [...new Set(mangler)] };
}

/** Betingelsene et steg kan settes til å kreve. */
export const PONDUS_BETINGELSER = [
  "taper_penger",
  "tjener_penger",
  "leder_er_styreleder",
  "stor_arbeidsstokk",
  "liten_arbeidsstokk",
  "har_omsetningstall",
  "mangler_omsetningstall",
] as const;

export type PondusBetingelse = (typeof PONDUS_BETINGELSER)[number];

/** Grensen for «stor». Femti selgere er et annet salg enn fem. */
const STOR_ARBEIDSSTOKK = 50;

/**
 * Avgjør om et steg skal vises.
 *
 * Ukjent betingelse gir true, ikke false. Et steg som forsvinner fordi
 * noen skrev feil i en mal er verre enn et steg for mye: selgeren ser ikke
 * hva som mangler, og manuset har et hull ingen forklarer.
 */
export function oppfyller(betingelse: string | null | undefined, k: PondusLeadKontekst): boolean {
  if (!betingelse) return true;
  switch (betingelse as PondusBetingelse) {
    case "taper_penger":
      return k.driftsresultat != null && k.driftsresultat < 0;
    case "tjener_penger":
      return k.driftsresultat != null && k.driftsresultat > 0;
    case "leder_er_styreleder":
      return Boolean(k.dagligLeder) && k.dagligLeder === k.styreleder;
    case "stor_arbeidsstokk":
      return k.ansatte != null && k.ansatte >= STOR_ARBEIDSSTOKK;
    case "liten_arbeidsstokk":
      return k.ansatte != null && k.ansatte < STOR_ARBEIDSSTOKK;
    case "har_omsetningstall":
      return k.omsetning != null;
    case "mangler_omsetningstall":
      return k.omsetning == null;
    default:
      return true;
  }
}

export interface FlettetSteg {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  prompt: string | null;
  order: number;
  mangler: string[];
}

/**
 * Kjører en hel mal mot ett lead: filtrerer bort steg som ikke gjelder, og
 * fletter inn resten.
 */
export function flettMal(
  steg: Array<{
    id: string; title: string; subtitle?: string | null; icon?: string | null;
    prompt?: string | null; order?: number; visIf?: string | null;
  }>,
  k: PondusLeadKontekst,
): { steg: FlettetSteg[]; mangler: string[] } {
  const alleMangler: string[] = [];
  const ut = steg
    .filter((s) => oppfyller(s.visIf, k))
    .map((s, i) => {
      const t = fletteInn(s.title, k);
      const u = s.subtitle ? fletteInn(s.subtitle, k) : null;
      const p = s.prompt ? fletteInn(s.prompt, k) : null;
      const m = [...t.mangler, ...(u?.mangler ?? []), ...(p?.mangler ?? [])];
      alleMangler.push(...m);
      return {
        id: s.id,
        title: t.tekst,
        subtitle: u?.tekst ?? null,
        icon: s.icon ?? null,
        prompt: p?.tekst ?? null,
        order: s.order ?? i,
        mangler: [...new Set(m)],
      };
    })
    .sort((a, b) => a.order - b.order);
  return { steg: ut, mangler: [...new Set(alleMangler)] };
}
