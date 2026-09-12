#pragma once

#include "AAX_CEffectGUI_Cocoa.h"

namespace creatorhub::aax {

class ReviewConsoleGUI final : public AAX_CEffectGUI_Cocoa {
public:
    static AAX_IEffectGUI* AAX_CALLBACK Create();
    void CreateViewContents() AAX_OVERRIDE;
};

} // namespace creatorhub::aax
