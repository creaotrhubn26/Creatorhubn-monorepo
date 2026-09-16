// LogbookView.swift — personlig spotting-database. PhotosPicker → EXIF
// (ImageIO, innebygd) → fly-match mot live-data → lagre.
// Lagres lokalt (UserDefaults-JSON) + synk mot backend når innlogget.
// ponytail: lokal lagring først; backend-synk kobles på når appen får
// CreatorHub-innlogging (samme mønster som LeadMapApp).

import SwiftUI
import PhotosUI
import ImageIO
import CoreLocation

@MainActor
@Observable
final class LogbookStore {
    private(set) var entries: [LogbookEntry] = []
    private static let storageKey = "aerospot.logbook"

    init() { load() }

    func add(_ entry: LogbookEntry) {
        entries.insert(entry, at: 0)
        save()
        // Push til server (best-effort) og adopter server-tildelt id.
        Task { [weak self] in
            guard let serverId = await AeroSpotAPI.pushLogbook(entry) else { return }
            self?.adoptServerId(localId: entry.id, serverId: serverId)
        }
    }

    func remove(_ id: String) {
        entries.removeAll { $0.id == id }
        save()
        Task { await AeroSpotAPI.deleteLogbook(id: id) }
    }

    func toggleFavorite(_ id: String) {
        guard let index = entries.firstIndex(where: { $0.id == id }) else { return }
        entries[index].favorite.toggle()
        let favorite = entries[index].favorite
        save()
        Task { await AeroSpotAPI.patchLogbookFavorite(id: id, favorite: favorite) }
    }

    private func adoptServerId(localId: String, serverId: String) {
        guard localId != serverId,
              let index = entries.firstIndex(where: { $0.id == localId }) else { return }
        entries[index].id = serverId
        save()
    }

    /// Slå sammen lokal og server-loggbok når innlogget. Server-oppføringer
    /// adopteres (uten thumb); lokale som mangler på server pushes opp.
    /// ponytail: union-merge — sletting fra annen enhet propageres ikke ned;
    /// hev til tombstones hvis multi-device-sletting blir et problem.
    func syncFromServer() async {
        guard let serverEntries = await AeroSpotAPI.fetchLogbook() else { return }
        let serverIds = Set(serverEntries.map(\.id))
        let localIds = Set(entries.map(\.id))

        // Push lokale oppføringer som ikke finnes på server; adopter ny id.
        for entry in entries where !serverIds.contains(entry.id) {
            if let serverId = await AeroSpotAPI.pushLogbook(entry) {
                adoptServerId(localId: entry.id, serverId: serverId)
            }
        }
        // Legg til server-oppføringer som mangler lokalt (uten thumb).
        let missing = serverEntries.filter { !localIds.contains($0.id) }
        if !missing.isEmpty {
            entries.append(contentsOf: missing)
            entries.sort { $0.dateIso > $1.dateIso }
            save()
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let decoded = try? JSONDecoder().decode([LogbookEntry].self, from: data)
        else { return }
        entries = decoded
    }

    private func save() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    var rareCount: Int { entries.filter { ($0.rarity?.rank ?? 0) >= 2 }.count }
    var airportCount: Int { Set(entries.compactMap(\.airportIcao)).count }

    var mostPhotographedType: String? {
        Dictionary(grouping: entries.compactMap(\.aircraftType), by: { $0 })
            .max { $0.value.count < $1.value.count }?.key
    }
}

/// EXIF-lesing med innebygd ImageIO — ingen ekstra dependency.
struct ExifSummary {
    var cameraModel: String?
    var lensModel: String?
    var focalLengthMm: Int?
    var shutterSpeed: String?
    var aperture: String?
    var iso: Int?
    var date: Date?
    var latitude: Double?
    var longitude: Double?

