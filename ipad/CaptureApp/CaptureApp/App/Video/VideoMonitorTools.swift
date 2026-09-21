import AVFoundation
import SwiftUI
import UIKit

enum VideoMonitorOrientation: String, CaseIterable, Identifiable {
    case automatic
    case landscape
    case portraitLeft
    case portraitRight

    var id: String { rawValue }

    var label: String {
        switch self {
        case .automatic: "Auto"
        case .landscape: "Landskap"
        case .portraitLeft: "Vertikal venstre"
        case .portraitRight: "Vertikal høyre"
        }
    }

    var angle: Angle {
        switch self {
        case .automatic, .landscape: .zero
        case .portraitLeft: .degrees(-90)
        case .portraitRight: .degrees(90)
        }
    }

    var swapsDimensions: Bool {
        self == .portraitLeft || self == .portraitRight
    }
}

enum VideoFrameGuide: String, CaseIterable, Identifiable {
    case off
    case thirds
    case safeArea
    case vertical916
    case cinema239

    var id: String { rawValue }

    var label: String {
        switch self {
        case .off: "Ingen"
        case .thirds: "Tredelsregel"
        case .safeArea: "Safe area"
        case .vertical916: "9:16"
        case .cinema239: "2.39:1"
        }
    }
}

struct VideoMonitorSurface: View {
    let image: UIImage
    let frameID: UInt64
    let orientation: VideoMonitorOrientation
    let guide: VideoFrameGuide
    let referenceImage: UIImage?
    let referenceOpacity: Double
    let showsVectorscope: Bool
    let onFocusTap: ((CGPoint) -> Void)?
    @State private var focusPoint: CGPoint?

    var body: some View {
        GeometryReader { proxy in
            let source = image.size
            let oriented = orientation.swapsDimensions
                ? CGSize(width: source.height, height: source.width)
                : source
            let rect = AVMakeRect(
                aspectRatio: oriented,
                insideRect: CGRect(origin: .zero, size: proxy.size)
            )

            ZStack {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .rotationEffect(orientation.angle)
                    .frame(width: rect.width, height: rect.height)

                if let referenceImage {
                    Image(uiImage: referenceImage)
                        .resizable()
                        .scaledToFit()
                        .opacity(referenceOpacity)
                        .frame(width: rect.width, height: rect.height)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }

                VideoFrameGuideView(guide: guide)
                    .frame(width: rect.width, height: rect.height)
                    .allowsHitTesting(false)

                if showsVectorscope {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            VideoVectorscopeView(image: image, frameID: frameID)
                                .frame(width: 150, height: 150)
                                .padding(12)
                        }
                    }
                }

                if let focusPoint {
                    Circle()
                        .stroke(Color.yellow, lineWidth: 2)
                        .frame(width: 42, height: 42)
                        .position(
                            x: rect.minX + focusPoint.x * rect.width,
                            y: rect.minY + focusPoint.y * rect.height
                        )
                        .shadow(color: .black.opacity(0.8), radius: 2)
                        .allowsHitTesting(false)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                SpatialTapGesture().onEnded { value in
                    guard let onFocusTap, rect.contains(value.location) else { return }
                    let displayed = CGPoint(
                        x: (value.location.x - rect.minX) / rect.width,
                        y: (value.location.y - rect.minY) / rect.height
                    )
                    focusPoint = displayed
                    let cameraPoint: CGPoint = switch orientation {
                    case .automatic, .landscape:
                        displayed
                    case .portraitLeft:
                        CGPoint(x: 1 - displayed.y, y: displayed.x)
                    case .portraitRight:
                        CGPoint(x: displayed.y, y: 1 - displayed.x)
                    }
                    onFocusTap(cameraPoint)
                }
            )
        }
        .accessibilityLabel("Canon CCAPI live monitor")
    }
}

