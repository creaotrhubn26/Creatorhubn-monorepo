#include "CreatorHubReviewBridge.hpp"

#include <cstring>
#include <stdexcept>
#include <string>
#include <thread>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
using TestSocket = SOCKET;
constexpr TestSocket InvalidTestSocket = INVALID_SOCKET;
void CloseTestSocket(TestSocket socket) { closesocket(socket); }
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using TestSocket = int;
constexpr TestSocket InvalidTestSocket = -1;
void CloseTestSocket(TestSocket socket) { close(socket); }
#endif

int main() {
    try {
        creatorhub::CreatorHubReviewBridge invalid("short");
        return 1;
    } catch (const std::invalid_argument&) {
    }
    const std::string secret(64, 'a');
    creatorhub::CreatorHubReviewBridge valid(secret);
    try {
        static_cast<void>(valid.Send("", "health"));
        return 2;
    } catch (const std::invalid_argument&) {
    }

#if defined(_WIN32)
    WSADATA data{};
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) return 3;
#endif
    const TestSocket listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listener == InvalidTestSocket) return 4;
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = 0;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0
        || listen(listener, 1) != 0) {
        CloseTestSocket(listener);
        return 5;
    }
#if defined(_WIN32)
    int addressLength = sizeof(address);
#else
    socklen_t addressLength = sizeof(address);
#endif
    if (getsockname(listener, reinterpret_cast<sockaddr*>(&address), &addressLength) != 0) {
        CloseTestSocket(listener);
        return 6;
    }
    const std::uint16_t port = ntohs(address.sin_port);
    bool requestValid = false;
    std::thread server([&] {
        const TestSocket client = accept(listener, nullptr, nullptr);
        if (client == InvalidTestSocket) return;
        std::string request;
        char buffer[1024];
        while (request.size() < 65536) {
            const auto count = recv(client, buffer, sizeof(buffer), 0);
            if (count <= 0) break;
            request.append(buffer, static_cast<std::size_t>(count));
            if (request.back() == '\n') break;
        }
        requestValid = request.find("\"protocolVersion\":1") != std::string::npos
            && request.find("\"requestId\":\"bridge-e2e\"") != std::string::npos
            && request.find("\"auth\":\"" + secret + "\"") != std::string::npos
            && request.find("\"action\":\"health\"") != std::string::npos;
        const std::string response = "{\"protocolVersion\":1,\"requestId\":\"bridge-e2e\",\"ok\":true}\n";
        static_cast<void>(send(client, response.data(), static_cast<int>(response.size()), 0));
        CloseTestSocket(client);
    });

    const std::string response = creatorhub::CreatorHubReviewBridge(secret, port)
        .Send("bridge-e2e", "health");
    server.join();
    CloseTestSocket(listener);
#if defined(_WIN32)
    WSACleanup();
#endif
    if (!requestValid || response.find("\"ok\":true") == std::string::npos) return 7;
    return 0;
}
