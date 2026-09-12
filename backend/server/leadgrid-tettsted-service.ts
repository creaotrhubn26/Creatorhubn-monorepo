/**
 * leadgrid-tettsted-service.ts
 *
 * SSB Tettsteder («tettbygde strøk») for område-tildeling under
 * kommunenivå. Kilde: SSBs offisielle tettsted-avgrensning via
 * kart.ssb.no WFS (gratis, ingen nøkkel).
 *
 * Viktige realiteter (verifisert mot ekte API 2026-07-17):
 *   • WFS-en serverer KUN GML (outputFormat=geojson gir 400) → vi
 *     parser GML her og konverterer til GeoJSON MultiPolygon.
 *   • Tettsteder har INGEN kommunenummer-attributt (de kan krysse
 *     kommunegrenser — f.eks. tettstedet Oslo). Filtrering per kommune
 *     gjøres derfor med bbox-spørring + vertex-i-kommunepolygon-sjekk
 *     (ray-casting fra leadgrid-territory-service).
 *   • Koordinater i GML-en er EPSG:4326 med akserekkefølge LAT LON.
 *
 * Årgang: typename `ms:tettsted_2025` — SSB publiserer ny årgang årlig;
 * bump TETTSTED_TYPENAME når 2026 foreligger.
 */

import { pointInGeometry } from "./leadgrid-territory-service.js";

const TETTSTED_TYPENAME = "ms:tettsted_2025";
const WFS_BASE = "https://kart.ssb.no/api/mapserver/v1/wfs/tettsteder";
const KOMMUNEINFO = "https://ws.geonorge.no/kommuneinfo/v1/kommuner";

export interface TettstedDTO {
  tett_nr: string;
  navn: string;
  befolkning: number | null;
  befolkningstetthet: number | null;
  center_lat: number;
  center_lng: number;
  /** GeoJSON MultiPolygon, [lng,lat], Douglas-Peucker-forenklet. */
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
}

