#import <Cocoa/Cocoa.h>
#import <Security/Security.h>

#include "MacCompanionWake.hpp"

#include "CreatorHubReviewBridge.hpp"
#include "MacCredentialStore.hpp"

#include <chrono>
#include <exception>
#include <stdexcept>
#include <string>
#include <thread>

namespace {

bool ShouldWakeCompanion(const std::string& error) {
    return error.find("Companion is not listening") != std::string::npos
        || error.find("Åpne Companion én gang") != std::string::npos;
}

bool HasCreatorHubSignature(NSURL* applicationUrl, std::string& errorMessage) {
    SecStaticCodeRef code = nullptr;
    OSStatus status = SecStaticCodeCreateWithPath(
        reinterpret_cast<CFURLRef>(applicationUrl), kSecCSDefaultFlags, &code);
    if (status != errSecSuccess || !code) {
        errorMessage = "kunne ikke lese app-signaturen (" + std::to_string(status) + ")";
        return false;
    }

    SecRequirementRef requirement = nullptr;
    status = SecRequirementCreateWithString(
        CFSTR("anchor apple generic and identifier \"com.creatorhub.protools-companion\" and certificate leaf[subject.OU] = \"9TAUZCPK95\""),
        kSecCSDefaultFlags,
        &requirement);
    if (status == errSecSuccess && requirement) {
        status = SecStaticCodeCheckValidity(code, kSecCSCheckAllArchitectures, requirement);
    }
    if (requirement) CFRelease(requirement);
    CFRelease(code);
    if (status != errSecSuccess) {
        errorMessage = "appen har ikke gyldig Creatorhub AS-signatur (" + std::to_string(status) + ")";
        return false;
    }
    return true;
}

bool LaunchCompanionInBackground(std::string& errorMessage) {
    NSWorkspace* workspace = [NSWorkspace sharedWorkspace];
    NSURL* applicationUrl = [workspace URLForApplicationWithBundleIdentifier:@"com.creatorhub.protools-companion"];
    if (!applicationUrl) {
        errorMessage = "CreatorHub Pro Tools Companion er ikke installert";
        return false;
    }
    if (!HasCreatorHubSignature(applicationUrl, errorMessage)) return false;

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    NSError* launchError = nil;
    NSDictionary* configuration = @{
        NSWorkspaceLaunchConfigurationArguments: @[@"--background"]
    };
    NSRunningApplication* launchedApplication =
        [workspace launchApplicationAtURL:applicationUrl
                                  options:NSWorkspaceLaunchWithoutActivation
                            configuration:configuration
                                    error:&launchError];
#pragma clang diagnostic pop
    if (!launchedApplication) {
        NSString* description = launchError.localizedDescription ?: @"ukjent oppstartsfeil";
        errorMessage = std::string([description UTF8String]);
        return false;
    }
    return true;
}

} // namespace

namespace creatorhub::aax {

std::string SendWithCompanionWake(
    const std::string& requestId,
    const std::string& action,
    const std::string& payload) {
    std::string lastError;
    auto send = [&]() {
        const std::string secret = ReadLocalIpcSecretFromKeychain();
        CreatorHubReviewBridge bridge(secret);
        return bridge.Send(requestId, action, payload);
    };

    try {
        return send();
    } catch (const std::exception& error) {
        lastError = error.what();
        if (!ShouldWakeCompanion(lastError)) throw;
    }

    std::string launchError;
    if (!LaunchCompanionInBackground(launchError)) {
        throw std::runtime_error(
            "Kunne ikke starte CreatorHub-motoren automatisk: " + launchError);
    }

    // LaunchServices returns before Tauri has opened the authenticated listener.
    // This runs on the existing worker queue, never on Pro Tools' audio/UI thread.
    for (int attempt = 0; attempt < 24; ++attempt) {
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
        try {
            return send();
        } catch (const std::exception& error) {
            lastError = error.what();
            // Only retry the two pre-dispatch states. A write/read failure may
            // mean the action reached Companion, so retrying could duplicate it.
            if (!ShouldWakeCompanion(lastError)) throw;
        }
    }
    throw std::runtime_error(
        "CreatorHub-motoren startet, men svarte ikke. Åpne Companion fra menylinjen og kjør diagnostikk. Siste feil: "
        + lastError);
}

} // namespace creatorhub::aax
