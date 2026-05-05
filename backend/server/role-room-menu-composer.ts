/**
 * Meny-composer (premium A4-meny + takeaway-trifold).
 *
 * Bygger flersides PDF-menyer fra MenuContent. Hver side rendres via Satori
 * som SVG → PNG (gjenbruker font-loader fra role-room-poster-composer), så
 * settes alle sidene sammen til én PDF med pdf-lib.
 *
 * MenuContent er full-editerbar JSON: cover-tittel, kategorinavn, item-navn/
 * beskrivelse/pris/thumbnail, kontakt-info og åpningstider er alle felter
 * som UI-en eksponerer for redigering. Hvilken som helst kategori og hvilket
 * som helst item kan legges til, fjernes eller redigeres uten å røre koden.
 */
import { PDFDocument } from "pdf-lib";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import {
  type BrandIdentity,
  type FormatDims,
  loadBrandFontsForExport,
} from "./role-room-poster-composer.ts";

// ─────────────────────────────────────────────────────────────────────────
// Format-presets for menyer
// ─────────────────────────────────────────────────────────────────────────

export type MenuFormat =
  | "menu-a4"           // Premium meny — A4 portrait per side
  | "menu-trifold-a4";  // Takeaway-trifold — A4 landscape, 3 paneler

export const MENU_FORMAT_DIMENSIONS: Record<MenuFormat, FormatDims> = {
  "menu-a4": {
    w: Math.round(((210 + 6) / 25.4) * 300),
    h: Math.round(((297 + 6) / 25.4) * 300),
    shape: "portrait",
    kind: "print",
    dpi: 300,
    bleed: Math.round((3 / 25.4) * 300),
    safeZone: Math.round((10 / 25.4) * 300),
    physicalMm: { w: 210, h: 297 },
  },
  "menu-trifold-a4": {
    w: Math.round(((297 + 6) / 25.4) * 300),
    h: Math.round(((210 + 6) / 25.4) * 300),
    shape: "landscape",
    kind: "print",
    dpi: 300,
    bleed: Math.round((3 / 25.4) * 300),
    safeZone: Math.round((10 / 25.4) * 300),
    physicalMm: { w: 297, h: 210 },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Content-modell
// ─────────────────────────────────────────────────────────────────────────

export interface MenuItem {
  /** Valgfri thumbnail (transparent PNG eller URL). Premium-meny viser
   *  rund eller avrundet 80×80-thumbnail til venstre. */
  imageUrl?: string;
  /** Navn — vises i bold display-font, ofte all-caps. */
  name: string;
  /** Valgfri kort beskrivelse — vises i body-font under navn. */
  description?: string;
  /** Pris-streng. Kan være enkel ("29 kr") eller kompleks
   *  ("Liten 99 · Stor 229 kr" — vi rendrer det som er gitt). */
  price: string;
}

export interface MenuCategory {
  /** Kategori-tittel ("STARTERS", "HOLY PIZZAS", "DETROIT STYLE"). */
  title: string;
  /** Valgfri sub-tittel under kategori-navnet ("Tykk, sprø panbunn — vår signaturpizza"). */
  description?: string;
  items: MenuItem[];
}

export interface MenuDeal {
  title: string;            // "2 STOR PIZZA"
  description?: string;     // "Velg blant Holy-favorittene"
  price: string;            // "429 kr"
}

export interface BusinessHours {
  day: string;              // "Mandag"
  time: string;             // "11:00 – 22:00"
}

export interface MenuContent {
  templateId: "menu-premium" | "menu-trifold";
  brand: BrandIdentity;
  cover: {
    title: string;          // "DEN HELLIGE MENYEN" / "TAKEAWAY MENY"
    subtitle?: string;      // "HOLY CRUST · OSLO"
    tagline?: string;       // "PIZZA · GRILL · DETROIT STYLE"
  };
  categories: MenuCategory[];
  contact: {
    phone?: string;
    address?: string;
    website?: string;
    hours?: BusinessHours[];
  };
  /** Highlight-tilbud for trifold-cover ("HOLY DEALS"). Ignoreres av premium-template. */
  deals?: MenuDeal[];
}

// ─────────────────────────────────────────────────────────────────────────
// JSX-helper (samme stil som poster-composer)
// ─────────────────────────────────────────────────────────────────────────

type Style = Record<string, unknown>;
type VNode = {
  type: string;
  props: { style?: Style; children?: VNode | VNode[] | string | number; [k: string]: unknown };
};

function el(
  type: string,
  props: Record<string, unknown>,
  ...children: Array<VNode | string | number | null | undefined>
): VNode {
  const filtered = children.filter((c) => c !== null && c !== undefined) as Array<VNode | string | number>;
  // Satori krever eksplisitt display: flex på alle divs med mer enn én child.
  // Settes automatisk hvis ikke spesifisert — sparer feilkilder.
  let mergedProps = props;
  if ((type === "div" || type === "span") && filtered.length > 1) {
    const style = (props.style as Style | undefined) ?? {};
    if (!style.display) {
      mergedProps = { ...props, style: { ...style, display: "flex" } };
    }
  }
  // Bestem children-prop: 0 → omit, 1 → unwrap, >1 → array
  const finalProps = { ...mergedProps };
  if (filtered.length === 1) {
    finalProps.children = filtered[0];
  } else if (filtered.length > 1) {
    finalProps.children = filtered;
  }
  // (else: ingen children-prop — viktig for Satori med tom-div som underline)
  return { type, props: finalProps };
}

// ─────────────────────────────────────────────────────────────────────────
// Premium-meny: cover-side
// ─────────────────────────────────────────────────────────────────────────

function premiumCoverPage(content: MenuContent, dims: FormatDims): VNode {
  const c = content.brand.colors;
  const bleed = dims.bleed ?? 0;
  const trimW = dims.w - 2 * bleed;
  const trimH = dims.h - 2 * bleed;
  const bgColor = c.primary;
  const textColor = c.text ?? "#FFFFFF";

  return el(
    "div",
    {
      style: {
        width: dims.w,
        height: dims.h,
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      },
    },
    // Logo
    el("img", {
      src: content.brand.logoUrl,
      style: {
        width: Math.round(trimW * 0.18),
        height: Math.round(trimW * 0.18),
        objectFit: "contain",
        marginBottom: Math.round(trimH * 0.04),
      },
    }),
    // Tittel — multi-linje split på space
    el(
      "div",
      {
        style: {
          fontFamily: content.brand.fonts.display,
          fontWeight: 700,
          fontSize: Math.round(trimW * 0.085),
          color: textColor,
          letterSpacing: "0.02em",
          lineHeight: 1.1,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
      },
      ...content.cover.title.split(/\s+/).map((word) =>
        el("span", { style: { display: "flex" } }, word.toUpperCase()),
      ),
    ),
    // Subtittel
    content.cover.subtitle
      ? el(
          "div",
          {
            style: {
              fontFamily: content.brand.fonts.body,
              fontWeight: 400,
              fontSize: Math.round(trimW * 0.022),
              color: textColor,
              letterSpacing: "0.2em",
              marginTop: Math.round(trimH * 0.015),
              display: "flex",
            },
          },
          content.cover.subtitle.toUpperCase(),
        )
      : null,
    // Footer
    el(
      "div",
      {
        style: {
          position: "absolute",
          bottom: Math.round(trimH * 0.04),
          left: 0,
          right: 0,
          fontFamily: content.brand.fonts.body,
          fontSize: Math.round(trimW * 0.018),
          color: textColor,
          opacity: 0.85,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
      },
      content.contact.phone || content.contact.address
        ? el(
            "div",
            { style: { display: "flex" } },
            [content.contact.phone && `TLF ${content.contact.phone}`, content.contact.address && `ADR ${content.contact.address}`]
              .filter(Boolean)
              .join(" · "),
          )
        : null,
      content.contact.website
        ? el("div", { style: { display: "flex", marginTop: 4 } }, content.contact.website)
        : null,
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Premium-meny: kategori-side (1 kategori per side)
// ─────────────────────────────────────────────────────────────────────────

function premiumCategoryPage(
  content: MenuContent,
  category: MenuCategory,
  dims: FormatDims,
): VNode {
  const c = content.brand.colors;
  const bleed = dims.bleed ?? 0;
  const trimW = dims.w - 2 * bleed;
  const trimH = dims.h - 2 * bleed;
  const safe = dims.safeZone ?? 0;
  const contentInset = bleed + safe;
  const padding = Math.round(trimW * 0.08);
  const accent = c.accent ?? "#F4EBD8";
  const textColor = c.text ?? "#FFFFFF";

  return el(
    "div",
    {
      style: {
        width: dims.w,
        height: dims.h,
        backgroundColor: c.primary,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      },
    },
    // Krem content-panel
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: contentInset,
          left: contentInset,
          width: dims.w - 2 * contentInset,
          height: dims.h - 2 * contentInset,
          backgroundColor: accent,
          borderRadius: Math.round(trimW * 0.01),
          display: "flex",
          flexDirection: "column",
          padding,
        },
      },
      // Kategori-tittel
      el(
        "div",
        {
          style: {
            fontFamily: content.brand.fonts.display,
            fontWeight: 700,
            fontSize: Math.round(trimW * 0.07),
            color: c.primary,
            letterSpacing: "0.02em",
            display: "flex",
            marginBottom: Math.round(trimH * 0.005),
          },
        },
        category.title.toUpperCase(),
      ),
      // Underline
      el("div", {
        style: {
          width: Math.round(trimW * 0.1),
          height: 3,
          backgroundColor: c.primary,
          marginBottom: Math.round(trimH * 0.02),
        },
      }),
      // Kategori-beskrivelse (valgfri)
      category.description
        ? el(
            "div",
            {
              style: {
                fontFamily: content.brand.fonts.body,
                fontSize: Math.round(trimW * 0.022),
                color: "#5A4A48",
                marginBottom: Math.round(trimH * 0.025),
                display: "flex",
              },
            },
            category.description,
          )
        : null,
      // Item-liste
      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: Math.round(trimH * 0.015) } },
        ...category.items.map((item) => menuItemRow(item, content.brand, trimW, c.primary)),
      ),
    ),
    // Header (top contact-line på krem-panel)
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: Math.round(trimH * 0.025) + bleed,
          left: contentInset + padding,
          right: contentInset + padding,
          fontFamily: content.brand.fonts.body,
          fontSize: Math.round(trimW * 0.014),
          color: textColor,
          opacity: 0.9,
          letterSpacing: "0.1em",
          display: "flex",
          justifyContent: "flex-end",
        },
      },
      [content.contact.website, content.contact.phone].filter(Boolean).join("  ").toUpperCase(),
    ),
    // Footer (bunn-linje med samme info)
    el(
      "div",
      {
        style: {
          position: "absolute",
          bottom: Math.round(trimH * 0.022) + bleed,
          left: contentInset + padding,
          right: contentInset + padding,
          fontFamily: content.brand.fonts.body,
          fontSize: Math.round(trimW * 0.014),
          color: textColor,
          opacity: 0.9,
          letterSpacing: "0.1em",
          display: "flex",
          justifyContent: "space-between",
        },
      },
      el("span", { style: { display: "flex" } }, content.contact.website?.toUpperCase() ?? ""),
      el("span", { style: { display: "flex" } }, content.contact.phone ?? ""),
    ),
  );
}

