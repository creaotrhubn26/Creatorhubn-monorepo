/**
 * b2-bucket-registry.ts
 *
 * Én bøtte per datatype, i stedet for én bøtte til alt.
 *
 * Hvorfor dele opp: originaler, proxyer og leveranser har ulik levetid,
 * ulikt tilgangsmønster og ulikt behov for beskyttelse. Ligger de i samme
 * bøtte, må enhver nøkkel som skal lese en proxy også kunne nå
 * kameramasterne, og enhver livssyklusregel som rydder midlertidige
 * renders må skrives så forsiktig at den ikke rører noe uopprettelig.
 *
 * Hva det IKKE gir: lavere pris. B2 har ingen lagringsklasser — ingen
 * Glacier, ingen infrequent access. `trr-prod-archive` koster nøyaktig
 * det samme per GB som `trr-prod-originals`. På AWS er «skill ut arkivet»
 * et kostnadsgrep; på B2 er det et tilgangs- og livssyklusgrep. Arkivering
 * sparer først penger når noe faktisk slettes.
 *
 * ── Hvordan en bar nøkkel finner riktig bøtte ──────────────────────────
 *
 * Lesestiene har ofte bare nøkkelen — den kommer rett ut av en SQL-rad og
 * går videre til `signAssetReadUrl(key)` fra rundt 40 kallsteder. Med én
 * bøtte holdt det. Med flere gjør det ikke det: samme nøkkel kunne ligget
 * i hvilken som helst av dem.
 *
 * Derfor bærer nøkkelen klassen sin, som et reservert ledd rett etter
 * lager-prefikset:
 *
 *   capture-b2/_originals/{eier}/{sesjon}/{asset}/full/v1/A001.mov
 *   capture-b2/_proxies/{eier}/{sesjon}/{asset}/preview/v1/A001.jpg
 *   capture-b2/{eier}/…            ← skrevet før splitten, felles bøtte
 *   capture/{eier}/…               ← R2, uendret
 *
 * Understreken er det som gjør leddet entydig. Uten den ville en bruker
 * med id-en «originals» fått filene sine rutet til feil bøtte — og gamle
 * nøkler, som har bruker-id-en nettopp i den posisjonen, kunne truffet en
 * klasse ved et uhell.
 *
 * Gamle nøkler mangler leddet og faller tilbake til fellesbøtta. Det er
 * det som gjør splitten trygg uten å kopiere noe: nye filer skrives til
 * riktig bøtte, gamle blir liggende og leses fra der de faktisk er.
 */

/** Hva slags data en bøtte inneholder. */
export type StorageClass =
  | "originals"
  | "proxies"
  | "working"
  | "deliverables"
  | "archive"
  | "uploads";

export interface StorageClassSpec {
  storageClass: StorageClass;
  /** Env-leddet: B2_BUCKET_<envSuffix>. */
  envSuffix: string;
  /** Foreslått bøttenavn. Ikke bindende — env vinner. */
  suggestedBucket: string;
  /** Det reserverte nøkkelleddet, inkludert understrek og skråstrek. */
  keyMarker: string;
  purpose: string;
  /**
   * Bør objektene her være uforanderlige etter opplasting?
   * Rådgivende — Object Lock settes hos Backblaze, ikke her. Feltet finnes
   * så beslutningen står ett sted og ikke må gjenskapes fra hukommelsen.
   */
  immutable: boolean;
}

export const STORAGE_CLASSES: Record<StorageClass, StorageClassSpec> = {
  originals: {
    storageClass: "originals",
    envSuffix: "ORIGINALS",
    suggestedBucket: "trr-prod-originals",
    keyMarker: "_originals/",
    purpose: "Kamerafiler, lydopptak, RAW. Masterne som ikke kan gjenskapes.",
    immutable: true,
  },
  proxies: {
    storageClass: "proxies",
    envSuffix: "PROXIES",
    suggestedBucket: "trr-prod-proxies",
    keyMarker: "_proxies/",
    purpose:
      "Previews, thumbnails, review-proxyer. Alt her kan genereres på nytt " +
      "fra originalen, så det er trygt å rydde aggressivt.",
    immutable: false,
  },
  working: {
    storageClass: "working",
    envSuffix: "WORKING",
    suggestedBucket: "trr-prod-working",
    keyMarker: "_working/",
    purpose:
      "Arbeidsfiler: timelines, dansevideo, koreografimusikk, " +
      "referansearkiv, midlertidige renders.",
    immutable: false,
  },
  deliverables: {
    storageClass: "deliverables",
    envSuffix: "DELIVERABLES",
    suggestedBucket: "trr-prod-deliverables",
    keyMarker: "_deliverables/",
    purpose:
      "Godkjente leveranser til kunde. Dokumenterer hva kunden faktisk " +
      "mottok, og skal derfor ikke skrives over.",
    immutable: true,
  },
  archive: {
    storageClass: "archive",
    envSuffix: "ARCHIVE",
    suggestedBucket: "trr-prod-archive",
    keyMarker: "_archive/",
    purpose: "Avsluttede produksjoner med lengre oppbevaringsfrist.",
    immutable: true,
  },
  uploads: {
    storageClass: "uploads",
    envSuffix: "UPLOADS",
    suggestedBucket: "trr-prod-uploads",
    keyMarker: "_uploads/",
    purpose:
      "Generiske opplastinger (chunked og single-shot) som ikke hører til " +
      "en produksjon.",
    immutable: false,
  },
};

