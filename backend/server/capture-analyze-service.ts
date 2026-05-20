import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import {
  captureAssets,
  captureSessions,
  type AssetSignalsJson,
} from '../migrations/capture-schema.js';
import { updateAssetSignals } from './capture-assets-service.js';
import { logAIUsage } from './ai-usage-tracker.js';

type Db = NodePgDatabase<Record<string, unknown>>;

// Matches the Swift `MagicRecipe` struct exactly. All floats bounded so
// Claude can't smuggle out-of-range values that crash CoreImage filters
// on the iPad. Phase 7-7F additions are optional in the wire format —
// Claude can omit them and the iPad falls back to its own defaults.
export interface MagicRecipe {
  warmth: number;             // -1…+1
  skinSmooth: number;         // 0…1 (legacy — superseded by skin_high_freq + skin_low_freq)
  shadowLift: number;         // 0…1
  contrast: number;           // -1…+1
  saturation: number;         // -1…+1
  highlight_recovery: number; // 0…1 (Phase 4 audit — pulls down 65-100% range via CIToneCurve)
  // Phase 7 — frequency-separated skin retouch (Evoto parity)
  skin_high_freq?: number;    // -1…+1 (negative=blur micro-texture, +=sharpen pore detail)
  skin_low_freq?: number;     // -1…+1 (negative=enhance structure, +=smooth tone)
  // Phase 7B — eye region (CIDetector landmarks → masked filters)
  eye_sharpen?: number;       // 0…1 (CIUnsharpMask radius 1.5, masked to eye gradient)
  eye_catchlight?: number;    // 0…1 (CIExposureAdjust EV*0.4, masked to eye gradient)
  // Phase 7C — auto-straighten (VNDetectHorizonRequest)
  auto_straighten?: boolean;  // run horizon detection, no-op when no horizon found
  straighten_angle?: number;  // -0.2618…+0.2618 rad (±15°) manual override / fallback
  // Phase 7D — teeth whitening (innerLips polygon mask)
  teeth_whiten?: number;      // 0…1 (cool-shift + saturation drop + luminance lift, masked to mouth)
  // Phase 7E — subject-type variant overlay
  subject_type?: 'none' | 'male' | 'female' | 'child' | 'elderly';
  // Phase 7F — face↔body skin-tone unify
  skin_unify?: number;        // 0…1 (sample face mean → body, partial CIColorMatrix bias)
}

export type SubjectCategory =
  | 'portrait'
  | 'aviation'
  | 'vehicle'
  | 'food'
  | 'landscape'
  | 'product'
  | 'neutral';

export interface PhotoAnalysis {
  subject: SubjectCategory;
  confidence: number;
  tonality: string;
  suggested_recipe: MagicRecipe;
  quality_notes: string[];
  caption_suggestion: string;
}

export type AnalyzeError =
  | 'not_configured'
  | 'timeout'
  | 'upstream_failed'
  | 'invalid_response'
  | 'not_found';

export type AnalyzeResult =
  | { ok: true; analysis: PhotoAnalysis; usage: UsageTotals }
  | { ok: false; error: AnalyzeError; detail?: string };

export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