function menuItemRow(item: MenuItem, brand: BrandIdentity, trimW: number, accentColor: string): VNode {
  const thumbnailSize = Math.round(trimW * 0.06);
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: Math.round(trimW * 0.018),
        paddingBottom: Math.round(trimW * 0.012),
        borderBottom: `1px dashed ${accentColor}40`,
      },
    },
    item.imageUrl
      ? el("img", {
          src: item.imageUrl,
          style: {
            width: thumbnailSize,
            height: thumbnailSize,
            objectFit: "cover",
            borderRadius: thumbnailSize * 0.5,
            flexShrink: 0,
          },
        })
      : el("div", {
          style: {
            width: thumbnailSize,
            height: thumbnailSize,
            backgroundColor: "#FFFFFF",
            borderRadius: thumbnailSize * 0.5,
            flexShrink: 0,
            display: "flex",
          },
        }),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1 } },
      // Navn — dotted leader — pris (klassisk meny-stil)
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            width: "100%",
            marginBottom: 4,
          },
        },
        el(
          "div",
          {
            style: {
              fontFamily: brand.fonts.display,
              fontWeight: 700,
              fontSize: Math.round(trimW * 0.022),
              color: "#3A2A28",
              letterSpacing: "0.05em",
              display: "flex",
              flexShrink: 0,
            },
          },
          item.name.toUpperCase(),
        ),
        // Dotted leader: flex-grow div med dashed bunn-kant
        el("div", {
          style: {
            flex: 1,
            height: Math.round(trimW * 0.022) * 0.5, // halvparten av tekst-høyde, plassert nær bunn
            margin: `0 ${Math.round(trimW * 0.008)}px`,
            // Satori støtter ikke 'dotted' — bruker dashed med tett spacing
            borderBottom: `2px dashed ${accentColor}55`,
            alignSelf: "flex-end",
            marginBottom: Math.round(trimW * 0.022) * 0.2,
          },
        }),
        el(
          "div",
          {
            style: {
              fontFamily: brand.fonts.display,
              fontWeight: 700,
              fontSize: Math.round(trimW * 0.022),
              color: accentColor,
              display: "flex",
              flexShrink: 0,
            },
          },
          item.price,
        ),
      ),
      item.description
        ? el(
            "div",
            {
              style: {
                fontFamily: brand.fonts.body,
                fontSize: Math.round(trimW * 0.014),
                color: "#5A4A48",
                lineHeight: 1.4,
                display: "flex",
              },
            },
            item.description,
          )
        : null,
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Trifold-meny: A4 landscape med 3 vertikale paneler per side.
// Front:  [ Kontakt + Hours | Holy Deals + bottom-CTA | Logo + Tittel + Tagline ]
// Back:   [ Starters/Grill   | Holy Pizzas             | Detroit Style + skann-CTA ]
// ─────────────────────────────────────────────────────────────────────────

