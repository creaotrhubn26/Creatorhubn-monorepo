import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Note = { path: string; title: string; modified: number };
export type SearchHit = {
  path: string;
  title: string;
  snippet: string;
  startLine: number;
  endLine: number;
};

export const listNotes = () => invoke<Note[]>("list_notes");
export const readNote = (path: string) => invoke<string>("read_note", { path });
export const writeNote = (path: string, content: string) =>
  invoke<void>("write_note", { path, content });
export const createNote = (title: string) => invoke<string>("create_note", { title });
export const searchNotes = (query: string) => invoke<SearchHit[]>("search_notes", { query });
export const reindex = () => invoke<string>("reindex");

/** Brukerens egen retting av én linje: hvor den hører hjemme, og hva den
 *  skulle stått som. `plass` er «fjernet» når linja ikke hører hjemme noe
 *  sted i det hele tatt. */
export type Rettelse = {
  plass: string;
  summary: string;
  /** Hva oppgaven venter på, når hun skrev en pil i kortformen sin. */
  venter: string;
};

/** Ett steg tilbake. Teksten er det hun ser i angrebanneret, `angre` er
 *  rettingen som setter det tilbake slik det var. Stabelen bor i `App`, ikke i
 *  panelet: panelet rives ved hvert notatbytte, og en feilklikket «Ikke
 *  relevant» skal ikke bli permanent av at hun så på et annet notat. */
export type Angring = { tekst: string; angre: Retting };

/** Ett avsnitt slik panelet leser det. `start` og `end` er posisjoner i
 *  teksten, talt slik JavaScript teller, så de kan brukes rett i editoren. */
export type Paragraph = {
  start: number;
  end: number;
  /** Avsnittets identitet. Den tildeles én gang og overlever at teksten
   *  redigeres, så en rettelse som henger på den blir stående. */
  id: number;
  /** Hashen av avsnittsteksten. Ikke identitet — den finner avsnittet igjen i
   *  fila, og svarer på om teksten er klassifisert før. */
  hash: string;
  text: string;
  summary: string;
  kind: string;
  action: string;
  /** Hvem som sa det, når notatet er en importert samtale. `null` i et vanlig
   *  notat — der er avsenderen brukeren selv. */
  avsender: string | null;
  /** Bare oppgaver: hva oppgaven venter på. */
  dependency: string | null;
  correction: Rettelse | null;
  /** Da linja ble lest, i sekunder siden epoke. Panelet viser datoen når den
   *  begynner å bli gammel. `0` er ukjent. */
  lest: number;
  /** Modellen som leste linja. Ikke vist; den er der for at en linje skal
   *  kunne spores til den utgaven som faktisk leste den. */
  modell: string;
};

/** Noe brukeren har tenkt om det samme før. `forhold` er `motsier`,
 *  `bekrefter`, `besvarer` eller `nevnt` — det siste når de to lesningene så
 *  en kobling men ikke den samme retningen, og appen derfor ikke påstår noen.
 *  Det som ikke handler om det samme kommer aldri hit. `gjelder` er avsnittet
 *  i notatet som står åpent, `hash` er avsnittet i det andre notatet. */
export type Tidligere = {
  forhold: string;
  gjelder: number;
  kortform: string;
  sti: string;
  tittel: string;
  hash: string;
  /** Dagen tanken ble skrevet — datoen i toppfeltet, eller filas
   *  endringstidspunkt. `0` når kilden ikke visste den; da vises linja uten
   *  dato, i stedet for med dagens. */
  tidspunkt: number;
};

/** Lesningen er slått av. Standardverdien: teksten forlater maskinen, og det
 *  er ikke noe å anta samtykke til. */
export const AVSLATT = "avslått";
/** Notatet har `privat: ja` i toppfeltet og sendes aldri noe sted. */
export const PRIVAT = "privat";

/** `on: false` betyr at lesningen ikke ga noe, og `grunn` sier hvorfor:
 *  [`AVSLATT`], [`PRIVAT`], eller feilteksten fra kallet. `reread` er
 *  rettelser som gjaldt avsnitt brukeren siden har skrevet om. `lesning` er
 *  løpenummeret for lesningen, som skiller delresultater fra hverandre. */
export type Understanding = {
  on: boolean;
  grunn: string | null;
  paragraphs: Paragraph[];
  reread: string[];
  earlier: Tidligere[];
  lesning: number;
  /** Avsnitt i notatet som ikke har fått en linje — modellen svarte ikke for
   *  dem, eller pakken de lå i feilet. Uten tallet ser et avsnitt appen ikke
   *  klarte å lese ut nøyaktig ut som et avsnitt uten innhold. */
  uleste: number;
  /** Hvor mange ganger appen har sendt tekst ut av maskinen siden den startet. */
  kall: number;
};

/** Brukerens svar på om «Hva vi har forstått» får lese notatene. Av som
 *  standard: lesningen sender avsnittene ut av maskinen og legger igjen en
 *  kopi på disk. Svaret leses av panelet gjennom `Understanding.grunn`. */
export const settLesning = (på: boolean) => invoke<void>("sett_lesning", { på });

