#include "ReviewConsole_Describe.hpp"

#include "ReviewConsole_Algorithm.hpp"
#include "ReviewConsole_Parameters.hpp"

#if defined(CREATORHUB_AAX_COCOA_GUI)
#include "ReviewConsole_GUI_Cocoa.hpp"
#endif

#include "AAX_IEffectDescriptor.h"
#include "AAX_ICollection.h"
#include "AAX_IComponentDescriptor.h"
#include "AAX_IPropertyMap.h"

namespace {

constexpr AAX_CEffectID EffectId = "com.creatorhub.protools.review-console";
constexpr AAX_CTypeID ManufacturerId = 'CrHb';
constexpr AAX_CTypeID ProductId = 'ChRC';
constexpr AAX_CTypeID MonoNativeId = 'ChR1';
constexpr AAX_CTypeID StereoNativeId = 'ChR2';

AAX_Result FirstFailure(AAX_Result current, AAX_Result candidate) {
    return current == AAX_SUCCESS ? candidate : current;
}

template <std::uint16_t ChannelCount>
AAX_Result AddNativeComponent(
    AAX_IEffectDescriptor* effect,
    AAX_EStemFormat stemFormat,
    AAX_CTypeID nativeId) {
    AAX_IComponentDescriptor* const component = effect->NewComponentDescriptor();
    if (!component) return AAX_ERROR_NULL_OBJECT;

    AAX_Result result = component->AddAudioIn(creatorhub::aax::AudioInput);
    result = FirstFailure(result, component->AddAudioOut(creatorhub::aax::AudioOutput));
    result = FirstFailure(result, component->AddAudioBufferLength(creatorhub::aax::BufferSize));
    result = FirstFailure(
        result,
        component->AddDataInPort(creatorhub::aax::MasterBypass, sizeof(std::int32_t)));

    AAX_IPropertyMap* const properties = component->NewPropertyMap();
    if (!properties) return AAX_ERROR_NULL_OBJECT;
    result = FirstFailure(result, properties->AddProperty(AAX_eProperty_ManufacturerID, ManufacturerId));
    result = FirstFailure(result, properties->AddProperty(AAX_eProperty_ProductID, ProductId));
    result = FirstFailure(result, properties->AddProperty(AAX_eProperty_InputStemFormat, stemFormat));
    result = FirstFailure(result, properties->AddProperty(AAX_eProperty_OutputStemFormat, stemFormat));
    result = FirstFailure(result, properties->AddProperty(AAX_eProperty_PlugInID_Native, nativeId));
    result = FirstFailure(result, properties->AddProperty(AAX_eProperty_CanBypass, true));
    if (result != AAX_SUCCESS) return result;

    result = component->AddProcessProc_Native(creatorhub::aax::Process<ChannelCount>, properties);
    if (result != AAX_SUCCESS) return result;
    return effect->AddComponent(component);
}

AAX_Result DescribeReviewConsole(AAX_IEffectDescriptor* descriptor) {
    if (!descriptor) return AAX_ERROR_NULL_OBJECT;
    AAX_Result result = descriptor->AddName("CreatorHub Review Console");
    result = FirstFailure(result, descriptor->AddName("CreatorHub Review"));
    result = FirstFailure(result, descriptor->AddName("CH Review"));
    result = FirstFailure(result, descriptor->AddCategory(AAX_ePlugInCategory_Effect));
    result = FirstFailure(result, AddNativeComponent<1>(descriptor, AAX_eStemFormat_Mono, MonoNativeId));
    result = FirstFailure(result, AddNativeComponent<2>(descriptor, AAX_eStemFormat_Stereo, StereoNativeId));
    result = FirstFailure(
        result,
        descriptor->AddProcPtr(
            reinterpret_cast<void*>(creatorhub::aax::ReviewConsoleParameters::Create),
            kAAX_ProcPtrID_Create_EffectParameters));
    result = FirstFailure(
        result,
        descriptor->AddResourceInfo(AAX_eResourceType_PageTable, "ReviewConsolePages.xml"));
#if defined(CREATORHUB_AAX_COCOA_GUI)
    result = FirstFailure(
        result,
        descriptor->AddProcPtr(
            reinterpret_cast<void*>(creatorhub::aax::ReviewConsoleGUI::Create),
            kAAX_ProcPtrID_Create_EffectGUI));
#endif
    return result;
}

} // namespace

AAX_Result GetEffectDescriptions(AAX_ICollection* collection) {
    if (!collection) return AAX_ERROR_NULL_OBJECT;
    AAX_IEffectDescriptor* const descriptor = collection->NewDescriptor();
    if (!descriptor) return AAX_ERROR_NULL_OBJECT;

    AAX_Result result = DescribeReviewConsole(descriptor);
    result = FirstFailure(result, collection->AddEffect(EffectId, descriptor));
    result = FirstFailure(result, collection->SetManufacturerName("Creatorhub AS"));
    result = FirstFailure(result, collection->AddPackageName("CreatorHub Pro Tools Companion"));
    result = FirstFailure(result, collection->AddPackageName("CreatorHub"));
    result = FirstFailure(result, collection->SetPackageVersion(3));
    return result;
}
