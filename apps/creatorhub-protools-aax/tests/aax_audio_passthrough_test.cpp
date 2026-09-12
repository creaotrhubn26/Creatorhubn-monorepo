#include "ReviewConsole_Algorithm.hpp"

#include <array>
#include <cstdint>

namespace {

bool MonoPassesThrough() {
    std::array<float, 7> input{-1.0F, -0.25F, 0.0F, 0.25F, 0.5F, 0.999F, 1.0F};
    std::array<float, 7> output{};
    float* inputChannels[]{input.data()};
    float* outputChannels[]{output.data()};
    std::int32_t bypass = 0;
    std::int32_t frames = static_cast<std::int32_t>(input.size());
    creatorhub::aax::AlgorithmContext context{&bypass, inputChannels, outputChannels, &frames};
    creatorhub::aax::AlgorithmContext* contexts[]{&context};
    creatorhub::aax::Process<1>(contexts, contexts + 1);
    return input == output;
}

bool StereoPassesThroughInPlaceAndOutOfPlace() {
    std::array<float, 5> left{-0.8F, -0.4F, 0.0F, 0.4F, 0.8F};
    std::array<float, 5> right{0.8F, 0.4F, 0.0F, -0.4F, -0.8F};
    const auto expectedRight = right;
    std::array<float, 5> rightOutput{};
    float* inputChannels[]{left.data(), right.data()};
    float* outputChannels[]{left.data(), rightOutput.data()};
    std::int32_t bypass = 1;
    std::int32_t frames = static_cast<std::int32_t>(left.size());
    creatorhub::aax::AlgorithmContext context{&bypass, inputChannels, outputChannels, &frames};
    creatorhub::aax::AlgorithmContext* contexts[]{&context};
    creatorhub::aax::Process<2>(contexts, contexts + 1);
    return rightOutput == expectedRight && left == std::array<float, 5>{-0.8F, -0.4F, 0.0F, 0.4F, 0.8F};
}

} // namespace

int main() {
    if (!MonoPassesThrough()) return 1;
    if (!StereoPassesThroughInPlaceAndOutOfPlace()) return 2;
    return 0;
}
