/** Husreglene, som tester.
 *
 *  «UX og UI må være gjennomtenkt, profesjonell, men bestemorvennlig» er ikke
 *  en smakssak, og reglene som følger av den er ikke til forhandling:
 *  brødtekst ikke under 15px, klikkflater minst 44px, ingenting kun ved hover,
 *  ingen sjargong, og kontrast som holder WCAG 2.2 AA.
 *
 *  Kontrastverdiene er regnet ut av CSS-en, ikke skrevet av. Setter noen
 *  `--ink-faint` tilbake til `#7c8683`, feiler denne fila — det er hele
 *  poenget med den. */
import { expect, test } from "vitest";
import stilark from "./styles.css?raw";

/** Reglene, uten kommentarene. Kommentarene her forklarer nettopp de feilene
 *  som er rettet — «Ringen sto før på `outline: none`» — og en test som leser
 *  dem finner feilen i sin egen forklaring. */
const css = stilark.replace(/\/\*[\s\S]*?\*\//g, "");

/** Variablene slik de står i ett tema. `blokk` er teksten mellom to
 *  krøllparenteser, og verdiene leses derfra — så testen leser den samme
 *  kilden nettleseren gjør. */
function variabler(blokk: string): Record<string, string> {
  const ut: Record<string, string> = {};
  for (const m of blokk.matchAll(/(--[^\s:]+):\s*([^;]+);/g)) ut[m[1]] = m[2].trim();
  return ut;
}

function blokk(velger: string): string {
  const i = css.indexOf(velger);
  expect(i, `fant ikke «${velger}» i styles.css`).toBeGreaterThan(-1);
  const start = css.indexOf("{", i);
  const slutt = css.indexOf("\n}", start);
  return css.slice(start, slutt);
}

const lyst = variabler(blokk(":root {"));
const mørkt = variabler(blokk(':root[data-tema="mørkt"] {'));

function kanal(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function lysstyrke(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

/** WCAG 2.2 sin kontrastformel. */
export function kontrast(a: string, b: string): number {
  const [x, y] = [lysstyrke(a), lysstyrke(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test("kontrastformelen stemmer med de kjente ytterpunktene", () => {
  expect(kontrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  expect(kontrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
});

for (const [navn, tema] of [
  ["lyst", lyst],
  ["mørkt", mørkt],
] as const) {
  /** All tekst må holde 4,5:1 mot begge bakgrunnene den kan stå på: `--ground`
   *  bak lista og panelet, `--paper` bak notatet. */
  test(`${navn} tema: all tekstfarge holder 4,5:1 mot begge bakgrunnene`, () => {
    for (const farge of ["--ink", "--ink-soft", "--ink-faint", "--accent"]) {
      for (const bak of ["--ground", "--paper"]) {
        const målt = kontrast(tema[farge], tema[bak]);
        expect(
          målt,
          `${farge} (${tema[farge]}) mot ${bak} (${tema[bak]}) er ${målt.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  /** Merkene i panelet. Kommentaren i CSS-en lovte «minst 6:1» og leverte
   *  5,35 — kravet er 4,5, så det var greit, men et løfte som ikke stemmer
   *  blir brukt som dekning senere. Testen måler det som gjelder. */
  test(`${navn} tema: merkefargene holder 4,5:1 mot panelbakgrunnen`, () => {
    for (const merke of [
      "--merke-forstått",
      "--merke-uavklart",
      "--merke-oppgave",
      "--merke-idé",
      "--merke-motsier",
    ]) {
      const målt = kontrast(tema[merke], tema["--ground"]);
      expect(målt, `${merke} er ${målt.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /** WCAG 1.4.11: kanten som identifiserer en kontroll må holde 3:1. `--rule`
   *  ga 1,18–1,37 og ble brukt både som strek og som knappekant; derfor
   *  finnes `--kant`, og derfor er det den som står rundt kontrollene. */
  test(`${navn} tema: kanten rundt en kontroll holder 3:1`, () => {
    for (const bak of ["--ground", "--paper"]) {
      const målt = kontrast(tema["--kant"], tema[bak]);
      expect(målt, `--kant mot ${bak} er ${målt.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
}

test("ingen skriftstørrelse er under 15px, og ingen er i px", () => {
  const funn = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  expect(funn.length).toBeGreaterThan(20);
  for (const verdi of funn) {
    expect(verdi, `«font-size: ${verdi}» er ikke i rem`).toMatch(/rem$|^100%$|^inherit$/);
    const rem = Number.parseFloat(verdi);
    if (!Number.isNaN(rem) && verdi.endsWith("rem")) {
      expect(rem * 16, `${verdi} er ${rem * 16}px`).toBeGreaterThanOrEqual(15);
    }
  }
});

test("ingen kontroll slår av fokusmarkeringen", () => {
  // `.søk input` og `.rettefelt input` sto på `outline: none`, og det vant
  // over `:focus-visible` på spesifisitet. Da bæres fokus av farge alene.
  expect(css).not.toMatch(/outline:\s*none/);
  expect(css).not.toMatch(/outline:\s*0[^.]/);
});

test("ingen tekst tynnes ut av font-smoothing", () => {
  // `-webkit-font-smoothing: antialiased` er en smakspreferanse, og den senker
  // lesbarheten for svaksynte på macOS.
  expect(css).not.toContain("font-smoothing");
});

test("spaltene stables i et smalt vindu", () => {
  // WCAG 1.4.10: innholdet skal kunne brukes ved 320px bredde, som er det
  // 1280px ved 400 % zoom gir. Tre faste spalter tålte ikke engang 200 %.
  expect(css).toMatch(/@media \(max-width: 900px\)/);
  const smalt = blokk("@media (max-width: 900px)");
  expect(smalt).toContain("display: block");
});

test("systemets høykontrastmodus har sitt eget svar", () => {
  // Alle flater er `color-mix(…, transparent)` og alle skiller er 1px
  // `--rule`. I macOS «Øk kontrast» forsvinner begge deler uten erstatning.
  expect(css).toMatch(/@media \(forced-colors: active\)/);
});
