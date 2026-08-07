#include <metal_stdlib>
using namespace metal;

// Layout speiles NØYAKTIG i StageRenderer.swift (GPULight/FrameUniforms/NodeUniforms).
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
    float4x4 viewProj; // 0
    float3 cameraPos;  // 64
    int lightCount;    // 80 (+12 pad)
    GPULight lights[8];// 96
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

fragment float4 fragment_main(VSOut in [[stage_in]],
                              constant FrameUniforms &frame [[buffer(1)]],
                              constant NodeUniforms &node [[buffer(2)]]) {
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

        float diff = max(dot(N, Ldir), 0.0);
        float3 H = normalize(Ldir + V);
        float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.35;
        color += L.color * L.intensity * atten * spot * (base * diff + spec);
    }

    if (node.baseColorSelected.w > 0.5) {
        color += float3(0.5528, 0.3572, 0.9307) * 0.22; // accent-tint på valgt node
    }

    color = color / (1.0 + color);          // Reinhard
    color = pow(color, float3(1.0 / 2.2));  // gamma
    return float4(color, 1.0);
}

// ---- unlit linjer (grid / hjelpegrafikk) ----
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