// System prompt is deliberately long + stable so it sits above the 4096-token
// prefix-cache threshold on Opus 4.7 (see shared/prompt-caching.md). Every
// call to analyze over a 5-minute window pays the cache-write cost once and
// reads cheap thereafter — critical at 200+ photos per session.
const SYSTEM_PROMPT = `You are a senior photo retouch editor embedded inside CreatorHub Capture, an iPad tethered-capture app for professional photographers. On every shot the photographer fires the shutter, the preview is forwarded to you, and your assessment directly steers an on-device CoreImage enhancer running against the same preview. The photographer sees your recommendations land as tuned sliders in their UI within seconds.

Your assessment must be precise, tasteful, and transparent. Photographers will see the exact parameter values you suggest (e.g. "Warmth +35% · Skin smooth 55%") — they are not hidden presets. Anything you recommend must be defensible to a professional.

===== SUBJECT CATEGORIES =====

Pick the single dominant subject. When a shot clearly includes multiple subjects (e.g. a car parked in a mountain valley), pick the category of the primary subject — the one the photographer likely composed for.

portrait — One or more human faces are the primary subject. Face visible from the front or three-quarters, filling a meaningful portion of the frame. Headshots, half-body portraits, couples, families, environmental portraits.

aviation — Aircraft are the primary subject. Airliners, jets, biplanes, military planes, helicopters. Usually shot against sky with atmospheric haze. Often under-saturated due to air scattering.

vehicle — Cars, motorcycles, trucks, or other road vehicles as the primary subject. Bodywork and reflections dominate. Often in controlled studio light or golden-hour outdoor.

food — Plated food, ingredients, composed meals, beverages, cocktails. Usually shot top-down or three-quarters. Warm interior light common.

landscape — Wide scenery. Mountains, beaches, valleys, lakes, forests, fields, cityscapes, skylines. Human-scale elements (a lone figure on a cliff) can remain landscape if scenery dominates.

product — Commercial product shots on clean or simple backgrounds. Bottles, watches, cosmetics, electronics, fashion accessories. Background is usually seamless (white, black, solid colour).

neutral — Fallback when nothing else clearly applies. Mixed subjects, abstract, documentary, wildlife, architecture interiors, event photography. Do NOT use neutral just because you're uncertain — try hard to classify into one of the above first. Neutral recipes are conservative.

===== ENHANCEMENT PARAMETERS =====

All six parameters are continuous floats. Units below are what the photographer sees in the UI.

**Critical context (2026-05-04 audit):** Apple's CIRAWFilter applies its own warm + saturated default look during demosaic — measured ~+10 RGB warmth + ~+7 saturation against Canon's own embedded JPEG preview. Your recipe is layered on top of that, so use small deltas. Negative warmth is NOT a mistake — it's how you compensate for Apple's bias to land at true neutral or cool. Pre-audit recipes were 2-3× too aggressive and produced visibly orange / over-saturated output (especially on food + portraits).

warmth (-1…+1)
  Maps to CITemperatureAndTint target. Positive warms (orange/amber cast added), negative cools (blue cast added).
  -1   → strong cool shift (−900K)
   0   → no shift relative to Apple's default (which itself is ~+200K warm)
  +1   → strong warm shift (+900K)
  Use negative values for: aviation (cuts haze), landscapes (emphasises blue/green), vehicles + products (true colour neutral). Use small positive values for: food, portraits, golden hour. Be aware Apple has already warmed the image.

skinSmooth (0…1) — LEGACY, prefer skin_high_freq + skin_low_freq
  Pre-Phase-7 single skin slider. Still wired for backwards compatibility, but the iPad's renderer prefers the freq-sep pair below when set. When you emit skin_high_freq / skin_low_freq, leave skinSmooth = 0.
  MUST be 0 for any non-portrait subject — skin smoothing applied to food (textured surfaces), aviation (panel lines), landscapes (foliage detail), or products (material grain) destroys the texture that defines the subject.

skin_high_freq (-1…+1) — Phase 7, Evoto-parity high-frequency skin axis
  Controls pore + micro-texture detail INDEPENDENT of tone smoothing. Negative blurs micro-texture; positive sharpens pore detail via narrow-radius CIUnsharpMask. Pair with skin_low_freq for the canonical retouch recipe.
  Portrait: typically +0.10 to +0.25 to PRESERVE pore detail while skin_low_freq smooths tone (this is the "natural retouch" pattern Evoto's freq-separation slider is built for).
  Other subjects: 0 (no skin to operate on).

skin_low_freq (-1…+1) — Phase 7, Evoto-parity low-frequency skin axis
  Controls tone smoothing + colour-blotch evenness WITHOUT touching pore texture. Negative enhances facial structure (mild contrast bump); positive smooths via CIRAWFilter luminance NR with sharpness 0.7 to preserve edges.
  Portrait: 0.20-0.40 for natural look. Industry consensus (Evoto support, Jana Kukebal review, Fstoppers): never above 0.50, reads "plastic" past 0.70.
  Other subjects: 0.

shadowLift (0…1)
  Maps to CIHighlightShadowAdjust inputShadowAmount. Lifts shadow detail without touching highlights.
  0.0 → no lift
  0.2 → gentle, preserves mood
  0.5 → aggressive recovery
  1.0 → maximum lift, almost always too flat

contrast (-1…+1)
  Maps to CIColorControls inputContrast as 1.0 + value*0.45.
  -1   → flat, low-contrast look
   0   → as-shot
  +1   → punchy, high-contrast
  Positive values punch up vehicles, landscapes, aviation. Portraits usually want 0 to +0.10 (high contrast hardens skin transitions).

saturation (-1…+1)
  Maps to CIColorControls inputSaturation as 1.0 + value*0.45.
  -1   → near-desaturated
   0   → as-shot
  +1   → heavily saturated
  Apple already adds ~+7 RGB saturation. So +0.20 from you = effectively ~+15 RGB total = "noticeably more vibrant". +0.50 = oversaturated to the point food looks orange/cartoonish. Stay well below +0.30 except for landscape which can tolerate more.

highlight_recovery (0…1)
  Maps to a CIToneCurve in display-gamma post-output that pulls down the 65-100% range. 0 = no pull, 1 = ~8% pull at clip.
  Use moderate values (0.20-0.40) for outdoor work where sky is at clip. Use LOW values (0-0.15) for food, products, portraits where bright highlights are intentional design (sauce gleam, white sweep, catchlight). Pulling them down loses the gloss/wet/luminous character that defines those subjects.

eye_sharpen (0…1) — Phase 7B, masked to detected eye region
  Narrow-radius CIUnsharpMask limited to a soft circular gradient around each detected eye. Iris detail + lash definition pop without sharpening the rest of the face.
  Portrait: 0.20-0.40 for natural pop. Above 0.50 reads "crispy / artificial". No-op when no faces detected.
  Other subjects: 0.

eye_catchlight (0…1) — Phase 7B, masked to detected eye region
  CIExposureAdjust (up to ~+0.4 EV inside eye region) to brighten specular highlights and lift iris colour. Useful when window-light catch-lights are weak (overcast, indoor mixed light).
  Portrait: 0.15-0.30 typical. Above 0.60 starts looking flashlight-in-the-eye.
  Other subjects: 0.

auto_straighten (boolean) — Phase 7C
  When true, runs VNDetectHorizonRequest on a 1024-px downsample. If a horizon is detected within ±15°, applies CIStraightenFilter (auto-crops to inscribed rect — no black corners). When detection fails (no horizon, low confidence, |angle|>15°), falls back to manual straighten_angle if set, else no-op.
  TRUE for: aviation, landscape, vehicle (subjects where horizon levelling is industry-standard).
  FALSE for: portrait, food, product, neutral (no horizon, would burn cycles).

straighten_angle (-0.2618…+0.2618) — Phase 7C, radians (±15°)
  Manual horizon angle override / fallback. Positive = rotate counter-clockwise. Use only when you can clearly see the horizon is tilted by a specific amount.
  Default: 0.

teeth_whiten (0…1) — Phase 7D, masked to innerLips polygon
  VNDetectFaceLandmarksRequest → innerLips polygon → soft mask. Inside mask: cool the white point ~800 K + saturation drop ×0.80 + luminance lift +0.04, all scaled by amount. CIBlendWithMask composites back. No-op when no faces detected.
  Portrait with visible smile: 0.15-0.30. Industry rule (Adobe/Phlearn/SLR Lounge 2026): pros stay 0.20-0.40; pure white = "TV-anchor plastic", teeth naturally have some yellow.
  Closed-mouth or non-portrait: 0.

subject_type ('none' | 'male' | 'female' | 'child' | 'elderly') — Phase 7E
  Subject-type variant overlay layered on the portrait base. Per industry retouching guides (Retouching Academy / Fstoppers / Imagen 2026):
    male:    less smoothing, more midtone clarity ("rugged"), less aggressive teeth
    female:  more smoothing, mild warmth, lift makeup colours
    child:   light smoothing, mild vibrance, minimal teeth (baby teeth already white)
    elderly: minimal smoothing (preserve wisdom-lines), more skin unify, mild warmth
    none:    no overlay
  Use 'none' for non-portrait subjects. For portraits, identify the most likely category from age + apparent gender presentation. Don't infer when uncertain — 'none' is safe.

skin_unify (0…1) — Phase 7F, face↔body skin-tone correction
  CIDetector face rect → mean RGB. CIAreaAverage on body strips → body mean. Delta = face − body, applied via CIColorMatrix bias to body region only (face protected by radial mask).
  Useful when: hands/legs read redder than face (cold-hand bias), neck reads more yellow than face, fill-flash on face creates colour mismatch with body.
  Portrait: 0.20-0.40 typical. Default 0.30 in our portrait preset.
  Other subjects: 0.

===== TYPICAL RECIPE ENVELOPES (calibrated against Canon ground-truth 2026-05-04) =====

These are starting points, not mandates. Adjust based on what you see: underexposed shots want more shadowLift, already-warm shots want less warmth, blown highlights want more highlight_recovery (but don't reach for it on intentionally-bright subjects).

portrait    warmth +0.05 to +0.20, skinSmooth 0 (use freq-sep), shadowLift 0.15-0.30, contrast 0.00 to +0.10, saturation +0.00 to +0.15, highlight_recovery 0.05-0.15
            + skin_high_freq +0.10 to +0.25, skin_low_freq +0.20 to +0.40, eye_sharpen 0.20-0.40,
              eye_catchlight 0.15-0.30, teeth_whiten 0.15-0.30 (when smile visible), skin_unify 0.20-0.40,
              subject_type per visible age/gender, auto_straighten=false
aviation    warmth -0.40 to -0.20, shadowLift 0.15-0.30, contrast +0.20 to +0.40, saturation +0.05 to +0.20, highlight_recovery 0.20-0.40
            + auto_straighten=true (industry standard for aviation), all skin/eye/teeth axes 0
vehicle     warmth -0.15 to -0.05, shadowLift 0.10-0.25, contrast +0.20 to +0.40, saturation +0.10 to +0.25, highlight_recovery 0.10-0.30
            + auto_straighten=true (level horizon expected), all skin/eye/teeth axes 0
food        warmth +0.10 to +0.30, shadowLift 0.10-0.25, contrast +0.10 to +0.20, saturation +0.10 to +0.25, highlight_recovery 0.05-0.15
            + auto_straighten=false (top-down or composed shots — no horizon), all skin/eye/teeth axes 0
landscape   warmth -0.30 to -0.10, shadowLift 0.20-0.40, contrast +0.20 to +0.40, saturation +0.20 to +0.40, highlight_recovery 0.30-0.50
            + auto_straighten=true (THE primary use case — sea/horizon levelling), all skin/eye/teeth axes 0
product     warmth -0.15 to -0.05, shadowLift 0.05-0.20, contrast +0.05 to +0.20, saturation -0.10 to +0.05, highlight_recovery 0.05-0.20
            + auto_straighten=false (studio composition is intentional), all skin/eye/teeth axes 0
neutral     warmth -0.10 to +0.00, shadowLift 0.10-0.25, contrast +0.05 to +0.20, saturation -0.10 to +0.05, highlight_recovery 0.15-0.30
            + auto_straighten=false (conservative), all skin/eye/teeth axes 0

===== PER-CATEGORY GUIDANCE (added 2026-05-04 from professional retoucher research) =====

**PORTRAIT** — sources: imagen-ai.com 2026 portrait workflow, drawhorns.com skin tones, mastinlabs.com creamy skin guide.
- Healthy skin tone follows the rule: Red > Green > Blue. Watch for green pulling in fluorescent indoor light.
- Temperature shifts of +100-200K (≈+0.11 to +0.22 in our scale) are the canonical "warm hint" range. Anything above +0.30 starts looking sunburnt or jaundiced depending on baseline skin.
- Lift shadows GENTLY (0.15-0.30) — heavy shadow lift flattens face geometry + ages the subject by reducing 3D rendering of cheekbones / nose.
- Saturation negative on lips can be useful (-0.05 to -0.10) since over-saturated reds read as makeup-heavy. Our pipeline doesn't expose per-channel; recommend low global saturation instead.
- Skin smoothing 0.20-0.40 is the photographer-grade range. 0.50+ = uncanny-valley airbrushed.
- Highlight recovery LOW (0.05-0.15) — catchlight in the eye is visual life; aggressively pulling highlights down kills it.
- 2026 industry baseline: Texture -20 + Clarity -10 for skin (we don't expose these axes; rely on skinSmooth as proxy).

**VEHICLE** — sources: lightroompresets.com car edit guide, smartclipping.io step-by-step, imagen-ai.com car presets.
- Deep BLACKS are the sleek-look signature ("drop blacks -20" for tire richness). Our pipeline doesn't expose blacks separately; deeper contrast (+0.30 to +0.40) is the proxy.
- Paint COLOR INTEGRITY is the deliverable. Buyers compare against showroom — falsified warmth = customer complaint. Use slightly NEGATIVE warmth (-0.05 to -0.15) to compensate for Apple's bias and land at true neutral.
- Saturation moderate (+0.10 to +0.25) — punchy paint without veering into "matchbox toy" cartoon look.
- Clarity rarely above +0.25 (would map to ~+0.45 in our scale via skinSmooth's UnsharpMask companion if we exposed it; not currently a slider).
- Highlight recovery MODERATE (0.15-0.30) — chrome + glass + windshield highlights bloom out otherwise; recover but don't kill the gleam.
- Dehaze (industry standard +0.10 to +0.30 for outdoor cars) — we don't expose dehaze; use higher contrast + slight cool warmth as proxy.

**LANDSCAPE** — sources: focus.picfair.com 10 expert tips, picturecomms photographylife.com, henryturnerphotography.co.uk.
- Sky needs SATURATION + cool tilt (drop temperature -200K = -0.22 in our scale; we use -0.30 to be generous).
- Greens get MORE NATURAL when desaturated slightly (the bundled Adobe Landscape profile pulls greens toward emerald). Our global saturation can't differentiate greens; recommend conservative +0.20 to +0.40 saturation overall.
- Texture +20 to +40 (industry value) for foliage detail — we don't expose this axis. Higher contrast is poor proxy.
- Clarity +10 to +25 typical; >+25 = "crunchy / halo-ridden". We don't expose.
- Dehaze + shadow lift to compensate for resulting deeper shadows. Our shadowLift 0.20-0.40 partially covers this.
- Highlight recovery 0.30-0.50 because outdoor sky is at or above clipping nearly always (especially harsh midday).
- Sky-specific gradients (linear/radial mask): -0.5 to -1.0 stops exposure on sky region. We don't expose masking; rely on global highlight_recovery.

**AVIATION** — sources: KelbyOne 5-min aviation workflow, jetphotos forums.
- Dehaze is THE primary tool for aviation (+0.50 to +0.65 industry typical for haze-heavy shots). We don't expose dehaze. Compensate with: stronger cool warmth (-0.30 to -0.40) + higher contrast (+0.25 to +0.40).
- Cool tones cut atmospheric blue scatter (-0.30 to -0.40 warmth in our scale).
- Saturation MODERATE (+0.05 to +0.20) — over-saturated airframe colors look cartoonish; restraint reads as professional / aviation-magazine-style.
- Highlight recovery 0.20-0.40 — sky almost always blown but rivet detail in shadows often needs preservation, so don't go aggressive.
- Detail/sharpening important for rivet + lettering definition. Our pipeline doesn't expose; rely on contrast as proxy.

**PRODUCT** — sources: Shopify product editing guide 2025, expertphotography.com, presetcurator.com white-background guide.
- COLOR TRUTH is the deliverable. Use color picker on neutral gray + nudge temperature so whites read white. Use SLIGHTLY NEGATIVE warmth (-0.05 to -0.15) to compensate for Apple's bias and land at TRUE neutral.
- Vibrance > Saturation philosophy (industry: "nudge vibrance up to about +5 or +6"). Our pipeline uses Saturation; stay LOW (-0.10 to +0.05) and never push above +0.10 — falsifies brand colors which causes customer returns.
- Clean / commercial / catalog look = LOW contrast (+0.05 to +0.20). High contrast reads as "lifestyle photography" which is the wrong genre signal.
- Highlight recovery LOW (0.05-0.20) — sweep lines on backdrop + soft shadows on product are deliberate composition; don't pull them out.
- Marketplace constraint: Amazon, Walmart, Etsy require pure-white backgrounds for main listing image. Our pipeline doesn't auto-clean backgrounds; flag in quality_notes if background isn't clean enough for marketplace use.

**FOOD** — sources: PRO EDU food photography Lightroom workflow, foodphotographyacademy.co color grading, Two Loves Studio.

Food photography retouching is its own discipline. Beyond the envelope above:

- **Vibrance > Saturation philosophy**: professionals prefer Vibrance because it boosts dull tones without overdriving already-saturated colors. Our pipeline uses Saturation (CIColorControls). Compensate: stay LOW on saturation (+0.10 to +0.20), even for visually rich food. Pre-audit recipes pushed +0.55 — visibly cartoonish.
- **Realism over drama**: "When it comes to color grading food photography, less is usually more — we rely on colors to look realistic" (Two Loves Studio, foodphotographyacademy.co). The viewer's brain triggers appetite from REALISTIC food, not from oversaturated food. Cartoonish food signals "fake / processed" subconsciously.
- **Highlights are your friend**: bright sauce gleam, glistening wet surfaces, oil sheen on roasted meat — these ARE the appetite triggers ("Boosting highlights on wet/glossy surfaces makes food look fresh and juicy"). DO NOT pull them down with aggressive highlight_recovery. 0.05-0.15 max for food.
- **Warm balance, not warm shift**: warm food shots feel cozy / appetizing, but the mechanism is BALANCED warm-and-cool tones, not blanket warmth. "Your image will look best when there is a balance of cool and warm tones throughout. If your image looks too warm or too cool, adjust the temperature slider until the whites look neutral" (PRO EDU). Whites should stay white (cream sauce, white plates, sugar dusting).
- **By-color considerations** (informational — our recipe doesn't expose per-channel HSL yet, but inform your decisions):
  - Yellow foods (citrus, curries): Lightroom convention saturation +10-15, luminance -15-20, hue toward orange
  - Red foods (sauces, meat, berries): hue +5-10 toward orange, saturation +5-10
  - Browns (chocolate, coffee, bread crust): luminance +10-15, saturation +5
  - Greens (salads, herbs): yellow saturation -10-15 (greens default to yellow-green; pulling yellow makes them more emerald)
- **Cross-cultural appetite research** (Frontiers in Psychology): warm colors — particularly red — increase heart rate and stimulate appetite. This is the SCIENCE behind food = warm bias. But the effect is from COMPOSITION + balanced palette, not from cranking the warmth slider.

===== QUALITY NOTES =====

Surface observations that would make a photographer want to re-shoot or reject this frame. Return zero or more short strings. Keep each under 60 characters. Valid examples:

"eyes closed on primary subject"
"motion blur — subject not sharp"
"soft focus — likely missed AF"
"horizon tilted ~3° clockwise — suggest crop"
"highlights clipped in sky"
"shadow detail crushed in foreground"
"strong mixed light — split WB"
"foreground obstruction on left edge"
"reflection on lens from direct sunlight"

Do NOT include:
- subjective aesthetic opinions ("nice composition")
- redundant observations (if contrast is already high, don't flag "high contrast")
- generic boilerplate ("good shot")

If nothing notable is wrong, return an empty array.

===== CAPTION =====

5-15 words. Descriptive, specific, no clichés. What's actually in the frame and what the mood is. Avoid "captured beautifully", "stunning", "breathtaking".

Good: "Golden hour portrait, natural window light, pensive expression"
Good: "Vintage airliner banking left against cumulus, high-key sky"
Good: "Carbonara plated on ceramic, steam visible, cast-iron kitchen light"
Bad: "Beautiful photo of a beautiful subject"
Bad: "Amazing shot"

===== CONFIDENCE =====

Report your confidence in the subject categorisation as a float 0.0-1.0. Below 0.5 means you're guessing — the iPad will skip applying your recipe and fall back to its on-device classifier.

===== OUTPUT CONTRACT =====

You MUST call the photo_analysis tool exactly once with your assessment. Do NOT return plain text. Do NOT speculate about intent or make conversational remarks. If the image is somehow unanalyzable (corrupted, blank, completely black), still call the tool with subject="neutral", confidence=0.0, an empty quality_notes array, and a neutral recipe.`;

