#include <metal_stdlib>
using namespace metal;

// Instanced dab-rendering: hver dab er en rotert/skalert quad som sampler
// dab-teksturen (alpha-maske) og tinter med penselfargen. Premultiplied
// alpha ut — blending one / oneMinusSourceAlpha.

struct DabInstance {
    float2 position;   // canvas-piksler
    float  size;       // diameter i piksler
    float  rotation;   // radianer
    float  alpha;      // 0..1
    float2 stretch;    // oval-skalering (Shade-tilt); (1,1) = rund
    float3 color;      // lineær rgb
    float  hardness;   // 0 = myk falloff, 1 = skarp kant
    float  grain;      // canvas-låst papirtann
    float  bleed;      // våt kantutvidelse
    float  paperProfile; // 0 smooth, 1 storyboard, 2 rough, 3 absorbent
};

struct VertexOut {
    float4 position [[position]];
    float2 uv;
    float  alpha;
    float3 color;
    float2 canvasPixel;
    float  hardness;
    float  grain;
    float  bleed;
    float  paperProfile;
};

vertex VertexOut dab_vertex(uint vertexId [[vertex_id]],
                            uint instanceId [[instance_id]],
                            constant DabInstance *instances [[buffer(0)]],
                            constant float2 &viewportSize [[buffer(1)]]) {
    // Quad-hjørner (triangle strip): (-0.5,-0.5)(0.5,-0.5)(-0.5,0.5)(0.5,0.5)
    float2 corners[4] = { float2(-0.5, -0.5), float2(0.5, -0.5),
                          float2(-0.5, 0.5),  float2(0.5, 0.5) };
    DabInstance dab = instances[instanceId];
    float2 corner = corners[vertexId] * dab.size * dab.stretch;
    float c = cos(dab.rotation), s = sin(dab.rotation);
    float2 rotated = float2(corner.x * c - corner.y * s,
                            corner.x * s + corner.y * c);
    float2 pixel = dab.position + rotated;
    // piksler → clip space (y ned i canvas, opp i clip)
    float2 clip = pixel / viewportSize * 2.0 - 1.0;
    clip.y = -clip.y;

    VertexOut out;
    out.position = float4(clip, 0, 1);
    out.uv = corners[vertexId] + 0.5;
    out.alpha = dab.alpha;
    out.color = dab.color;
    out.canvasPixel = pixel;
    out.hardness = dab.hardness;
    out.grain = dab.grain;
    out.bleed = dab.bleed;
    out.paperProfile = dab.paperProfile;
    return out;
}

static float paper_tooth(float2 pixel, float profile) {
    if (profile < 0.5) return 1.0;
    float frequency = profile < 1.5 ? 0.19 : (profile < 2.5 ? 0.31 : 0.14);
    float amplitude = profile < 1.5 ? 0.16 : (profile < 2.5 ? 0.29 : 0.12);
    float2 cell = floor(pixel * frequency);
    float noise = fract(sin(dot(cell, float2(12.9898, 78.233))) * 43758.5453);
    return 1.0 - amplitude + noise * amplitude;
}

fragment float4 dab_fragment(VertexOut in [[stage_in]],
                             texture2d<float> dabTexture [[texture(0)]]) {
    constexpr sampler dabSampler(mag_filter::linear, min_filter::linear);
    float mask = dabTexture.sample(dabSampler, in.uv).r;
    // Hardness former kanten uten å gjøre en teksturert blyant helt binær.
    float feather = mix(0.34, 0.025, clamp(in.hardness, 0.0, 1.0));
    float hardMask = smoothstep(0.5 - feather, 0.5 + feather, mask);
    mask = mix(mask, hardMask, clamp(in.hardness * 0.78, 0.0, 0.78));
    // Våte medier utvider en svak halo fra samme dabform.
    if (in.bleed > 0.001) {
        float2 expandedUV = (in.uv - 0.5) / (1.0 + in.bleed * 0.28) + 0.5;
        float expanded = dabTexture.sample(dabSampler, expandedUV).r;
        mask = max(mask, expanded * in.bleed * 0.42);
    }
    mask *= mix(1.0, paper_tooth(in.canvasPixel, in.paperProfile),
                clamp(in.grain, 0.0, 1.0));
    float a = mask * in.alpha;
    return float4(in.color * a, a);   // premultiplied
}

// Smudge: stempler en kopiert region av akkumulatoren tilbake på ny
// posisjon (Krita «Smearing mode»). Sampler full RGBA (premultiplied)
// og skalerer med strength i instansens alpha.
fragment float4 smudge_fragment(VertexOut in [[stage_in]],
                                texture2d<float> regionTexture [[texture(0)]]) {
    constexpr sampler regionSampler(mag_filter::linear, min_filter::linear);
    float4 region = regionTexture.sample(regionSampler, in.uv); // premultiplied
    // Sirkulær maske så stempelet ikke får firkantede kanter
    float2 centered = in.uv - 0.5;
    float falloff = 1.0 - smoothstep(0.35, 0.5, length(centered));
    return region * in.alpha * falloff;
}

// Komposit: tegn akkumulator-teksturen (premultiplied) over papirfargen.
struct BlitOut {
    float4 position [[position]];
    float2 uv;
};