    static func read(from data: Data) -> ExifSummary {
        var result = ExifSummary()
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
        else { return result }

        if let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any] {
            result.cameraModel = tiff[kCGImagePropertyTIFFModel] as? String
        }
        if let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any] {
            result.lensModel = exif[kCGImagePropertyExifLensModel] as? String
            if let focal = exif[kCGImagePropertyExifFocalLenIn35mmFilm] as? Double
                ?? exif[kCGImagePropertyExifFocalLength] as? Double {
                result.focalLengthMm = Int(focal)
            }
            if let exposure = exif[kCGImagePropertyExifExposureTime] as? Double, exposure > 0 {
                result.shutterSpeed = exposure >= 1
                    ? "\(exposure)s"
                    : "1/\(Int((1 / exposure).rounded()))"
            }
            if let fNumber = exif[kCGImagePropertyExifFNumber] as? Double {
                result.aperture = String(format: "f/%.1f", fNumber)
            }
            if let isoValues = exif[kCGImagePropertyExifISOSpeedRatings] as? [Int] {
                result.iso = isoValues.first
            }
            if let dateString = exif[kCGImagePropertyExifDateTimeOriginal] as? String {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy:MM:dd HH:mm:ss"
                formatter.timeZone = .current
                result.date = formatter.date(from: dateString)
            }
        }
        if let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any] {
            if let lat = gps[kCGImagePropertyGPSLatitude] as? Double,
               let latRef = gps[kCGImagePropertyGPSLatitudeRef] as? String {
                result.latitude = latRef == "S" ? -lat : lat
            }
            if let lon = gps[kCGImagePropertyGPSLongitude] as? Double,
               let lonRef = gps[kCGImagePropertyGPSLongitudeRef] as? String {
                result.longitude = lonRef == "W" ? -lon : lon
            }
        }
        return result
    }
}

struct LogbookView: View {
    @Environment(AppModel.self) private var model
    private var store: LogbookStore { model.logbook }
    @State private var pickerItem: PhotosPickerItem?
    @State private var draft: DraftEntry?

    enum Filter: String, CaseIterable {
        case all = "Alle"
        case favorites = "Favoritter"
        case rare = "Sjeldne"
    }
    @State private var filter: Filter = .all

