import Foundation

/// Ett planlagt shot i en ``ShotList``. Lever som element i shotsJson-
/// JSON-arrayen — har INGEN GRDB-conformance, decodes/encodes kun via
/// JSON round-trip på ShotList sin computed ``shots``-property.
///
/// Felt-shape matcher web-wizardens `ShotListItem`-interface i
/// `frontend/client/src/components/project/ProjectCreationWithMemoryCards.tsx`
/// så samme JSON kan flyte begge veier uten remapping.
struct ShotListItem: Codable, Sendable, Equatable, Identifiable {
    /// UUID lowercased — generert på iPad ved opprettelse, beholdes
    /// gjennom sync. Aldri reassignet etter første lagring.
    var id: String

    /// Hovedbeskrivelsen av shotet ("Bridal portrait — backlit",
    /// "First-look reaction"). Påkrevd, alt annet er optional fordi
    /// shot-listene typisk starter sparsomt og fylles ut underveis.
    var scene: String

    var description: String?

    /// Anslått varighet i sekunder. Brukt for tidsplan-summen i
    /// `LiveCaptureView`. nil hvis fotografen ikke har gjort estimat.
    var estimatedDuration: Int?

    /// "must" | "high" | "medium" | "low" — string match webs
    /// dropdown. Mest brukt: "must" som triggers "Must-have"-stripa
    /// på ``TodayView``.
    var priority: String?

    /// "wide" | "tight" | "detail" | "candid" — visuelt valg.
    var shotType: String?

    /// Fritekst-navn på lokasjonen ("Brudens hjemmebar", "Hagepartiet").
    /// Atskilt fra prosjektets `location` så multi-location-shoots kan
    /// markere hvilket shot hører hjem hvor.
    var locationName: String?

    var notes: String?

    /// `true` hvis fotografen har scoutet lokasjonen på forhånd. Drives
    /// markører i shot-list-panelet ("✓ scoutet").
    var scouted: Bool?

    /// Default `false` ved opprettelse, slått til `true` av
    /// ``ShotListStore.toggleCompletion`` når shotet er tatt.
    var isCompleted: Bool?

    /// Kobler dette shotet til en `Asset.id` — slik at shot-listen kan
    /// vise thumbnail når flagget completed.
    var capturedAssetId: String?

    /// Base64-encoded PencilKit-strokes. Brukt for håndtegnede skisser
    /// av kameravinkel/komposisjon. Hard 200 KB-grense før vi tvinger
    /// rasterisering — håndhevet i ``ShotListStore``, ikke her.
    var inkData: String?

    init(
        id: String,
        scene: String,
        description: String? = nil,
        estimatedDuration: Int? = nil,
        priority: String? = nil,
        shotType: String? = nil,
        locationName: String? = nil,
        notes: String? = nil,
        scouted: Bool? = nil,
        isCompleted: Bool? = nil,
        capturedAssetId: String? = nil,
        inkData: String? = nil,
    ) {
        self.id = id
        self.scene = scene
        self.description = description
        self.estimatedDuration = estimatedDuration
        self.priority = priority
        self.shotType = shotType
        self.locationName = locationName
        self.notes = notes
        self.scouted = scouted
        self.isCompleted = isCompleted
        self.capturedAssetId = capturedAssetId
        self.inkData = inkData
    }
}
