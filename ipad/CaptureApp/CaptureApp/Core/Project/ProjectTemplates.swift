import Foundation
import Observation

/// Complexity markers shown as chips on a project — what makes this kind of
/// shoot demanding to run.
enum ProjectComplexityFlag: String, Sendable, Hashable {
    case multiDay, crew, licensing, highVolume, modelReleases, embargo, drone, retouching, sameDay, permits

    var label: String {
        switch self {
        case .multiDay: return "Flerdags"
        case .crew: return "Crew/stylist"
        case .licensing: return "Bruksrettigheter"
        case .highVolume: return "Høyt volum"
        case .modelReleases: return "Model releases"
        case .embargo: return "Embargo"
        case .drone: return "Drone"
        case .retouching: return "Retusjeringsrunder"
        case .sameDay: return "Same-day-levering"
        case .permits: return "Tillatelser"
        }
    }

    var icon: String {
        switch self {
        case .multiDay: return "calendar.day.timeline.left"
        case .crew: return "person.3"
        case .licensing: return "checkmark.seal"
        case .highVolume: return "square.stack.3d.up"
        case .modelReleases: return "signature"
        case .embargo: return "lock"
        case .drone: return "airplane"
        case .retouching: return "wand.and.stars"
        case .sameDay: return "bolt"
        case .permits: return "doc.badge.gearshape"
        }
    }
}

/// A project-type template: drives the timeline (phases), suggested worklog
/// phases, the deliverables checklist, and the complexity flags. Photographer
/// projects are far more than weddings — each type runs differently.
struct ProjectTemplate: Sendable, Hashable {
    let key: String
    let displayName: String
    let phases: [String]
    let worklogPhases: [String]
    let deliverables: [String]
    let flags: [ProjectComplexityFlag]

    /// Best-effort match from the backend's free-text projectType.
    static func match(_ projectType: String?) -> ProjectTemplate {
        let t = (projectType ?? "").lowercased()
        func has(_ words: [String]) -> Bool { words.contains { t.contains($0) } }

        if has(["bryllup", "wedding"]) { return wedding }
        if has(["kampanje", "campaign", "reklame", "kommersiell", "commercial"]) { return commercialCampaign }
        if has(["produkt", "product", "katalog", "e-handel", "ehandel", "ecommerce", "pakkshot", "packshot"]) { return productCatalog }
        if has(["eiendom", "real", "estate", "arkitektur", "architecture", "bolig"]) { return realEstate }
        if has(["event", "konferanse", "conference", "arrangement"]) { return eventMultiDay }
        if has(["editorial", "magasin", "magazine", "redaksjon"]) { return editorial }
        if has(["mote", "fashion", "lookbook", "kolleksjon"]) { return fashion }
        if has(["branding", "headshot", "ansatt", "bedrift", "profil", "corporate"]) { return brandingPackage }
        if has(["konsert", "concert", "live", "band", "festival"]) { return concert }
        if has(["portrett", "portrait", "familie", "family", "nyfødt", "newborn"]) { return portrait }
        return generic
    }

    static let all: [ProjectTemplate] = [
        wedding, commercialCampaign, productCatalog, realEstate, eventMultiDay,
        editorial, fashion, brandingPackage, concert, portrait
    ]

    // MARK: - Catalog

    static let wedding = ProjectTemplate(
        key: "wedding", displayName: "Bryllup",
        phases: ["Forsamtale & timeline", "Lokasjons-rekognosering", "Bryllupsdagen", "Utvalg & redigering", "Levering & album"],
        worklogPhases: ["Planlegging", "Fotografering", "Culling", "Redigering", "Album-design"],
        deliverables: ["Online galleri", "Høyoppløste filer", "Album", "Forhåndsvisning (sneak peek)"],
        flags: [.multiDay, .sameDay],
    )

    static let commercialCampaign = ProjectTemplate(
        key: "commercial", displayName: "Kommersiell kampanje",
        phases: ["Brief & moodboard", "Pre-produksjon (crew/lokasjon)", "Opptaksdag(er)", "Utvalg & klient-godkjenning", "Retusjering & levering"],
        worklogPhases: ["Pre-produksjon", "Opptak", "Utvalg", "Retusjering", "Levering"],
        deliverables: ["Web-optimerte filer", "Print-oppløsning", "Sosiale formater (1:1/9:16)", "Bruksrettighets-dokument"],
        flags: [.crew, .licensing, .retouching],
    )

    static let productCatalog = ProjectTemplate(
        key: "product", displayName: "Produkt / katalog",
        phases: ["Motta SKU-liste & prøver", "Studio-oppsett", "Fotografering (packshot + lifestyle)", "Retusjering per bilde", "Metadata & levering"],
        worklogPhases: ["Oppsett", "Fotografering", "Retusjering", "Filnavn/metadata", "Levering"],
        deliverables: ["Hvit bakgrunn / clipping path", "Lifestyle-bilder", "Web-format + miniatyrer", "Filnavn etter SKU"],
        flags: [.highVolume, .retouching],
    )

