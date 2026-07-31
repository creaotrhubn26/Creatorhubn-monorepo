// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NetworkingKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "NetworkingKit", targets: ["NetworkingKit"]),
    ],
    targets: [
        .target(
            name: "NetworkingKit",
            swiftSettings: [.swiftLanguageMode(.v6)],
        ),
        .testTarget(
            name: "NetworkingKitTests",
            dependencies: ["NetworkingKit"],
            swiftSettings: [.swiftLanguageMode(.v6)],
        ),
    ],
)
