/**
 * Tauri-stubb for grensesnittstesting i en vanlig nettleser.
 *
 * Frontenden snakker med Rust gjennom `invoke()`. Uten en stubb kaster hvert
 * kall, og appen står tom. Denne svarer med data som ligner virkeligheten —
 * ekte notattitler, ekte avsnitt, ekte treff — slik at layout, kontrast,
 * tastatur og tomtilstander kan måles slik de faktisk tegnes.
 *
 * Samme mønster som `apps/resolve-script-manager/e2e/fixtures/tauri-mock.ts`:
 * installeres FØR appen monteres, enten med `page.addInitScript(...)` fra en
 * Playwright-test, eller av `e2e/qa.html` som laster den og så `main.tsx`.
 *
 * Tilstanden ligger på `globalThis.__notatMock` så en test kan skru på
 * scenarioer uten å bygge om stubben.
 */

const MERKE_START = "\u0002";
const MERKE_SLUTT = "\u0003";

export type Scenario =
  | "standard"
  /** Ingen notater i det hele tatt. */
  | "tomt"
  /** Ett notat, uten en eneste tegn i. */
  | "tomtNotat";

export interface MockOptions {
  scenario?: Scenario;
  /** Er lesningen slått på? Av er standardvalget i appen, og derfor det
   *  brukeren møter først. */
  lesning?: boolean;
}

const NÅ = Math.floor(Date.now() / 1000);
const DAG = 86_400;

/** Notatet som står åpent i de fleste testene. Flere avsnitt, toppfelt, og
 *  setninger som gir mening å klassifisere. */
const MOTEREFERAT = `---
id: 2026-09-11-tirsdagsmotet
type: møte
deltakere: Kari, Marius
---

# Tirsdagsmøtet 11. september

Vi gikk gjennom tilbudet til Fjellheim Bryggeri. Kari mener prisen er for lav
når vi regner inn to dager med opptak og en uke i klipp.

Marius: Vi går for Stripe som betalingsløsning. Det er den eneste som støtter
Vipps uten at vi må drive med avtalegiro selv.

Beslutningen om lagring står fortsatt åpen. Skal råmaterialet ligge på NAS-en
på kontoret, eller skal vi betale for skylagring med versjonering?

Send oppdatert tilbud til Fjellheim innen fredag. Kari har kontaktpersonen.

Kunden ønsker seg drone over bryggeriet. Vi har ikke lov til å fly der uten
tillatelse fra Avinor, så dette er ikke noe vi kan love ennå.

Nettsiden må fungere på bestemors iPad. Det er ikke en smakssak — halvparten
av dem som bestiller er over seksti.

Kanskje vi skulle prøve å tilby en kortversjon til sosiale medier som et
tillegg? Ikke bestemt, bare en tanke.

Jeg må huske å hente kameraet fra service før torsdag.`;

const LANGT_NOTAT = `---
id: 2026-09-02-innboksen
type: notat
---

# Innboksen

Tre ting fra i dag som ikke hører hjemme noe annet sted ennå.

Regnskapsfører spurte om vi fører utstyrsleie som inntekt eller som fradrag.
Jeg vet ikke, og det haster ikke før i januar.

Lydopptakeren knitrer på kanal to. Sannsynligvis kabelen, ikke opptakeren.`;

interface MockNote {
  path: string;
  title: string;
  modified: number;
  content: string;
}

function lagNotater(): MockNote[] {
  const n = (path: string, title: string, alder: number, content: string): MockNote => ({
    path,
    title,
    modified: NÅ - alder,
    content,
  });
  return [
    n("2026-09-11-tirsdagsmotet.md", "Tirsdagsmøtet 11. september", 3600, MOTEREFERAT),
    n("2026-09-10-bestemorvennlig-kart.md", "Bestemorvennlig kart", 5 * 3600, LANGT_NOTAT),
    n("2026-09-09-fjellheim-tilbud.md", "Tilbud Fjellheim Bryggeri", 9 * 3600, LANGT_NOTAT),
    n("2026-09-08-lydopptak-knitrer.md", "Lydopptakeren knitrer på kanal to", DAG + 3600, LANGT_NOTAT),
    n("2026-09-08-visningen.md", "Visningen på Sagene", DAG + 7 * 3600, LANGT_NOTAT),
    n("2026-09-07-utstyrsregisteret.md", "Utstyrsregisteret — hva vi faktisk eier", 2 * DAG, LANGT_NOTAT),
    n("2026-09-06-depositum.md", "Depositum og avbestilling", 3 * DAG, LANGT_NOTAT),
    n("2026-09-05-tre-a-velge-mellom.md", "Tre kameraer å velge mellom", 4 * DAG, LANGT_NOTAT),
    n("2026-09-04-lastetid.md", "Lastetid på galleriet", 5 * DAG, LANGT_NOTAT),
    n("2026-09-02-innboksen.md", "Innboksen", 7 * DAG, LANGT_NOTAT),
    n("2026-08-29-adresseoppslag.md", "Adresseoppslag mot Kartverket", 11 * DAG, LANGT_NOTAT),
    n("2026-08-26-lang-epost.md", "Den lange e-posten fra Hansen", 14 * DAG, LANGT_NOTAT),
    n("2026-08-20-hvem-vi-jobber-for.md", "Hvem vi egentlig jobber for", 20 * DAG, LANGT_NOTAT),
    n("2026-07-15-ubetalt.md", "Ubetalte fakturaer, juli", 60 * DAG, LANGT_NOTAT),
    n("2026-06-03-nytt-utstyr.md", "Nytt utstyr — ønskeliste", 100 * DAG, LANGT_NOTAT),
    n("2025-11-18-arsoppgjor.md", "Årsoppgjør 2025", 300 * DAG, LANGT_NOTAT),
  ];
}

