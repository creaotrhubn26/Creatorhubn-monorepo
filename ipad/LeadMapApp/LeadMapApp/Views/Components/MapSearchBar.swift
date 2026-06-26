// MapSearchBar.swift
//
// Søk-overlay øverst på MapScreen. Pakke 9 (Daniels Research-trio).
//
// Tre kilder, alle live:
//   1. STEDER — MapKit MKLocalSearch (adresser, POIs, byer)
//   2. MINE LEADS — filter på appState.leads (name / company / city)
//   3. BRANSJER — filter på appState.industries (nameNo + code)
//
// UX:
//   - Kompakt kapsel-knapp m/ magnifyingglass-ikon når lukket
//   - Tap → ekspanderer til text-felt med ultraThin backdrop + 3 resultat-
//     seksjoner (steder / leads / bransjer)
//   - Tap på resultat:
//       • Sted → animér kamera til koordinatet (preview-only, ingen pin)
//       • Lead → animér kamera + presenter quick-status-sheet
//       • Bransje → toggle filter "Bare bransje X"
//   - Swipe-down (drag) eller "Lukk" lukker
//
// Designvalg
//   - MapKit-søk er INFINITY for sted, men beste UX er debounced query
//     (350 ms) for å unngå å fyre 8 søk på ett tastetrykk.
//   - Industries-listen er statisk i appen (max 111 rader); vi filtrerer
//     client-side via `appState.industriesCache` (oppdateres ved tab-mount).
//   - Vi rendre ALDRI MapKit-resultater UTEN at brukeren har skrevet ≥ 2 tegn;
//     å brenne quota på 1-tegns-strenger gir søppel.
//
// Integrasjon
//   - Caller mounter MapSearchBar i topOverlay (over MapProjectCard).
//   - Callbacks:
//       • onCenterCoordinate(CLLocationCoordinate2D, span)  ← preview-pan
//       • onSelectLead(LeadModel)                            ← presenter quick-sheet
//       • onSelectIndustry(Industry)                         ← toggle filter

import SwiftUI
import MapKit
import CoreLocation

/// Hva brukeren ber om å vise på kartet.
enum MapSearchTarget {
    case place(CLLocationCoordinate2D, displayName: String)
    case lead(LeadModel)
    case industry(Industry)
}

@MainActor
struct MapSearchBar: View {
    @Environment(AppState.self) private var appState

    /// Caller bestemmer hva som skjer med valgt resultat. Sted → pan kamera,
    /// lead → presenter quick-sheet, bransje → toggle filter i meny.
    let onSelect: (MapSearchTarget) -> Void