interface PanelDims {
  panelW: number;   // bredde av ett panel
  panelH: number;   // høyde (= trim-høyde)
  padding: number;
  bleed: number;
}

function trifoldPanelDims(dims: FormatDims): PanelDims {
  const bleed = dims.bleed ?? 0;
  const trimW = dims.w - 2 * bleed;
  const trimH = dims.h - 2 * bleed;
  return {
    panelW: trimW / 3,
    panelH: trimH,
    padding: Math.round(trimW * 0.025),
    bleed,
  };
}

function trifoldContactPanel(content: MenuContent, p: PanelDims): VNode {
  const c = content.brand.colors;
  const accent = c.accent ?? "#F4EBD8";
  return el(
    "div",
    {
      style: {
        width: p.panelW,
        height: p.panelH,
        padding: p.padding,
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.primary,
        boxSizing: "border-box",
      },
    },
    el(
      "div",
      {
        style: {
          backgroundColor: accent,
          padding: p.padding * 0.8,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRadius: p.padding * 0.3,
        },
      },
      el(
        "div",
        {
          style: {
            fontFamily: content.brand.fonts.display,
            fontWeight: 700,
            fontSize: Math.round(p.panelW * 0.07),
            color: c.primary,
            letterSpacing: "0.02em",
            display: "flex",
            flexDirection: "column",
            marginBottom: p.padding * 0.6,
          },
        },
        el("span", { style: { display: "flex" } }, "KONTAKT &"),
        el("span", { style: { display: "flex" } }, "ÅPNINGSTIDER"),
      ),
      // Hours
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: p.padding,
          },
        },
        ...(content.contact.hours ?? []).map((h) =>
          el(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                fontFamily: content.brand.fonts.body,
                fontSize: Math.round(p.panelW * 0.028),
                color: "#3A2A28",
              },
            },
            el("span", { style: { display: "flex", fontWeight: 700 } }, h.day),
            el("span", { style: { display: "flex", color: "#5A4A48" } }, h.time),
          ),
        ),
      ),
      // Linjeskille
      el("div", {
        style: {
          width: "60%",
          height: 2,
          backgroundColor: c.primary,
          marginBottom: p.padding * 0.6,
        },
      }),
      // Kontakt-info
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontFamily: content.brand.fonts.body,
            fontSize: Math.round(p.panelW * 0.028),
            color: "#3A2A28",
          },
        },
        content.contact.phone
          ? el(
              "div",
              { style: { display: "flex" } },
              el("span", { style: { fontWeight: 700, color: c.primary, marginRight: 6, display: "flex" } }, "TLF"),
              content.contact.phone,
            )
          : null,
        content.contact.address
          ? el(
              "div",
              { style: { display: "flex" } },
              el("span", { style: { fontWeight: 700, color: c.primary, marginRight: 6, display: "flex" } }, "ADR"),
              content.contact.address,
            )
          : null,
        content.contact.website
          ? el(
              "div",
              { style: { display: "flex" } },
              el("span", { style: { fontWeight: 700, color: c.primary, marginRight: 6, display: "flex" } }, "WEB"),
              content.contact.website,
            )
          : null,
      ),
      // Spacer
      el("div", { style: { flex: 1 } }),
      el(
        "div",
        {
          style: {
            fontFamily: content.brand.fonts.body,
            fontSize: Math.round(p.panelW * 0.022),
            color: "#5A4A48",
            opacity: 0.7,
            marginTop: p.padding * 0.4,
            display: "flex",
          },
        },
        `© ${content.brand.businessName} · Bestill online på ${content.contact.website ?? ""}`,
      ),
    ),
  );
}