/** Avsnittene i møtereferatet, lest. Posisjonene regnes ut av teksten, slik at
 *  et klikk i panelet peker på riktig sted i skriveflaten. */
function avsnitt(innhold: string) {
  const finn = (bit: string) => {
    const start = innhold.indexOf(bit);
    return { start, end: start + bit.length };
  };
  const rad = (
    id: number,
    bit: string,
    felt: {
      summary: string;
      kind: string;
      action: string;
      avsender?: string | null;
      dependency?: string | null;
      lest?: number;
    },
  ) => ({
    ...finn(bit),
    id,
    hash: `h${id.toString(16)}${"0".repeat(8)}`,
    text: bit,
    summary: felt.summary,
    kind: felt.kind,
    action: felt.action,
    avsender: felt.avsender ?? null,
    dependency: felt.dependency ?? null,
    correction: null,
    lest: felt.lest ?? NÅ - 3600,
    modell: "claude-sonnet-4-6",
  });

  return [
    rad(101, "Vi gikk gjennom tilbudet til Fjellheim Bryggeri. Kari mener prisen er for lav", {
      summary: "prisen på Fjellheim-tilbudet er for lav",
      kind: "gjengivelse",
      action: "hold",
      avsender: "Kari",
    }),
    rad(102, "Marius: Vi går for Stripe som betalingsløsning. Det er den eneste som støtter", {
      summary: "bruke Stripe som betalingsløsning",
      kind: "beslutning",
      action: "bygg",
      avsender: "Marius",
    }),
    rad(103, "Beslutningen om lagring står fortsatt åpen. Skal råmaterialet ligge på NAS-en", {
      summary: "hvor råmaterialet skal lagres",
      kind: "spørsmål",
      action: "marker_åpent",
    }),
    rad(104, "Send oppdatert tilbud til Fjellheim innen fredag. Kari har kontaktpersonen.", {
      summary: "sende oppdatert tilbud til Fjellheim",
      kind: "oppgave",
      action: "bygg",
      dependency: "prisen fra Kari",
    }),
    rad(105, "Kunden ønsker seg drone over bryggeriet. Vi har ikke lov til å fly der uten", {
      summary: "kunden vil ha drone over bryggeriet",
      kind: "gjengivelse",
      action: "hold",
    }),
    rad(106, "Nettsiden må fungere på bestemors iPad. Det er ikke en smakssak — halvparten", {
      summary: "nettsiden må fungere på en gammel iPad",
      kind: "begrensning",
      action: "bygg",
      // Gammel nok til at panelet skal vise datoen den ble lest.
      lest: NÅ - 47 * DAG,
    }),
    rad(107, "Kanskje vi skulle prøve å tilby en kortversjon til sosiale medier som et", {
      summary: "kortversjon til sosiale medier som tillegg",
      kind: "tvil",
      action: "hold",
    }),
    rad(108, "Jeg må huske å hente kameraet fra service før torsdag.", {
      summary: "hente kameraet fra service",
      kind: "oppgave",
      action: "bygg",
      dependency: "",
    }),
  ];
}

