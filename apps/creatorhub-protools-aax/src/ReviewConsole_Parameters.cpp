#include "ReviewConsole_Parameters.hpp"

#include "ReviewConsole_Algorithm.hpp"

#include "AAX_CBinaryDisplayDelegate.h"
#include "AAX_CBinaryTaperDelegate.h"
#include "AAX_CParameter.h"

#include <memory>

namespace creatorhub::aax {

AAX_CEffectParameters* AAX_CALLBACK ReviewConsoleParameters::Create() {
    return new ReviewConsoleParameters();
}

AAX_Result ReviewConsoleParameters::EffectInit() {
    AAX_CString id = cDefaultMasterBypassID;
    std::unique_ptr<AAX_IParameter> parameter(new AAX_CParameter<bool>(
        id,
        AAX_CString("Master Bypass"),
        false,
        AAX_CBinaryTaperDelegate<bool>(),
        AAX_CBinaryDisplayDelegate<bool>("bypass", "on"),
        true));
    parameter->SetNumberOfSteps(2);
    parameter->SetType(AAX_eParameterType_Discrete);
    mParameterManager.AddParameter(parameter.release());
    const AAX_Result packetResult = mPacketDispatcher.RegisterPacket(
        id.CString(),
        MasterBypass);
    if (packetResult != AAX_SUCCESS) return packetResult;

    // The console remains transparent in either state. Registering AAX's
    // standard bypass parameter makes host automation and validation complete.
    return AAX_SUCCESS;
}

} // namespace creatorhub::aax
