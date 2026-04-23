/**
 * Client helper for the 16-bit PNG save endpoint.
 *
 * The editor holds its final edited pixels as Float32 (via `recompose`
 * over the band stack). For a true-16-bit save we:
 *   1. Quantise Float32 [0,1] → Uint16 [0, 65535] (native rounding).
 *   2. POST the raw bytes as application/octet-stream to the Node proxy
 *      (`/api/photo-enhancer/frequency-sep/save-16bit`) which forwards
 *      to the Python runner — see backend/gfpgan-runner/freq_sep_save.py.
 *   3. Receive a real 16-bit PNG as a Blob.
 *
 * We deliberately convert to Uint16 on the client rather than shipping
 * Float32: halves the request payload (2 bytes vs 4 bytes per channel),
 * and it's the quantisation the server would apply anyway before writing.
 */

import type { Float32Image } from './decomposition';

export type Save16bitSource =
  /** Already-quantised 16-bit pixels in RGB(A) order, little-endian. */
  | { kind: 'u16'; data: Uint16Array; width: number; height: number; channels: 3 | 4 }
  /** Float32 image in [0,1] — converted to u16 in-line. */
  | { kind: 'float32'; image: Float32Image };

export type Save16bitOptions = {
  /** Override the default endpoint for tests or non-default deployments. */
  endpoint?: string;
  /** Passed to fetch for cancellation. */
  signal?: AbortSignal;
};

const DEFAULT_ENDPOINT = '/api/photo-enhancer/frequency-sep/save-16bit';

/** Quantise a Float32 [0,1] image buffer to a Uint16Array. Out-of-range
 *  values are clamped, not wrapped. NaN maps to 0. */
export function float32ToUint16(image: Float32Image): {
  data: Uint16Array;
  width: number;
  height: number;
  channels: 3 | 4;
} {
  const { data, width, height, channels } = image;
  if (channels !== 3 && channels !== 4) {
    throw new Error(`save-16bit only supports 3 or 4 channels, got ${channels}`);
  }
  const out = new Uint16Array(width * height * channels);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (Number.isNaN(v)) {
      out[i] = 0;
    } else if (v <= 0) {
      out[i] = 0;
    } else if (v >= 1) {
      out[i] = 65535;
    } else {
      out[i] = Math.round(v * 65535);
    }
  }
  return { data: out, width, height, channels };
}

/** POST the buffer and return the server's 16-bit PNG as a Blob. */
export async function save16bitPng(
  source: Save16bitSource,
  options: Save16bitOptions = {},
): Promise<Blob> {
  const { data, width, height, channels } =
    source.kind === 'u16' ? source : float32ToUint16(source.image);

  const expected = width * height * channels * 2;
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.byteLength !== expected) {
    throw new Error(
      `pixel byte length mismatch: got ${bytes.byteLength}, expected ${expected}`,
    );
  }

  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const url = `${endpoint}?width=${width}&height=${height}&channels=${channels}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    // TS 5.x types BodyInit against Uint8Array<ArrayBuffer>; a sliced-view
    // Uint8Array over the typed-array's underlying buffer is identical at
    // runtime but carries the looser ArrayBufferLike generic — cast
    // through BodyInit.
    body: bytes as BodyInit,
    signal: options.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `save-16bit failed: ${response.status} ${response.statusText} — ${text.slice(0, 200)}`,
    );
  }
  return response.blob();
}