function trifoldDealsPanel(content: MenuContent, p: PanelDims): VNode {
  const c = content.brand.colors;
  const textColor = c.text ?? "#FFFFFF";
  return el(
    "div",
    {
      style: {
        width: p.panelW,
        height: p.panelH,
        padding: p.padding,
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.primary,
        color: textColor,
        boxSizing: "border-box",
      },
    },
    // Deals header
    el(
      "div",
      {
        style: {
          fontFamily: content.brand.fonts.display,
          fontWeight: 700,
          fontSize: Math.round(p.panelW * 0.085),
          letterSpacing: "0.02em",
          marginBottom: p.padding * 0.4,
          display: "flex",
        },
      },
      "HOLY DEALS",
    ),
    el(
      "div",
      {
        style: {
          fontFamily: content.brand.fonts.body,
          fontSize: Math.round(p.panelW * 0.026),
          opacity: 0.85,
          marginBottom: p.padding,
          display: "flex",
        },
      },
      "Bestill online for våre beste tilbud",
    ),
    // Deal-kort
    el(
      "div",
      {
        style: { display: "flex", flexDirection: "column", gap: p.padding * 0.6, flex: 1 },
      },
      ...(content.deals ?? []).map((deal) =>
        el(
          "div",
          {
            style: {
              backgroundColor: "rgba(255,255,255,0.1)",
              padding: p.padding * 0.7,
              borderRadius: p.padding * 0.25,
              display: "flex",
              flexDirection: "column",
            },
          },
          el(
            "div",
            {
              style: {
                fontFamily: content.brand.fonts.display,
                fontWeight: 700,
                fontSize: Math.round(p.panelW * 0.05),
                letterSpacing: "0.05em",
                marginBottom: 4,
                display: "flex",
              },
            },
            deal.title.toUpperCase(),
          ),
          deal.description
            ? el(
                "div",
                {
                  style: {
                    fontFamily: content.brand.fonts.body,
                    fontSize: Math.round(p.panelW * 0.024),
                    opacity: 0.9,
                    marginBottom: p.padding * 0.3,
                    display: "flex",
                  },
                },
                deal.description,
              )
            : null,
          el(
            "div",
            {
              style: {
                fontFamily: content.brand.fonts.display,
                fontWeight: 700,
                fontSize: Math.round(p.panelW * 0.075),
                color: c.accent ?? "#F4EBD8",
                display: "flex",
              },
            },
            deal.price,
          ),
        ),
      ),
    ),
    // Bottom CTA: TLF · BESTILL
    el(
      "div",
      {
        style: {
          backgroundColor: c.accent ?? "#F4EBD8",
          color: c.primary,
          padding: p.padding * 0.6,
          marginTop: p.padding * 0.5,
          fontFamily: content.brand.fonts.display,
          fontWeight: 700,
          fontSize: Math.round(p.panelW * 0.04),
          letterSpacing: "0.05em",
          textAlign: "center",
          borderRadius: p.padding * 0.2,
          display: "flex",
          justifyContent: "center",
        },
      },
      `TLF · BESTILL: ${content.contact.phone ?? ""}`,
    ),
  );
}

