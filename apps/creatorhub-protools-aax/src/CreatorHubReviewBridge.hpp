#pragma once

#include <cstdint>
#include <string>

namespace creatorhub {

// Host-neutral transport. Call Send from a worker thread, never the Pro Tools
// UI or audio thread. The AAX-specific view owns rendering and dispatch.
class CreatorHubReviewBridge final {
public:
    explicit CreatorHubReviewBridge(std::string localSecret, std::uint16_t port = 31417);

    [[nodiscard]] std::string Send(
        const std::string& requestId,
        const std::string& action,
        const std::string& payloadJson = "{}") const;

private:
    std::string secret_;
    std::uint16_t port_;
};

} // namespace creatorhub