const TIDLIGERE = [
  {
    forhold: "motsier",
    gjelder: 102,
    kortform: "bruke Vipps direkte, uten mellomledd",
    sti: "2026-08-20-hvem-vi-jobber-for.md",
    tittel: "Hvem vi egentlig jobber for",
    hash: "haa11bb22",
    tidspunkt: NÅ - 22 * DAG,
  },
  {
    forhold: "besvarer",
    gjelder: 103,
    kortform: "hvor lenge må vi ta vare på råmaterialet?",
    sti: "2026-09-06-depositum.md",
    tittel: "Depositum og avbestilling",
    hash: "hcc33dd44",
    tidspunkt: NÅ - 3 * DAG,
  },
  {
    forhold: "bekrefter",
    gjelder: 106,
    kortform: "alt må virke på en iPad fra 2017",
    sti: "2026-09-10-bestemorvennlig-kart.md",
    tittel: "Bestemorvennlig kart",
    hash: "hee55ff66",
    tidspunkt: NÅ - 5 * DAG,
  },
  {
    forhold: "nevnt",
    gjelder: 107,
    kortform: "vertikalformat tar mer tid i klipp enn vi tror",
    sti: "2026-08-26-lang-epost.md",
    tittel: "Den lange e-posten fra Hansen",
    hash: "h7788aa99",
    tidspunkt: NÅ - 14 * DAG,
  },
  {
    forhold: "bekrefter",
    gjelder: 104,
    kortform: "tilbud skal ut samme uke som møtet",
    sti: "2026-09-09-fjellheim-tilbud.md",
    tittel: "Tilbud Fjellheim Bryggeri",
    hash: "hbb00cc11",
    tidspunkt: NÅ - 9 * DAG,
  },
  {
    forhold: "nevnt",
    gjelder: 101,
    kortform: "vi priser oss under alle vi sammenligner oss med",
    sti: "2026-07-15-ubetalt.md",
    tittel: "Ubetalte fakturaer, juli",
    hash: "hdd22ee33",
    tidspunkt: NÅ - 60 * DAG,
  },
];

const SØKETREFF = [
  {
    path: "2026-09-11-tirsdagsmotet.md",
    title: "Tirsdagsmøtet 11. september",
    snippet: `Marius: Vi går for ${MERKE_START}Stripe${MERKE_SLUTT} som betalingsløsning. Det er den eneste som støtter Vipps uten at vi må drive med avtalegiro selv.`,
    startLine: 13,
    endLine: 14,
    modified: NÅ - 3600,
  },
  {
    path: "2026-08-20-hvem-vi-jobber-for.md",
    title: "Hvem vi egentlig jobber for",
    snippet: `Vi tar imot ${MERKE_START}betaling${MERKE_SLUTT} i dag gjennom Vipps direkte, og det fungerer helt til noen vil ha faktura.`,
    startLine: 7,
    endLine: 8,
    modified: NÅ - 20 * DAG,
  },
  {
    path: "2026-09-06-depositum.md",
    title: "Depositum og avbestilling",
    snippet: `Depositum på 30 % ved bestilling, resten ved levering. ${MERKE_START}Betaling${MERKE_SLUTT} etter forfall purres én gang.`,
    startLine: 11,
    endLine: 11,
    modified: NÅ - 3 * DAG,
  },
];

const SPØRSMÅLSSVAR = {
  overskrift: "Det som venter på noe",
  treff: [
    {
      kortform: "sende oppdatert tilbud til Fjellheim",
      avsender: "Kari",
      sti: "2026-09-11-tirsdagsmotet.md",
      tittel: "Tirsdagsmøtet 11. september",
      hash: "h65000000",
      tidspunkt: NÅ - 3600,
      venter: "prisen fra Kari",
    },
    {
      kortform: "bekrefte flytillatelse hos Avinor",
      avsender: null,
      sti: "2026-09-08-visningen.md",
      tittel: "Visningen på Sagene",
      hash: "h66000000",
      tidspunkt: NÅ - DAG,
      venter: "svar fra Avinor",
    },
    {
      kortform: "purre Hansen på faktura 2026-114",
      avsender: null,
      sti: "2026-07-15-ubetalt.md",
      tittel: "Ubetalte fakturaer, juli",
      hash: "h67000000",
      tidspunkt: NÅ - 60 * DAG,
      venter: null,
    },
  ],
  filter: ["venter"],
  tid: [],
  lest: 214,
};