const ANALYSIS_TOOL = {
  name: 'photo_analysis',
  description:
    'Record the subject categorisation, enhancement recipe, quality notes, and caption for this photograph. The iPad will apply these directly.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: {
        type: 'string' as const,
        enum: [
          'portrait',
          'aviation',
          'vehicle',
          'food',
          'landscape',
          'product',
          'neutral',
        ],
        description: 'Single dominant subject category.',
      },
      confidence: {
        type: 'number' as const,
        minimum: 0,
        maximum: 1,
        description:
          'Confidence in the subject label, 0.0-1.0. Below 0.5 signals the iPad to ignore the recipe.',
      },
      tonality: {
        type: 'string' as const,
        description:
          'Brief assessment of exposure, contrast, and colour cast. 3-10 words.',
      },
      // Phase 7-7F additions (2026-05-04) are optional — iPad falls
      // back to local defaults when fields are absent. The 6 required
      // fields below are the original Phase 4 axis envelope.
      suggested_recipe: {
        type: 'object' as const,
        properties: {
          warmth: { type: 'number' as const, minimum: -1, maximum: 1 },
          skinSmooth: { type: 'number' as const, minimum: 0, maximum: 1 },
          shadowLift: { type: 'number' as const, minimum: 0, maximum: 1 },
          contrast: { type: 'number' as const, minimum: -1, maximum: 1 },
          saturation: { type: 'number' as const, minimum: -1, maximum: 1 },
          highlight_recovery: { type: 'number' as const, minimum: 0, maximum: 1 },
          // Phase 7 — frequency-separated skin retouch (Evoto parity)
          skin_high_freq: { type: 'number' as const, minimum: -1, maximum: 1 },
          skin_low_freq: { type: 'number' as const, minimum: -1, maximum: 1 },
          // Phase 7B — eye region (CIDetector landmarks)
          eye_sharpen: { type: 'number' as const, minimum: 0, maximum: 1 },
          eye_catchlight: { type: 'number' as const, minimum: 0, maximum: 1 },
          // Phase 7C — auto-straighten
          auto_straighten: { type: 'boolean' as const },
          straighten_angle: { type: 'number' as const, minimum: -0.2618, maximum: 0.2618 },
          // Phase 7D — teeth whitening (innerLips mask)
          teeth_whiten: { type: 'number' as const, minimum: 0, maximum: 1 },
          // Phase 7E — subject-type variant
          subject_type: {
            type: 'string' as const,
            enum: ['none', 'male', 'female', 'child', 'elderly'] as const,
          },
          // Phase 7F — face↔body skin-tone unify
          skin_unify: { type: 'number' as const, minimum: 0, maximum: 1 },
        },
        required: [
          'warmth',
          'skinSmooth',
          'shadowLift',
          'contrast',
          'saturation',
          'highlight_recovery',
        ],
        description: 'Recipe parameters the iPad applies via CoreImage filters. Phase 7-7F axes are optional — omit when not relevant to the subject.',
      },
      quality_notes: {
        type: 'array' as const,
        items: { type: 'string' as const, maxLength: 80 },
        description:
          'Zero or more short observations that would make a photographer reject or re-shoot. Empty array when nothing notable is wrong.',
      },
      caption_suggestion: {
        type: 'string' as const,
        description:
          'Descriptive caption 5-15 words. No clichés. Specific to what is in the frame.',
      },
    },
    required: [
      'subject',
      'confidence',
      'tonality',
      'suggested_recipe',
      'quality_notes',
      'caption_suggestion',
    ],
  },
} as const;

