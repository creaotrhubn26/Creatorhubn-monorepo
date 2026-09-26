#include "MacCompanionWake.hpp"

#include <exception>
#include <iostream>
#include <string>

namespace {

bool IsSuccessful(const std::string& response, const std::string& requestId) {
    return response.find("\"ok\":true") != std::string::npos
        && response.find("\"requestId\":\"" + requestId + "\"") != std::string::npos;
}

} // namespace

int main() {
    try {
        const std::string health = creatorhub::aax::SendWithCompanionWake(
            "aax-live-health", "health");
        if (!IsSuccessful(health, "aax-live-health")) return 1;
        const std::string state = creatorhub::aax::SendWithCompanionWake(
            "aax-live-state", "state");
        if (!IsSuccessful(state, "aax-live-state")) return 2;
        const std::string feedback = creatorhub::aax::SendWithCompanionWake(
            "aax-live-feedback", "feedback");
        if (!IsSuccessful(feedback, "aax-live-feedback")) return 3;
        std::cout << "Keychain, Companion IPC, state and Sound Room feedback: PASS\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "IPC smoke failed: " << error.what() << '\n';
        return 4;
    }
}