export function installTauriMock(opts: MockOptions = {}) {
  const scenario: Scenario = opts.scenario ?? "standard";

  const alle = lagNotater();
  const notater: MockNote[] =
    scenario === "tomt"
      ? []
      : scenario === "tomtNotat"
        ? [{ path: "2026-09-12-tomt.md", title: "Uten tittel", modified: NÅ, content: "" }]
        : alle;

  const tilstand = {
    notater,
    lesning: opts.lesning ?? false,
    /** Hendelseslyttere, så en test kan sende `forstår`-framdrift inn. */
    lyttere: new Map<number, (data: unknown) => void>(),
    kall: 0,
  };

  const finn = (path: string) => tilstand.notater.find((n) => n.path === path);

  const forståelse = (innhold: string) => {
    if (!tilstand.lesning) {
      return {
        on: false,
        grunn: "avslått",
        paragraphs: [],
        reread: [],
        earlier: [],
        lesning: 1,
        uleste: 0,
        avkortet: false,
        kall: tilstand.kall,
      };
    }
    if (/^privat:\s*ja\s*$/m.test(innhold)) {
      return {
        on: false,
        grunn: "privat",
        paragraphs: [],
        reread: [],
        earlier: [],
        lesning: 1,
        uleste: 0,
        avkortet: false,
        kall: tilstand.kall,
      };
    }
    tilstand.kall += 1;
    const p = avsnitt(innhold).filter((a) => a.start >= 0);
    return {
      on: true,
      grunn: null,
      paragraphs: p,
      reread: p.length ? ["prisen bør opp med ti prosent"] : [],
      earlier: p.length ? TIDLIGERE : [],
      lesning: 1,
      uleste: p.length ? 2 : 0,
      avkortet: false,
      kall: tilstand.kall,
    };
  };

  const svar: Record<string, (a: any) => unknown> = {
    list_notes: () =>
      tilstand.notater.map(({ path, title, modified }) => ({ path, title, modified })),
    read_note: (a) => finn(a.path)?.content ?? "",
    write_note: (a) => {
      const n = finn(a.path);
      if (n) {
        n.content = a.content;
        n.modified = Math.floor(Date.now() / 1000);
      }
      return null;
    },
    create_note: () => {
      const path = `2026-09-14-nytt-${tilstand.notater.length}.md`;
      tilstand.notater.unshift({
        path,
        title: "Uten tittel",
        modified: Math.floor(Date.now() / 1000),
        content: "",
      });
      return path;
    },
    search_notes: (a) => {
      const q = String(a.query ?? "").trim().toLowerCase();
      if (q === "kvasarblekk") return { treff: [], avkortet: false };
      return { treff: SØKETREFF, avkortet: q.length < 4 };
    },
    spor_notater: (a) => {
      const q = String(a.query ?? "").toLowerCase();
      return q.includes("venter") || q.includes("uavklart") ? SPØRSMÅLSSVAR : null;
    },
    reindex: () => "ok",
    ordbank_status: () => ({
      tekst: "Søket kjenner bøyningene av norske ord.",
      mangler: false,
    }),
    last_ned_ordbank: () => ({ tekst: "Ordlista er lastet ned.", mangler: false }),
    sett_lesning: (a) => {
      tilstand.lesning = Boolean(a["på"] ?? a.pa);
      return null;
    },
    sett_privat: (a) => {
      const innhold: string = a.innhold ?? "";
      return a.privat
        ? innhold.replace(/^---\n/, "---\nprivat: ja\n")
        : innhold.replace(/^privat:\s*ja\n/m, "");
    },
    sett_samtale: (a) => a.innhold,
    samtaleform: (a) => {
      const er = /^(Marius|Kari):/m.test(String(a.innhold ?? ""));
      return {
        er,
        tvunget: null,
        deltakere: er ? ["Marius", "Kari"] : [],
        utenAvsender: er ? 6 : 0,
      };
    },
    understand_note: (a) => forståelse(String(a.content ?? "")),
    avbryt_lesning: () => null,
    rett_avsnitt: () => null,
    avvis_kobling: () => null,
    finn_avsnitt: (a) => {
      const n = finn(a.path);
      if (!n) return null;
      const p = avsnitt(n.content).find((x) => x.hash === a.hash);
      return p && p.start >= 0 ? [p.start, p.end] : null;
    },
    importer_samtale: () => null,
  };

  let nesteLytter = 1;

  (globalThis as any).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    transformCallback: (cb: (d: unknown) => void) => {
      const id = nesteLytter++;
      tilstand.lyttere.set(id, cb);
      return id;
    },
    unregisterCallback: (id: number) => tilstand.lyttere.delete(id),
    convertFileSrc: (p: string) => `file://${p}`,
    invoke: async (cmd: string, args: any = {}) => {
      if (cmd === "plugin:event|listen") return nesteLytter - 1;
      if (cmd === "plugin:event|unlisten") return null;
      // Ekte IPC tar millisekunder. Uten den ventingen svarer stubben i samme
      // mikrooppgave som kallet, React rekker ikke å tegne imellom, og
      // `understand_note`-svaret forkastes av vaktsetningen i `App.les`
      // («notatet kan være byttet») fordi `stiNå.current` ennå ikke er satt.
      await new Promise((r) => setTimeout(r, 12));
      if (cmd in svar) return svar[cmd](args ?? {});
      console.warn(`[tauri-mock] uventet invoke: ${cmd}`);
      return null;
    },
  };

  (globalThis as any).__notatMock = tilstand;
}
