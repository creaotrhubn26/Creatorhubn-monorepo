/**
 * b2-key-registry.ts
 *
 * Én B2-nøkkel per tjenesterolle, i stedet for én master-nøkkel til alt.
 *
 * Slik det var: `B2_ROLE_ROOM_APPLICATION_KEY_ID` og `B2_APPLICATION_KEY_ID`
 * ble lest av atten forskjellige moduler — opplasting, lesing, sletting,
 * arkivering, admin-verktøy, helsesjekker. Alle med full tilgang til hele
 * bøtta. Lekket én av dem, lekket alt: en angriper med lesetilgangen til
 * proxy-visningen kunne like gjerne slette originalene fra en innspilling.
 *
 * Rollene her er avgrenset etter hva tjenesten faktisk gjør. Nøkkelen som
 * signerer en preview-URL trenger ikke kunne skrive. Nøkkelen som laster
 * opp trenger ikke kunne slette. Sletting er sin egen rolle fordi den er
 * den eneste som kan ødelegge noe permanent.
 *
 * Avgrensningen skjer HOS BACKBLAZE, ikke her. Denne modulen velger
 * hvilken nøkkel som brukes; kapabilitetene settes når nøkkelen opprettes
 * (b2 create-key --bucket … --namePrefix …). `requiredCapabilities` under
 * er fasiten på hva hver nøkkel skal ha, slik at den som provisjonerer
 * ikke må gjette.
 *
 * HVILKEN BØTTE en operasjon treffer bestemmes IKKE her, men av
 * b2-bucket-registry etter datatype. To steder som velger bøtte ville før
 * eller siden vært uenige.
 *
 * OM FALLBACK: en rolle uten egen nøkkel faller tilbake til
 * plattformnøkkelen, slik at ingenting slutter å virke før nøklene er
 * provisjonert. Det betyr også at sikkerhetsgevinsten uteblir i stillhet.
 * Derfor logger `describeKeyRoles()` hvilke roller som fortsatt ligger på
 * fellesnøkkelen, og `B2_REQUIRE_SCOPED_KEYS=true` gjør fallbacken til en
 * feil i stedet for en stille nedgradering.
 */

/** Hva en tjeneste faktisk trenger å gjøre. */
export type B2KeyRole =
  | "capture-read"
  | "capture-write"
  | "capture-delete"
  | "uploads-read"
  | "uploads-write"
  | "archive"
  | "admin";

/** B2-kapabiliteter, med samme navn som Backblaze bruker. */
export type B2Capability =
  | "listBuckets"
  | "listFiles"
  | "readFiles"
  | "shareFiles"
  | "writeFiles"
  | "deleteFiles";

export interface B2RoleSpec {
  role: B2KeyRole;
  /** Env-leddet: B2_KEY_<envSuffix>_ID / _SECRET / _BUCKET. */
  envSuffix: string;
  /** Hva nøkkelen må ha hos Backblaze. Fasit for provisjonering. */
  requiredCapabilities: B2Capability[];
  /** Én setning om hva rollen brukes til. Vises i diagnosen. */
  purpose: string;
}