function trifoldCoverPanel(content: MenuContent, p: PanelDims): VNode {
  const c = content.brand.colors;
  const textColor = c.text ?? "#FFFFFF";
  return el(
    "div",
    {
      style: {
        width: p.panelW,
        height: p.panelH,
        padding: p.padding,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: c.primary,
        color: textColor,
        boxSizing: "border-box",
      },
    },
    // Logo
    el("img", {
      src: content.brand.logoUrl,
      style: {
        width: Math.round(p.panelW * 0.45),
        height: Math.round(p.panelW * 0.45),
        objectFit: "contain",
        marginTop: p.padding,
      },
    }),
    el("div", { style: { flex: 0.3 } }),
    // Tittel — multilinje
    el(
      "div",
      {
        style: {
          fontFamily: content.brand.fonts.display,
          fontWeight: 700,
          fontSize: Math.round(p.panelW * 0.13),
          letterSpacing: "0.02em",
          lineHeight: 1.05,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: p.padding * 0.4,
        },
      },
      ...content.cover.title.split(/\s+/).map((word) =>
        el("span", { style: { display: "flex" } }, word.toUpperCase()),
      ),
    ),
    // Tagline
    content.cover.tagline
      ? el(
          "div",
          {
            style: {
              fontFamily: content.brand.fonts.body,
              fontSize: Math.round(p.panelW * 0.028),
              letterSpacing: "0.2em",
              opacity: 0.9,
              display: "flex",
            },
          },
          content.cover.tagline.toUpperCase(),
        )
      : null,
    el("div", { style: { flex: 1 } }),
    // Bottom: BESTILL ONLINE / nettside
    el(
      "div",
      {
        style: {
          backgroundColor: c.accent ?? "#F4EBD8",
          color: c.primary,
          padding: p.padding * 0.5,
          width: "85%",
          fontFamily: content.brand.fonts.display,
          fontWeight: 700,
          textAlign: "center",
          borderRadius: p.padding * 0.2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
      },
      el(
        "span",
        {
          style: {
            fontFamily: content.brand.fonts.body,
            fontSize: Math.round(p.panelW * 0.02),
            color: "#5A4A48",
            letterSpacing: "0.1em",
            marginBottom: 4,
            display: "flex",
          },
        },
        "BESTILL ONLINE",
      ),
      el(
        "span",
        { style: { fontSize: Math.round(p.panelW * 0.045), letterSpacing: "0.05em", display: "flex" } },
        (content.contact.website ?? "").toUpperCase(),
      ),
    ),
  );
}

function trifoldCategoryPanel(
  content: MenuContent,
  categories: MenuCategory[],
  p: PanelDims,
  bottomCta?: string,
): VNode {
  const c = content.brand.colors;
  const accent = c.accent ?? "#F4EBD8";
  return el(
    "div",
    {
      style: {
        width: p.panelW,
        height: p.panelH,
        padding: p.padding,
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.primary,
        boxSizing: "border-box",
      },
    },
    el(
      "div",
      {
        style: {
          backgroundColor: accent,
          padding: p.padding * 0.8,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: p.padding * 0.3,
        },
      },
      ...categories.map((cat, idx) =>
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", marginBottom: idx < categories.length - 1 ? p.padding : 0 } },
          el(
            "div",
            {
              style: {
                fontFamily: content.brand.fonts.display,
                fontWeight: 700,
                fontSize: Math.round(p.panelW * 0.07),
                color: c.primary,
                letterSpacing: "0.02em",
                marginBottom: p.padding * 0.3,
                display: "flex",
              },
            },
            cat.title.toUpperCase(),
          ),
          cat.description
            ? el(
                "div",
                {
                  style: {
                    fontFamily: content.brand.fonts.body,
                    fontSize: Math.round(p.panelW * 0.022),
                    color: "#5A4A48",
                    fontStyle: "italic",
                    marginBottom: p.padding * 0.4,
                    display: "flex",
                  },
                },
                cat.description,
              )
            : null,
          // Items — kompakt liste m/ navn-leader-pris
          el(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 6 } },
            ...cat.items.map((item) =>
              el(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-end",
                    fontFamily: content.brand.fonts.body,
                    fontSize: Math.round(p.panelW * 0.025),
                    color: "#3A2A28",
                  },
                },
                el(
                  "span",
                  { style: { display: "flex", fontWeight: 700, flexShrink: 0 } },
                  item.name,
                ),
                el("div", {
                  style: {
                    flex: 1,
                    height: Math.round(p.panelW * 0.025) * 0.45,
                    margin: "0 6px",
                    borderBottom: `1px dashed ${c.primary}55`,
                    alignSelf: "flex-end",
                    marginBottom: 3,
                  },
                }),
                el("span", { style: { display: "flex", color: c.primary, fontWeight: 700, flexShrink: 0 } }, item.price),
              ),
            ),
          ),
        ),
      ),
    ),
    // Optional bottom-CTA (Skann · Velg · Bestill / TLF)
    bottomCta
      ? el(
          "div",
          {
            style: {
              backgroundColor: accent,
              color: c.primary,
              padding: p.padding * 0.5,
              marginTop: p.padding * 0.4,
              fontFamily: content.brand.fonts.display,
              fontWeight: 700,
              fontSize: Math.round(p.panelW * 0.035),
              letterSpacing: "0.1em",
              textAlign: "center",
              borderRadius: p.padding * 0.2,
              display: "flex",
              justifyContent: "center",
            },
          },
          bottomCta.toUpperCase(),
        )
      : null,
  );
}

