cmake_minimum_required(VERSION 3.20)
project(CreatorHubReviewConsole VERSION 0.3.3 LANGUAGES CXX)

include(CTest)

option(CREATORHUB_BUILD_AAX_PLUGIN "Build the CreatorHub Review Console AAX plug-in" OFF)
set(CREATORHUB_AAX_SDK_ROOT "" CACHE PATH "Path to an extracted Avid AAX SDK")
set(CREATORHUB_AAX_MANUFACTURER_ID "CrHb" CACHE STRING "Four-character Avid-registered manufacturer ID")
set(CREATORHUB_AAX_PRODUCT_ID "ChRC" CACHE STRING "Four-character AAX product ID")
set(CREATORHUB_AAX_MONO_NATIVE_ID "ChR1" CACHE STRING "Four-character mono Native plug-in ID")
set(CREATORHUB_AAX_STEREO_NATIVE_ID "ChR2" CACHE STRING "Four-character stereo Native plug-in ID")
option(CREATORHUB_AAX_IDS_AVID_APPROVED "Confirm that Avid approved the configured production IDs" OFF)
set(CREATORHUB_AAX_AVID_APPROVAL_REFERENCE "" CACHE STRING "Avid case or written approval reference for production IDs")

function(creatorhub_validate_aax_id variable_name)
  set(value "${${variable_name}}")
  string(LENGTH "${value}" value_length)
  if(NOT value_length EQUAL 4 OR NOT value MATCHES "^[A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9]$")
    message(FATAL_ERROR "${variable_name} must contain exactly four ASCII letters or digits")
  endif()
endfunction()

creatorhub_validate_aax_id(CREATORHUB_AAX_MANUFACTURER_ID)
creatorhub_validate_aax_id(CREATORHUB_AAX_PRODUCT_ID)
creatorhub_validate_aax_id(CREATORHUB_AAX_MONO_NATIVE_ID)
creatorhub_validate_aax_id(CREATORHUB_AAX_STEREO_NATIVE_ID)

if(CREATORHUB_AAX_IDS_AVID_APPROVED)
  if(CREATORHUB_AAX_AVID_APPROVAL_REFERENCE STREQUAL "")
    message(FATAL_ERROR
      "CREATORHUB_AAX_AVID_APPROVAL_REFERENCE is required when production IDs are marked as Avid-approved")
  endif()
  string(LENGTH "${CREATORHUB_AAX_AVID_APPROVAL_REFERENCE}" approval_reference_length)
  if(approval_reference_length GREATER 128 OR
     NOT CREATORHUB_AAX_AVID_APPROVAL_REFERENCE MATCHES "^[A-Za-z0-9][A-Za-z0-9._:/-]*$")
    message(FATAL_ERROR
      "CREATORHUB_AAX_AVID_APPROVAL_REFERENCE must be 1-128 safe reference characters")
  endif()
  set(CREATORHUB_AAX_IDS_AVID_APPROVED_CPP 1)
  set(CREATORHUB_AAX_IDS_AVID_APPROVED_PLIST true)
else()
  set(CREATORHUB_AAX_IDS_AVID_APPROVED_CPP 0)
  set(CREATORHUB_AAX_IDS_AVID_APPROVED_PLIST false)
endif()