/** Merker notatet som noe som aldri sendes noe sted. Svaret er hele notatet
 *  med `privat` satt i toppfeltet, så valget står i fila. */
export const settPrivat = (innhold: string, privat: boolean) =>
  invoke<string>("sett_privat", { innhold, privat });

/** `synlig` er `[fra, til]` i teksten — området editoren viser. Det som står
 *  der leses først, slik at en lang kilde fyller panelet ovenfra og nedover i
 *  stedet for å begynne et sted brukeren ikke ser. */
export const understandNote = (
  path: string,
  content: string,
  synlig?: [number, number] | null,
) => invoke<Understanding>("understand_note", { path, content, synlig: synlig ?? null });

/** Én pakke er lest: avsnittene som fikk et merke akkurat nå, og hvor langt
 *  lesningen er kommet. */
export type Framdrift = {
  lesning: number;
  lest: number;
  totalt: number;
  /** Hva som pågår når det ikke lenger er avsnitt som leses. `sammenligner` er
   *  turen til det hun har skrevet før: to modellkall som tar minutter, og som
   *  panelet før sto ferdig-utseende og taust gjennom. */
  fase: string | null;
  paragraphs: Paragraph[];
};

export const påLesning = (f: (d: Framdrift) => void) =>
  listen<Framdrift>("forstår", (e) => f(e.payload));

/** Notater som er endret utenfra mens appen kjører — en ny fil, en slettet
 *  fil, eller en fil som ble skrevet i av noe annet enn appen selv (`notat`,
 *  en annen editor, en git-synk). Stiene er relative til notatmappen, samme
 *  form som i [`Note`]. Appens egne lagringer er allerede luket bort her —
 *  denne hendelsen kommer aldri fra appens eget skriv. */
export const påNotatEndret = (f: (stier: string[]) => void) =>
  listen<string[]>("notat-endret", (e) => f(e.payload));

/** Brukeren har gått videre. Lesningen som kjører forlates ved neste
 *  pakkeslutt; det den rakk å lese står. */
export const avbrytLesning = () => invoke<void>("avbryt_lesning");

/** `plass: null` tar rettelsen bort igjen — det angre gjør når det ikke var
 *  noen rettelse fra før. */
export type Retting = {
  avsnittId: number;
  sti: string;
  tekst: string;
  lestType: string;
  lestHandling: string;
  lestKortform: string;
  plass: string | null;
  kortform: string | null;
};

export const rettAvsnitt = (retting: Retting) => invoke<void>("rett_avsnitt", { retting });

/** Brukerens egen dom over en kobling: disse to hører ikke sammen. Gjelder
 *  paret, ikke retningen, og `avvist: false` tar dommen tilbake — da dømmes
 *  paret på nytt. */
export const avvisKobling = (gjelder: number, annenHash: string, sti: string, avvist: boolean) =>
  invoke<void>("avvis_kobling", { gjelder, annenHash, sti, avvist });

/** Ett strukturert treff: en linje appen har lest ut av et notat. */
export type Strukturert = {
  kortform: string;
  /** Hvem som sa det, når treffet står i en importert samtale. */
  avsender: string | null;
  sti: string;
  tittel: string;
  hash: string;
  tidspunkt: number;
  venter: string | null;
};

/** Svar på et spørsmål om det som er lest — «hva er uavklart», «hva venter på
 *  noe». `null` betyr at søket var et vanlig søk, og da står fritekstsøket
 *  alene, som før. */
export type Sporsmal = { overskrift: string; treff: Strukturert[] };

export const sporNotater = (query: string) =>
  invoke<Sporsmal | null>("spor_notater", { query });

/** Hvor et avsnitt står i et notat, som `[fra, til]`. `null` når avsnittet er
 *  skrevet om siden sist. */
export const finnAvsnitt = (path: string, hash: string) =>
  invoke<[number, number] | null>("finn_avsnitt", { path, hash });

/** Er den limte teksten en samtale? Svaret er innleggene som markdown — ett
 *  avsnitt per innlegg, avsenderen først — eller `null` når den ikke er
 *  gjenkjent. Da limes teksten inn som den er.
 *
 *  Regelbasert, ingen modell: dette skjer mellom ⌘V og at teksten står der. */
export const importerSamtale = (tekst: string) =>
  invoke<string | null>("importer_samtale", { tekst });

/** Hvordan notatet leses nå. `tvunget` er satt når brukeren har bestemt det
 *  selv — da er det hennes valg som gjelder, ikke gjenkjenningen. */
export type Samtaleform = {
  er: boolean;
  tvunget: string | null;
  deltakere: string[];
  /** Avsnitt uten et gjenkjent avsenderhode. Et notat merket «Samtale med
   *  Marius, Kari» der halve fila ikke er innlegg skal si det. */
  utenAvsender: number;
};

export const samtaleform = (innhold: string) =>
  invoke<Samtaleform>("samtaleform", { innhold });

/** Brukerens overstyring, begge veier. Svaret er hele notatet med valget satt
 *  i toppfeltet, slik at det står i fila og gjelder neste gang også. */
export const settSamtale = (innhold: string, erSamtale: boolean) =>
  invoke<string>("sett_samtale", { innhold, erSamtale });
