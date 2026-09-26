#pragma once

#include "AAX.h"

#include <algorithm>
#include <atomic>
#include <cmath>
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

struct LiveSignalSnapshot {
    float peakLinear;
    float rmsLinear;
    float stereoCorrelation;
    std::uint64_t sequence;
};

// One bounded write per audio buffer lets the UI show reassuring signal
// presence without locks, allocation, IPC, oversampling or changing samples.
// Final EBU R128 / true-peak delivery decisions still come from offline QC.
struct LiveSignalState {
    std::atomic<float> peakLinear{0.0F};
    std::atomic<float> rmsLinear{0.0F};
    std::atomic<float> stereoCorrelation{0.0F};
    std::atomic<std::uint64_t> sequence{0};
};

inline LiveSignalState gLiveSignal;

inline LiveSignalSnapshot ReadLiveSignal() noexcept {
    return {
        gLiveSignal.peakLinear.load(std::memory_order_relaxed),
        gLiveSignal.rmsLinear.load(std::memory_order_relaxed),
        gLiveSignal.stereoCorrelation.load(std::memory_order_relaxed),
        gLiveSignal.sequence.load(std::memory_order_relaxed),
    };
}

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
        float peak = 0.0F;
        double squareSum = 0.0;
        double stereoCross = 0.0;
        double leftSquare = 0.0;
        double rightSquare = 0.0;
        for (std::uint16_t channel = 0; channel < ChannelCount; ++channel) {
            const float* const input = context->audioInput[channel];
            float* const output = context->audioOutput[channel];
            if (!input || !output) continue;
            for (std::int32_t frame = 0; frame < frameCount; ++frame) {
                const float sample = input[frame];
                peak = std::max(peak, std::abs(sample));
                squareSum += static_cast<double>(sample) * sample;
                if (input != output) output[frame] = sample;
            }
        }
        if constexpr (ChannelCount >= 2) {
            const float* const left = context->audioInput[0];
            const float* const right = context->audioInput[1];
            if (left && right) {
                for (std::int32_t frame = 0; frame < frameCount; ++frame) {
                    stereoCross += static_cast<double>(left[frame]) * right[frame];
                    leftSquare += static_cast<double>(left[frame]) * left[frame];
                    rightSquare += static_cast<double>(right[frame]) * right[frame];
                }
            }
        }
        const double sampleCount = static_cast<double>(frameCount) * ChannelCount;
        const float rms = sampleCount > 0.0
            ? static_cast<float>(std::sqrt(squareSum / sampleCount))
            : 0.0F;
        const double denominator = std::sqrt(leftSquare * rightSquare);
        const float correlation = denominator > 0.0
            ? static_cast<float>(std::clamp(stereoCross / denominator, -1.0, 1.0))
            : 0.0F;
        gLiveSignal.peakLinear.store(peak, std::memory_order_relaxed);
        gLiveSignal.rmsLinear.store(rms, std::memory_order_relaxed);
        gLiveSignal.stereoCorrelation.store(correlation, std::memory_order_relaxed);
        gLiveSignal.sequence.fetch_add(1, std::memory_order_relaxed);
    }
}

} // namespace creatorhub::aax
