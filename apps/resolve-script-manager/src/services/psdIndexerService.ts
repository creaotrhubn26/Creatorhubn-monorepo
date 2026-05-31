/**
 * psdIndexerService — typed wrapper rundt psd_index_directory og
 * psd_get_info Tauri-commands. Lar UI vise et thumbnail-galleri
 * over alle .psd / .psb-filer i en mappe uten å åpne Photoshop.
 */

import { invoke } from "@tauri-apps/api/core";

export interface PsdLayerInfo {
  name: string;
  visible: boolean;
  width: number;
  height: number;
}

export interface PsdEntry {
  path: string;
  name: string;
  width: number;
  height: number;
  file_size: number;
  layer_count: number;
  layers: PsdLayerInfo[];
  /** Base64-encoded PNG thumbnail. Null hvis flatten feilet. */
  thumbnail_b64: string | null;
  /** Parsing- eller thumbnail-feil. Entry vises fortsatt i galleriet. */
  error: string | null;
}

export async function indexDirectory(
  dir: string,
  maxDepth: number = 1,
): Promise<PsdEntry[]> {
  return invoke<PsdEntry[]>("psd_index_directory", { dir, maxDepth });
}

export async function getInfo(path: string): Promise<PsdEntry> {
  return invoke<PsdEntry>("psd_get_info", { path });
}
