cmake_minimum_required(VERSION 3.20)
project(CreatorHubReviewBridge LANGUAGES CXX)

add_library(creatorhub-review-bridge STATIC src/CreatorHubReviewBridge.cpp)
target_compile_features(creatorhub-review-bridge PUBLIC cxx_std_17)
target_include_directories(creatorhub-review-bridge PUBLIC src)

if(WIN32)
  target_link_libraries(creatorhub-review-bridge PRIVATE ws2_32)
endif()

include(CTest)
if(BUILD_TESTING)
  find_package(Threads REQUIRED)
  add_executable(creatorhub-review-bridge-test tests/bridge_test.cpp)
  target_link_libraries(creatorhub-review-bridge-test PRIVATE creatorhub-review-bridge Threads::Threads)
  add_test(NAME creatorhub-review-bridge-contract COMMAND creatorhub-review-bridge-test)
endif()