    static let realEstate = ProjectTemplate(
        key: "realestate", displayName: "Eiendom / arkitektur",
        phases: ["Booking & tilgang", "Befaring", "Fotografering (HDR + evt. drone)", "Redigering", "24t-levering"],
        worklogPhases: ["Planlegging", "Fotografering", "Drone", "Redigering", "Levering"],
        deliverables: ["MLS/web-format", "Høyoppløst print", "Drone-bilder", "Evt. plantegning/virtuell styling"],
        flags: [.drone, .permits, .sameDay],
    )

    static let eventMultiDay = ProjectTemplate(
        key: "event", displayName: "Event / konferanse",
        phases: ["Program & akkreditering", "Crew-koordinering", "Dag 1 + same-day-utvalg", "Resterende dager", "Full levering"],
        worklogPhases: ["Planlegging", "Fotografering", "Same-day-utvalg", "Redigering", "Levering"],
        deliverables: ["Same-day SoMe-utvalg", "Fullt galleri", "Keynote/stand/sosialt-mapper", "Presse-format"],
        flags: [.multiDay, .crew, .sameDay],
    )

    static let editorial = ProjectTemplate(
        key: "editorial", displayName: "Editorial / magasin",
        phases: ["Konsept m/ art director", "Casting & crew (MUA/stylist)", "Opptaksdag", "Utvalg m/ redaksjon", "Layout-tilpasset levering"],
        worklogPhases: ["Konsept", "Pre-produksjon", "Opptak", "Utvalg", "Retusjering"],
        deliverables: ["Layout-format", "Model releases", "Høyoppløst retusjert", "Embargo-avtale"],
        flags: [.crew, .modelReleases, .embargo, .retouching],
    )

    static let fashion = ProjectTemplate(
        key: "fashion", displayName: "Mote / lookbook",
        phases: ["Kolleksjon & looks-plan", "Casting & crew", "Opptak (on-figure + flatlay)", "Retusjeringsrunder", "Sesong-levering"],
        worklogPhases: ["Planlegging", "Opptak", "Retusjering r1", "Retusjering r2", "Levering"],
        deliverables: ["On-figure", "Flatlay/still", "Web + lookbook-PDF", "Model releases"],
        flags: [.crew, .modelReleases, .retouching],
    )

    static let brandingPackage = ProjectTemplate(
        key: "branding", displayName: "Branding-pakke (bedrift)",
        phases: ["Avklar stil & antall ansatte", "Booking per person", "Fotodag(er)", "Individuell redigering", "Levering per person"],
        worklogPhases: ["Planlegging", "Fotografering", "Redigering", "Levering"],
        deliverables: ["Headshot per ansatt", "Konsistent stil/bakgrunn", "Web + LinkedIn-format", "Gruppebilde"],
        flags: [.highVolume, .crew],
    )

    static let concert = ProjectTemplate(
        key: "concert", displayName: "Konsert / live",
        phases: ["Akkreditering & avtale", "Tre-låters-regel/posisjon", "Opptak (lavt lys)", "Rask redigering", "Levering m/ embargo"],
        worklogPhases: ["Planlegging", "Fotografering", "Redigering", "Levering"],
        deliverables: ["Presse-format", "Label/artist-levering", "Embargo-merket", "SoMe-utvalg"],
        flags: [.embargo, .permits, .sameDay],
    )

    static let portrait = ProjectTemplate(
        key: "portrait", displayName: "Portrett",
        phases: ["Forsamtale & stil", "Lokasjon/studio", "Fotografering", "Utvalg & redigering", "Levering"],
        worklogPhases: ["Planlegging", "Fotografering", "Redigering", "Levering"],
        deliverables: ["Online galleri", "Retusjerte favoritter", "Web + print-format"],
        flags: [],
    )

    static let generic = ProjectTemplate(
        key: "generic", displayName: "Prosjekt",
        phases: ["Planlegging", "Gjennomføring", "Etterarbeid", "Levering"],
        worklogPhases: ["Planlegging", "Gjennomføring", "Etterarbeid", "Levering"],
        deliverables: ["Online galleri", "Leverte filer"],
        flags: [],
    )
}

/// Per-project deliverables checklist — seeded from the template, persisted
/// locally (no backend deliverables endpoint yet), like the packing checklist.
@MainActor
@Observable
final class ProjectDeliverables {
    struct Item: Codable, Identifiable, Hashable, Sendable {
        let id: String      // the deliverable text is the stable id
        var done: Bool
    }

    private let projectId: String
    private let template: ProjectTemplate
    private(set) var items: [Item] { didSet { persist() } }

    init(projectId: String, template: ProjectTemplate) {
        self.projectId = projectId
        self.template = template
        let key = "creatorhub.deliverables.\(projectId)"
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([Item].self, from: data) {
            // Merge in any new template deliverables added since last open.
            var merged = decoded
            let seen = Set(decoded.map(\.id))
            for d in template.deliverables where !seen.contains(d) { merged.append(Item(id: d, done: false)) }
            items = merged
        } else {
            items = template.deliverables.map { Item(id: $0, done: false) }
        }
    }

    var doneCount: Int { items.filter(\.done).count }

    func toggle(_ item: Item) {
        guard let idx = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[idx].done.toggle()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: "creatorhub.deliverables.\(projectId)")
        }
    }
}
