#include "MacCompanionWake.hpp"

#include <exception>
#include <iostream>
#include <iterator>
#include <string>

namespace {

bool IsSuccessful(const std::string& response, const std::string& requestId) {
    return response.find("\"ok\":true") != std::string::npos
        && response.find("\"requestId\":\"" + requestId + "\"") != std::string::npos;
}

} // namespace

int main() {
    try {
        const struct {
            const char* id;
            const char* action;
        } readOnlyChecks[] = {
            {"aax-live-health", "health"},
            {"aax-live-state", "state"},
            {"aax-live-diagnostics", "diagnostics"},
            {"aax-live-sources", "sources"},
            {"aax-live-snapshots", "snapshots"},
            {"aax-live-delivery-jobs", "delivery_jobs"},
            {"aax-live-feedback", "feedback"},
        };
        for (std::size_t index = 0; index < std::size(readOnlyChecks); ++index) {
            const auto& check = readOnlyChecks[index];
            std::cout << "Checking " << check.action << " … " << std::flush;
            const std::string response = creatorhub::aax::SendWithCompanionWake(
                check.id, check.action);
            if (!IsSuccessful(response, check.id)) {
                std::cerr << "FAILED\n";
                return static_cast<int>(index + 1);
            }
            std::cout << "PASS\n";
        }
        std::cout << "Keychain + authenticated Companion/Pro Tools/Sound Room read flow: PASS\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "IPC smoke failed: " << error.what() << '\n';
        return 20;
    }
}
