#include "CreatorHubReviewBridge.hpp"

#include <stdexcept>
#include <utility>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "Ws2_32.lib")
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace {

std::string JsonEscape(const std::string& value) {
    std::string result;
    result.reserve(value.size() + 8);
    for (const char character : value) {
        switch (character) {
            case '\\': result += "\\\\"; break;
            case '"': result += "\\\""; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default:
                if (static_cast<unsigned char>(character) < 0x20) throw std::invalid_argument("control character in IPC field");
                result += character;
        }
    }
    return result;
}

#if defined(_WIN32)
using Socket = SOCKET;
constexpr Socket InvalidSocket = INVALID_SOCKET;
void CloseSocket(Socket socket) { closesocket(socket); }
#else
using Socket = int;
constexpr Socket InvalidSocket = -1;
void CloseSocket(Socket socket) { close(socket); }
#endif

void ConfigureTimeouts(Socket socket, bool longRunning) {
#if defined(_WIN32)
    const DWORD receiveTimeoutMs = longRunning ? 180000 : 5000;
    constexpr DWORD sendTimeoutMs = 5000;
    setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&receiveTimeoutMs), sizeof(receiveTimeoutMs));
    setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&sendTimeoutMs), sizeof(sendTimeoutMs));
#else
    const timeval receiveTimeout{longRunning ? 180 : 5, 0};
    constexpr timeval sendTimeout{5, 0};
    setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, &receiveTimeout, sizeof(receiveTimeout));
    setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, &sendTimeout, sizeof(sendTimeout));
#if defined(SO_NOSIGPIPE)
    constexpr int noSigPipe = 1;
    setsockopt(socket, SOL_SOCKET, SO_NOSIGPIPE, &noSigPipe, sizeof(noSigPipe));
#endif
#endif
}

bool IsLongRunningAction(const std::string& action) {
    return action == "send_review"
        || action == "delivery"
        || action == "import_reference"
        || action == "prepare_compare"
        || action == "recall"
        || action == "intro_copy";
}

int SendFlags() {
#if defined(MSG_NOSIGNAL)
    return MSG_NOSIGNAL;
#else
    return 0;
#endif
}

void CleanupSocket(Socket socket) {
    if (socket != InvalidSocket) CloseSocket(socket);
#if defined(_WIN32)
    WSACleanup();
#endif
}

} // namespace

namespace creatorhub {

CreatorHubReviewBridge::CreatorHubReviewBridge(std::string localSecret, std::uint16_t port)
    : secret_(std::move(localSecret)), port_(port) {
    if (secret_.size() < 32) throw std::invalid_argument("Review Console secret is missing or invalid");
}

std::string CreatorHubReviewBridge::Send(
    const std::string& requestId,
    const std::string& action,
    const std::string& payloadJson) const {
    if (requestId.empty() || requestId.size() > 128) throw std::invalid_argument("invalid request id");
    if (action.empty() || action.size() > 64) throw std::invalid_argument("invalid action");
    if (payloadJson.empty() || payloadJson.size() > 60000) throw std::invalid_argument("invalid payload");

#if defined(_WIN32)
    WSADATA data{};
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) throw std::runtime_error("WSAStartup failed");
#endif
    const Socket socketHandle = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (socketHandle == InvalidSocket) {
#if defined(_WIN32)
        WSACleanup();
#endif
        throw std::runtime_error("socket creation failed");
    }
    // A review export includes Pro Tools bounce, QC, private S3 upload and
    // server-side registration. It runs on a worker thread and legitimately
    // takes longer than the five-second timeout used by interactive actions.
    ConfigureTimeouts(socketHandle, IsLongRunningAction(action));
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(port_);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(socketHandle, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0) {
        CleanupSocket(socketHandle);
        throw std::runtime_error("CreatorHub Companion is not listening");
    }
    const std::string request = "{\"protocolVersion\":1,\"requestId\":\"" + JsonEscape(requestId)
        + "\",\"auth\":\"" + JsonEscape(secret_) + "\",\"action\":\"" + JsonEscape(action)
        + "\",\"payload\":" + payloadJson + "}\n";
    std::size_t sent = 0;
    while (sent < request.size()) {
        const auto written = send(
            socketHandle,
            request.data() + sent,
            static_cast<int>(request.size() - sent),
            SendFlags());
        if (written <= 0) { CleanupSocket(socketHandle); throw std::runtime_error("IPC write failed"); }
        sent += static_cast<std::size_t>(written);
    }
    std::string response;
    char buffer[4096];
    constexpr std::size_t MaxResponseBytes = 512 * 1024;
    while (response.size() <= MaxResponseBytes) {
        const auto count = recv(socketHandle, buffer, sizeof(buffer), 0);
        if (count <= 0) break;
        response.append(buffer, static_cast<std::size_t>(count));
        if (!response.empty() && response.back() == '\n') break;
    }
    CleanupSocket(socketHandle);
    if (response.empty() || response.size() > MaxResponseBytes) throw std::runtime_error("invalid IPC response");
    return response;
}

} // namespace creatorhub
