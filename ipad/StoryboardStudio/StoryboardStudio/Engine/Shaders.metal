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
    float3 color;      // lineær rgb
};

struct VertexOut {
    float4 position [[position]];
    float2 uv;
    float  alpha;
    float3 color;
};

vertex VertexOut dab_vertex(uint vertexId [[vertex_id]],
                            uint instanceId [[instance_id]],
                            constant DabInstance *instances [[buffer(0)]],
                            constant float2 &viewportSize [[buffer(1)]]) {
    // Quad-hjørner (triangle strip): (-0.5,-0.5)(0.5,-0.5)(-0.5,0.5)(0.5,0.5)
    float2 corners[4] = { float2(-0.5, -0.5), float2(0.5, -0.5),
                          float2(-0.5, 0.5),  float2(0.5, 0.5) };
    DabInstance dab = instances[instanceId];
    float2 corner = corners[vertexId] * dab.size;
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
    return out;
}

fragment float4 dab_fragment(VertexOut in [[stage_in]],
                             texture2d<float> dabTexture [[texture(0)]]) {
    constexpr sampler dabSampler(mag_filter::linear, min_filter::linear);
    float mask = dabTexture.sample(dabSampler, in.uv).r;
    float a = mask * in.alpha;
    return float4(in.color * a, a);   // premultiplied
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

fragment float4 blit_fragment(BlitOut in [[stage_in]],
                              texture2d<float> canvasTexture [[texture(0)]],
                              constant float3 &paperColor [[buffer(0)]]) {
    constexpr sampler blitSampler(mag_filter::linear, min_filter::linear);
    float4 ink = canvasTexture.sample(blitSampler, in.uv); // premultiplied
    float3 rgb = paperColor * (1.0 - ink.a) + ink.rgb;
    return float4(rgb, 1.0);
}