export const B2_ROLE_SPECS: Record<B2KeyRole, B2RoleSpec> = {
  "capture-read": {
    role: "capture-read",
    envSuffix: "CAPTURE_READ",
    // shareFiles er det som lar oss signere en GET-URL. Uten writeFiles
    // kan en lekket lesenøkkel ikke plante filer i bøtta.
    requiredCapabilities: ["listFiles", "readFiles", "shareFiles"],
    purpose: "Signerer nedlastings-URL-er for kameramedier og previews.",
  },
  "capture-write": {
    role: "capture-write",
    envSuffix: "CAPTURE_WRITE",
    // Ikke deleteFiles: en opplastingsnøkkel som kan slette er en
    // opplastingsnøkkel som kan slette en hel innspilling.
    requiredCapabilities: ["listFiles", "writeFiles", "shareFiles"],
    purpose: "Multipart-opplasting fra iPad og kamera-app.",
  },
  "capture-delete": {
    role: "capture-delete",
    envSuffix: "CAPTURE_DELETE",
    requiredCapabilities: ["listFiles", "readFiles", "deleteFiles"],
    purpose:
      "Frigjøring av avløste versjoner og opprydding etter retention. " +
      "Egen rolle fordi den er den eneste som kan ødelegge noe permanent.",
  },
  "uploads-read": {
    role: "uploads-read",
    envSuffix: "UPLOADS_READ",
    requiredCapabilities: ["listFiles", "readFiles", "shareFiles"],
    purpose: "Nedlasting av generiske opplastinger (chunked og single-shot).",
  },
  "uploads-write": {
    role: "uploads-write",
    envSuffix: "UPLOADS_WRITE",
    requiredCapabilities: ["listFiles", "writeFiles", "shareFiles"],
    purpose: "Lagring av ferdig assemblede opplastinger.",
  },
  archive: {
    role: "archive",
    envSuffix: "ARCHIVE",
    requiredCapabilities: ["listFiles", "readFiles", "writeFiles", "shareFiles"],
    purpose: "Arkivering av avsluttede produksjoner og selskapsdokumenter.",
  },
  admin: {
    role: "admin",
    envSuffix: "ADMIN",
    requiredCapabilities: [
      "listBuckets",
      "listFiles",
      "readFiles",
      "writeFiles",
      "deleteFiles",
      "shareFiles",
    ],
    purpose:
      "Admin-verktøy: academy-materiell, systembackup, helsesjekker. " +
      "Bred med vilje — men da skal den brukes av admin-flatene alene.",
  },
};

export interface ResolvedB2Key {
  role: B2KeyRole;
  keyId: string;
  applicationKey: string;
  /**
   * True når rollen kjører på plattformens fellesnøkkel fordi den ikke har
   * fått sin egen. Sikkerhetsgevinsten uteblir da — se `describeKeyRoles`.
   */
  usingSharedFallback: boolean;
}

const firstNonEmpty = (...values: (string | undefined)[]): string | undefined => {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
};

/** Plattformens fellesnøkkel — den alt brukte før rollene fantes. */
function sharedPlatformKey(): { keyId?: string; applicationKey?: string } {
  return {
    keyId: firstNonEmpty(
      process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID,
      process.env.B2_APPLICATION_KEY_ID,
    ),
    applicationKey: firstNonEmpty(
      process.env.B2_ROLE_ROOM_APPLICATION_KEY,
      process.env.B2_APPLICATION_KEY,
    ),
  };
}

export class B2KeyMissingError extends Error {
  constructor(
    readonly role: B2KeyRole,
    readonly reason: "no_scoped_key" | "not_configured",
  ) {
    super(
      reason === "no_scoped_key"
        ? `B2-rollen «${role}» mangler egen nøkkel, og B2_REQUIRE_SCOPED_KEYS=true ` +
          `forbyr fallback til fellesnøkkelen. Sett B2_KEY_${B2_ROLE_SPECS[role].envSuffix}_ID ` +
          `og _SECRET.`
        : `B2 er ikke konfigurert for rollen «${role}».`,
    );
    this.name = "B2KeyMissingError";
  }
}

/**
 * Nøkkelen en rolle skal bruke.
 *
 * Returnerer null når verken rollenøkkel eller fellesnøkkel finnes — da er
 * B2 rett og slett ikke satt opp, og kalleren skal falle tilbake på det
 * den ellers gjør (R2, filesystem). Kaster bare når en rollenøkkel MANGLER
 * mens fallback er forbudt; det er en konfigurasjonsfeil noen må rette,
 * ikke en tilstand å jobbe rundt.
 */
