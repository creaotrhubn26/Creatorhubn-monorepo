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
  | "output"
  | "3d"
  | "particles";

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
  // ─────────── 3D — scene / geometri / kamera / lys ───────────
  {
    type: "Text3D",
    label: "Text+ 3D",
    category: "3d",
    description:
      "Ekstrudert 3D-tekst med bezels, materialer, depth. Brukes for fancy bryllup-titler med 3D-perspektiv.",
    commonInputs: [
      { name: "StyledText", description: "Tekst-innholdet.", valueFormat: "string" },
      { name: "ExtrusionDepth", description: "3D-dybde.", valueFormat: "float 0+" },
      { name: "Font", description: "Font-familie.", valueFormat: "string" },
      { name: "Size", description: "Tekst-størrelse.", valueFormat: "float 0-1" },
    ],
  },
  {
    type: "Shape3D",
    label: "Shape 3D",
    category: "3d",
    description:
      "3D-primitiver: sphere, cube, cylinder, plane, torus, cone. Velg via Shape-input.",
    commonInputs: [
      {
        name: "Shape",
        description: "0=Plane, 1=Cube, 2=Sphere, 3=Cylinder, 4=Cone, 5=Torus",
        valueFormat: "int 0-5",
      },
      { name: "Translate.X", description: "Position X", valueFormat: "float" },
      { name: "Translate.Y", description: "Position Y", valueFormat: "float" },
      { name: "Translate.Z", description: "Position Z", valueFormat: "float" },
    ],
  },
  {
    type: "Camera3D",
    label: "Camera 3D",
    category: "3d",
    description:
      "3D-kamera med perspektiv. Connect til Merge3D for å definere viewpoint. Animér Translate for fly-through.",
    commonInputs: [
      { name: "AoV", description: "Field of view i grader.", valueFormat: "float 0-180" },
      { name: "Translate.X", description: "Camera X position.", valueFormat: "float" },
      { name: "Translate.Y", description: "Camera Y position.", valueFormat: "float" },
      { name: "Translate.Z", description: "Camera Z position (typisk -3 til -10).", valueFormat: "float" },
      { name: "Rotate.X", description: "Pitch (grader).", valueFormat: "float -180 to 180" },
      { name: "Rotate.Y", description: "Yaw (grader).", valueFormat: "float -180 to 180" },
    ],
  },
  {
    type: "PointLight",
    label: "Point Light",
    category: "3d",
    description: "Punktlys med fall-off. Connect til Merge3D for å belyse scene.",
    commonInputs: [
      { name: "Translate.X", description: "Light X position.", valueFormat: "float" },
      { name: "Translate.Y", description: "Light Y position.", valueFormat: "float" },
      { name: "Translate.Z", description: "Light Z position.", valueFormat: "float" },
      { name: "Intensity", description: "Lys-intensitet.", valueFormat: "float 0+" },
    ],
  },
  {
    type: "SpotLight",
    label: "Spot Light",
    category: "3d",
    description: "Retningsstyrt spotlight med cone-vinkel.",
    commonInputs: [
      { name: "ConeAngle", description: "Cone-vinkel i grader.", valueFormat: "float 0-180" },
      { name: "PenumbraAngle", description: "Soft fall-off cone.", valueFormat: "float 0-180" },
      { name: "Intensity", description: "Lys-intensitet.", valueFormat: "float 0+" },
    ],
  },
  {
    type: "DirectionalLight",
    label: "Directional Light",
    category: "3d",
    description: "Parallelt lys (solenergi-stil) uten avstand-fall-off.",
  },
  {
    type: "AmbientLight",
    label: "Ambient Light",
    category: "3d",
    description: "Global ambient-belysning på hele scenen.",
  },
  {
    type: "Merge3D",
    label: "Merge 3D",
    category: "3d",
    description:
      "Kombiner 3D-objekter, kameraer, lys til én scene. Connect inputs SceneInput1, SceneInput2, ...",
  },
  {
    type: "Transform3D",
    label: "Transform 3D",
    category: "3d",
    description:
      "Transform-noden i 3D-rom. Brukes for å pakke et 3D-objekt med ekstra transform.",
    commonInputs: [
      { name: "Translate.X", description: "Position X", valueFormat: "float" },
      { name: "Translate.Y", description: "Position Y", valueFormat: "float" },
      { name: "Translate.Z", description: "Position Z", valueFormat: "float" },
      { name: "Rotate.X", description: "Rotation X (grader)", valueFormat: "float" },
      { name: "Rotate.Y", description: "Rotation Y (grader)", valueFormat: "float" },
      { name: "Rotate.Z", description: "Rotation Z (grader)", valueFormat: "float" },
      { name: "XScale", description: "Scale X", valueFormat: "float 0+" },
      { name: "YScale", description: "Scale Y", valueFormat: "float 0+" },
      { name: "ZScale", description: "Scale Z", valueFormat: "float 0+" },
    ],
  },
  {
    type: "Renderer3D",
    label: "Renderer 3D",
    category: "3d",
    description:
      "Render 3D-scene til 2D-image. KREVES for å koble 3D-pipeline til MediaOut. Connect SceneInput ← Merge3D-output.",
    commonInputs: [
      { name: "ImageWidth", description: "Output width.", valueFormat: "int" },
      { name: "ImageHeight", description: "Output height.", valueFormat: "int" },
    ],
  },
  {
    type: "ImagePlane3D",
    label: "Image Plane 3D",
    category: "3d",
    description: "2D-bilde mapped til 3D-plane. Brukes for bilde-strukturer i 3D-rom.",
  },
  {
    type: "Custom3D",
    label: "Custom 3D",
    category: "3d",
    description:
      "Custom 3D-objekt. Brukes for å bygge tilpassede 3D-geometrier.",
  },
  {
    type: "Replicate3D",
    label: "Replicate 3D",
    category: "3d",
    description:
      "Instans ett 3D-objekt mange ganger basert på partikler eller annet input.",
  },
  {
    type: "Duplicate3D",
    label: "Duplicate 3D",
    category: "3d",
    description: "Repeat 3D-objekt med innstilt transform-step.",
  },
  {
    type: "FBXMesh3D",
    label: "FBX Mesh 3D",
    category: "3d",
    description:
      "Importer FBX-mesh fra disk inn i 3D-scene.",
    commonInputs: [
      { name: "Filename", description: "Path til .fbx-fil.", valueFormat: "string" },
    ],
  },
  {
    type: "AlembicMesh3D",
    label: "Alembic Mesh 3D",
    category: "3d",
    description: "Importer Alembic-cache (.abc) — typisk fra Blender/Maya.",
  },
  {
    type: "Override3D",
    label: "Override 3D",
    category: "3d",
    description: "Overstyr properties på et 3D-objekt nedstrøms.",
  },
  // ─────────── Partikler ───────────
  {
    type: "pEmitter",
    label: "pEmitter",
    category: "particles",
    description:
      "Partikkel-emitter (utstråler). Definerer hva slags partikler, hvor mange, og hvor de starter. Startpunkt for ethvert partikkel-system.",
    commonInputs: [
      { name: "Number", description: "Antall partikler per frame.", valueFormat: "float 0+" },
      { name: "Lifespan", description: "Levetid i frames.", valueFormat: "float" },
      { name: "Velocity", description: "Hastighet.", valueFormat: "float" },
    ],
  },
  {
    type: "pRender",
    label: "pRender",
    category: "particles",
    description:
      "Render partikler til 2D-image. ALLTID siste node i partikkel-kjede før Merge til hovedpipeline.",
    commonInputs: [
      {
        name: "RenderingMode",
        description: "0=2D, 1=3D rendering",
        valueFormat: "int 0-1",
      },
    ],
  },
  {
    type: "pSpawn",
    label: "pSpawn",
    category: "particles",
    description:
      "Sekundære partikler — spawn nye partikler fra eksisterende (f.eks. gnist fra fyrverkeri).",
  },
  {
    type: "pBounce",
    label: "pBounce",
    category: "particles",
    description: "Fysikk-bounce mot et bounce-plane.",
  },
  {
    type: "pVortex",
    label: "pVortex",
    category: "particles",
    description:
      "Vortex-kraft — partikler virvler rundt en sentral akse (typisk for tornado/whirlwind).",
  },
  {
    type: "pTurbulence",
    label: "pTurbulence",
    category: "particles",
    description:
      "Tilfeldig turbulens — gir naturlig 'liv' til ellers mekaniske partikler. Typisk for røyk, ild, støv.",
  },
  {
    type: "pFlow",
    label: "pFlow",
    category: "particles",
    description: "Bevegelses-strøm langs en angitt vector. Typisk for vind/strøm.",
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
  "3d",
  "particles",
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