vertex BlitOut blit_vertex(uint vertexId [[vertex_id]]) {
    float2 positions[4] = { float2(-1, -1), float2(1, -1), float2(-1, 1), float2(1, 1) };
    BlitOut out;
    out.position = float4(positions[vertexId], 0, 1);
    out.uv = float2((positions[vertexId].x + 1) * 0.5, (1 - positions[vertexId].y) * 0.5);
    return out;
}

// Non-destructive camera window. The committed texture always remains in the
// full drawing coordinate space; only the final presentation samples through
// this inverse camera transform. This keeps Pencil strokes editable after a
// shot-size/lens change and gives thumbnails/exports the same canonical crop.
static float2 framed_source_uv(
    float2 viewportUV, float4 framing, float4 sourceViewportSize) {
    const float zoom = max(0.0001, framing.z);
    const float roll = framing.w;
    const float c = cos(roll);
    const float s = sin(roll);
    const float2 sourceSize = max(sourceViewportSize.xy, float2(1.0));
    const float2 viewportSize = max(sourceViewportSize.zw, float2(1.0));
    const float sourceScale = max(viewportSize.x / sourceSize.x,
                                  viewportSize.y / sourceSize.y) * zoom;
    const float2 viewportDelta = (viewportUV - 0.5) * viewportSize;
    const float2 unrolledPixels = float2(
        viewportDelta.x * c + viewportDelta.y * s,
        -viewportDelta.x * s + viewportDelta.y * c);
    return framing.xy + unrolledPixels / (sourceScale * sourceSize);
}

static bool uv_is_inside(float2 uv) {
    return all(uv >= float2(0.0)) && all(uv <= float2(1.0));
}

// Kopier et panelbilde inn i den redigerbare RGBA-akkumulatoren. Bildet
// blir dermed første rasterlag i historikken, så destination-out-viskelær
// påvirker både originalpiksler og tidligere strøk.
fragment float4 blit_editable_base_fragment(BlitOut in [[stage_in]],
                                             texture2d<float> baseTexture [[texture(0)]],
                                             constant float4 &sourceUVTransform [[buffer(0)]]) {
    constexpr sampler blitSampler(mag_filter::linear, min_filter::linear);
    const float2 sourceUV = sourceUVTransform.xy + in.uv * sourceUVTransform.zw;
    return baseTexture.sample(blitSampler, sourceUV);
}

// Approved AI stages are generated for the final camera viewport. They must
// be aspect-filled only for provider rounding (for example 1536×864), never
// passed through framed_source_uv again.
fragment float4 blit_viewport_preview_fragment(
    BlitOut in [[stage_in]],
    texture2d<float> previewTexture [[texture(0)]],
    constant float4 &sourceUVTransform [[buffer(0)]]) {
    constexpr sampler blitSampler(mag_filter::linear, min_filter::linear);
    const float2 sourceUV = sourceUVTransform.xy + in.uv * sourceUVTransform.zw;
    return previewTexture.sample(blitSampler, sourceUV);
}

fragment float4 blit_fragment(BlitOut in [[stage_in]],
                              texture2d<float> canvasTexture [[texture(0)]],
                              constant float3 &paperColor [[buffer(0)]],
                              constant float4 &framing [[buffer(2)]],
                              constant float4 &sourceViewportSize [[buffer(3)]]) {
    constexpr sampler blitSampler(mag_filter::linear, min_filter::linear);
    const float2 sourceUV = framed_source_uv(in.uv, framing, sourceViewportSize);
    if (!uv_is_inside(sourceUV)) return float4(paperColor, 1.0);
    float4 ink = canvasTexture.sample(blitSampler, sourceUV); // premultiplied
    float3 rgb = paperColor * (1.0 - ink.a) + ink.rgb;
    return float4(rgb, 1.0);
}

// Referanse-underlag: papir → underlagsbilde (fadet) → strøk, i ett pass.
// Kun skjermvei (present) — thumbnails/eksport leser akkumulatoren og
// forblir uten underlag by design.
fragment float4 blit_underlay_fragment(BlitOut in [[stage_in]],
                                       texture2d<float> canvasTexture [[texture(0)]],
                                       texture2d<float> underlayTexture [[texture(1)]],
                                       constant float3 &paperColor [[buffer(0)]],
                                       constant float &underlayOpacity [[buffer(1)]],
                                       constant float4 &framing [[buffer(2)]],
                                       constant float4 &sourceViewportSize [[buffer(3)]],
                                       constant float4 &underlayUVTransform [[buffer(4)]]) {
    constexpr sampler blitSampler(mag_filter::linear, min_filter::linear);
    const float2 sourceUV = framed_source_uv(in.uv, framing, sourceViewportSize);
    if (!uv_is_inside(sourceUV)) return float4(paperColor, 1.0);
    float4 ink = canvasTexture.sample(blitSampler, sourceUV);
    const float2 underlayUV = underlayUVTransform.xy
        + sourceUV * underlayUVTransform.zw;
    float3 reference = underlayTexture.sample(blitSampler, underlayUV).rgb;
    float3 base = mix(paperColor, reference, underlayOpacity);
    return float4(base * (1.0 - ink.a) + ink.rgb, 1.0);
}
