/**
 * Delt LinkedIn OAuth-klientkonfig for Role Room-tilkoblingen og
 * LinkedIn-innloggingen. Begge bruker samme LinkedIn-app og samme
 * registrerte callback-URL (/api/auth/linkedin/callback); forwarderen i
 * index.ts ruter på state-prefiks.
 */

type EnvLike = Readonly<Record<string, string | undefined>>;

type RequestLike = {
  get(name: string): string | undefined;
  headers: Record<string, unknown>;
  protocol?: string;
};

function readStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface LinkedInOauthClient {
  clientId: string | null;
  clientSecret: string | null;
  complete: boolean;
}

/**
 * Hvilket produkt innloggingen gjelder.
 *
 * Rutene skiller i dag på «web» og «ios» — altså ENHET, ikke produkt. Men
 * det er produktet som avgjør hvilken LinkedIn-app som skal brukes, fordi
 * samtykkeskjermen viser appens navn og logo. Logger en Leadgrid-selger inn
 * gjennom Role Room sin app, blir han bedt om tilgang av et produkt han
 * ikke bruker.
 */
export type LinkedInProdukt = "leadgrid" | "roleroom";

export function resolveLinkedInOauthClient(
  produkt: LinkedInProdukt = "roleroom",
  env: EnvLike = process.env,
): LinkedInOauthClient {
  // Nøklene velges PARVIS, ikke felt for felt.
  //
  // Første forsøk lot id og hemmelighet falle tilbake hver for seg. Da kan
  // man ende med id fra Leadgrid-appen og hemmelighet fra Role Room-appen —
  // LinkedIn avviser utvekslingen, og feilmeldingen sier ingenting om
  // hvorfor. Min egen test fanget det.
  //
  // Rekkefølgen: produktets egen app, så den delte, så den andres. Det
  // siste leddet er stygt og står der med vilje: et miljø som bare har
  // ROLE_ROOM_*-nøklene hadde fungerende innlogging før denne endringen.
  // Feil merkenavn på samtykkeskjermen er dårlig. Ingen innlogging er verre.
  const kjeder: ReadonlyArray<readonly [string | undefined, string | undefined]> =
    produkt === "leadgrid"
      ? [
          [env.LEADGRID_LINKEDIN_CLIENT_ID, env.LEADGRID_LINKEDIN_CLIENT_SECRET],
          [env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET],
          [env.ROLE_ROOM_LINKEDIN_CLIENT_ID, env.ROLE_ROOM_LINKEDIN_CLIENT_SECRET],
        ]
      : [
          [env.ROLE_ROOM_LINKEDIN_CLIENT_ID, env.ROLE_ROOM_LINKEDIN_CLIENT_SECRET],
          [env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET],
        ];

  let clientId: string | null = null;
  let clientSecret: string | null = null;
  for (const [id, hemmelighet] of kjeder) {
    const i = readStringValue(id);
    const h = readStringValue(hemmelighet);
    if (i && h) { clientId = i; clientSecret = h; break; }
    // Et halvt konfigurert ledd skal rapporteres som ufullstendig, ikke
    // lappes med biter fra neste app.
    if (i || h) { clientId = i; clientSecret = h; break; }
  }

  return { clientId, clientSecret, complete: Boolean(clientId && clientSecret) };
}

/**
 * Callback-URL-en som er registrert hos LinkedIn. Konfigurert verdi vinner;
 * ellers utledes den fra forespørselens host (bak proxy: x-forwarded-proto).
 */
export function resolveLinkedInRedirectUri(
  req?: RequestLike | null,
  env: EnvLike = process.env,
): string | null {
  const configured = readStringValue(env.ROLE_ROOM_LINKEDIN_REDIRECT_URI);
  if (configured) return configured;
  if (!req) return null;
  const host = req.get("host");
  if (!host) return null;
  const forwardedProto = readStringValue(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto ?? req.protocol ?? "http";
  // Stien må matche ruta som faktisk finnes. Fallbacken bygget
  // «/api/auth/linkedin/callback», mens linkedin-login-routes.ts
  // registrerer «/api/auth/linkedin/login-callback». Resultatet var at
  // LinkedIn avviste adressen som uregistrert — og hadde den blitt
  // registrert, ville den truffet 404.
  return `${protocol}://${host}/api/auth/linkedin/login-callback`;
}
