/** Lyst eller mørkt, uavhengig av hva maskinen mener. Valget er brukerens:
 *  noen vil ha lyst tema om kvelden, og noen ser rett og slett bedre på lys
 *  bakgrunn. Standard er å følge systemet, som er det appen gjorde før. */
export type Tema = "system" | "lyst" | "mørkt";

const NØKKEL = "tema";

export const TEMAER: { verdi: Tema; navn: string }[] = [
  { verdi: "system", navn: "Følg systemet" },
  { verdi: "lyst", navn: "Alltid lyst" },
  { verdi: "mørkt", navn: "Alltid mørkt" },
];

type Lager = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Rot = { dataset: { tema?: string } };

/** Det som ble valgt sist. Er det ingenting lagret, følger vi systemet. */
export function lesTema(lager: Lager = localStorage): Tema {
  const lagret = lager.getItem(NØKKEL);
  return lagret === "lyst" || lagret === "mørkt" ? lagret : "system";
}

/** Setter temaet og husker det. «System» fjerner merket, slik at CSS-en
 *  faller tilbake på maskinens innstilling helt av seg selv. */
export function settTema(
  valg: Tema,
  rot: Rot = document.documentElement,
  lager: Lager = localStorage,
): Tema {
  if (valg === "system") {
    delete rot.dataset.tema;
    lager.removeItem(NØKKEL);
  } else {
    rot.dataset.tema = valg;
    lager.setItem(NØKKEL, valg);
  }
  return valg;
}
