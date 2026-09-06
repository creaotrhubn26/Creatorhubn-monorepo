import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  cinematicFigureGenerationAvailable,
  customizeFigureGeneration,
  figureGenerationPlan,
  generateCharacterMaster,
  generateCinematicFigure,
  generateFigureSpritePackage,
} from "./mockupAiFigure";
import { materializeMockupAsset } from "./mockupCloudAssets";
import {
  DEFAULT_FIGURE_COMPOSITING,
  FIGURE_EXPRESSION_PRESETS,
  FIGURE_MOTION_PRESETS,
  FIGURE_POSE_PRESETS,
} from "./mockupFigurePipeline";
import type {
  MockupCanvasSpec,
  MockupFigureRenderMode,
  MockupFigureVariant,
  MockupImageSlot,
  PersonRigPose,
} from "./mockupStudioModel";
import { useMockupStudio } from "./mockupStudioStore";

const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: 32,
  border: "1px solid rgba(91, 105, 135, .26)",
  borderRadius: 7,
  padding: "5px 7px",
  color: "#243248",
  background: "#FFFFFF",
  fontSize: 11,
};

const choiceStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  minHeight: 31,
  border: `1px solid ${active ? "#102A43" : "rgba(91, 105, 135, .26)"}`,
  borderRadius: 7,
  color: active ? "#FFFFFF" : "#324055",
  background: active ? "#102A43" : "#FFFFFF",
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 700,
});