    @State private var expanded = false
    @State private var query: String = ""
    @State private var debouncedQuery: String = ""
    @State private var debounceTask: Task<Void, Never>?
    @State private var places: [PlaceSuggestion] = []
    @State private var placeSearchTask: Task<Void, Never>?
    @State private var industries: [Industry] = []
    @State private var industryFetchTask: Task<Void, Never>?
    @FocusState private var fieldFocused: Bool

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    var body: some View {
        VStack(spacing: 0) {
            if expanded {
                expandedView
            } else {
                collapsedPill
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.85), value: expanded)
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    // MARK: - Collapsed pill

    private var collapsedPill: some View {
        Button {
            expanded = true
            // Sett fokus etter at animasjonen har startet — fieldFocused
            // virker ikke før viewen finnes i hierarchy.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 120_000_000)
                fieldFocused = true
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Self.brandPurple)
                Text("Søk etter sted, lead eller bransje …")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(
                Capsule().stroke(Self.brandPurple.opacity(0.30), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.18), radius: 6, x: 0, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Søk i kartet")
        .accessibilityHint("Finner steder, mine leads og bransjer")
    }

    // MARK: - Expanded view

    private var expandedView: some View {
        VStack(spacing: 0) {
            searchField
            Divider().padding(.horizontal, 8)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if debouncedQuery.count < 2 {
                        emptyHint
                    } else {
                        leadsSection
                        industriesSection
                        placesSection
                    }
                }
                .padding(.vertical, 12)
            }
            .frame(maxHeight: 360)
        }
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Self.brandPurple.opacity(0.30), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.25), radius: 10, x: 0, y: 4)
        .task { await loadIndustriesIfNeeded() }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Self.brandPurple)
            TextField("Sted, lead, bransje …", text: $query)
                .focused($fieldFocused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .submitLabel(.search)
                .onChange(of: query) { _, newValue in
                    scheduleDebounce(newValue)
                }
            if !query.isEmpty {
                Button {
                    query = ""
                    debouncedQuery = ""
                    places = []
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Fjern søk")
            }
            Button("Lukk") {
                close()
            }
            .font(.callout.weight(.semibold))
            .foregroundStyle(Self.brandPurple)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    // MARK: - Sections

    private var emptyHint: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Skriv minst 2 tegn …")
                .font(.callout)
                .foregroundStyle(.secondary)
            Text("Vi viser steder fra Apple Maps, dine egne leads og bransjer du kan filtrere på.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var leadsSection: some View {
        let matches = filteredLeads
        if !matches.isEmpty {
            sectionHeader("Mine leads", count: matches.count, icon: "person.crop.rectangle.stack.fill")
            VStack(spacing: 0) {
                ForEach(matches.prefix(6)) { lead in
                    Button {
                        onSelect(.lead(lead))
                        close()
                    } label: {
                        leadRow(lead)
                    }
                    .buttonStyle(.plain)
                    Divider().padding(.leading, 50)
                }
            }
        }
    }

    @ViewBuilder
    private var industriesSection: some View {
        let matches = filteredIndustries
        if !matches.isEmpty {
            sectionHeader("Bransjer", count: matches.count, icon: "tag.fill")
            VStack(spacing: 0) {
                ForEach(matches.prefix(6)) { industry in
                    Button {
                        onSelect(.industry(industry))
                        close()
                    } label: {
                        industryRow(industry)
                    }
                    .buttonStyle(.plain)
                    Divider().padding(.leading, 50)
                }
            }
        }
    }

    @ViewBuilder
    private var placesSection: some View {
        if !places.isEmpty {
            sectionHeader("Steder", count: places.count, icon: "mappin.and.ellipse")
            VStack(spacing: 0) {
                ForEach(places) { place in
                    Button {
                        onSelect(.place(place.coordinate, displayName: place.title))
                        close()
                    } label: {
                        placeRow(place)
                    }
                    .buttonStyle(.plain)
                    Divider().padding(.leading, 50)
                }
            }
        } else if debouncedQuery.count >= 2 && filteredLeads.isEmpty && filteredIndustries.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Ingen treff")
                    .font(.callout.bold())
                    .foregroundStyle(.secondary)
                Text("Prøv å skrive adresse, by, navn på lead eller bransje.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private func sectionHeader(_ title: String, count: Int, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Self.brandPurple)
            Text(title.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
                .tracking(0.5)
            Spacer()
            Text("\(count)")
                .font(.caption2.monospaced())
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
    }

    private func leadRow(_ lead: LeadModel) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Self.brandPurple.opacity(0.20))
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: "mappin.circle.fill")
                        .foregroundStyle(Self.brandPurple)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.name).font(.callout.weight(.semibold)).lineLimit(1)
                if let company = lead.company, !company.isEmpty, company != lead.name {
                    Text(company).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                } else if let city = lead.city, !city.isEmpty {
                    Text(city).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private func industryRow(_ industry: Industry) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(industry.color.opacity(0.20))
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: industry.sfSymbol)
                        .foregroundStyle(industry.color)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(industry.nameNo).font(.callout.weight(.semibold)).lineLimit(1)
                Text(industry.code).font(.caption.monospaced()).foregroundStyle(.secondary)
            }
            Spacer()
            Text("Filter")
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(industry.color.opacity(0.15), in: Capsule())
                .foregroundStyle(industry.color)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private func placeRow(_ place: PlaceSuggestion) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.blue.opacity(0.20))
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: "mappin.and.ellipse")
                        .foregroundStyle(.blue)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(place.title).font(.callout.weight(.semibold)).lineLimit(1)
                if !place.subtitle.isEmpty {
                    Text(place.subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    // MARK: - Filtering

    private var trimmedQuery: String {
        debouncedQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var filteredLeads: [LeadModel] {
        let q = trimmedQuery
        guard q.count >= 2 else { return [] }
        return appState.leads.filter { lead in
            if lead.name.lowercased().contains(q) { return true }
            if let c = lead.company?.lowercased(), c.contains(q) { return true }
            if let c = lead.city?.lowercased(), c.contains(q) { return true }
            if let a = lead.address?.lowercased(), a.contains(q) { return true }
            return false
        }
    }

    private var filteredIndustries: [Industry] {
        let q = trimmedQuery
        guard q.count >= 2 else { return [] }
        return industries.filter { industry in
            if industry.nameNo.lowercased().contains(q) { return true }
            if let en = industry.nameEn?.lowercased(), en.contains(q) { return true }
            if industry.code.lowercased().contains(q) { return true }
            return false
        }
    }

    // MARK: - Debounce + Places search

    private func scheduleDebounce(_ value: String) {
        debounceTask?.cancel()
        debounceTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            debouncedQuery = value
            await runPlaceSearchIfNeeded(value)
        }
    }

    private func runPlaceSearchIfNeeded(_ value: String) async {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            places = []
            return
        }
        placeSearchTask?.cancel()
        placeSearchTask = Task { @MainActor in
            do {
                let req = MKLocalSearch.Request()
                req.naturalLanguageQuery = trimmed
                req.resultTypes = [.address, .pointOfInterest]
                // Bias mot Norge (default) — overrides region hvis bruker
                // søker "Paris" eller liknende. MKLocalSearch håndterer
                // dette bedre enn å rigid-låse til NO.
                req.region = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 64.0, longitude: 12.0),
                    span: MKCoordinateSpan(latitudeDelta: 18, longitudeDelta: 18)
                )
                let search = MKLocalSearch(request: req)
                let response = try await search.start()
                if Task.isCancelled { return }
                let mapped: [PlaceSuggestion] = response.mapItems.prefix(8).map { item in
                    PlaceSuggestion(
                        id: UUID().uuidString,
                        title: item.name ?? "Ukjent",
                        subtitle: [
                            item.placemark.locality,
                            item.placemark.administrativeArea,
                            item.placemark.country,
                        ].compactMap { $0 }.joined(separator: ", "),
                        coordinate: item.placemark.coordinate,
                    )
                }
                places = mapped
            } catch {
                // Stille — MKLocalSearch feiler ofte v/ ingen treff. Vi
                // viser bare ingen steder.
                places = []
            }
        }
    }

    // MARK: - Industries load

    private func loadIndustriesIfNeeded() async {
        guard industries.isEmpty, let api = appState.api else { return }
        industryFetchTask?.cancel()
        industryFetchTask = Task { @MainActor in
            do {
                let fetched = try await api.fetchIndustries()
                industries = fetched
            } catch {
                // Stille — bransje-seksjonen blir bare tom til neste tab-mount.
            }
        }
    }

    // MARK: - Close

    private func close() {
        debounceTask?.cancel()
        placeSearchTask?.cancel()
        fieldFocused = false
        expanded = false
        query = ""
        debouncedQuery = ""
        places = []
    }
}

/// Identifiable wrapper rundt MapKit-resultatet — MKMapItem er ikke
/// Identifiable, og vi vil heller ikke holde en referanse til det her.
struct PlaceSuggestion: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let coordinate: CLLocationCoordinate2D
}
