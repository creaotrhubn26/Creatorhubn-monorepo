cmake_minimum_required(VERSION 3.20)
project(CreatorHubReviewConsole VERSION 0.3.2 LANGUAGES CXX)

include(CTest)

option(CREATORHUB_BUILD_AAX_PLUGIN "Build the CreatorHub Review Console AAX plug-in" OFF)
set(CREATORHUB_AAX_SDK_ROOT "" CACHE PATH "Path to an extracted Avid AAX SDK")

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
    src/ReviewConsole_Algorithm.hpp
    src/ReviewConsole_Describe.cpp
    src/ReviewConsole_Describe.hpp
    src/ReviewConsolePages.xml
    src/ReviewConsole_Parameters.cpp
    src/ReviewConsole_Parameters.hpp
  )
  set_source_files_properties(src/ReviewConsolePages.xml PROPERTIES HEADER_FILE_ONLY TRUE)
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
