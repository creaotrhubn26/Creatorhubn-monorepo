/**
 * fitRect.ts
 *
 * Ren geometri-matematikk for å plassere en video (eller et bilde) inn i
 * et mål-rektangel — nøyaktig som CSS `object-fit: cover | contain`.
 *
 * Dette er kjernen i "auto-justerer seg": uansett kildens størrelse/forhold
 * regner vi ut hvilket draw-rektangel som fyller (cover) eller passer inni
 * (contain) skjerm-området til en device-mockup.
 *
 * Funksjonene er bevisst rene (ingen DOM/canvas) slik at de kan unit-testes
 * uten nettleser.
 */

export type FitMode = 'cover' | 'contain';

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hvor video-tracken skal tegnes i mål-rektangelet.
 *
 * - `cover`: skaler opp til hele målet dekkes; kildens overskytende kanter
 *   beskjæres (sentrert). Dette er default for device-mockups — vi vil ikke
 *   ha svarte striper inne på "skjermen".
 * - `contain`: skaler ned slik at hele kilden synes; mål-rektangelet kan få
 *   tomme felter (letterbox) langs én akse.
 *
 * Returnerer et draw-rektangel i samme koordinatsystem som `target`. Ved
 * `cover` kan x/y bli negative og bredde/høyde større enn målet — det er
 * meningen; caller klipper til skjerm-området før tegning.
 */
export function fitRect(source: Size, target: Rect, mode: FitMode = 'cover'): Rect {
  // Degenererte input → fall tilbake til mål-rektangelet uendret, så vi
  // aldri produserer NaN/Infinity nedstrøms.
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    target.width <= 0 ||
    target.height <= 0
  ) {
    return { x: target.x, y: target.y, width: target.width, height: target.height };
  }

  const sourceRatio = source.width / source.height;
  const targetRatio = target.width / target.height;

  let drawWidth: number;
  let drawHeight: number;

  // Avgjør hvilken akse som "binder". cover og contain er speilvendte:
  // der cover fyller, lar contain den andre aksen flyte.
  const sourceIsWider = sourceRatio > targetRatio;
  const fillByWidth = mode === 'cover' ? !sourceIsWider : sourceIsWider;

  if (fillByWidth) {
    drawWidth = target.width;
    drawHeight = target.width / sourceRatio;
  } else {
    drawHeight = target.height;
    drawWidth = target.height * sourceRatio;
  }

  // Sentrer draw-rektangelet i målet.
  const x = target.x + (target.width - drawWidth) / 2;
  const y = target.y + (target.height - drawHeight) / 2;

  return { x, y, width: drawWidth, height: drawHeight };
}

/**
 * Sentrer en boks med gitt størrelse inni en container — brukes til å
 * plassere selve enheten midt i et "social post"-lerret med padding.
 */
export function centerWithin(container: Size, box: Size): Rect {
  return {
    x: (container.width - box.width) / 2,
    y: (container.height - box.height) / 2,
    width: box.width,
    height: box.height,
  };
}

/**
 * Skaler en størrelse slik at den passer inni `bounds` uten å endre
 * forholdet (contain-skalering). Returnerer skalafaktoren (≤ maxScale).
 * Brukes til å plassere en device-mockup i et lerret med marg.
 */
export function scaleToFit(box: Size, bounds: Size, maxScale = Infinity): number {
  if (box.width <= 0 || box.height <= 0) return 1;
  const s = Math.min(bounds.width / box.width, bounds.height / box.height);
  return Math.min(s, maxScale);
}
