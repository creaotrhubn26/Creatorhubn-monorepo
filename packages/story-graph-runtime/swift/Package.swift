// swift-tools-version:5.9
// Package.swift — Story Graph runtime som Swift Package (tredje port, se ../README.md).
// Ingen tredjeparts-avhengigheter: JSON leses med Foundations JSONSerialization,
// akkurat som Newtonsoft/JObject i C#-porten og JSON.parse_string i GDScript-porten.
import PackageDescription

let package = Package(
    name: "StoryGraphRuntime",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "StoryGraphRuntime", targets: ["StoryGraphRuntime"]),
    ],
    targets: [
        .target(
            name: "StoryGraphRuntime",
            path: "Sources/StoryGraphRuntime"
        ),
        .testTarget(
            name: "StoryGraphRuntimeTests",
            dependencies: ["StoryGraphRuntime"],
            path: "Tests/StoryGraphRuntimeTests"
        ),
    ]
)
