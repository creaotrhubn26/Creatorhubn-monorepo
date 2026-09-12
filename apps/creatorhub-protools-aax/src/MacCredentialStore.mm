#import <Foundation/Foundation.h>
#import <Security/Security.h>

#include "MacCredentialStore.hpp"

#include <stdexcept>

namespace creatorhub::aax {

std::string ReadLocalIpcSecretFromKeychain() {
    const void* keys[] = {
        kSecClass,
        kSecAttrService,
        kSecAttrAccount,
        kSecReturnData,
        kSecMatchLimit,
    };
    const void* values[] = {
        kSecClassGenericPassword,
        CFSTR("com.creatorhub.protools-companion"),
        CFSTR("aax-review-console-ipc"),
        kCFBooleanTrue,
        kSecMatchLimitOne,
    };
    CFDictionaryRef query = CFDictionaryCreate(
        kCFAllocatorDefault,
        keys,
        values,
        sizeof(keys) / sizeof(keys[0]),
        &kCFTypeDictionaryKeyCallBacks,
        &kCFTypeDictionaryValueCallBacks);
    if (!query) throw std::runtime_error("Kunne ikke åpne macOS-nøkkelringen");

    CFTypeRef result = nullptr;
    const OSStatus status = SecItemCopyMatching(query, &result);
    CFRelease(query);
    if (status == errSecItemNotFound) {
        throw std::runtime_error("Åpne Companion én gang for å opprette lokal tilkobling");
    }
    if (status != errSecSuccess || !result || CFGetTypeID(result) != CFDataGetTypeID()) {
        if (result) CFRelease(result);
        throw std::runtime_error("Kunne ikke lese Companion-nøkkelen fra macOS-nøkkelringen");
    }
    CFDataRef data = static_cast<CFDataRef>(result);
    const UInt8* bytes = CFDataGetBytePtr(data);
    const CFIndex length = CFDataGetLength(data);
    std::string secret(reinterpret_cast<const char*>(bytes), static_cast<std::size_t>(length));
    CFRelease(result);
    if (secret.size() < 32) throw std::runtime_error("Companion-nøkkelen er ugyldig");
    return secret;
}

} // namespace creatorhub::aax
