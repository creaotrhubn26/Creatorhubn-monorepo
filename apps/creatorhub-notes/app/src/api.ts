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

/** Ett avsnitt slik panelet leser det. `start` og `end` er posisjoner i
 *  teksten, talt slik JavaScript teller, så de kan brukes rett i editoren. */
export type Paragraph = {
  start: number;
  end: number;
  summary: string;
  kind: string;
  action: string;
};

/** `on: false` betyr at det ikke finnes noen nøkkel i miljøet. */
export type Understanding = { on: boolean; paragraphs: Paragraph[] };

export const understandNote = (content: string) =>
  invoke<Understanding>("understand_note", { content });
