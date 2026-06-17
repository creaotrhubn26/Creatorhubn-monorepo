// PencilAnnotationCanvas.swift
//
// PencilKit-overlay som ligger oppå MapKit når tegne-modus er aktivt.
// Strøkene konverteres til lat/lng-koordinater via MKMapView.convert.
//
// Bruk:
//   PencilAnnotationCanvas(
//     mapView: mapViewRef,
//     onFinish: { coordinates in ... }
//   )
//
// Apple Pencil tegner med fysisk press → bredere strøk. Finger gir
// tynnere stroke for å skille intensjon.

import SwiftUI
import PencilKit
import MapKit

struct PencilAnnotationCanvas: UIViewRepresentable {
    let mapView: MKMapView
    let strokeColor: UIColor
    let strokeWidth: CGFloat
    let onFinish: ([CLLocationCoordinate2D]) -> Void
    /// Hvis true: la strøket lukkes til polygon (focus_area)
    let closeToPolygon: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(
            mapView: mapView,
            onFinish: onFinish,
            closeToPolygon: closeToPolygon,
        )
    }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.delegate = context.coordinator
        canvas.drawingPolicy = .anyInput      // Pencil + finger
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.tool = PKInkingTool(.pen, color: strokeColor, width: strokeWidth)
        // Tillat samtidig touch på map (vi forhindrer scroll via pan-gesture
        // disable utenfor coordinator)
        canvas.isMultipleTouchEnabled = true
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        uiView.tool = PKInkingTool(.pen, color: strokeColor, width: strokeWidth)
        context.coordinator.closeToPolygon = closeToPolygon
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        private let mapView: MKMapView
        private let onFinish: ([CLLocationCoordinate2D]) -> Void
        var closeToPolygon: Bool

        init(
            mapView: MKMapView,
            onFinish: @escaping ([CLLocationCoordinate2D]) -> Void,
            closeToPolygon: Bool,
        ) {
            self.mapView = mapView
            self.onFinish = onFinish
            self.closeToPolygon = closeToPolygon
        }

        /// PencilKit kaller dette ved hver endring i drawing. Vi venter
        /// til brukeren løfter pennen (en kort debounce) før vi konverterer
        /// til koordinater.
        private var debounceTask: Task<Void, Never>?

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            debounceTask?.cancel()
            let drawing = canvasView.drawing
            let map = mapView
            debounceTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 600_000_000) // 600ms
                if Task.isCancelled { return }
                let coords = Self.extractCoordinates(
                    from: drawing,
                    in: map,
                )
                if coords.count >= 2 {
                    self.onFinish(coords)
                }
            }
        }

        /// Plukk ut path-points fra alle strøk, downsample til ~30 punkter
        /// for å holde payload-en liten, og konverter via mapView.convert.
        static func extractCoordinates(
            from drawing: PKDrawing,
            in mapView: MKMapView,
        ) -> [CLLocationCoordinate2D] {
            // Samle alle path-points fra alle strøk (siste strøk er primært)
            guard let stroke = drawing.strokes.last else { return [] }
            let path = stroke.path
            let pointCount = path.count
            guard pointCount > 0 else { return [] }
            // Downsample
            let targetCount = min(60, pointCount)
            let step = max(1, pointCount / targetCount)
            var coords: [CLLocationCoordinate2D] = []
            for i in stride(from: 0, to: pointCount, by: step) {
                let p = path[i]
                let coord = mapView.convert(p.location, toCoordinateFrom: mapView)
                coords.append(coord)
            }
            return coords
        }
    }
}
