/**
 * E-post-designsystemet.
 *
 * Det som testes er koblingen som ikke feiler høylytt: Creatorhub-e-poster
 * lages ved å rendre Role Rooms HTML og BYTTE fargene etterpå. Fargene er
 * altså data, ikke stil. Endres paletten uten at bytte-listen endres, slutter
 * erstatningene å treffe — og Creatorhub-e-poster går ut i Role Rooms farger
 * uten at noen test blir rød og uten at noen oppdager det før en kunde ser en
 * indigo e-post fra feil merke.
 */

import { describe, expect, it } from "vitest";

import { composeEmail, emailPalette } from "./email-design-system.js";

const args = {
  category: "general" as const,
  preheader: "Test",
  headline: "Overskrift",
  subhead: "Underoverskrift",
  body: "En kort brødtekst.",
  cta: { label: "Åpne", href: "https://theroleroom.com/talents" },
  table: [{ label: "Rolle", value: "Nora" }],
};

/** Hex-verdiene i paletten, uten duplikater. */
const paletteHexes = [...new Set(Object.values(emailPalette).filter((v) => /^#[0-9a-f]{6}$/i.test(v)))];

describe("Role Room-e-post", () => {
  it("bruker palettens farger", () => {
    const { html } = composeEmail({ ...args, brand: "roleroom" });
    expect(html).toContain(emailPalette.accent);
    expect(html).toContain(emailPalette.bgOuter);
  });

  it("inneholder ingen farger fra den gamle lilla paletten", () => {
    const { html } = composeEmail({ ...args, brand: "roleroom" });
    for (const gammel of ["#a855f7", "#c084fc", "#7c3aed", "#d946ef", "#0a0118", "#150b2e", "#f5f3ff", "#c4b5fd"]) {
      expect(html.toLowerCase(), `gammel farge igjen: ${gammel}`).not.toContain(gammel);
    }
  });
});

describe("Creatorhub-e-post", () => {
  it("har byttet ut ALLE palettfarger — ellers lekker Role Rooms merke inn", () => {
    const { html } = composeEmail({ ...args, brand: "creatorhub" });
    const igjen = paletteHexes.filter((hex) => html.toLowerCase().includes(hex.toLowerCase()));

    // Status-fargene (grønn/gul/rød) er felles for begge merkene og byttes
    // ikke — de er tilstand, ikke merkevare.
    const forventetFelles = [emailPalette.success, emailPalette.warning, emailPalette.danger]
      .map((c) => c.toLowerCase());
    const lekkasje = igjen.filter((h) => !forventetFelles.includes(h.toLowerCase()));

    expect(lekkasje, `Role Room-farger i Creatorhub-e-post: ${lekkasje.join(", ")}`).toEqual([]);
  });

  it("bruker Creatorhubs oransje aksent", () => {
    const { html } = composeEmail({ ...args, brand: "creatorhub" });
    expect(html.toLowerCase()).toContain("#ff8c00");
  });

  it("bytter også rgba-tripler, ikke bare hex", () => {
    const { html } = composeEmail({ ...args, brand: "creatorhub" });
    // Kantene er rgba. Glemmes de, står Role Rooms indigo igjen i rammene
    // rundt en ellers oransje e-post.
    expect(html).not.toMatch(/rgba\(\s*98\s*,\s*73\s*,\s*223/i);
  });
});