export function resolveB2Key(role: B2KeyRole): ResolvedB2Key | null {
  const spec = B2_ROLE_SPECS[role];
  const keyId = firstNonEmpty(process.env[`B2_KEY_${spec.envSuffix}_ID`]);
  const applicationKey = firstNonEmpty(
    process.env[`B2_KEY_${spec.envSuffix}_SECRET`],
  );
  if (keyId && applicationKey) {
    return { role, keyId, applicationKey, usingSharedFallback: false };
  }

  // Halv konfig er verre enn ingen: den ser ut som en avgrenset nøkkel og
  // oppfører seg som fellesnøkkelen. Si fra framfor å blande.
  if (keyId || applicationKey) {
    console.warn(
      `[b2-keys] Rollen «${role}» har bare halve nøkkelen satt ` +
        `(B2_KEY_${spec.envSuffix}_ID/_SECRET). Bruker fellesnøkkelen.`,
    );
  }

  if (process.env.B2_REQUIRE_SCOPED_KEYS === "true") {
    throw new B2KeyMissingError(role, "no_scoped_key");
  }

  const shared = sharedPlatformKey();
  if (!shared.keyId || !shared.applicationKey) return null;
  return {
    role,
    keyId: shared.keyId,
    applicationKey: shared.applicationKey,
    usingSharedFallback: true,
  };
}

export interface B2RoleStatus {
  role: B2KeyRole;
  purpose: string;
  requiredCapabilities: B2Capability[];
  envVars: { id: string; secret: string };
  configured: boolean;
  usingSharedFallback: boolean;
  /** Siste fire tegn av nøkkel-id-en, til å kjenne igjen hvilken som brukes. */
  keyIdSuffix: string | null;
}

/**
 * Hvilke roller som har egen nøkkel og hvilke som fortsatt deler.
 *
 * Aldri hele nøkkel-id-en og aldri hemmeligheten: diagnosen er ment å
 * kunne leses i en logg eller en admin-flate, og en nøkkel-id i en logg er
 * halve lekkasjen.
 */
export function describeKeyRoles(): B2RoleStatus[] {
  return (Object.keys(B2_ROLE_SPECS) as B2KeyRole[]).map((role) => {
    const spec = B2_ROLE_SPECS[role];
    let resolved: ResolvedB2Key | null = null;
    try {
      resolved = resolveB2Key(role);
    } catch {
      // B2_REQUIRE_SCOPED_KEYS er på og rollen mangler nøkkel. Diagnosen
      // skal vise det som «ikke konfigurert», ikke krasje.
      resolved = null;
    }
    return {
      role,
      purpose: spec.purpose,
      requiredCapabilities: spec.requiredCapabilities,
      envVars: {
        id: `B2_KEY_${spec.envSuffix}_ID`,
        secret: `B2_KEY_${spec.envSuffix}_SECRET`,
      },
      configured: resolved !== null,
      usingSharedFallback: resolved?.usingSharedFallback ?? false,
      keyIdSuffix: resolved ? resolved.keyId.slice(-4) : null,
    };
  });
}

/**
 * Logg én linje ved oppstart om hvor mange roller som fortsatt deler
 * fellesnøkkelen.
 *
 * Uten dette er en halvferdig utrulling usynlig: alt virker, og ingen
 * oppdager at seks av sju tjenester fortsatt har full slettetilgang.
 */
export function logKeyRoleStatus(): void {
  const statuses = describeKeyRoles();
  const shared = statuses.filter((s) => s.usingSharedFallback);
  const scoped = statuses.filter((s) => s.configured && !s.usingSharedFallback);

  if (!statuses.some((s) => s.configured)) {
    console.log("[b2-keys] B2 er ikke konfigurert — ingen roller å rapportere.");
    return;
  }
  if (shared.length === 0) {
    console.log(`[b2-keys] Alle ${scoped.length} roller har egen nøkkel.`);
    return;
  }
  console.warn(
    `[b2-keys] ${shared.length} av ${statuses.length} roller deler fortsatt ` +
      `plattformens fellesnøkkel: ${shared.map((s) => s.role).join(", ")}. ` +
      `Hver av dem har dermed full tilgang til hele bøtta.`,
  );
}
