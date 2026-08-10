// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OutboxKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "OutboxKit", targets: ["OutboxKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift", from: "7.0.0"),
    ],
    targets: [
        .target(
            name: "OutboxKit",
            dependencies: [.product(name: "GRDB", package: "GRDB.swift")],
            swiftSettings: [
                // Samme regime som appene. Data-race-feil skal være hard error
                // her også, ikke noe som først dukker opp hos konsumenten.
                .swiftLanguageMode(.v6),
            ],
        ),
        .testTarget(
            name: "OutboxKitTests",
            dependencies: ["OutboxKit"],
            swiftSettings: [.swiftLanguageMode(.v6)],
        ),
    ],
)
