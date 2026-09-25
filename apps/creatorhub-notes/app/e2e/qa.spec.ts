/** Det som bare kan måles i en rendering.
 *
 *  Alle sju feilene disse testene låser ble funnet med øynene i et ekte
 *  nettleservindu, ikke lest ut av koden — og ingen av dem ville blitt fanget
 *  av en test som leser CSS-kilden. De står her i samme rekkefølge som de ble
 *  rettet. */
import { expect, test, type Page } from "@playwright/test";

const SIDE = "/e2e/qa.html";

/** Kontrasten slik nettleseren faktisk tegner den: tekstfargen mot flaten den
 *  står på, sammensatt av alle lagene over bakgrunnen.
 *
 *  `color-mix(…, transparent)` kommer ut av `getComputedStyle` som
 *  `color(srgb …)` med kanaler i 0–1, ikke 0–255. Den forskjellen er hele
 *  grunnen til at feilen fantes: variabelen holdt 4,51:1, flaten den sto på
 *  gjorde det ikke.
 *
 *  Installeres på `window` før hver sidelast, så hver måling er ett kall. */
const MÅLER = () => {
  const tall = (s: string) => {
    const n = (s.match(/[\d.]+/g) ?? []).map(Number);
    const a = n[3] === undefined ? 1 : n[3];
    return s.startsWith("color(") ? [n[0] * 255, n[1] * 255, n[2] * 255, a] : [n[0], n[1], n[2], a];
  };
  const kanal = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lys = (f: number[]) => 0.2126 * kanal(f[0]) + 0.7152 * kanal(f[1]) + 0.0722 * kanal(f[2]);
  const bak = (el: Element | null): number[] => {
    for (let e = el; e; e = e.parentElement) {
      const p = tall(getComputedStyle(e).backgroundColor);
      if (p[3] === 1) return p;
      if (p[3] > 0) {
        const under = bak(e.parentElement);
        return [0, 1, 2].map((i) => p[i] * p[3] + under[i] * (1 - p[3]));
      }
    }
    return [255, 255, 255];
  };
  (window as unknown as { kontrasten: (el: Element) => number }).kontrasten = (el) => {
    const [x, y] = [lys(tall(getComputedStyle(el).color)), lys(bak(el))].sort((a, b) => b - a);
    return (x + 0.05) / (y + 0.05);
  };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(MÅLER);
});

/** Første notat åpnet, med lesningen på: det er den tilstanden appen står i. */
async function åpneNotat(side: Page, tema: "lyst" | "mørkt" = "lyst") {
  await side.goto(`${SIDE}?lesning=1&tema=${tema}`);
  await side.locator(".rad").first().click();
  await expect(side.locator(".cm-content")).toBeVisible();
  await expect(side.locator(".panel h2").first()).toBeVisible();
}