    struct DraftEntry: Identifiable {
        let id = UUID()
        let exif: ExifSummary
        let matches: [(flight: LiveFlight, distanceKm: Double)]
        var chosen: LiveFlight?
        let thumbDataURL: String? // nedskalert bilde for loggbok + deling
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.spacingLG) {
                    Text("Loggbok")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                    statsRow
                    filterTabs
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Text("+ Legg til bilde")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Theme.spacingMD)
                            .background(Theme.primary)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                    entryList
                }
                .padding(Theme.spacingLG)
            }
            .background(Theme.background)
        }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task { await handlePickedPhoto(item) }
        }
        .sheet(item: $draft) { current in
            DraftSheet(draft: current, store: store) { draft = nil }
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.surface)
        }
    }

    private var entriesThisMonth: Int {
        let calendar = Calendar.current
        let iso = ISO8601DateFormatter()
        return store.entries.filter {
            guard let date = iso.date(from: $0.dateIso) else { return false }
            return calendar.isDate(date, equalTo: Date(), toGranularity: .month)
        }.count
    }

    /// Stats-hero i blå gradient (mockup-stil)
    private var statsRow: some View {
        VStack(spacing: Theme.spacingMD) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TOTALT FOTOGRAFERT")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(.white.opacity(0.75))
                    Text("\(store.entries.count)")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("fly")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("DENNE MÅNEDEN")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(.white.opacity(0.75))
                    Text("\(entriesThisMonth)")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("nylige")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                }
            }
            HStack {
                statPair(label: "FLYPLASSER", value: "\(store.airportCount)")
                Spacer()
                statPair(label: "SJELDNE FLY", value: "\(store.rareCount)")
                Spacer()
                statPair(label: "FAVORITTER", value: "\(store.entries.filter(\.favorite).count)")
            }
        }
        .padding(Theme.spacingLG)
        .background(
            LinearGradient(
                colors: [Theme.primary, Color(hex: 0x0B4FA0)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLg))
    }

    private func statPair(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(.white.opacity(0.75))
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }

    private var filterTabs: some View {
        HStack(spacing: Theme.spacingSM) {
            ForEach(Filter.allCases, id: \.self) { item in
                Button {
                    filter = item
                } label: {
                    Text(item.rawValue)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, Theme.spacingMD)
                        .padding(.vertical, Theme.spacingSM)
                        .background(filter == item ? Theme.primary : Theme.surfaceElevated)
                        .foregroundStyle(filter == item ? .white : Theme.textSecondary)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    private var filteredEntries: [LogbookEntry] {
        switch filter {
        case .all: return store.entries
        case .favorites: return store.entries.filter(\.favorite)
        case .rare: return store.entries.filter { ($0.rarity?.rank ?? 0) >= 2 }
        }
    }

    @ViewBuilder
    private var entryList: some View {
        if store.entries.isEmpty {
            EmptyStateView(
                title: "Tom loggbok",
                message: "Legg til ditt første bilde — EXIF og fly-match fylles ut automatisk."
            )
        } else if filteredEntries.isEmpty {
            EmptyStateView(
                title: "Ingen treff",
                message: "Ingen oppføringer i «\(filter.rawValue)» ennå."
            )
        } else {
            ForEach(filteredEntries) { entry in
                LogbookRow(entry: entry, store: store)
            }
        }
    }

    private func handlePickedPhoto(_ item: PhotosPickerItem) async {
        defer { pickerItem = nil }
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        let exif = ExifSummary.read(from: data)
        // Fly-match: nærmeste lave fly ift. bildets/brukerens posisjon
        let reference: CLLocationCoordinate2D
        if let lat = exif.latitude, let lon = exif.longitude {
            reference = CLLocationCoordinate2D(latitude: lat, longitude: lon)
        } else {
            reference = model.userCoordinate ?? model.activeAirport.coordinate
        }
        let matches = model.flights
            .filter { !$0.onGround }
            .map { ($0, Geo.distanceKm(reference, $0.coordinate)) }
            .filter { $0.1 < 15 }
            .sorted { $0.1 < $1.1 }
            .prefix(3)
        let thumb = Self.makeThumbnailDataURL(from: data)
        draft = DraftEntry(
            exif: exif,
            matches: Array(matches),
            chosen: matches.first?.0,
            thumbDataURL: thumb
        )
    }

    /// Nedskaler til ~800px JPEG og pakk som data-URL (loggbok + deling).
    static func makeThumbnailDataURL(from data: Data, maxDim: CGFloat = 800) -> String? {
        guard let image = UIImage(data: data) else { return nil }
        let scale = min(1, maxDim / max(image.size.width, image.size.height))
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: target)
        let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        guard let jpeg = resized.jpegData(compressionQuality: 0.7) else { return nil }
        return "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
    }
}

private struct LogbookRow: View {
    let entry: LogbookEntry
    let store: LogbookStore
    @State private var shareState: ShareState = .idle
    enum ShareState { case idle, sharing, done, failed }

    private func thumbImage() -> UIImage? {
        guard let s = entry.thumbDataURL, let comma = s.firstIndex(of: ","),
              let data = Data(base64Encoded: String(s[s.index(after: comma)...]))
        else { return nil }
        return UIImage(data: data)
    }

    var body: some View {
        HStack(spacing: Theme.spacingMD) {
            if let thumb = thumbImage() {
                Image(uiImage: thumb)
                    .resizable().scaledToFill()
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSm))
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Theme.spacingSM) {
                    Text(entry.aircraftType ?? entry.callsign ?? "Ukjent fly")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                    if let rarity = entry.rarity {
                        RareBadge(rarity: rarity)
                    }
                }
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Button {
                store.toggleFavorite(entry.id)
            } label: {
                Image(systemName: entry.favorite ? "star.fill" : "star")
                    .foregroundStyle(entry.favorite ? Theme.gold : Theme.textTertiary)
            }
        }
        .card()
        .contextMenu {
            Button {
                Task { await share() }
            } label: {
                Label(shareLabel, systemImage: "square.and.arrow.up")
            }
            Button(role: .destructive) {
                store.remove(entry.id)
            } label: {
                Label("Slett", systemImage: "trash")
            }
        }
    }

    private var shareLabel: String {
        switch shareState {
        case .idle: return "Del til community"
        case .sharing: return "Deler…"
        case .done: return "Delt ✓"
        case .failed: return "Deling feilet — logg inn"
        }
    }

    private func share() async {
        shareState = .sharing
        var payload: [String: Any] = [:]
        if let t = entry.thumbDataURL { payload["thumbData"] = t }
        if let v = entry.aircraftType { payload["aircraftType"] = v }
        if let v = entry.registration { payload["registration"] = v }
        if let v = entry.airline { payload["airline"] = v }
        if let v = entry.airportIcao { payload["airportIcao"] = v }
        if let v = entry.location { payload["spotName"] = v }
        if let v = entry.rarity { payload["rarity"] = v.rawValue }
        let ok = await AeroSpotAPI.postToCommunity(payload)
        shareState = ok ? .done : .failed
    }

    private var subtitle: String {
        var parts: [String] = []
        if let reg = entry.registration { parts.append(reg) }
        if let icao = entry.airportIcao { parts.append(icao) }
        if let focal = entry.focalLengthMm { parts.append("\(focal) mm") }
        if let shutter = entry.shutterSpeed { parts.append(shutter) }
        return parts.joined(separator: " · ")
    }
}

