/**
 * Fusion tools-catalog — vanlige Fusion-noder Director kan legge til
 * via fusionComp.addTool. Brukes både for tool-types-reference Claude-
 * tool og for å gi Director hint om common inputs.
 *
 * IKKE komplett — Fusion har 100+ noder. Vi lister de mest brukte for
 * Director-flyt (titler, motion graphics, color, effekter).
 */

export type FusionToolCategory =
  | "generator"
  | "effect"
  | "merge"
  | "text"
  | "transform"
  | "mask"
  | "color"
  | "tracker"
  | "output";

export interface FusionToolEntry {
  /** TOOLS_RegID som AddTool forventer. Case-sensitivt. */
  type: string;
  /** Display-navn. */
  label: string;
  category: FusionToolCategory;
  description: string;
  /** Common inputs Claude kan sette via fusionComp.setInput. */
  commonInputs?: ReadonlyArray<{
    name: string;
    description: string;
    valueFormat: string;
  }>;
}

export const FUSION_TOOLS_CATALOG: readonly FusionToolEntry[] = [
  // ─────────── Generators ───────────
  {
    type: "Background",
    label: "Background",
    category: "generator",
    description: "Solid eller gradient bakgrunn. Inputs styrer farge per hjørne.",
    commonInputs: [
      { name: "TopLeftRed", description: "Top-left R 0-1", valueFormat: "float 0-1" },
      { name: "TopLeftGreen", description: "Top-left G 0-1", valueFormat: "float 0-1" },
      { name: "TopLeftBlue", description: "Top-left B 0-1", valueFormat: "float 0-1" },
      { name: "TopLeftAlpha", description: "Top-left A 0-1", valueFormat: "float 0-1" },
      { name: "Type", description: "0=Solid, 1=Horizontal grad, 2=Vertical grad", valueFormat: "int 0-3" },
    ],
  },
  {
    type: "FastNoise",
    label: "Fast Noise",
    category: "generator",
    description: "Perlin/Cellular-noise — bra for tekstur, partikler, render-base.",
  },
  // ─────────── Text ───────────
  {
    type: "TextPlus",
    label: "Text+",
    category: "text",
    description:
      "Den moderne Fusion-tekst-noden. Brukes for titler, lower thirds, kreditt-ruller.",
    commonInputs: [
      { name: "StyledText", description: "Tekst-innholdet.", valueFormat: "string" },
      { name: "Font", description: "Font-familie-navn.", valueFormat: "string" },
      { name: "Style", description: "Font-stil ('Regular', 'Bold', 'Italic').", valueFormat: "string" },
      { name: "Size", description: "Font-størrelse.", valueFormat: "float 0-1 (skala)" },
      { name: "Red1", description: "Text farge R", valueFormat: "float 0-1" },
      { name: "Green1", description: "Text farge G", valueFormat: "float 0-1" },
      { name: "Blue1", description: "Text farge B", valueFormat: "float 0-1" },
      { name: "Alpha1", description: "Text alpha", valueFormat: "float 0-1" },
    ],
  },
  // ─────────── Merge ───────────
  {
    type: "Merge",
    label: "Merge",
    category: "merge",
    description:
      "Kompositt to lag — Foreground over Background. STANDARD-måten å bygge en comp på.",
    commonInputs: [
      { name: "Background", description: "Bakgrunn-lag (input).", valueFormat: "tool-output" },
      { name: "Foreground", description: "Forgrunn-lag (input).", valueFormat: "tool-output" },
      { name: "Blend", description: "Opacity 0-1.", valueFormat: "float 0-1" },
      { name: "ApplyMode", description: "Blend mode.", valueFormat: "string ('Merge', 'Screen', 'Multiply', 'Add', etc.)" },
    ],
  },
  {
    type: "ChannelBooleans",
    label: "Channel Booleans",
    category: "merge",
    description: "Channel-arithmetic mellom to lag (R/G/B/A-operasjoner).",
  },
  // ─────────── Transform ───────────
  {
    type: "Transform",
    label: "Transform",
    category: "transform",
    description: "2D translate/rotate/scale på et lag.",
    commonInputs: [
      { name: "Center", description: "Center-position (XY).", valueFormat: "Point — settes via Center.X og Center.Y" },
      { name: "Angle", description: "Rotation i grader.", valueFormat: "float -360 to 360" },
      { name: "Size", description: "Uniform scale.", valueFormat: "float 0+" },
    ],
  },
  {
    type: "Crop",
    label: "Crop",
    category: "transform",
    description: "Beskjær laget til rektangel.",
  },
  // ─────────── Effects / blur / glow ───────────
  {
    type: "Blur",
    label: "Blur",
    category: "effect",
    description: "Standard Gaussian/box-blur.",
    commonInputs: [
      { name: "XBlurSize", description: "Horisontal blur-styrke.", valueFormat: "float 0+" },
      { name: "YBlurSize", description: "Vertikal blur-styrke.", valueFormat: "float 0+" },
    ],
  },
  {
    type: "Glow",
    label: "Glow",
    category: "effect",
    description: "Soft glow / bloom-effekt.",
  },
  {
    type: "Defocus",
    label: "Defocus",
    category: "effect",
    description: "Realistisk lens-defocus (bedre enn Blur for cinematic look).",
  },
  // ─────────── Color ───────────
  {
    type: "ColorCorrector",
    label: "Color Corrector",
    category: "color",
    description: "Lift/Gamma/Gain/Saturation. Bedre å gjøre på Color page; her for in-comp-grading.",
  },
  {
    type: "BrightnessContrast",
    label: "Brightness Contrast",
    category: "color",
    description: "Enkel brightness/contrast-justering.",
    commonInputs: [
      { name: "Brightness", description: "-1 til 1", valueFormat: "float -1 to 1" },
      { name: "Contrast", description: "-1 til 1", valueFormat: "float -1 to 1" },
      { name: "Gamma", description: "Gamma adjustment.", valueFormat: "float 0+" },
      { name: "Saturation", description: "Mettning.", valueFormat: "float 0-2" },
    ],
  },
  {
    type: "HueCurves",
    label: "Hue Curves",
    category: "color",
    description: "Per-hue justering (advanced color grading).",
  },
  // ─────────── Masks ───────────
  {
    type: "Rectangle",
    label: "Rectangle Mask",
    category: "mask",
    description: "Rektangulær mask (kan kobles til Effect Mask-input på andre noder).",
  },
  {
    type: "Ellipse",
    label: "Ellipse Mask",
    category: "mask",
    description: "Sirkulær/oval mask.",
  },
  {
    type: "Polygon",
    label: "Polygon Mask",
    category: "mask",
    description: "Vilkårlig polygon-mask (bezier-kurver).",
  },
  {
    type: "BSpline",
    label: "B-Spline Mask",
    category: "mask",
    description: "Smooth B-spline-mask — bra for organiske former.",
  },
  // ─────────── Tracker ───────────
  {
    type: "Tracker",
    label: "Tracker",
    category: "tracker",
    description: "Standard 2D-tracker (translate/rotate/scale).",
  },
  {
    type: "PlanarTracker",
    label: "Planar Tracker",
    category: "tracker",
    description: "Planar tracking for skjerm-erstatninger / sign-replacement.",
  },
  // ─────────── Output ───────────
  {
    type: "MediaOut",
    label: "MediaOut",
    category: "output",
    description:
      "Comp-output til timeline. Hver Fusion-comp har én. Final-merge skal koble til denne.",
  },
] as const;

export const FUSION_CATEGORIES: readonly FusionToolCategory[] = [
  "generator",
  "effect",
  "merge",
  "text",
  "transform",
  "mask",
  "color",
  "tracker",
  "output",
] as const;

/** Hent katalog filtrert på kategori. */
export function getFusionCatalog(filter?: {
  category?: FusionToolCategory;
}): FusionToolEntry[] {
  return FUSION_TOOLS_CATALOG.filter((e) => {
    if (filter?.category && e.category !== filter.category) return false;
    return true;
  });
}
