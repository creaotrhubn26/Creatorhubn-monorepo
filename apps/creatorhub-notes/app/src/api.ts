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
export type Rettelse = { plass: string; summary: string };

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
  tidspunkt: number;
};

/** `on: false` betyr at lesningen ikke er tilgjengelig nå. `reread` er
 *  rettelser som gjaldt avsnitt brukeren siden har skrevet om. `lesning` er
 *  løpenummeret for lesningen, som skiller delresultater fra hverandre. */
export type Understanding = {
  on: boolean;
  paragraphs: Paragraph[];
  reread: string[];
  earlier: Tidligere[];
  lesning: number;
};

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
  paragraphs: Paragraph[];
};

export const påLesning = (f: (d: Framdrift) => void) =>
  listen<Framdrift>("forstår", (e) => f(e.payload));

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
export type Samtaleform = { er: boolean; tvunget: string | null; deltakere: string[] };

export const samtaleform = (innhold: string) =>
  invoke<Samtaleform>("samtaleform", { innhold });

/** Brukerens overstyring, begge veier. Svaret er hele notatet med valget satt
 *  i toppfeltet, slik at det står i fila og gjelder neste gang også. */
export const settSamtale = (innhold: string, erSamtale: boolean) =>
  invoke<string>("sett_samtale", { innhold, erSamtale });