private struct DraftSheet: View {
    @Environment(AppModel.self) private var model
    let draft: LogbookView.DraftEntry
    let store: LogbookStore
    let dismiss: () -> Void
    @State private var chosen: LiveFlight?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.spacingLG) {
                Text("Nytt bilde")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Theme.textPrimary)
                Text(exifText)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)

                if !draft.matches.isEmpty {
                    Text("Vi tror du fotograferte")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                    ForEach(draft.matches, id: \.flight.id) { match in
                        matchRow(match)
                    }
                }

                Button {
                    save()
                } label: {
                    Text("Lagre")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.spacingMD)
                        .background(Theme.primary)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
            }
            .padding(Theme.spacingLG)
        }
        .background(Theme.surface)
        .onAppear { chosen = draft.chosen }
    }

    private var exifText: String {
        let e = draft.exif
        var parts: [String] = []
        if let camera = e.cameraModel { parts.append(camera) }
        if let lens = e.lensModel { parts.append(lens) }
        if let focal = e.focalLengthMm { parts.append("\(focal) mm") }
        if let shutter = e.shutterSpeed { parts.append(shutter) }
        if let aperture = e.aperture { parts.append(aperture) }
        if let iso = e.iso { parts.append("ISO \(iso)") }
        return parts.isEmpty ? "Ingen EXIF funnet" : parts.joined(separator: " · ")
    }

    private func matchRow(_ match: (flight: LiveFlight, distanceKm: Double)) -> some View {
        Button {
            chosen = match.flight
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(match.flight.callsign)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("\(match.flight.aircraftType ?? "") · \(String(format: "%.1f", match.distanceKm)) km")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if chosen?.id == match.flight.id {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.primaryBright)
                }
            }
            .padding(Theme.spacingMD)
            .background(
                chosen?.id == match.flight.id
                    ? Theme.primary.opacity(0.14) : Theme.surfaceElevated
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMd))
        }
        .buttonStyle(.plain)
    }

    private func save() {
        let e = draft.exif
        let flight = chosen
        store.add(LogbookEntry(
            id: UUID().uuidString,
            dateIso: ISO8601DateFormatter().string(from: e.date ?? Date()),
            location: model.activeAirport.name,
            airportIcao: model.activeAirport.icao,
            flightNumber: flight?.flightNumber,
            callsign: flight?.callsign,
            registration: flight?.registration,
            aircraftType: flight?.aircraftType,
            airline: flight?.airline,
            latitude: e.latitude,
            longitude: e.longitude,
            focalLengthMm: e.focalLengthMm,
            shutterSpeed: e.shutterSpeed,
            aperture: e.aperture,
            iso: e.iso,
            cameraModel: e.cameraModel,
            lensModel: e.lensModel,
            rating: nil,
            notes: nil,
            favorite: false,
            rarity: flight.map {
                RarityService.classify(aircraftIcao: $0.aircraftIcao, callsign: $0.callsign)
            },
            thumbDataURL: draft.thumbDataURL
        ))
        dismiss()
    }
}