function FigureAssetImage(props: { source: string; alt: string; height?: number }) {
  const [resolved, setResolved] = useState(props.source);
  useEffect(() => {
    let active = true;
    setResolved(props.source);
    void materializeMockupAsset(props.source).then((source) => {
      if (active) setResolved(source);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [props.source]);
  return <img src={resolved} alt={props.alt} style={{ width: "100%", height: props.height ?? 164, display: "block", objectFit: "contain", objectPosition: "50% 50%" }} />;
}

export function CinematicFigurePanel(props: {
  image: MockupImageSlot;
  canvas: MockupCanvasSpec;
  projectId: string;
  fallbackPreview: ReactNode;
}) {
  const { image, canvas, projectId, fallbackPreview } = props;
  const patchImage = useMockupStudio((state) => state.patchImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);
  const plan = figureGenerationPlan(image, canvas);
  const generatedAsset =
    image.figureGeneration?.status === "generated" &&
    image.mediaProvenance?.source === "generated";
  const renderMode = plan.renderMode ?? "editable-rig";
  const generated = generatedAsset && renderMode !== "editable-rig";
  const available = cinematicFigureGenerationAvailable();
  const appearance = plan.appearance!;

  const applyChoices = (
    choices: Parameters<typeof customizeFigureGeneration>[2],
    personStyle: Partial<NonNullable<MockupImageSlot["personStyle"]>> = {},
  ) => {
    const nextPlan = customizeFigureGeneration(image, canvas, choices);
    patchImage(image.id, {
      figureGeneration: nextPlan,
      personStyle: { ...image.personStyle, ...personStyle },
      mediaProvenance:
        image.mediaProvenance?.source === "generated" &&
        image.image.startsWith("data:image/")
          ? {
              ...image.mediaProvenance,
              consistencyKey: nextPlan.consistencyKey,
              seed: nextPlan.seed,
            }
          : {
              source: "deterministic-procedural",
              disclosure: "representative-concept-illustration",
              consistencyKey: nextPlan.consistencyKey,
              seed: nextPlan.seed,
            },
    });
    setError(null);
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      patchImage(image.id, {
        figureGeneration: { ...plan, status: "generating", error: undefined },
      });
      setProgress("High-end variant · genererer og kvalitetssjekker");
      patchImage(image.id, await generateCinematicFigure(image, canvas, projectId));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Figurgenereringen feilet.";
      patchImage(image.id, {
        figureGeneration: { ...plan, status: "failed", error: message },
      });
      setError(message);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const runMaster = async () => {
    setBusy(true); setError(null);
    try {
      patchImage(image.id, { figureGeneration: { ...plan, status: "generating", error: undefined } });
      const result = await generateCharacterMaster(image, canvas, projectId, setProgress);
      patchImage(image.id, result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Karakter-masteren feilet.";
      patchImage(image.id, { figureGeneration: { ...plan, status: "failed", error: message } });
      setError(message);
    } finally { setProgress(null); setBusy(false); }
  };

  const runSpritePackage = async () => {
    setBusy(true); setError(null);
    try {
      patchImage(image.id, { figureGeneration: { ...plan, status: "generating", error: undefined } });
      const result = await generateFigureSpritePackage(image, canvas, projectId, setProgress);
      patchImage(image.id, result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Spritepakken feilet.";
      patchImage(image.id, { figureGeneration: { ...plan, status: "failed", error: message } });
      setError(message);
    } finally { setProgress(null); setBusy(false); }
  };

  const resetToFallback = () => {
    patchImage(image.id, {
      figureGeneration: {
        ...plan,
        renderMode: "editable-rig",
        error: undefined,
      },
      mediaProvenance:
        image.mediaProvenance?.source === "generated"
          ? image.mediaProvenance
          : {
              source: "deterministic-procedural",
              disclosure: "representative-concept-illustration",
              consistencyKey: plan.consistencyKey,
              seed: plan.seed,
            },
    });
    setError(null);
  };

  const setRenderMode = (nextMode: MockupFigureRenderMode) => {
    if (nextMode === "generated-raster" && !generatedAsset) return;
    if (nextMode === "sprite-sequence" && !image.sprite?.frames.length) return;
    patchImage(image.id, {
      figureGeneration: { ...plan, renderMode: nextMode },
    });
    setError(null);
  };

  const applyRigPreset = (values: Partial<PersonRigPose>) => {
    const next = { ...(image.kf ?? {}) };
    (Object.keys(values) as (keyof PersonRigPose)[]).forEach((key) => {
      next[key] = [{ t: 0, v: values[key]! }];
    });
    patchImage(image.id, { kf: next });
  };

  const activateVariant = (variant: MockupFigureVariant) => {
    patchImage(image.id, {
      image: variant.image,
      sprite: undefined,
      figureGeneration: {
        ...plan,
        renderMode: "generated-raster",
        status: "generated",
        poseId: variant.poseId || plan.poseId,
        expressionId: variant.expressionId || plan.expressionId,
        visualQa: variant.qa,
        assetHash: variant.assetHash,
        generatedAt: variant.generatedAt,
      },
      mediaProvenance: {
        ...image.mediaProvenance,
        source: "generated",
        disclosure: "representative-concept-illustration",
        assetHash: variant.assetHash,
      },
    });
  };

  const toggleComparison = (variantId: string) => {
    setComparison((current) => current.includes(variantId)
      ? current.filter((id) => id !== variantId)
      : [...current.slice(-1), variantId]);
  };

  return (
    <section
      aria-label="Kinematisk 3D-figur"
      style={{
        marginBottom: 12,
        padding: 10,
        border: "1px solid rgba(91, 105, 135, .22)",
        borderRadius: 12,
        background:
          "linear-gradient(145deg, rgba(17, 31, 56, .06), rgba(255, 255, 255, .86))",
      }}
    >
      <div
        style={{
          minHeight: 132,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          borderRadius: 9,
          background: "rgba(15, 31, 54, .045)",
        }}
      >
        {generated ? (
          <FigureAssetImage source={image.image} alt={image.altText || "Representativ kinematisk 3D-figur"} />
        ) : (
          fallbackPreview
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 9,
        }}
      >
        <span
          style={{
            padding: "4px 7px",
            borderRadius: 999,
            color: "#173E35",
            background: "rgba(44, 182, 125, .15)",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {generated
            ? "Kinematisk 3D · generert"
            : "Kinematisk 3D · redigerbar fallback"}
        </span>
        <span style={{ color: "#6A7280", fontSize: 10 }}>seed {plan.seed}</span>
      </div>
      <p
        style={{
          margin: "8px 0",
          color: "#555F70",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        Original konseptfigur med brandfarger og fast karakter-seed. Figuren er
        ikke en ekte ansatt og kopierer ingen eksisterende filmfigur.
      </p>
      <div style={{ marginBottom: 9 }}>
        <div
          style={{
            marginBottom: 5,
            color: "#4D596C",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          Rendermodus
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            type="button"
            onClick={() => setRenderMode("editable-rig")}
            style={choiceStyle(renderMode === "editable-rig")}
          >
            Fullt redigerbar rigg
          </button>
          <button
            type="button"
            onClick={() => setRenderMode("generated-raster")}
            disabled={!generatedAsset}
            title={
              generatedAsset
                ? "Vis generert high-end-figur"
                : "Generer en figur først"
            }
            style={{
              ...choiceStyle(renderMode === "generated-raster"),
              opacity: generatedAsset ? 1 : 0.48,
              cursor: generatedAsset ? "pointer" : "not-allowed",
            }}
          >
            Generert high-end
          </button>
          <button
            type="button"
            onClick={() => setRenderMode("sprite-sequence")}
            disabled={!image.sprite?.frames.length}
            style={{
              ...choiceStyle(renderMode === "sprite-sequence"),
              opacity: image.sprite?.frames.length ? 1 : 0.48,
              cursor: image.sprite?.frames.length ? "pointer" : "not-allowed",
            }}
          >
            Sprite
          </button>
        </div>
        <div
          style={{
            marginTop: 5,
            color: "#687184",
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          Rigg-modus styres uten AI med ledd- og transform-keyframes nedenfor.
          Et generert bilde kan fortsatt flyttes, skaleres, roteres og fades som
          ett lag. Sprite bruker kryssfade mellom identitetslåste high-end-frames.
        </div>
      </div>

      <div style={{ marginBottom: 9 }}>
        <div
          style={{
            marginBottom: 5,
            color: "#4D596C",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          Presentasjon
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            type="button"
            onClick={() =>
              applyChoices(
                { presentation: "female" },
                { presentation: "female" },
              )
            }
            style={choiceStyle(plan.presentation === "female")}
          >
            Kvinne
          </button>
          <button
            type="button"
            onClick={() =>
              applyChoices({ presentation: "male" }, { presentation: "male" })
            }
            style={choiceStyle(plan.presentation === "male")}
          >
            Mann
          </button>
          <button
            type="button"
            onClick={() =>
              applyChoices(
                { presentation: "neutral" },
                { presentation: "neutral" },
              )
            }
            style={choiceStyle(plan.presentation === "neutral")}
          >
            Nøytral
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 7,
          marginBottom: 8,
        }}
      >
        <label style={{ color: "#4D596C", fontSize: 10 }}>
          Aldersuttrykk
          <select
            value={appearance.ageRange}
            onChange={(event) =>
              applyChoices(
                {
                  appearance: {
                    ageRange: event.target.value as typeof appearance.ageRange,
                  },
                },
                {
                  ageRange: event.target.value as typeof appearance.ageRange,
                },
              )
            }
            style={{ ...fieldStyle, marginTop: 4 }}
          >
            <option value="young-adult">Ung voksen</option>
            <option value="adult">Voksen</option>
            <option value="mature">Moden</option>
          </select>
        </label>
        <label style={{ color: "#4D596C", fontSize: 10 }}>
          Ansiktsform
          <select
            value={appearance.faceShape}
            onChange={(event) =>
              applyChoices(
                {
                  appearance: {
                    faceShape: event.target
                      .value as typeof appearance.faceShape,
                  },
                },
                {
                  faceShape: event.target.value as typeof appearance.faceShape,
                },
              )
            }
            style={{ ...fieldStyle, marginTop: 4 }}
          >
            <option value="soft">Myk</option>
            <option value="balanced">Balansert</option>
            <option value="angular">Markert</option>
          </select>
        </label>
        <label style={{ color: "#4D596C", fontSize: 10 }}>
          Hårform
          <select
            value={appearance.hairStyle}
            onChange={(event) =>
              applyChoices(
                {
                  appearance: {
                    hairStyle: event.target
                      .value as typeof appearance.hairStyle,
                  },
                },
                {
                  hairStyle: {
                    short: "kort",
                    volume: "buffert",
                    curly: "krøller",
                    coily: "coily",
                    bald: "bald",
                  }[event.target.value] as NonNullable<
                    MockupImageSlot["personStyle"]
                  >["hairStyle"],
                },
              )
            }
            style={{ ...fieldStyle, marginTop: 4 }}
          >
            <option value="short">Kort</option>
            <option value="volume">Volum</option>
            <option value="curly">Krøller</option>
            <option value="coily">Coily</option>
            <option value="bald">Barbert</option>
          </select>
        </label>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}
        >
          <label style={{ color: "#4D596C", fontSize: 10 }}>
            Hudtone
            <input
              aria-label="Hudtone"
              type="color"
              value={appearance.skinTone}
              onChange={(event) =>
                applyChoices(
                  { appearance: { skinTone: event.target.value } },
                  { skin: event.target.value },
                )
              }
              style={{ ...fieldStyle, marginTop: 4, padding: 3 }}
            />
          </label>
          <label style={{ color: "#4D596C", fontSize: 10 }}>
            Hår
            <input
              aria-label="Hårfarge"
              type="color"
              value={appearance.hairColor}
              onChange={(event) =>
                applyChoices(
                  { appearance: { hairColor: event.target.value } },
                  { hair: event.target.value },
                )
              }
              style={{ ...fieldStyle, marginTop: 4, padding: 3 }}
            />
          </label>
        </div>
      </div>

      <label
        style={{
          display: "block",
          marginBottom: 9,
          color: "#4D596C",
          fontSize: 10,
        }}
      >
        Egen utseendebeskrivelse
        <textarea
          value={appearance.customDirection || ""}
          onChange={(event) =>
            applyChoices({
              appearance: { customDirection: event.target.value },
            })
          }
          placeholder="For eksempel: fregner, firkantede briller, vennlig smil"
          rows={2}
          style={{ ...fieldStyle, marginTop: 4, resize: "vertical" }}
        />
      </label>
      <div
        style={{
          margin: "-5px 0 9px",
          color: "#687184",
          fontSize: 9,
          lineHeight: 1.4,
        }}
      >
        Fritekst brukes ved neste high-end-generering. De strukturerte valgene
        over oppdaterer den manuelle riggen direkte uten AI.
      </div>

      <div data-testid="figure-pose-expression-library" style={{ marginBottom: 10, paddingTop: 8, borderTop: "1px solid rgba(91, 105, 135, .16)" }}>
        <div style={{ marginBottom: 5, color: "#4D596C", fontSize: 10, fontWeight: 700 }}>Positur</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FIGURE_POSE_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => {
              applyChoices({ poseId: preset.id }, { scenario: preset.id === "walking" ? "walk" : preset.id === "presenting" || preset.id === "pointing" ? "presenter" : "stand" });
              applyRigPreset(preset.rig);
            }} style={{ ...choiceStyle(plan.poseId === preset.id), flex: "1 1 30%" }}>
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{ margin: "8px 0 5px", color: "#4D596C", fontSize: 10, fontWeight: 700 }}>Ansikksuttrykk</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FIGURE_EXPRESSION_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => {
              applyChoices({ expressionId: preset.id });
              applyRigPreset(preset.rig);
            }} style={{ ...choiceStyle(plan.expressionId === preset.id), flex: "1 1 42%" }}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div data-testid="figure-motion-presets" style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 5, color: "#4D596C", fontSize: 10, fontWeight: 700 }}>Manuell bevegelse · keyframes</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FIGURE_MOTION_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => patchImage(image.id, { kf: { ...(image.kf ?? {}), ...preset.keyframes } })}
              style={{ ...choiceStyle(false), flex: "1 1 30%" }}>
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 5, color: "#687184", fontSize: 9, lineHeight: 1.4 }}>Kurvene er interruptible, redigerbare i timeline-panelet og beholder fade-only ved redusert bevegelse.</div>
      </div>

      <div data-testid="figure-character-master" style={{ marginBottom: 10, padding: 8, borderRadius: 9, background: "rgba(16, 42, 67, .055)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
          <strong style={{ color: "#324055", fontSize: 10 }}>Karakter-master</strong>
          <span style={{ color: plan.characterMaster ? "#16724B" : "#687184", fontSize: 9 }}>{plan.characterMaster ? "3 visninger klare" : "Ikke opprettet"}</span>
        </div>
        {plan.characterMaster ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 7 }}>
              {(["front", "three-quarter", "profile"] as const).map((view) => {
                const asset = plan.characterMaster?.views[view];
                return asset ? (
                  <button key={view} type="button" onClick={() => activateVariant(asset)} style={{ padding: 2, border: plan.characterMaster?.approvedView === view ? `2px solid ${canvas.accent}` : "1px solid rgba(91,105,135,.2)", borderRadius: 7, background: "#fff", cursor: "pointer" }}>
                    <FigureAssetImage source={asset.image} alt={asset.label} height={74} />
                    <span style={{ fontSize: 8, color: "#4D596C" }}>{asset.label.replace("Master · ", "")}</span>
                  </button>
                ) : null;
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 7 }}>
              {(Object.keys(plan.characterMaster.locks) as Array<keyof typeof plan.characterMaster.locks>).map((key) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, color: "#4D596C", fontSize: 9 }}>
                  <input type="checkbox" checked={plan.characterMaster!.locks[key]} onChange={(event) => patchImage(image.id, { figureGeneration: { ...plan, characterMaster: { ...plan.characterMaster!, locks: { ...plan.characterMaster!.locks, [key]: event.target.checked } } } })} />
                  Lås {{ face: "ansikt", hair: "hår", outfit: "antrekk", palette: "palett" }[key]}
                </label>
              ))}
            </div>
          </>
        ) : null}
        <button type="button" onClick={() => void runMaster()} disabled={busy || !available}
          style={{ ...choiceStyle(false), width: "100%", marginTop: 7, opacity: busy || !available ? .55 : 1 }}>
          {plan.characterMaster ? "Regenerer 3-visnings-master" : "Lag 3-visnings-master"}
        </button>
      </div>

      <div data-testid="figure-sprite-package" style={{ marginBottom: 10, padding: 8, borderRadius: 9, background: "rgba(44, 177, 166, .07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <strong style={{ color: "#324055", fontSize: 10 }}>Lagdelte sprite-frames</strong>
          <span style={{ color: "#687184", fontSize: 9 }}>{image.sprite?.frames.length || 0} frames</span>
        </div>
        <div style={{ marginTop: 4, color: "#687184", fontSize: 9, lineHeight: 1.4 }}>Åtte semantiske lag (skygge, kropp, armer/hender, ansikt, mimikk, hår og rekvisitt) følger hver identitetslåste frame. Kryssfade gir rolig animasjon uten å late som et flatt raster er en 3D-rigg.</div>
        <button type="button" onClick={() => void runSpritePackage()} disabled={busy || !available || !plan.characterMaster}
          style={{ ...choiceStyle(false), width: "100%", marginTop: 7, opacity: busy || !available || !plan.characterMaster ? .55 : 1 }}>
          Generer 4-frame spritepakke
        </button>
      </div>

      <div data-testid="figure-compositing-controls" style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 5, color: "#4D596C", fontSize: 10, fontWeight: 700 }}>Compositing</div>
        {([
          ["contactShadow", "Kontaktskygge"], ["rimLight", "Brand-rimlys"], ["ambientMatch", "Miljømatch"],
          ["depthBlur", "Dybdeblur"], ["perspective", "Perspektiv"], ["groundOffset", "Bakkekontakt"],
        ] as const).map(([key, label]) => (
          <label key={key} style={{ display: "grid", gridTemplateColumns: "76px 1fr 28px", gap: 5, alignItems: "center", color: "#4D596C", fontSize: 9, marginBottom: 4 }}>
            {label}
            <input type="range" min={key === "perspective" ? -.25 : 0} max={1} step={.01}
              value={(plan.compositing || DEFAULT_FIGURE_COMPOSITING)[key]}
              onChange={(event) => patchImage(image.id, { figureGeneration: { ...plan, compositing: { ...(plan.compositing || DEFAULT_FIGURE_COMPOSITING), [key]: Number(event.target.value) } } })} />
            <span>{Math.round((plan.compositing || DEFAULT_FIGURE_COMPOSITING)[key] * 100)}</span>
          </label>
        ))}
      </div>

      {plan.variants?.length ? (
        <div data-testid="figure-variant-history" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <strong style={{ color: "#4D596C", fontSize: 10 }}>Variant-historikk</strong>
            <span style={{ color: "#687184", fontSize: 9 }}>{plan.variants.length}/8 · deduplisert</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {plan.variants.slice(-4).reverse().map((variant) => (
              <div key={variant.id} style={{ padding: 3, border: variant.assetHash && variant.assetHash === plan.assetHash ? `2px solid ${canvas.accent}` : "1px solid rgba(91,105,135,.2)", borderRadius: 7, background: "#fff" }}>
                <button type="button" onClick={() => activateVariant(variant)} style={{ width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
                  <FigureAssetImage source={variant.image} alt={variant.label} height={82} />
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 8, color: "#4D596C" }}>{variant.label}</span>
                  <span style={{ fontSize: 8, color: variant.qa?.status === "passed" ? "#16724B" : "#9A6110" }}>QA {variant.qa?.score ?? "–"}</span>
                </button>
                <label style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 2, color: "#687184", fontSize: 8 }}>
                  <input type="checkbox" checked={comparison.includes(variant.id)} onChange={() => toggleComparison(variant.id)} />
                  Sammenlign
                </label>
              </div>
            ))}
          </div>
          {comparison.length === 2 ? (
            <div data-testid="figure-variant-comparison" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 7, paddingTop: 7, borderTop: "1px solid rgba(91,105,135,.16)" }}>
              {comparison.map((id) => plan.variants?.find((variant) => variant.id === id)).filter((variant): variant is MockupFigureVariant => Boolean(variant)).map((variant) => (
                <div key={variant.id} style={{ minWidth: 0, textAlign: "center" }}>
                  <FigureAssetImage source={variant.image} alt={`Sammenlign ${variant.label}`} height={112} />
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#4D596C", fontSize: 8 }}>{variant.label} · QA {variant.qa?.score ?? "–"}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {plan.visualQa ? (
        <div data-testid="figure-visual-qa" style={{ marginBottom: 10, padding: 8, borderRadius: 9, background: plan.visualQa.status === "passed" ? "rgba(44,177,166,.09)" : "rgba(205,137,32,.09)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
            <strong style={{ color: "#324055", fontSize: 10 }}>Automatisk visuell QA</strong>
            <span style={{ color: plan.visualQa.status === "passed" ? "#16724B" : "#9A6110", fontSize: 10, fontWeight: 700 }}>{plan.visualQa.score}/100</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginTop: 6 }}>
            {plan.visualQa.checks.map((check) => (
              <span key={check.id} title={check.detail} style={{ color: check.passed ? "#16724B" : "#A23B3B", fontSize: 8 }}>{check.passed ? "✓" : "!"} {check.id}</span>
            ))}
          </div>
        </div>
      ) : null}

      {progress ? <div role="status" style={{ marginBottom: 8, color: "#405168", fontSize: 10 }}>{progress}</div> : null}

      <div
        style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9 }}
      >
        <span
          style={{
            padding: "3px 6px",
            borderRadius: 999,
            background: "rgba(16, 42, 67, .08)",
            color: "#405168",
            fontSize: 9,
          }}
        >
          customize_subject_identity v1
        </span>
        <span
          style={{
            padding: "3px 6px",
            borderRadius: 999,
            background: "rgba(16, 42, 67, .08)",
            color: "#405168",
            fontSize: 9,
          }}
        >
          render_high_fidelity_subject v1
        </span>
        <span
          style={{
            padding: "3px 6px",
            borderRadius: 999,
            background: "rgba(16, 42, 67, .08)",
            color: "#405168",
            fontSize: 9,
          }}
        >
          rig_subject_motion v1
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={generate}
          disabled={busy || !available}
          title={
            available
              ? "Generer via den kreditt-gatede AI-proxyen"
              : "Tilgjengelig i desktop-appen når AI-proxyen er tilkoblet"
          }
          style={{
            flex: 1,
            minHeight: 34,
            border: 0,
            borderRadius: 8,
            color: "#FFFFFF",
            background: "#102A43",
            opacity: busy || !available ? 0.62 : 1,
            cursor: busy || !available ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {busy
            ? "Genererer…"
            : generatedAsset
              ? "Generer ny variant"
              : "Generer kinematisk 3D-figur"}
        </button>
        {generatedAsset ? (
          <button
            type="button"
            onClick={resetToFallback}
            style={{
              minHeight: 34,
              border: "1px solid rgba(91, 105, 135, .26)",
              borderRadius: 8,
              color: "#324055",
              background: "#FFFFFF",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Bruk redigerbar rigg
          </button>
        ) : null}
      </div>
      {!available ? (
        <div style={{ marginTop: 7, color: "#687184", fontSize: 10 }}>
          AI-generering aktiveres i desktop-appen; fallbacken eksporteres
          identisk i nettleseren.
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          style={{ marginTop: 7, color: "#A23B3B", fontSize: 10 }}
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