// ─── Douglas-Peucker (2D, grader) ────────────────────────────────────
// Tettsted-polygonene fra SSB er svært detaljerte (tusenvis av punkter);
// for tildelings-/matchingsformål holder ~10m-oppløsning. Toleransen
// 0.0002° ≈ 12-20m. Uten forenkling blir JSONB-geometrien i
// lead_territories unødvendig tung for on-device ray-casting.
function perpDist(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function simplifyRing(ring: number[][], tolerance = 0.0002): number[][] {
  if (ring.length <= 4) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(ring[i], ring[lo], ring[hi]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = true;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  // En gyldig lukket ring trenger minst 4 punkter (først == sist).
  return out.length >= 4 ? out : ring;
}

// ─── GML-parsing ─────────────────────────────────────────────────────
// MapServer-GML-en er regulær nok til regex-basert uthenting: hvert
// <wfs:member> har ms-attributter + msGeometry med posList-ringer
// (exterior først, deretter ev. interior-hull per polygon).

interface ParsedTettsted {
  tettNr: string;
  navn: string;
  befolkning: number | null;
  tetthet: number | null;
  /** polygons[i] = ringer, ring[0]=exterior, resten hull; [lng,lat]. */
  polygons: number[][][][];
}

function tagValue(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<ms:${tag}>([^<]*)</ms:${tag}>`));
  return m ? m[1] : null;
}

/** posList «lat lon lat lon …» → [[lng,lat], …] */
function parsePosList(text: string): number[][] {
  const nums = text.trim().split(/\s+/).map(Number);
  const pts: number[][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    // GML akserekkefølge for EPSG:4326-urn er lat lon → snu til GeoJSON.
    pts.push([nums[i + 1], nums[i]]);
  }
  return pts;
}

export function parseTettstedGML(gml: string): ParsedTettsted[] {
  const out: ParsedTettsted[] = [];
  // MapServer WFS 2.0 pakker features i <wfs:member>.
  const members = gml.split(/<wfs:member>/).slice(1);
  for (const raw of members) {
    const block = raw.split("</wfs:member>")[0];
    const navn = tagValue(block, "tettstedsnavn");
    const tettNr = tagValue(block, "tett_nr");
    if (!navn || !tettNr) continue;
    const befRaw = tagValue(block, "befolkning_tettsted");
    const tetRaw = tagValue(block, "befolkningstetthet");

    const polygons: number[][][][] = [];
    // Polygoner: <gml:Polygon …> … </gml:Polygon> (inne i MultiSurface
    // eller direkte). exterior/interior har hver sin LinearRing/posList.
    const polyBlocks = block.split(/<gml:Polygon[ >]/).slice(1);
    for (const pRaw of polyBlocks) {
      const pBlock = pRaw.split("</gml:Polygon>")[0];
      const rings: number[][][] = [];
      const ext = pBlock.match(
        /<gml:exterior>[\s\S]*?<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>[\s\S]*?<\/gml:exterior>/,
      );
      if (!ext) continue;
      rings.push(simplifyRing(parsePosList(ext[1])));
      const intRe =
        /<gml:interior>[\s\S]*?<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>[\s\S]*?<\/gml:interior>/g;
      let im: RegExpExecArray | null;
      while ((im = intRe.exec(pBlock)) !== null) {
        rings.push(simplifyRing(parsePosList(im[1])));
      }
      if (rings[0].length >= 4) polygons.push(rings);
    }
    if (polygons.length === 0) continue;
    out.push({
      tettNr,
      navn,
      befolkning: befRaw != null && befRaw !== "" ? Number(befRaw) : null,
      tetthet: tetRaw != null && tetRaw !== "" ? Number(tetRaw) : null,
      polygons,
    });
  }
  return out;
}

// ─── Geonorge kommune-oppslag ────────────────────────────────────────

interface KommuneGeo {
  /** [lngMin, latMin, lngMax, latMax] */
  bbox: [number, number, number, number];
  /** GeoJSON-geometri (MultiPolygon) for grensen. */
  omrade: unknown;
}

async function fetchKommuneGeo(kommunenr: string): Promise<KommuneGeo | null> {
  const [infoRes, omradeRes] = await Promise.all([
    fetch(`${KOMMUNEINFO}/${kommunenr}`, { headers: { Accept: "application/json" } }),
    fetch(`${KOMMUNEINFO}/${kommunenr}/omrade`, { headers: { Accept: "application/json" } }),
  ]);
  if (!infoRes.ok || !omradeRes.ok) return null;
  const info = (await infoRes.json()) as {
    avgrensningsboks?: { coordinates?: number[][][] };
  };
  const omradeBody = (await omradeRes.json()) as { omrade?: unknown };
  const ringCoords = info.avgrensningsboks?.coordinates?.[0];
  if (!ringCoords || ringCoords.length < 4) return null;
  const lngs = ringCoords.map((c) => c[0]);
  const lats = ringCoords.map((c) => c[1]);
  return {
    bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    omrade: omradeBody.omrade ?? omradeBody,
  };
}

// ─── Hoved-oppslag m/ 24t cache ──────────────────────────────────────
// Tettsted-avgrensningen endres én gang i året — 24t er konservativt.

const TTL_MS = 24 * 60 * 60 * 1000;
const tettstedCache = new Map<string, { at: number; body: TettstedDTO[] }>();

function centroidOf(polygons: number[][][][]): [number, number] {
  // Enkelt vertex-snitt av største exterior-ring — godt nok til
  // kart-sentrering (ikke arealvektet).
  let biggest: number[][] = [];
  for (const p of polygons) if (p[0].length > biggest.length) biggest = p[0];
  const n = Math.max(1, biggest.length);
  const sum = biggest.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
  return [sum[1] / n, sum[0] / n]; // [lat, lng]
}

export async function fetchTettstederForKommune(
  kommunenr: string,
): Promise<TettstedDTO[] | null> {
  const cached = tettstedCache.get(kommunenr);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.body;

  const geo = await fetchKommuneGeo(kommunenr);
  if (!geo) return null;
  const [lngMin, latMin, lngMax, latMax] = geo.bbox;
  // WFS 2.0-bbox i urn-CRS bruker lat,lon-akserekkefølge (verifisert).
  const url =
    `${WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=${encodeURIComponent(TETTSTED_TYPENAME)}&count=200` +
    `&bbox=${latMin},${lngMin},${latMax},${lngMax},urn:ogc:def:crs:EPSG::4326`;
  const wfsRes = await fetch(url);
  if (!wfsRes.ok) return null;
  const gml = await wfsRes.text();
  const parsed = parseTettstedGML(gml);

  // Kommune-filter: behold tettsteder med minst ett exterior-vertex
  // innenfor kommunegrensen (fanger også grensekryssende tettsteder).
  const inKommune = parsed.filter((t) =>
    t.polygons.some((poly) =>
      poly[0].some((pt) => pointInGeometry(pt[1], pt[0], geo.omrade)),
    ),
  );

  const body: TettstedDTO[] = inKommune
    .map((t) => {
      const [lat, lng] = centroidOf(t.polygons);
      return {
        tett_nr: t.tettNr,
        navn: t.navn,
        befolkning: t.befolkning,
        befolkningstetthet: t.tetthet,
        center_lat: lat,
        center_lng: lng,
        geometry: { type: "MultiPolygon" as const, coordinates: t.polygons },
      };
    })
    .sort((a, b) => (b.befolkning ?? 0) - (a.befolkning ?? 0));

  tettstedCache.set(kommunenr, { at: Date.now(), body });
  return body;
}
