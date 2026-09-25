/**
 * Innvendinger som lærer av samtalene som faktisk ble vunnet.
 *
 * Pondus har i dag statiske par: innvending → svar, skrevet av den som lagde
 * malen. Svaret er like godt den dagen det skrives og fem år senere — altså
 * dårligere, fordi markedet flytter seg.
 *
 * Leadbook har noe malen ikke har: ekte samtaler med utfall. Et eksempel som
 * er `won` og nevner «Veeva» i `alternative_phrasings` er et svar noen faktisk
 * brukte og vant med. Det slår et svar jeg fant på.
 *
 * Så: samme innvending, men svaret hentes fra det som virket sist.
 *
 * Fallback er viktig og ikke en detalj. Med null vunne samtaler — der Leadgrid
 * står i dag — skal selgeren få malens eget svar, ikke et tomt felt. Systemet
 * blir bedre etter hvert som det brukes, og er brukbart før det.
 */
import type { Pool } from "pg";

export interface InnvendingSvar {
  /** Svaret selgeren skal bruke. */
  svar: string;
  /** «mal» = skrevet på forhånd. «erfaring» = hentet fra en vunnet samtale. */
  kilde: "mal" | "erfaring";
  /** Hvor mange vunne samtaler svaret hviler på. 0 for maler. */
  grunnlag: number;
  /** Eksempelet svaret kom fra, så selgeren kan lese hele samtalen. */
  eksempelId?: string;
  eksempelTittel?: string;
}

/** Ord som ikke skiller to innvendinger fra hverandre. */
const STOPPORD = new Set([
  "vi", "har", "er", "det", "en", "et", "og", "i", "på", "for", "med",
  "som", "til", "av", "ikke", "de", "den", "om", "at", "kan", "vår", "våre",
]);

/** Ordene i en innvending som er verdt å lete etter. */
export function nøkkelord(tekst: string): string[] {
  return [...new Set(
    (tekst ?? "")
      .toLocaleLowerCase("nb-NO")
      .split(/[^a-zA-ZæøåÆØÅ0-9]+/)
      .filter((o) => o.length >= 3 && !STOPPORD.has(o)),
  )];
}

/**
 * Henter svar på én innvending, rangert etter hva som har virket.
 *
 * Feiler oppslaget, returneres malsvaret. En treg eller nede database skal
 * ikke ta fra selgeren manuset midt i en samtale.
 */
export async function svarPåInnvending(
  pool: Pool,
  input: {
    organizationId: string;
    projectId?: string | null;
    innvending: string;
    malsvar: string;
    /** Bare samtaler i samme kanal — telefon lærer ikke av e-post. */
    kanal?: string | null;
  },
): Promise<InnvendingSvar> {
  const fallback: InnvendingSvar = {
    svar: input.malsvar,
    kilde: "mal",
    grunnlag: 0,
  };
  const ord = nøkkelord(input.innvending);
  if (ord.length === 0) return fallback;

  try {
    // Leter i formuleringene og lærdommene fra VUNNE samtaler. Tapte
    // samtaler er også data, men ikke et svar man skal gjenta.
    const rader = await pool.query<{
      id: string;
      title: string;
      alternative_phrasings: unknown;
      key_learnings: unknown;
      treff: number;
    }>(
      `SELECT id::text, title, alternative_phrasings, key_learnings,
              (SELECT count(*) FROM unnest($3::text[]) o
                WHERE lower(alternative_phrasings::text) LIKE '%' || o || '%'
                   OR lower(key_learnings::text) LIKE '%' || o || '%'
                   OR lower(summary) LIKE '%' || o || '%') AS treff
         FROM leadbook_examples
        WHERE organization_id = $1::uuid
          AND status = 'published'
          AND outcome = 'won'
          AND ($2::text IS NULL OR channel = $2)
          AND ($4::text IS NULL OR project_id = $4)
        ORDER BY treff DESC, updated_at DESC
        LIMIT 5`,
      [input.organizationId, input.kanal ?? null, ord, input.projectId ?? null],
    );

    const beste = rader.rows.filter((r) => Number(r.treff) > 0);
    if (beste.length === 0) return fallback;

    // Formuleringen fra det beste treffet som selv nevner innvendingen.
    const formuleringer = Array.isArray(beste[0].alternative_phrasings)
      ? (beste[0].alternative_phrasings as unknown[]).map(String)
      : [];
    const truffet = formuleringer.find((f) =>
      ord.some((o) => f.toLocaleLowerCase("nb-NO").includes(o)),
    );
    if (!truffet) return fallback;

    return {
      svar: truffet,
      kilde: "erfaring",
      grunnlag: beste.length,
      eksempelId: beste[0].id,
      eksempelTittel: beste[0].title,
    };
  } catch (error) {
    console.warn("[pondus] innvendingsoppslag feilet:", (error as Error).message);
    return fallback;
  }
}

/** Kjører hele innvendingslisten i malen mot erfaringen. */
export async function berikInnvendinger(
  pool: Pool,
  input: {
    organizationId: string;
    projectId?: string | null;
    kanal?: string | null;
    innvendinger: Array<{ id: string; prompt: string; response: string }>;
  },
): Promise<Array<{ id: string; prompt: string } & InnvendingSvar>> {
  return Promise.all(
    input.innvendinger.map(async (i) => ({
      id: i.id,
      prompt: i.prompt,
      ...(await svarPåInnvending(pool, {
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        kanal: input.kanal ?? null,
        innvending: i.prompt,
        malsvar: i.response,
      })),
    })),
  );
}
