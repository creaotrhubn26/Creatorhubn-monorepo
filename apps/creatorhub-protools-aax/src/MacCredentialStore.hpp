#pragma once

#include <string>

namespace creatorhub::aax {

// Reads only the separate localhost IPC credential. Cloud device tokens remain
// owned by Companion and are never available to the AAX plug-in.
std::string ReadLocalIpcSecretFromKeychain();

} // namespace creatorhub::aax