const ALL_CLASSES = Object.keys(STORAGE_CLASSES) as StorageClass[];

const firstNonEmpty = (...values: (string | undefined)[]): string | undefined => {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
};

/** Bøtta alt lå i før splitten. Fallback for hver klasse som ikke har egen. */
export function sharedBucket(): string | undefined {
  return firstNonEmpty(
    process.env.B2_ROLE_ROOM_BUCKET_NAME,
    process.env.B2_BUCKET_NAME,
  );
}

export interface ResolvedBucket {
  bucket: string;
  storageClass: StorageClass | null;
  /**
   * True når klassen ikke har egen bøtte og bruker fellesbøtta. Splitten
   * er da ikke gjennomført for denne klassen.
   */
  usingSharedFallback: boolean;
}

/**
 * Bøtta en klasse skal skrives til.
 *
 * Returnerer null når B2 ikke er konfigurert i det hele tatt — da faller
 * kalleren tilbake på R2 eller filesystem, som før.
 */
export function bucketForClass(storageClass: StorageClass): ResolvedBucket | null {
  const spec = STORAGE_CLASSES[storageClass];
  const own = firstNonEmpty(process.env[`B2_BUCKET_${spec.envSuffix}`]);
  if (own) {
    return { bucket: own, storageClass, usingSharedFallback: false };
  }
  const shared = sharedBucket();
  if (!shared) return null;
  return { bucket: shared, storageClass, usingSharedFallback: true };
}

/**
 * Klassen en nøkkel tilhører, lest av det reserverte leddet.
 *
 * `keyWithoutStorePrefix` er nøkkelen MINUS lager-prefikset
 * (`capture-b2/`), fordi det er der klasseleddet står. Å sende inn hele
 * nøkkelen ville aldri gitt treff.
 *
 * Null betyr «skrevet før splitten» — ikke en feil, bare en nøkkel som
 * hører hjemme i fellesbøtta.
 */
export function classForKeySegment(
  keyWithoutStorePrefix: string,
): StorageClass | null {
  for (const cls of ALL_CLASSES) {
    if (keyWithoutStorePrefix.startsWith(STORAGE_CLASSES[cls].keyMarker)) {
      return cls;
    }
  }
  return null;
}

/**
 * Bøtta en gitt nøkkel ligger i.
 *
 * Nøkkelen uten klasseledd betyr fellesbøtta — det er nettopp derfor
 * eksisterende filer fortsatt kan leses etter splitten.
 */
export function bucketForKey(
  keyWithoutStorePrefix: string,
): ResolvedBucket | null {
  const cls = classForKeySegment(keyWithoutStorePrefix);
  if (!cls) {
    const shared = sharedBucket();
    if (!shared) return null;
    return { bucket: shared, storageClass: null, usingSharedFallback: true };
  }
  return bucketForClass(cls);
}

/** Klasseleddet nye nøkler skal skrives under. */
export function keyMarkerFor(storageClass: StorageClass): string {
  return STORAGE_CLASSES[storageClass].keyMarker;
}

export interface BucketStatus {
  storageClass: StorageClass;
  purpose: string;
  immutable: boolean;
  envVar: string;
  suggestedBucket: string;
  bucket: string | null;
  usingSharedFallback: boolean;
}

/** Hvilke klasser som har egen bøtte og hvilke som fortsatt deler. */
export function describeBuckets(): BucketStatus[] {
  return ALL_CLASSES.map((cls) => {
    const spec = STORAGE_CLASSES[cls];
    const resolved = bucketForClass(cls);
    return {
      storageClass: cls,
      purpose: spec.purpose,
      immutable: spec.immutable,
      envVar: `B2_BUCKET_${spec.envSuffix}`,
      suggestedBucket: spec.suggestedBucket,
      bucket: resolved?.bucket ?? null,
      usingSharedFallback: resolved?.usingSharedFallback ?? false,
    };
  });
}

/**
 * Én linje ved oppstart om hvor langt bøtte-splitten er kommet.
 *
 * Samme grunn som for nøklene: en halvferdig utrulling er usynlig uten
 * den. Alt virker, og ingen oppdager at kameramasterne fortsatt ligger i
 * samme bøtte som thumbnailene.
 */
export function logBucketStatus(): void {
  const statuses = describeBuckets();
  const configured = statuses.filter((s) => s.bucket !== null);
  if (configured.length === 0) {
    console.log("[b2-buckets] B2 er ikke konfigurert — ingen bøtter å rapportere.");
    return;
  }
  const shared = configured.filter((s) => s.usingSharedFallback);
  if (shared.length === 0) {
    console.log(`[b2-buckets] Alle ${configured.length} klasser har egen bøtte.`);
    return;
  }
  console.warn(
    `[b2-buckets] ${shared.length} av ${statuses.length} klasser deler ` +
      `fortsatt fellesbøtta: ${shared.map((s) => s.storageClass).join(", ")}.`,
  );
}
