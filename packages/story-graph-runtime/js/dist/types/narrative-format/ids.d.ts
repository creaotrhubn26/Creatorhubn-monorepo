/**
 * Id-håndtering mellom våre prefiksede ider (`nel_<uuid>`) og Arcweave.
 *
 * Eksport: prefikset strippes (Arcweave-plugins forventer uuid-lignende ider);
 * ved kollisjon på tvers av samlinger beholdes hele originalen — eksporten er
 * deterministisk for samme graf. Import: nye prefiksede ider fra en
 * injiserbar fabrikk (deterministisk i tester).
 */
export declare const ID_PREFIXES: {
    readonly board: "nbd";
    readonly element: "nel";
    readonly connection: "ncn";
    readonly component: "ncp";
    readonly attribute: "nat";
    readonly variable: "nvr";
    readonly asset: "nas";
    readonly condition: "cond";
};
export type IdKind = keyof typeof ID_PREFIXES;
export interface IdMapper {
    /** Stabil eksport-id for en intern id. */
    map: (internalId: string) => string;
    /** Alle registrerte mappinger (intern → eksport). */
    entries: () => Array<[string, string]>;
}
export declare function createExportIdMapper(): IdMapper;
/**
 * Id-fabrikk. `sourceId` er kildens id (f.eks. Arcweave-id) når importen kjenner den,
 * så en fabrikk kan velge å bevare den (runtime-pakken gjør det).
 */
export type IdFactory = (kind: IdKind, sourceId?: string) => string;
export declare const defaultIdFactory: IdFactory;
/** Deterministisk fabrikk for tester/snapshots. */
export declare function createSequentialIdFactory(): IdFactory;
/** Deterministisk mappe-id fra sti (eksport av mappetrær). */
export declare function folderIdForPath(path: string, used: Set<string>): string;