private struct VideoFrameGuideView: View {
    let guide: VideoFrameGuide

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                var path = Path()
                switch guide {
                case .off:
                    break
                case .thirds:
                    for fraction in [1.0 / 3.0, 2.0 / 3.0] {
                        path.move(to: CGPoint(x: size.width * fraction, y: 0))
                        path.addLine(to: CGPoint(x: size.width * fraction, y: size.height))
                        path.move(to: CGPoint(x: 0, y: size.height * fraction))
                        path.addLine(to: CGPoint(x: size.width, y: size.height * fraction))
                    }
                case .safeArea:
                    path.addRect(CGRect(
                        x: size.width * 0.05,
                        y: size.height * 0.05,
                        width: size.width * 0.9,
                        height: size.height * 0.9
                    ))
                    path.addRect(CGRect(
                        x: size.width * 0.1,
                        y: size.height * 0.1,
                        width: size.width * 0.8,
                        height: size.height * 0.8
                    ))
                case .vertical916:
                    let width = size.height * 9 / 16
                    path.addRect(CGRect(x: (size.width - width) / 2, y: 0, width: width, height: size.height))
                case .cinema239:
                    let height = size.width / 2.39
                    path.addRect(CGRect(x: 0, y: (size.height - height) / 2, width: size.width, height: height))
                }
                context.stroke(path, with: .color(.white.opacity(0.82)), lineWidth: 1)
            }
        }
        .accessibilityHidden(true)
    }
}

private struct VideoVectorscopeView: View {
    let image: UIImage
    let frameID: UInt64
    @State private var points: [CGPoint] = []

    var body: some View {
        ZStack {
            Circle().fill(.black.opacity(0.72))
            Circle().stroke(.white.opacity(0.32), lineWidth: 1)
            Circle().stroke(.white.opacity(0.18), lineWidth: 1).padding(28)
            Path { path in
                path.move(to: CGPoint(x: 75, y: 7))
                path.addLine(to: CGPoint(x: 75, y: 143))
                path.move(to: CGPoint(x: 7, y: 75))
                path.addLine(to: CGPoint(x: 143, y: 75))
            }
            .stroke(.white.opacity(0.18), lineWidth: 1)
            Canvas { context, size in
                for point in points {
                    let rect = CGRect(
                        x: point.x * size.width - 0.7,
                        y: point.y * size.height - 0.7,
                        width: 1.4,
                        height: 1.4
                    )
                    context.fill(Path(ellipseIn: rect), with: .color(.green.opacity(0.33)))
                }
            }
            Text("VECTORSCOPE")
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundStyle(.white.opacity(0.7))
                .frame(maxHeight: .infinity, alignment: .top)
                .padding(.top, 8)
        }
        .task(id: frameID / 5) {
            points = VectorscopeSampler.points(from: image)
        }
        .accessibilityLabel("Vectorscope")
    }
}

enum VectorscopeSampler {
    static func points(from image: UIImage) -> [CGPoint] {
        guard let cgImage = image.cgImage else { return [] }
        let width = 48
        let height = 27
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let base = buffer.baseAddress,
                  let context = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: width * 4,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                  )
            else { return false }
            context.interpolationQuality = .low
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard rendered else { return [] }
        return stride(from: 0, to: pixels.count, by: 4).map { index in
            let r = Double(pixels[index]) / 255
            let g = Double(pixels[index + 1]) / 255
            let b = Double(pixels[index + 2]) / 255
            let y = 0.299 * r + 0.587 * g + 0.114 * b
            let u = max(0, min(1, 0.5 + 0.492 * (b - y)))
            let v = max(0, min(1, 0.5 + 0.877 * (r - y)))
            return CGPoint(x: u, y: 1 - v)
        }
    }
}

enum VideoSnapshotStore {
    static func save(
        image: UIImage,
        projectId: String?,
        cameraName: String?
    ) throws -> URL {
        guard let data = image.jpegData(compressionQuality: 0.92) else {
            throw SnapshotError.encodingFailed
        }
        let root = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let safeProject = (projectId ?? "uten-prosjekt")
            .replacingOccurrences(of: "/", with: "-")
        let directory = root
            .appendingPathComponent("CreatorHub", isDirectory: true)
            .appendingPathComponent("VideoSnapshots", isDirectory: true)
            .appendingPathComponent(safeProject, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss-SSS"
        let stem = "monitor-\(formatter.string(from: Date()))"
        let imageURL = directory.appendingPathComponent(stem).appendingPathExtension("jpg")
        try data.write(to: imageURL, options: .atomic)
        let metadata: [String: String] = [
            "capturedAt": ISO8601DateFormatter().string(from: Date()),
            "camera": cameraName ?? "Ukjent kamera",
            "projectId": projectId ?? ""
        ]
        let metadataData = try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys])
        try metadataData.write(
            to: directory.appendingPathComponent(stem).appendingPathExtension("json"),
            options: .atomic
        )
        return imageURL
    }

    enum SnapshotError: LocalizedError {
        case encodingFailed

        var errorDescription: String? { "Kunne ikke kode monitorbildet som JPEG." }
    }
}
