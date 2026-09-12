#include <metal_stdlib>
using namespace metal;

// Layout speiles NØYAKTIG i StageRenderer.swift (GPULight/FrameUniforms/NodeUniforms/BeamUniforms).
struct VertexIn {
    float3 position;
    float pad0;
    float3 normal;
    float pad1;
};

struct GPULight {
    float3 position;   // 0
    float3 direction;  // 16
    float3 color;      // 32
    float intensity;   // 48
    float beamCos;     // 52
    float isSpot;      // 56
    float pad;         // 60
};

struct FrameUniforms {
    float4x4 viewProj;     // 0
    float4x4 shadowMatrix; // 64
    float3 cameraPos;      // 128
    int lightCount;        // 144
    int hasShadow;         // 148 (+8 pad)
    GPULight lights[8];    // 160
};

struct NodeUniforms {
    float4x4 model;
    float4x4 normalMatrix;
    float4 baseColorSelected; // rgb = base, w = selected-flagg
};

struct VSOut {
    float4 pos [[position]];
    float3 worldPos;
    float3 normal;
};

vertex VSOut vertex_main(uint vid [[vertex_id]],
                         const device VertexIn *verts [[buffer(0)]],
                         constant FrameUniforms &frame [[buffer(1)]],
                         constant NodeUniforms &node [[buffer(2)]]) {
    VertexIn v = verts[vid];
    float4 world = node.model * float4(v.position, 1.0);
    VSOut out;
    out.pos = frame.viewProj * world;
    out.worldPos = world.xyz;
    out.normal = normalize((node.normalMatrix * float4(v.normal, 0.0)).xyz);
    return out;
}

static float shadowFactor(float3 worldPos, constant FrameUniforms &frame,
                          depth2d<float> shadowMap) {
    if (frame.hasShadow == 0) { return 1.0; }
    float4 sp = frame.shadowMatrix * float4(worldPos, 1.0);
    if (sp.w <= 0.0) { return 1.0; }
    float3 ndc = sp.xyz / sp.w;
    float2 uv = float2(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || ndc.z > 1.0) { return 1.0; }
    constexpr sampler cmp(coord::normalized, filter::linear, address::clamp_to_edge,
                          compare_func::less_equal);
    float ref = ndc.z - 0.0025;
    float sum = 0.0;
    const float texel = 1.0 / 2048.0;
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            sum += shadowMap.sample_compare(cmp, uv + float2(dx, dy) * texel, ref);
        }
    }
    return sum / 9.0;
}

fragment float4 fragment_main(VSOut in [[stage_in]],
                              constant FrameUniforms &frame [[buffer(1)]],
                              constant NodeUniforms &node [[buffer(2)]],
                              depth2d<float> shadowMap [[texture(0)]]) {
    float3 base = node.baseColorSelected.rgb;
    float3 N = normalize(in.normal);
    float3 V = normalize(frame.cameraPos - in.worldPos);
    float3 color = base * 0.10; // ambient

    for (int i = 0; i < frame.lightCount; i++) {
        GPULight L = frame.lights[i];
        float3 toLight = L.position - in.worldPos;
        float dist = length(toLight);
        float3 Ldir = toLight / max(dist, 0.0001);
        float atten = 1.0 / (1.0 + 0.12 * dist * dist);

        float spot = 1.0;
        if (L.isSpot > 0.5) {
            float cd = dot(-Ldir, normalize(L.direction));
            spot = smoothstep(L.beamCos, L.beamCos + 0.08, cd);
        }

        float shadow = (i == 0) ? shadowFactor(in.worldPos, frame, shadowMap) : 1.0;

        float diff = max(dot(N, Ldir), 0.0);
        float3 H = normalize(Ldir + V);
        float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.35;
        color += L.color * L.intensity * atten * spot * shadow * (base * diff + spec);
    }

    if (node.baseColorSelected.w > 0.5) {
        color += float3(0.5528, 0.3572, 0.9307) * 0.22; // accent-tint på valgt node
    }

    color = color / (1.0 + color);          // Reinhard
    color = pow(color, float3(1.0 / 2.2));  // gamma
    return float4(color, 1.0);
}

// ---- skyggekart (depth-only) ----
vertex float4 shadow_vertex(uint vid [[vertex_id]],
                            const device VertexIn *verts [[buffer(0)]],
                            constant float4x4 &lightViewProj [[buffer(1)]],
                            constant NodeUniforms &node [[buffer(2)]]) {
    return lightViewProj * node.model * float4(verts[vid].position, 1.0);
}

// ---- unlit linjer (grid / frustum / lys-ikoner) ----
struct LineVSOut { float4 pos [[position]]; };

vertex LineVSOut line_vertex(uint vid [[vertex_id]],
                             const device VertexIn *verts [[buffer(0)]],
                             constant FrameUniforms &frame [[buffer(1)]]) {
    LineVSOut out;
    out.pos = frame.viewProj * float4(verts[vid].position, 1.0);
    return out;
}

fragment float4 line_fragment(LineVSOut in [[stage_in]],
                              constant float4 &color [[buffer(2)]]) {
    return color;
}

// ---- selection-outline (normal-ekstrudert, front-cullet) ----
vertex VSOut outline_vertex(uint vid [[vertex_id]],
                            const device VertexIn *verts [[buffer(0)]],
                            constant FrameUniforms &frame [[buffer(1)]],
                            constant NodeUniforms &node [[buffer(2)]]) {
    VertexIn v = verts[vid];
    float4 world = node.model * float4(v.position, 1.0);
    float3 wn = normalize((node.normalMatrix * float4(v.normal, 0.0)).xyz);
    world.xyz += wn * 0.025;
    VSOut out;
    out.pos = frame.viewProj * world;
    out.worldPos = world.xyz;
    out.normal = wn;
    return out;
}

fragment float4 outline_fragment(VSOut in [[stage_in]]) {
    return float4(0.5528, 0.3572, 0.9307, 1.0); // accent
}

// ---- volumetriske beam-kjegler (additiv) ----
// Kjegle-mesh i lys-lokalt rom: apex i origo, åpner seg mot -Z, enhetslengde,
// radius 1 ved z=-1 (skaleres til tan(beam/2)·lengde via model-matrisen).
struct BeamUniforms {
    float4x4 model;     // 0
    float4 colorAlpha;  // 64 — rgb = lysfarge, a = maks-alpha
};

struct BeamVSOut {
    float4 pos [[position]];
    float3 localPos;
};

vertex BeamVSOut beam_vertex(uint vid [[vertex_id]],
                             const device VertexIn *verts [[buffer(0)]],
                             constant FrameUniforms &frame [[buffer(1)]],
                             constant BeamUniforms &beam [[buffer(2)]]) {
    VertexIn v = verts[vid];
    BeamVSOut out;
    out.pos = frame.viewProj * beam.model * float4(v.position, 1.0);
    out.localPos = v.position;
    return out;
}

fragment float4 beam_fragment(BeamVSOut in [[stage_in]],
                              constant FrameUniforms &frame [[buffer(1)]],
                              constant BeamUniforms &beam [[buffer(2)]]) {
    float depth = clamp(-in.localPos.z, 0.0, 1.0);       // 0 ved apex, 1 ved enden
    float radial = depth > 0.001 ? length(in.localPos.xy) / depth : 0.0; // 0 senter, 1 kant
    float a = beam.colorAlpha.a * (1.0 - depth) * (1.0 - radial * radial);
    a = max(a, 0.0);
    return float4(beam.colorAlpha.rgb * a, a);
}
