import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { float32ToUint16, save16bitPng } from '../save-16bit';
import type { Float32Image } from '../decomposition';

function makeFloat32Image(
  w: number,
  h: number,
  channels: 3 | 4,
  fill: (x: number, y: number, c: number) => number,
): Float32Image {
  const data = new Float32Array(w * h * channels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = (y * w + x) * channels;
      for (let c = 0; c < channels; c++) data[base + c] = fill(x, y, c);
    }
  }
  return { data, width: w, height: h, channels };
}

describe('float32ToUint16', () => {
  it('maps 0 → 0 and 1 → 65535', () => {
    const img = makeFloat32Image(2, 1, 3, (x) => (x === 0 ? 0 : 1));
    const out = float32ToUint16(img);
    expect(out.data[0]).toBe(0);
    expect(out.data[1]).toBe(0);
    expect(out.data[2]).toBe(0);
    expect(out.data[3]).toBe(65535);
    expect(out.data[4]).toBe(65535);
    expect(out.data[5]).toBe(65535);
  });

  it('clamps out-of-range values', () => {
    const img: Float32Image = {
      data: new Float32Array([-0.5, 2, 0.5]),
      width: 1,
      height: 1,
      channels: 3,
    };
    const out = float32ToUint16(img);
    expect(out.data[0]).toBe(0);
    expect(out.data[1]).toBe(65535);
    expect(out.data[2]).toBe(Math.round(0.5 * 65535));
  });

  it('rounds toward the nearest integer', () => {
    // Pick exactly-representable mid-integer positions: 100.6 / 65535 and
    // 100.4 / 65535 round to 101 and 100 respectively — far enough from
    // 0.5 that the f32 round-trip doesn't disturb the rounding direction.
    const img: Float32Image = {
      data: new Float32Array([100.6 / 65535, 100.4 / 65535, 200.7 / 65535]),
      width: 1,
      height: 1,
      channels: 3,
    };
    const out = float32ToUint16(img);
    expect(out.data[0]).toBe(101);
    expect(out.data[1]).toBe(100);
    expect(out.data[2]).toBe(201);
  });

  it('treats NaN as 0', () => {
    const img: Float32Image = {
      data: new Float32Array([NaN, 0.5, 1]),
      width: 1,
      height: 1,
      channels: 3,
    };
    const out = float32ToUint16(img);
    expect(out.data[0]).toBe(0);
  });

  it('rejects non 3/4 channel counts', () => {
    const img = {
      data: new Float32Array(4),
      width: 2,
      height: 2,
      channels: 1,
    } as unknown as Float32Image;
    expect(() => float32ToUint16(img)).toThrow(/3 or 4/);
  });

  it('preserves shape metadata', () => {
    const img = makeFloat32Image(5, 7, 4, () => 0.3);
    const out = float32ToUint16(img);
    expect(out.width).toBe(5);
    expect(out.height).toBe(7);
    expect(out.channels).toBe(4);
    expect(out.data.length).toBe(5 * 7 * 4);
  });
});

describe('save16bitPng', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    // Reset between tests.
    globalThis.fetch = originalFetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts raw bytes with width/height/channels in the URL', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const u16 = new Uint16Array([10, 20, 30, 40, 50, 60]);
    const blob = await save16bitPng(
      { kind: 'u16', data: u16, width: 2, height: 1, channels: 3 },
      { endpoint: '/api/test/save' },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/test/save?width=2&height=1&channels=3');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/octet-stream',
    );
    expect(init.body).toBeInstanceOf(Uint8Array);
    // Byte length = 2*1*3*2 = 12.
    expect((init.body as Uint8Array).byteLength).toBe(12);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('converts a Float32Image source to Uint16 before sending', async () => {
    const bodies: Uint8Array[] = [];
    globalThis.fetch = (async (_url, init) => {
      bodies.push(init!.body as Uint8Array);
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
    }) as unknown as typeof fetch;

    const image = makeFloat32Image(2, 2, 4, () => 1); // all channels = 65535
    await save16bitPng({ kind: 'float32', image });
    expect(bodies).toHaveLength(1);
    const view = new Uint16Array(
      bodies[0].buffer,
      bodies[0].byteOffset,
      bodies[0].byteLength / 2,
    );
    for (let i = 0; i < view.length; i++) expect(view[i]).toBe(65535);
  });

  it('throws on a non-ok response with body snippet', async () => {
    globalThis.fetch = (async () =>
      new Response('pixel byte length mismatch: got 4, expected 12', {
        status: 400,
      })) as unknown as typeof fetch;
    await expect(
      save16bitPng({
        kind: 'u16',
        data: new Uint16Array([1, 2, 3]),
        width: 1,
        height: 1,
        channels: 3,
      }),
    ).rejects.toThrow(/400/);
  });
});