for (const tema of ["lyst", "mørkt"] as const) {
  test(`${tema} tema: klokkeslettet på den valgte raden holder 4,5:1 i renderingen`, async ({
    page,
  }) => {
    await åpneNotat(page, tema);
    // `--ink-faint` holder 4,51:1 mot `--ground` — men den valgte raden legger
    // `color-mix(--accent 14%)` over bakgrunnen, og der falt den til 3,72:1
    // (lyst) og 3,85:1 (mørkt). Det er raden brukeren ser på.
    const måle = async () => {
      // Flatene toner over 120ms; mål den de lander på, ikke en mellomting.
      await page.waitForTimeout(250);
      return await page.evaluate(() =>
        (window as unknown as { kontrasten: (el: Element) => number }).kontrasten(
          document.querySelector(".rad.valgt .tid")!,
        ),
      );
    };

    await page.mouse.move(0, 0);
    const rolig = await måle();
    expect(rolig, `valgt rad, ${tema} tema: ${rolig.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

    await page.locator(".rad.valgt").hover();
    const under = await måle();
    expect(
      under,
      `valgt rad under musepekeren, ${tema} tema: ${under.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
}

test("«Ferdig» lar fokus stå et fornuftig sted", async ({ page }) => {
  await åpneNotat(page);
  await page.locator("button.endre", { hasText: "Ferdig" }).first().click();

  // `Panel.tilbake()` sto på `queueMicrotask`, som kjører før React har
  // committet: den fokuserte «Endre»-knappen React var i ferd med å flytte til
  // «Gjort», og fokus falt til <body>. Neste Tab begynte på toppen av siden.
  const hvor = async () =>
    await page.evaluate(() => {
      const a = document.activeElement;
      return a === document.body || a === null
        ? "body"
        : `${a.tagName}.${a.className}|${(a.textContent ?? "").trim().slice(0, 20)}`;
    });

  expect(await hvor(), "rett etter klikket").not.toBe("body");
  // Og fortsatt når svaret fra lesningen har kommet og linja har flyttet seg.
  await expect(page.locator(".panel h2", { hasText: "Gjort" })).toBeVisible();
  expect(await hvor(), "etter at linja flyttet til «Gjort»").not.toBe("body");
  // Fokus står i panelet, ikke et vilkårlig sted i dokumentet.
  expect(await page.evaluate(() => document.querySelector(".panel")?.contains(document.activeElement))).toBe(true);
});

test("«Lagre» og «Avbryt» lander fortsatt på «Endre»", async ({ page }) => {
  await åpneNotat(page);
  // `[data-endre]` er linjas egen «Endre» — `.endre` alene er også
  // «Henger ikke sammen» i «Tidligere om dette».
  const endre = page.locator("button[data-endre]").first();
  await endre.click();
  await page.locator(".retteknapper button", { hasText: "Avbryt" }).click();
  await expect(endre).toBeFocused();
});

/** Bredden der tre spalter faktisk fungerer.
 *
 *  Terskelen sto på 900px, og ett piksel over den var skriveflaten 336px — 43
 *  tegn. Tallet er målt her, ikke gjettet: skriften i flata måler ~7,8px per
 *  tegn i ekte norsk brødtekst, og 45 tegn er nedre grense for lesbar
 *  brødtekst i det hele tatt. 55 er der linja slutter å være en stripe. */
const TEGN = 55;

test("tre spalter gir en skriveflate på minst 55 tegn", async ({ page }) => {
  await åpneNotat(page);
  const pxPerTegn = await page.evaluate(() => {
    const c = document.querySelector(".cm-content")!;
    const s = document.createElement("span");
    const cs = getComputedStyle(c);
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
    const prøve = "Vi ble enige om at nettsiden skal fungere på en gammel iPad, og at ";
    s.textContent = prøve;
    document.body.append(s);
    const per = s.getBoundingClientRect().width / prøve.length;
    s.remove();
    return per;
  });
  expect(pxPerTegn).toBeGreaterThan(5);

  const mål = async (w: number) => {
    await page.setViewportSize({ width: w, height: 900 });
    return await page.evaluate(() => ({
      spalter: getComputedStyle(document.querySelector(".kropp")!).display === "grid",
      cm: document.querySelector(".cm-content")!.getBoundingClientRect().width,
      skriveflateY:
        document.querySelector(".cm-content")!.getBoundingClientRect().top + window.scrollY,
      rulling: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
  };

  // Finn terskelen: den smaleste bredden som fortsatt gir tre spalter.
  let lav = 320;
  let høy = 1400;
  while (lav < høy) {
    const midt = Math.floor((lav + høy) / 2);
    if ((await mål(midt)).spalter) høy = midt;
    else lav = midt + 1;
  }
  const terskel = lav;
  const ved = await mål(terskel);
  expect(
    ved.cm / pxPerTegn,
    `ved ${terskel}px er skriveflaten ${Math.round(ved.cm)}px = ${Math.round(ved.cm / pxPerTegn)} tegn`,
  ).toBeGreaterThanOrEqual(TEGN);

  // Og ett piksel under terskelen er den stablet — uten at hele registeret
  // legger seg over notatet. Skriveflaten begynte på y=1402.
  const under = await mål(terskel - 1);
  expect(under.spalter).toBe(false);
  expect(under.skriveflateY, "skriveflaten må begynne innenfor første skjerm").toBeLessThan(900);
  expect(under.rulling).toBe(0);
});

test("ingen vannrett rulling ved 320px", async ({ page }) => {
  // WCAG 1.4.10. `.skjult` sto med `margin: -1px` — en rest fra `clip: rect()`
  // — og stakk 1px utenfor venstre kant uten at noen forelder klippet den.
  await åpneNotat(page);
  await page.setViewportSize({ width: 320, height: 900 });
  const rulling = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(rulling).toBe(0);
});

test("«Tidligere om dette» er lesbar ved standardbredden", async ({ page }) => {
  await åpneNotat(page);
  // Setningen fikk 140px og avvisningen 168px i et 336px panel: ett til to ord
  // per linje, 305px per kobling, 1 678px før «Hva vi har forstått» begynte.
  const mål = await page.evaluate(() => {
    const li = document.querySelector(".tidligere li")!;
    const tekst = li.querySelector("button:first-child")!;
    return {
      tekst: tekst.getBoundingClientRect().width,
      rad: li.getBoundingClientRect().height,
      liste: document.querySelector(".tidligere")!.getBoundingClientRect().height,
      koblinger: document.querySelectorAll(".tidligere li").length,
    };
  });
  // Setningen skal ha hele bredden i panelet, ikke en rest av den.
  expect(mål.tekst).toBeGreaterThan(280);
  // Og en kobling skal ikke være et avsnitt: fire linjer er nok.
  expect(mål.rad).toBeLessThan(220);
  expect(mål.liste / mål.koblinger).toBeLessThan(220);
});

test("knappene i notatlinja står samlet når raden brekker", async ({ page }) => {
  await åpneNotat(page);
  // `margin-left: auto` på *hver* knapp dyttet den første knappen på en ny
  // linje helt til høyre, og raden ble stående med et hull i midten.
  const hull = await page.evaluate(() => {
    const linje = document.querySelector(".notatlinje")!;
    const venstre = linje.getBoundingClientRect().left;
    const knapper = [...linje.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
    const rader = new Map<number, DOMRect[]>();
    for (const r of knapper) {
      const y = Math.round(r.top);
      rader.set(y, [...(rader.get(y) ?? []), r]);
    }
    // Alle rader utenom den første skal begynne ved venstre kant.
    const y = [...rader.keys()].sort((a, b) => a - b);
    return y.slice(1).map((k) => Math.round(rader.get(k)![0].left - venstre));
  });
  for (const avstand of hull) expect(avstand).toBeLessThanOrEqual(2);
});

test("ingen React-konsollfeil i noen tomtilstand", async ({ page }) => {
  const feil: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") feil.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => feil.push(String(e).slice(0, 160)));

  // `<SøkeSyntaks />` er en `<dl>`, og den sto inne i `<p className="tomt">`:
  // to feil ved hvert tomme søk, og syntaksen havnet utenfor avsnittet.
  await page.goto(`${SIDE}?lesning=1&tema=lyst`);
  await page.locator(".søk input").fill("kvasarblekk");
  await expect(page.locator(".søkesyntaks")).toBeVisible();
  expect(
    await page.evaluate(() => document.querySelector(".søkesyntaks")!.closest("p")),
  ).toBeNull();

  for (const scenario of ["tomt", "tomtNotat"]) {
    await page.goto(`${SIDE}?scenario=${scenario}&lesning=1`);
    await expect(page.locator(".skall")).toBeVisible();
  }
  // Tomt panel uten notat, og panelet uten nøkkel.
  await page.goto(`${SIDE}?tema=lyst`);
  await expect(page.locator("aside.panel")).toHaveAttribute("aria-label", /.+/);
  await page.goto(`${SIDE}?tema=lyst`);
  await page.locator(".rad").first().click();
  await expect(page.locator(".panel")).toBeVisible();

  expect(feil, feil.join("\n")).toHaveLength(0);
});
