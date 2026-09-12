#pragma once

#include "AAX.h"

#include <cstdint>

namespace creatorhub::aax {

struct AlgorithmContext {
    std::int32_t* masterBypass;
    float** audioInput;
    float** audioOutput;
    std::int32_t* bufferSize;
};

enum AlgorithmField : AAX_CFieldIndex {
    MasterBypass = AAX_FIELD_INDEX(AlgorithmContext, masterBypass),
    AudioInput = AAX_FIELD_INDEX(AlgorithmContext, audioInput),
    AudioOutput = AAX_FIELD_INDEX(AlgorithmContext, audioOutput),
    BufferSize = AAX_FIELD_INDEX(AlgorithmContext, bufferSize),
};

// The Review Console is a control surface, not an audio effect. It must be
// sample-for-sample transparent and must never perform IPC on this callback.
template <std::uint16_t ChannelCount>
void AAX_CALLBACK Process(
    AlgorithmContext* const instancesBegin[],
    const void* instancesEnd) {
    for (AlgorithmContext* const* cursor = instancesBegin;
         cursor < instancesEnd;
         ++cursor) {
        AlgorithmContext* const context = *cursor;
        if (!context || !context->audioInput || !context->audioOutput || !context->bufferSize) {
            continue;
        }
        const std::int32_t frameCount = *context->bufferSize;
        if (frameCount <= 0) continue;
        for (std::uint16_t channel = 0; channel < ChannelCount; ++channel) {
            const float* const input = context->audioInput[channel];
            float* const output = context->audioOutput[channel];
            if (!input || !output || input == output) continue;
            for (std::int32_t frame = 0; frame < frameCount; ++frame) {
                output[frame] = input[frame];
            }
        }
    }
}

} // namespace creatorhub::aax
