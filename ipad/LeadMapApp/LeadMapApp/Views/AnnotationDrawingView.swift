// AnnotationDrawingView.swift
//
// Modal full-screen tegne-flate. MKMapView nederst + PencilKit-canvas
// oppå. Brukeren tegner med Apple Pencil → strøk-punktene konverteres
// til lat/lng-koordinater og lagres som annotasjon.
//
// Vises som .sheet fra MapScreen når brukeren klikker "Tegn på kart".

import SwiftUI
import MapKit
import PencilKit

struct AnnotationDrawingView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss
    @StateObject private var draft = AnnotationDraftStore()
    @State private var mapView = MKMapView()
    @State private var members: [MemberProfile] = []
    @State private var canCreate = false
    @State private var saving = false
    @State private var error: String?

    let initialRegion: MKCoordinateRegion?

    init(initialRegion: MKCoordinateRegion? = nil) {
        self.initialRegion = initialRegion
    }

    var body: some View {
        NavigationStack {
            ZStack {
                MapViewRepresentable(mapView: mapView, initialRegion: initialRegion)
                    .ignoresSafeArea()

                if draft.isDrawing {
                    PencilAnnotationCanvas(
                        mapView: mapView,
                        strokeColor: UIColor.fromHex(draft.selectedColorHex)
                            ?? .systemPurple,
                        strokeWidth: draft.strokeWidth,
                        onFinish: handleStroke,
                        closeToPolygon: draft.selectedType == .focusArea,
                    )
                    .allowsHitTesting(true)
                }

                // Flytende toolbar i bunn
                VStack {
                    if let err = error {
                        Text(err).font(.caption).foregroundStyle(.red)
                            .padding(8)
                            .background(.ultraThinMaterial, in: Capsule())
                            .padding(.top, 8)
                    }
                    Spacer()
                    AnnotationToolbar(
                        store: draft,
                        canCreate: canCreate,
                        members: members,
                        onSave: save
                    )
                    .padding()
                }
            }
            .navigationTitle("Tegn på kart")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if draft.hasPendingDraft {
                        Button("Slett") { draft.reset() }
                            .foregroundStyle(.red)
                    }
                }
            }
            .task { await loadMembers() }
        }
    }

    @MainActor
    private func loadMembers() async {
        guard let api = state.api, let orgId = state.activeOrganizationId else { return }
        do {
            self.members = try await api.fetchOrgMembers(orgId)
        } catch { /* noop */ }
        // canCreate: admin/salgssjef/teamleder
        if let role = state.roleInOrg {
            canCreate = ["admin","salgssjef","teamleder"].contains(role)
        }
    }

    private func handleStroke(_ coords: [CLLocationCoordinate2D]) {
        draft.pendingCoordinates = coords.map {
            .init(lat: $0.latitude, lng: $0.longitude)
        }
    }

    @MainActor
    private func save() async {
        guard let api = state.api, let orgId = state.activeOrganizationId,
              draft.hasPendingDraft else { return }
        saving = true
        defer { saving = false }
        let payload = AnnotationCreatePayload(
            annotationType: draft.selectedType,
            coordinates: draft.pendingCoordinates.map {
                CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng)
            },
            title: draft.title.isEmpty ? nil : draft.title,
            body: draft.body.isEmpty ? nil : draft.body,
            color: "#" + draft.selectedColorHex,
            strokeWidth: draft.strokeWidth,
            assignedToUserId: draft.assignedToUserId,
            targetLeadId: nil
        )
        do {
            _ = try await api.createAnnotation(organizationId: orgId, payload: payload)
            await state.refreshAnnotations()
            dismiss()
        } catch {
            self.error = "Lagring feilet: \(error.localizedDescription)"
        }
    }
}

// MARK: - MKMapView UIViewRepresentable

struct MapViewRepresentable: UIViewRepresentable {
    let mapView: MKMapView
    let initialRegion: MKCoordinateRegion?

    func makeUIView(context: Context) -> MKMapView {
        if let region = initialRegion {
            mapView.setRegion(region, animated: false)
        }
        mapView.showsUserLocation = true
        return mapView
    }

    func updateUIView(_ uiView: MKMapView, context: Context) {}
}

// MARK: - Hex-helper for UIColor

private extension UIColor {
    static func fromHex(_ hex: String) -> UIColor? {
        let s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        guard s.count == 6 else { return nil }
        var rgb: UInt64 = 0
        guard Scanner(string: s).scanHexInt64(&rgb) else { return nil }
        return UIColor(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}