set(CREATORHUB_AAX_GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
file(MAKE_DIRECTORY "${CREATORHUB_AAX_GENERATED_DIR}")
configure_file(
  src/AAXIdentity.hpp.in
  "${CREATORHUB_AAX_GENERATED_DIR}/AAXIdentity.hpp"
  @ONLY
)
configure_file(
  src/CreatorHubAAXIdentity.plist.in
  "${CREATORHUB_AAX_GENERATED_DIR}/CreatorHubAAXIdentity.plist"
  @ONLY
)

add_library(creatorhub-review-bridge STATIC src/CreatorHubReviewBridge.cpp)
target_compile_features(creatorhub-review-bridge PUBLIC cxx_std_17)
target_include_directories(creatorhub-review-bridge PUBLIC src)

if(WIN32)
  target_link_libraries(creatorhub-review-bridge PRIVATE ws2_32)
endif()

if(APPLE)
  enable_language(OBJCXX)
  add_library(creatorhub-mac-companion-wake STATIC
    src/MacCredentialStore.hpp
    src/MacCredentialStore.mm
    src/MacCompanionWake.hpp
    src/MacCompanionWake.mm
  )
  target_include_directories(creatorhub-mac-companion-wake PUBLIC src)
  target_link_libraries(creatorhub-mac-companion-wake PUBLIC
    creatorhub-review-bridge
    "-framework Cocoa"
    "-framework Security"
  )
  target_compile_features(creatorhub-mac-companion-wake PUBLIC cxx_std_17)
endif()

if(CREATORHUB_BUILD_AAX_PLUGIN)
  if(NOT IS_DIRECTORY "${CREATORHUB_AAX_SDK_ROOT}/Interfaces")
    message(FATAL_ERROR
      "CREATORHUB_AAX_SDK_ROOT must point to an extracted, licensed Avid AAX SDK")
  endif()

  # The SDK remains outside this repository. Only build targets and headers are
  # consumed from the user-provided, click-through licensed installation.
  set(AAX_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(AAX_BUILD_PTSL_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(AAX_BUILD_TI_INTERFACE OFF CACHE BOOL "" FORCE)
  add_subdirectory("${CREATORHUB_AAX_SDK_ROOT}" "${CMAKE_BINARY_DIR}/avid-aax-sdk" EXCLUDE_FROM_ALL)
  include("${CREATORHUB_AAX_SDK_ROOT}/cmake/AAX_SDKFunctions.cmake")

  aax_plugin(
    TARGET_NAME creatorhub-review-console-aax
    OUTPUT_NAME "CreatorHub Review Console"
    VERSION "${PROJECT_VERSION}"
    COPYRIGHT_STRING "Copyright 2026 Creatorhub AS"
    BUNDLE_IDENTIFIER "com.creatorhub.protools.review-console"
    RESOURCE_FILES src/ReviewConsolePages.xml
  )
  target_sources(creatorhub-review-console-aax PRIVATE
    "${CREATORHUB_AAX_GENERATED_DIR}/AAXIdentity.hpp"
    src/ReviewConsole_Algorithm.hpp
    src/ReviewConsole_Describe.cpp
    src/ReviewConsole_Describe.hpp
    src/ReviewConsolePages.xml
    src/ReviewConsole_Parameters.cpp
    src/ReviewConsole_Parameters.hpp
  )
  set_source_files_properties(src/ReviewConsolePages.xml PROPERTIES HEADER_FILE_ONLY TRUE)
  target_include_directories(creatorhub-review-console-aax PRIVATE "${CREATORHUB_AAX_GENERATED_DIR}")

  if(APPLE)
    set(CREATORHUB_AAX_RESOURCES_DIR
      "$<TARGET_BUNDLE_DIR:creatorhub-review-console-aax>/Contents/Resources")
  elseif(WIN32)
    set(CREATORHUB_AAX_RESOURCES_DIR
      "$<TARGET_FILE_DIR:creatorhub-review-console-aax>/../Resources")
  else()
    set(CREATORHUB_AAX_RESOURCES_DIR
      "$<TARGET_FILE_DIR:creatorhub-review-console-aax>/Resources")
  endif()
  add_custom_command(TARGET creatorhub-review-console-aax POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory
      "${CREATORHUB_AAX_RESOURCES_DIR}"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      "${CREATORHUB_AAX_GENERATED_DIR}/CreatorHubAAXIdentity.plist"
      "${CREATORHUB_AAX_RESOURCES_DIR}/CreatorHubAAXIdentity.plist"
    COMMENT "Embedding CreatorHub AAX release identity"
  )
  if(NOT APPLE)
    target_link_libraries(creatorhub-review-console-aax PRIVATE creatorhub-review-bridge)
  endif()
  target_compile_features(creatorhub-review-console-aax PRIVATE cxx_std_17)

  if(BUILD_TESTING)
    add_executable(creatorhub-review-console-audio-test tests/aax_audio_passthrough_test.cpp)
    target_link_libraries(creatorhub-review-console-audio-test PRIVATE AAX_SDK::AAX_SDK_Interface)
    target_compile_features(creatorhub-review-console-audio-test PRIVATE cxx_std_17)
    target_include_directories(creatorhub-review-console-audio-test PRIVATE src)
    add_test(NAME creatorhub-review-console-audio-passthrough
      COMMAND creatorhub-review-console-audio-test)
  endif()

  if(APPLE)
    target_sources(creatorhub-review-console-aax PRIVATE
      src/ReviewConsole_GUI_Cocoa.hpp
      src/ReviewConsole_GUI_Cocoa.mm
      "${CREATORHUB_AAX_SDK_ROOT}/Extensions/GUI/AAX_CEffectGUI_Cocoa.mm"
    )
    target_include_directories(creatorhub-review-console-aax PRIVATE
      "${CREATORHUB_AAX_SDK_ROOT}/Extensions/GUI"
    )
    target_compile_definitions(creatorhub-review-console-aax PRIVATE CREATORHUB_AAX_COCOA_GUI=1)
    target_link_libraries(creatorhub-review-console-aax PRIVATE
      creatorhub-mac-companion-wake
      "-framework Cocoa"
      "-framework Security"
    )
  endif()
endif()

if(BUILD_TESTING)
  find_package(Threads REQUIRED)
  add_executable(creatorhub-review-bridge-test tests/bridge_test.cpp)
  target_link_libraries(creatorhub-review-bridge-test PRIVATE creatorhub-review-bridge Threads::Threads)
  add_test(NAME creatorhub-review-bridge-contract COMMAND creatorhub-review-bridge-test)

  if(APPLE)
    add_executable(creatorhub-review-console-ipc-smoke tests/keychain_ipc_smoke.mm)
    target_link_libraries(creatorhub-review-console-ipc-smoke PRIVATE creatorhub-mac-companion-wake)
    target_compile_features(creatorhub-review-console-ipc-smoke PRIVATE cxx_std_17)
  endif()
endif()