function trifoldFrontPage(content: MenuContent, dims: FormatDims): VNode {
  const p = trifoldPanelDims(dims);
  const c = content.brand.colors;
  return el(
    "div",
    {
      style: {
        width: dims.w,
        height: dims.h,
        backgroundColor: c.primary,
        display: "flex",
        flexDirection: "row",
        position: "relative",
      },
    },
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: p.bleed,
          left: p.bleed,
          width: dims.w - 2 * p.bleed,
          height: dims.h - 2 * p.bleed,
          display: "flex",
          flexDirection: "row",
        },
      },
      trifoldContactPanel(content, p),
      trifoldDealsPanel(content, p),
      trifoldCoverPanel(content, p),
    ),
  );
}

function trifoldBackPage(content: MenuContent, dims: FormatDims): VNode {
  const p = trifoldPanelDims(dims);
  const c = content.brand.colors;
  // Distribuer kategorier på 3 paneler.
  // Heuristikk: hvis ≥4 kategorier, panel1 = [0,1], panel2 = [2], panel3 = [3+ rest].
  // Med færre kategorier: panel1 = [0], panel2 = [1], panel3 = [2..rest].
  const cats = content.categories;
  let p1: MenuCategory[];
  let p2: MenuCategory[];
  let p3: MenuCategory[];
  if (cats.length >= 4) {
    p1 = cats.slice(0, 2);
    p2 = [cats[2]];
    p3 = cats.slice(3);
  } else if (cats.length === 3) {
    p1 = [cats[0]];
    p2 = [cats[1]];
    p3 = [cats[2]];
  } else {
    p1 = cats[0] ? [cats[0]] : [];
    p2 = cats[1] ? [cats[1]] : [];
    p3 = cats[2] ? [cats[2]] : [];
  }
  const bottomCta = content.contact.phone ? `Skann · Velg · Bestill   TLF ${content.contact.phone}` : undefined;
  return el(
    "div",
    {
      style: {
        width: dims.w,
        height: dims.h,
        backgroundColor: c.primary,
        display: "flex",
        flexDirection: "row",
        position: "relative",
      },
    },
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: p.bleed,
          left: p.bleed,
          width: dims.w - 2 * p.bleed,
          height: dims.h - 2 * p.bleed,
          display: "flex",
          flexDirection: "row",
        },
      },
      trifoldCategoryPanel(content, p1, p),
      trifoldCategoryPanel(content, p2, p),
      trifoldCategoryPanel(content, p3, p, bottomCta),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

