/**
 * Hva scenene på en opptaksdag krever av rekvisitter.
 *
 * Koblingen rekvisitt → scene har ligget i modellen hele tiden
 * (`Prop.assignedScenes`), og rekvisittpanelet målte den allerede: «klar»
 * krever at rekvisitten har minst én scene. Ingenting kunne sette den, så
 * tallet var null uansett.
 *
 * Når scenen er satt på både dagen og rekvisitten, følger behovet av seg selv:
 * dagen skyter scene 9 og 10, Geiger-telleren hører til scene 10, altså skal
 * den være med. Det er hele produksjonsdesignerens første spørsmål, og det
 * trenger ingen ny tabell.
 */

export interface ScenedProp {
  readonly id: string;
  readonly name?: string;
  readonly assignedScenes?: readonly string[];
}

export interface PropNeed {
  readonly id: string;
  readonly name: string;
  /** Scenene på denne dagen som krever rekvisitten. */
  readonly sceneIds: readonly string[];
  /** Står den allerede på dagen? */
  readonly onDay: boolean;
}

export interface DayPropNeeds {
  /** Alt scenene krever, enten det står på dagen eller ikke. */
  readonly needed: PropNeed[];
  /** Det scenene krever som dagen mangler. */
  readonly missing: PropNeed[];
  /** Står på dagen uten at noen av dagens scener krever det. */
  readonly extra: PropNeed[];
}

/**
 * Behovet for én dag. Rekkefølgen følger rekvisittnavnet, så listen leses likt
 * hver gang.
 */
export function propsNeededForDay(
  dayScenes: readonly string[],
  dayProps: readonly string[],
  props: readonly ScenedProp[],
): DayPropNeeds {
  const scener = new Set(dayScenes.map(String));
  const påDagen = new Set(dayProps.map(String));

  const needed: PropNeed[] = [];
  const extra: PropNeed[] = [];

  for (const prop of props) {
    const id = String(prop.id ?? '');
    if (!id) continue;
    const propScener = (prop.assignedScenes ?? []).map(String);
    const treff = propScener.filter((sceneId) => scener.has(sceneId));
    const oppføring: PropNeed = {
      id,
      name: prop.name?.trim() || id,
      sceneIds: treff,
      onDay: påDagen.has(id),
    };
    if (treff.length > 0) needed.push(oppføring);
    else if (oppføring.onDay) extra.push(oppføring);
  }

  const etterNavn = (a: PropNeed, b: PropNeed) => a.name.localeCompare(b.name, 'nb');
  needed.sort(etterNavn);
  extra.sort(etterNavn);

  return { needed, missing: needed.filter((item) => !item.onDay), extra };
}
