#!/usr/bin/env tsx
/**
 * CLI som rendrer Holy Crust premium-meny til PDF.
 * Demonstrerer at MenuContent-modellen er full editerbar — hvert eneste
 * felt (cover-tittel, kategori-navn, item-navn/beskrivelse/pris/thumbnail,
 * kontakt, åpningstider) er JSON som UI-en kan endre.
 *
 * Kjør:
 *   npx tsx backend/scripts/render-menu-cli.ts
 *
 * Output: /tmp/posters/holy-crust-menu.pdf
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderMenuPdf, type MenuContent } from "../server/role-room-menu-composer.ts";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="92" fill="none" stroke="white" stroke-width="6"/>
  <circle cx="40" cy="60" r="6" fill="white"/>
  <circle cx="160" cy="80" r="5" fill="white"/>
  <circle cx="60" cy="140" r="7" fill="white"/>
  <circle cx="150" cy="150" r="6" fill="white"/>
  <text x="100" y="92" font-family="Arial Black, sans-serif" font-size="32" font-weight="900" fill="white" text-anchor="middle">HOLY</text>
  <text x="100" y="128" font-family="Arial Black, sans-serif" font-size="32" font-weight="900" fill="white" text-anchor="middle">CRUST</text>
</svg>`;
const LOGO_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

// Hentet fra "Den Hellige Menyen"-PDF (referanse). I produksjon kommer all
// denne data fra brand-/produktkatalog-DB; her er det hardkodet PoC-data.
const HOLY_CRUST_MENU: MenuContent = {
  templateId: "menu-premium",
  brand: {
    businessName: "Holy Crust",
    logoUrl: LOGO_DATA_URL,
    colors: {
      primary: "#C8102E",
      secondary: "#1B2D5C",
      accent: "#F4EBD8", // krem
      background: "#0E0E0E",
      text: "#FFFFFF",
    },
    fonts: {
      display: "Bebas Neue",
      body: "Inter",
    },
  },
  cover: {
    title: "Den Hellige Menyen",
    subtitle: "Holy Crust · Oslo",
  },
  categories: [
    {
      title: "Starters",
      items: [
        {
          name: "Garlic Brød",
          description:
            "Sprøtt, nystekt brød med smør og hvitløk som smelter sammen til en enkel, men uimotståelig klassiker.",
          price: "29 kr",
        },
        {
          name: "Holy Garlic Brød",
          description:
            "Mykt hvitløksbrød løftet med smeltet ost og saftig, krydret kylling tikka — en smakfull vri på klassikeren.",
          price: "59 kr",
        },
        {
          name: "Spicy Rice",
          description: "Aromatisk ris med vår signatur smak — varm, krydret og full av liv.",
          price: "69 kr",
        },
      ],
    },
    {
      title: "Grill",
      items: [
        {
          name: "Chicken Tandoori",
          description: "Klassisk tandoori-marinert kylling med røkt smak.",
          price: "4 stk 79 · 6 stk 109 · 8 stk 139 kr",
        },
        {
          name: "Peri Peri",
          description: "Kyllingbiter i vår signatur peri peri-saus — kraftig og krydret.",
          price: "4 stk 79 · 6 stk 109 · 8 stk 139 kr",
        },
      ],
    },
    {
      title: "Holy Pizzas",
      items: [
        { name: "Margherita", description: "Klassisk pizza med fyldig tomatsaus og smeltet ost i perfekt balanse.", price: "Liten 99 · Stor 229 kr" },
        { name: "Pepperoni", description: "En tidløs favoritt med rikelig pepperoni og smeltet ost.", price: "Liten 129 · Stor 249 kr" },
        { name: "Chicken Tikka", description: "Saftig marinert kylling og rødløk med et hint av krydder.", price: "Liten 139 · Stor 259 kr" },
        { name: "Peri Peri", description: "Kylling, paprika og løk med vår signatur peri peri-saus — fyldig og krydret.", price: "Liten 149 · Stor 269 kr" },
        { name: "Beef Blessing", description: "Marinert biff med ost og paprika — en robust klassiker.", price: "Liten 149 · Stor 259 kr" },
        { name: "Hot Beef", description: "Krydret biff med løk, jalapeños og tomat — for deg som liker litt sting.", price: "Liten 149 · Stor 259 kr" },
        { name: "Holy Kebab", description: "Dønerkjøtt, jalapeños, mais og rødløk toppet med kremet kebabdressing.", price: "Liten 149 · Stor 269 kr" },
        { name: "Holy Veggie", description: "Fargerik miks av paprika, rødløk, sopp, tomat og sort pepper.", price: "Liten 149 · Stor 249 kr" },
      ],
    },
    {
      title: "Detroit Style",
      description: "Tykk, sprø panbunn — vår signaturpizza",
      items: [
        { name: "Ost og Marinara", description: "Sprø firkantet bunn med ost og fyldig tomatsaus.", price: "Liten 169 · Stor 229 kr" },
        { name: "Pepperoni", description: "Klassisk Detroit-stil med rikelig pepperoni.", price: "Liten 179 · Stor 249 kr" },
        { name: "Chicken Tikka", description: "Marinert kylling med rødløk på tykk, luftig bunn.", price: "Liten 189 · Stor 259 kr" },
        { name: "Peri Peri", description: "Kylling, paprika, løk og peri peri-saus — kraftig smak på kraftig bunn.", price: "Liten 189 · Stor 259 kr" },
        { name: "Kebab", description: "Dønerkjøtt, jalapeños, mais, rødløk og kebabdressing på ekte Detroit-manér.", price: "Liten 189 · Stor 259 kr" },
      ],
    },
    {
      title: "Andre Retter",
      items: [
        { name: "Plain Fries", description: "Klassiske pommes frites, sprø og gylne.", price: "39 kr" },
      ],
    },
    {
      title: "Dessert",
      items: [
        { name: "Raspberry Cheesecake", description: "Ostekake med bringebær og hvit sjokolade. Håndglassert på toppen.", price: "99 kr" },
        { name: "Cookie Double Chocolate", description: "Myk og seig kjeks med dobbel dose sjokolade — enkel, og uimotståelig.", price: "49 kr" },
      ],
    },
  ],
  contact: {
    phone: "972 52 222",
    address: "Jerikoveien 1, 1067 Oslo",
    website: "holycrust.no",
    hours: [
      { day: "Mandag", time: "11:00 – 22:00" },
      { day: "Tirsdag", time: "11:00 – 22:00" },
      { day: "Onsdag", time: "11:00 – 22:00" },
      { day: "Torsdag", time: "11:00 – 22:00" },
      { day: "Fredag", time: "11:00 – 22:00" },
      { day: "Lørdag", time: "11:00 – 22:00" },
      { day: "Søndag", time: "11:00 – 22:00" },
    ],
  },
  deals: [
    { title: "2 Stor Pizza", description: "Velg blant Holy-favorittene", price: "429 kr" },
    { title: "Familiepakke", description: "Pizza + grill + drikke", price: "699 kr" },
  ],
};

const HOLY_CRUST_TRIFOLD: MenuContent = {
  ...HOLY_CRUST_MENU,
  templateId: "menu-trifold",
  cover: {
    title: "Takeaway Meny",
    tagline: "Pizza · Grill · Detroit Style",
  },
};

async function main() {
  const outDir = "/tmp/posters";
  mkdirSync(outDir, { recursive: true });

  // Premium A4
  console.log(`\nRendrer Holy Crust premium-meny (${HOLY_CRUST_MENU.categories.length} kategorier)…`);
  let t0 = Date.now();
  let pdf = await renderMenuPdf(HOLY_CRUST_MENU, "menu-a4");
  console.log(
    `OK ${Date.now() - t0}ms (${(pdf.length / 1024).toFixed(0)} kB) → ${join(outDir, "holy-crust-menu.pdf")}`,
  );
  writeFileSync(join(outDir, "holy-crust-menu.pdf"), pdf);

  // Trifold takeaway
  console.log(`\nRendrer Holy Crust takeaway-trifold (front + back)…`);
  t0 = Date.now();
  pdf = await renderMenuPdf(HOLY_CRUST_TRIFOLD, "menu-trifold-a4");
  console.log(
    `OK ${Date.now() - t0}ms (${(pdf.length / 1024).toFixed(0)} kB) → ${join(outDir, "holy-crust-trifold.pdf")}\n`,
  );
  writeFileSync(join(outDir, "holy-crust-trifold.pdf"), pdf);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
