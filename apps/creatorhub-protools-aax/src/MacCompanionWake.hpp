#pragma once

#include <string>

namespace creatorhub::aax {

// Sends through the authenticated local bridge. When the listener is absent,
// the signed CreatorHub Companion is launched without activating its window
// and the request is retried for a bounded period.
std::string SendWithCompanionWake(
    const std::string& requestId,
    const std::string& action,
    const std::string& payload = "{}");

} // namespace creatorhub::aax