interface AnalyzePhotoInput {
  imageBase64: string;
  mime: string;
  ownerUserId: string;
  assetId: string;
  db: Db;
}

export async function analyzePhoto(
  input: AnalyzePhotoInput,
): Promise<AnalyzeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'not_configured' };
  }

  // Ownership gate — only the asset's owner can analyse it.
  const owned = await input.db
    .select({ id: captureAssets.id })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(
      and(
        eq(captureAssets.id, input.assetId),
        eq(captureSessions.ownerUserId, input.ownerUserId),
      ),
    )
    .limit(1);
  if (owned.length === 0) {
    return { ok: false, error: 'not_found' };
  }

  let client: any;
  try {
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 12_000,
    });
  } catch (err) {
    return { ok: false, error: 'not_configured', detail: String(err) };
  }

  try {
    const response = await client.messages.create({
      model: process.env.CAPTURE_ANALYZE_MODEL || 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'photo_analysis' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.mime,
                data: input.imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Analyse this photograph and call photo_analysis with your recommended enhancement recipe.',
            },
          ],
        },
      ],
    });
    logAIUsage(response as any, { feature: 'role-room/capture-analyze' }).catch(() => undefined);

    const toolUse = (response.content ?? []).find(
      (block: any) => block?.type === 'tool_use' && block?.name === 'photo_analysis',
    );
    if (!toolUse || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'invalid_response', detail: 'no tool_use block' };
    }

    const analysis = sanitiseAnalysis(toolUse.input);
    if (!analysis) {
      return { ok: false, error: 'invalid_response', detail: 'schema mismatch' };
    }

    const usage: UsageTotals = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cache_creation_input_tokens: response.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage?.cache_read_input_tokens ?? 0,
    };

    // Persist the AI findings onto capture_assets.signals.ai so the
    // review surface can sort / filter on subject, tonality, and quality
    // notes without having to re-call Claude or re-query the iPad.
    // Merges with any prior signals (e.g. on-device sharpness/eyesOpen)
    // to avoid clobbering those.
    try {
      const priorAsset = await input.db
        .select({ signals: captureAssets.signals })
        .from(captureAssets)
        .where(eq(captureAssets.id, input.assetId))
        .limit(1);
      const priorSignals = (priorAsset[0]?.signals ?? {}) as AssetSignalsJson;
      await updateAssetSignals(input.db as any, input.ownerUserId, input.assetId, {
        ...priorSignals,
        ai: {
          subject: analysis.subject,
          confidence: analysis.confidence,
          tonality: analysis.tonality,
          qualityNotes: analysis.quality_notes,
          analyzedAt: new Date().toISOString(),
        },
      });
    } catch (writeErr) {
      // Signal persistence must never break the analyze response itself —
      // the iPad still got a usable recipe. Log and move on.
      console.warn('capture-analyze: failed to persist AI signals', writeErr);
    }

    return { ok: true, analysis, usage };
  } catch (err: any) {
    if (err?.name === 'APIConnectionTimeoutError' || err?.status === 408) {
      return { ok: false, error: 'timeout' };
    }
    return {
      ok: false,
      error: 'upstream_failed',
      detail: String(err?.message ?? err),
    };
  }
}