async function renderPageToPng(tree: VNode, dims: FormatDims, brand: BrandIdentity): Promise<Buffer> {
  const fonts = await loadBrandFontsForExport(brand);
  try {
    const svg = await satori(tree as never, {
      width: dims.w,
      height: dims.h,
      fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
    });
    return new Resvg(svg, { fitTo: { mode: "width", value: dims.w } }).render().asPng();
  } catch (err) {
    // Dump tree til disk for inspeksjon når Satori klager på struktur
    const { writeFileSync: ws } = await import("node:fs");
    ws("/tmp/failing-menu-tree.json", JSON.stringify(tree, null, 2));
    console.error("Tree dumped to /tmp/failing-menu-tree.json");
    throw err;
  }
}

/**
 * Rendrer en premium-meny til PDF. Hver side er én A4-side; cover først,
 * deretter én side per kategori.
 */
export async function renderMenuPdf(content: MenuContent, format: MenuFormat = "menu-a4"): Promise<Buffer> {
  // Trifold krever landscape — auto-overstyr format hvis bruker har valgt
  // portrait-A4 sammen med menu-trifold templateId.
  const effectiveFormat: MenuFormat =
    content.templateId === "menu-trifold" ? "menu-trifold-a4" : format;
  const dims = MENU_FORMAT_DIMENSIONS[effectiveFormat];

  const pages: VNode[] = [];
  if (content.templateId === "menu-premium") {
    pages.push(premiumCoverPage(content, dims));
    for (const cat of content.categories) {
      pages.push(premiumCategoryPage(content, cat, dims));
    }
  } else if (content.templateId === "menu-trifold") {
    pages.push(trifoldFrontPage(content, dims));
    pages.push(trifoldBackPage(content, dims));
  } else {
    throw new Error(`Template ${content.templateId} ikke implementert`);
  }

  // Render hver side til PNG, embed i PDF
  const pdfDoc = await PDFDocument.create();
  for (const tree of pages) {
    const png = await renderPageToPng(tree, dims, content.brand);
    const img = await pdfDoc.embedPng(png);
    // PDF-side i poeng: 1pt = 1/72 tomme; vi ønsker fysisk størrelse uten bleed
    // pluss bleed-eksport, så vi setter siden = render-canvas (dims.w/h px @ DPI).
    const dpi = dims.dpi ?? 300;
    const pageW = (dims.w / dpi) * 72;
    const pageH = (dims.h / dpi) * 72;
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
