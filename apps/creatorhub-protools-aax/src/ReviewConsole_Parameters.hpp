#pragma once

#include "AAX_CEffectParameters.h"

namespace creatorhub::aax {

class ReviewConsoleParameters final : public AAX_CEffectParameters {
public:
    static AAX_CEffectParameters* AAX_CALLBACK Create();
    AAX_Result EffectInit() AAX_OVERRIDE;
};

} // namespace creatorhub::aax
