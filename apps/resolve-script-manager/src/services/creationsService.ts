/**
 * creationsService — Phase 4. Typed wrapper rundt Rust-side
 * creation_save/list/load/delete commands. Hver "creation" er én
 * AI-generert PSD-template som kan iteres på senere.
 */

import { invoke } from "@tauri-apps/api/core";
import type { TemplateSpec } from "../agents/templateArtDirector";

export interface CreationImage {
  path: string;
  prompt: string;
  seed: number | null;
  width: number | null;
  height: number | null;
  model: string;
}

export interface Creation {
  id: string;
  created_at: string;
  updated_at: string;
  user_prompt: string;
  spec: TemplateSpec;
  images: Record<string, CreationImage>;
  text_values: Record<string, string>;
  psd_path: string;
}

export async function saveCreation(creation: Creation): Promise<Creation> {
  return invoke<Creation>("creation_save", { creation });
}

export async function listCreations(): Promise<Creation[]> {
  return invoke<Creation[]>("creation_list");
}

export async function loadCreation(id: string): Promise<Creation> {
  return invoke<Creation>("creation_load", { id });
}

export async function deleteCreation(id: string): Promise<void> {
  await invoke<void>("creation_delete", { id });
}
