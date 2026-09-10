import { invoke } from "@tauri-apps/api/core";

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
  /** Avsnittsteksten som nøkkel. En rettelse henger på denne. */
  hash: string;
  text: string;
  summary: string;
  kind: string;
  action: string;
  /** Bare oppgaver: hva oppgaven venter på. */
  dependency: string | null;
  correction: Rettelse | null;
};

/** `on: false` betyr at lesningen ikke er tilgjengelig nå. `reread` er
 *  rettelser som gjaldt avsnitt brukeren siden har skrevet om. */
export type Understanding = { on: boolean; paragraphs: Paragraph[]; reread: string[] };

export const understandNote = (path: string, content: string) =>
  invoke<Understanding>("understand_note", { path, content });

/** `plass: null` tar rettelsen bort igjen — det angre gjør når det ikke var
 *  noen rettelse fra før. */
export type Retting = {
  sti: string;
  hash: string;
  tekst: string;
  lestType: string;
  lestHandling: string;
  lestKortform: string;
  plass: string | null;
  kortform: string | null;
};

export const rettAvsnitt = (retting: Retting) => invoke<void>("rett_avsnitt", { retting });
