import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractBrandColorsFromLogo,
  extractBrandColorsFromSvg,
} from "./role-room-agent.js";

const MEDSIDE_LOGO_FIXTURE = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 135">
    <style>.tagline { fill: #4a5878; }</style>
    <linearGradient id="gold">
      <stop offset="0%" stop-color="#A9842E" />
      <stop offset="100%" stop-color="#7A5C16" />
    </linearGradient>
    <linearGradient id="navy">
      <stop offset="0%" stop-color="#3b486b" />
      <stop offset="100%" stop-color="#212a42" />
    </linearGradient>
    <path fill="url(#navy)" />
    <path fill="url(#gold)" />
    <text><tspan fill="#212a42">Med</tspan><tspan fill="#7A5C16">Side</tspan></text>
  </svg>
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractBrandColorsFromSvg", () => {
  it("extracts, ranks and deduplicates the real MedSide logo colors", () => {
    const colors = extractBrandColorsFromSvg(MEDSIDE_LOGO_FIXTURE);

    expect(colors).toHaveLength(5);
    expect(colors.slice(0, 2).map((color) => color.hex)).toEqual([
      "#212A42",
      "#7A5C16",
    ]);
    expect(new Set(colors.map((color) => color.hex))).toEqual(
      new Set(["#A9842E", "#4A5878", "#3B486B", "#212A42", "#7A5C16"]),
    );
    expect(new Set(colors.map((color) => color.hex)).size).toBe(colors.length);
    expect(colors[0].label).toBe("Primær");
    expect(colors[1].label).toBe("Aksent");
  });

  it("normalizes short hex and rgb values while ignoring transparent colors and gradient references", () => {
    const colors = extractBrandColorsFromSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <style>.one { color: rgb(10, 20, 30); fill: #abc; }</style>
        <path fill="url(#abc)" stroke="rgba(255, 0, 0, 0)" />
        <path style="stroke: rgb(100% 50% 0% / 80%); fill: #AABBCC" />
      </svg>
    `);

    expect(colors.map((color) => color.hex).sort()).toEqual([
      "#0A141E",
      "#AABBCC",
      "#FF8000",
    ]);
  });

  it("ignores colors inside comments and scripts and supports compact SVG logos", () => {
    const colors = extractBrandColorsFromSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <!-- fill: #FF0000 -->
        <script>const ignored = "stroke: #00FF00";</script>
        <path fill="#123456"/>
      </svg>
    `);

    expect(colors.map((color) => color.hex)).toEqual(["#123456"]);
    expect(extractBrandColorsFromSvg("fill: #ABCDEF")).toEqual([]);
  });
});

describe("extractBrandColorsFromLogo SVG dataflow", () => {
  it("fetches an SVG logo and returns its exact palette without invoking raster decoding", async () => {
    const bytes = new TextEncoder().encode(MEDSIDE_LOGO_FIXTURE);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({
          "content-type": "image/svg+xml",
          "content-length": String(bytes.byteLength),
        }),
        arrayBuffer: async () => bytes.buffer,
      })),
    );

    const colors = await extractBrandColorsFromLogo(
      "https://medside.no/medside-logo.svg",
    );

    expect(colors.slice(0, 2).map((color) => color.hex)).toEqual([
      "#212A42",
      "#7A5C16",
    ]);
    expect(new Set(colors.map((color) => color.hex))).toEqual(
      new Set(["#A9842E", "#4A5878", "#3B486B", "#212A42", "#7A5C16"]),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects oversized SVG responses before reading their body", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({
          "content-type": "image/svg+xml",
          "content-length": String(5 * 1024 * 1024 + 1),
        }),
        arrayBuffer,
      })),
    );

    await expect(
      extractBrandColorsFromLogo("https://example.test/oversized.svg"),
    ).resolves.toEqual([]);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