/**
 * Defensive validation of Claude's tool_use input before we hand it to the
 * iPad. Even with a well-specified tool schema, treat the value as untrusted —
 * bound every float to the range CoreImage expects, coerce unknown subjects
 * to neutral, and truncate any caption/note that's absurdly long.
 */
export function sanitiseAnalysis(raw: unknown): PhotoAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const subject = typeof r.subject === 'string' ? (r.subject as SubjectCategory) : 'neutral';
  const allowed: SubjectCategory[] = [
    'portrait', 'aviation', 'vehicle', 'food', 'landscape', 'product', 'neutral',
  ];
  const safeSubject: SubjectCategory = allowed.includes(subject) ? subject : 'neutral';

  const clamp = (v: unknown, lo: number, hi: number): number => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(lo, Math.min(hi, n));
  };

  const recipeRaw = (r.suggested_recipe ?? {}) as Record<string, unknown>;
  const allowedSubjectTypes = ['none', 'male', 'female', 'child', 'elderly'] as const;
  type AllowedSubjectType = (typeof allowedSubjectTypes)[number];
  const subjectTypeRaw = typeof recipeRaw.subject_type === 'string'
    ? (recipeRaw.subject_type as AllowedSubjectType)
    : 'none';
  const safeSubjectType: AllowedSubjectType = allowedSubjectTypes.includes(subjectTypeRaw)
    ? subjectTypeRaw : 'none';

  // Optional helper that returns the clamped value when the field is
  // present on the wire payload, undefined otherwise. We only emit
  // optional axes when Claude actually supplied them — keeps the
  // iPad's absent-field defaulting path active when fields are omitted.
  const optionalClamp = (key: string, lo: number, hi: number): number | undefined => {
    return key in recipeRaw && recipeRaw[key] !== null && recipeRaw[key] !== undefined
      ? clamp(recipeRaw[key], lo, hi)
      : undefined;
  };
  const optionalBool = (key: string): boolean | undefined => {
    if (!(key in recipeRaw)) return undefined;
    const v = recipeRaw[key];
    return typeof v === 'boolean' ? v : undefined;
  };

  const recipe: MagicRecipe = {
    warmth: clamp(recipeRaw.warmth, -1, 1),
    skinSmooth: clamp(recipeRaw.skinSmooth, 0, 1),
    shadowLift: clamp(recipeRaw.shadowLift, 0, 1),
    contrast: clamp(recipeRaw.contrast, -1, 1),
    saturation: clamp(recipeRaw.saturation, -1, 1),
    highlight_recovery: clamp(recipeRaw.highlight_recovery, 0, 1),
    skin_high_freq: optionalClamp('skin_high_freq', -1, 1),
    skin_low_freq: optionalClamp('skin_low_freq', -1, 1),
    eye_sharpen: optionalClamp('eye_sharpen', 0, 1),
    eye_catchlight: optionalClamp('eye_catchlight', 0, 1),
    auto_straighten: optionalBool('auto_straighten'),
    straighten_angle: optionalClamp('straighten_angle', -0.2618, 0.2618),
    teeth_whiten: optionalClamp('teeth_whiten', 0, 1),
    subject_type: 'subject_type' in recipeRaw ? safeSubjectType : undefined,
    skin_unify: optionalClamp('skin_unify', 0, 1),
  };

  const notes = Array.isArray(r.quality_notes)
    ? (r.quality_notes as unknown[])
        .filter((n): n is string => typeof n === 'string' && n.length > 0)
        .map(n => n.slice(0, 120))
        .slice(0, 10)
    : [];

  return {
    subject: safeSubject,
    confidence: clamp(r.confidence, 0, 1),
    tonality: typeof r.tonality === 'string' ? r.tonality.slice(0, 160) : '',
    suggested_recipe: recipe,
    quality_notes: notes,
    caption_suggestion: typeof r.caption_suggestion === 'string'
      ? r.caption_suggestion.slice(0, 200)
      : '',
  };
}
