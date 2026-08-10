/**
 * b2-client-factory.ts
 *
 * Én måte å bygge en B2-klient på.
 *
 * Femten moduler hadde hver sin kopi av nøyaktig dette oppsettet —
 * region, endepunkt, `forcePathStyle: true`, og de samme to env-variablene
 * for legitimasjon. Femten kopier betyr at en endring må gjøres femten
 * ganger, og at den som glemmer én av dem ikke får vite det. Det var slik
 * master-nøkkelen ble sittende overalt.
 *
 * Klienten som returneres herfra bruker nøkkelen som hører til rollen.
 * Mangler rollen sin egen nøkkel, faller den tilbake til fellesnøkkelen —
 * se b2-key-registry for hvorfor det er synlig og ikke stille.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { resolveB2Key, type B2KeyRole } from "./b2-key-registry.js";

/**
 * eu-central-003 er der the-role-room-prod ligger.
 *
 * Feil region gir ikke en exception — den gir stille skrivefeil. Derfor er
 * defaulten den samme overalt, og derfor bor den ett sted.
 */
export const B2_DEFAULT_REGION = "eu-central-003";

export function b2Region(): string {
  const raw = process.env.B2_REGION;
  return raw && raw.trim().length > 0 ? raw.trim() : B2_DEFAULT_REGION;
}

export function b2Endpoint(): string {
  const raw = process.env.B2_ENDPOINT;
  if (raw && raw.trim().length > 0) return raw.trim();
  return `https://s3.${b2Region()}.backblazeb2.com`;
}

const clientCache = new Map<string, S3Client>();

/**
 * Klient for en rolle, eller null når B2 ikke er konfigurert.
 *
 * Null er ikke en feil — det betyr at B2 ikke er satt opp, og kalleren
 * skal håndtere det slik den alltid har gjort (tom liste, 503, fallback
 * til et annet lager).
 */
export function b2ClientFor(
  role: B2KeyRole,
  /**
   * Overstyrer regionen for moduler som historisk har ligget i en annen.
   * Academy-materiellet defaulter til us-west-001; å flytte det til
   * fellesregionen ville gitt stille skrivefeil mot en bøtte som ikke er
   * der. Utelat den med mindre modulen faktisk har en annen default.
   */
  regionOverride?: string,
): S3Client | null {
  const key = resolveB2Key(role);
  if (!key) return null;

  const region = regionOverride ?? b2Region();
  const endpoint =
    regionOverride && !process.env.B2_ENDPOINT
      ? `https://s3.${regionOverride}.backblazeb2.com`
      : b2Endpoint();
  // Nøkkel-id-en er med i cache-nøkkelen, så to roller med ulik nøkkel
  // aldri deler klient. Uten den ville den første rollen som koblet opp
  // bestemt legitimasjonen for alle de andre.
  const cacheKey = `${endpoint}|${key.keyId}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: key.keyId,
      secretAccessKey: key.applicationKey,
    },
    // B2 krever path-style-adressering. Uten den treffer forespørselen en
    // vert som ikke finnes.
    forcePathStyle: true,
  });
  clientCache.set(cacheKey, client);
  return client;
}

/**
 * Klient + bøtte for en rolle.
 *
 * Bøtta kommer fra `bucketEnvChain` — modulens egen kjede — fordi disse
 * modulene skriver i hvert sitt nøkkelrom og ennå ikke er delt opp etter
 * datatype. Bøtte-splitten gjelder capture og generiske opplastinger; her
 * beholdes fellesbøtta til de eventuelt flyttes hver for seg.
 */
export function b2StoreFor(
  role: B2KeyRole,
  ...bucketEnvChain: (string | undefined)[]
): { client: S3Client; bucket: string } | null {
  const client = b2ClientFor(role);
  if (!client) return null;
  for (const candidate of bucketEnvChain) {
    if (candidate && candidate.trim().length > 0) {
      return { client, bucket: candidate.trim() };
    }
  }
  return null;
}
