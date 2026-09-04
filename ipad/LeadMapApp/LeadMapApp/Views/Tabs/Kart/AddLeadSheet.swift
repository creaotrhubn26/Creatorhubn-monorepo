// AddLeadSheet.swift
//
// Modal som åpnes når salgssjefen tapper "+ Legg til lead" i Kart-toppen.
//
// To inn-veier:
//   1. AI auto-fyll — lim inn URL eller bedriftsnavn → Leadgrid scanner
//      nettsiden + Brønnøysund → fyller automatisk navn,
//      adresse, kontakt, bransje, ansatt-antall, omsetning, kart-pin.
//   2. Manuell — fyll selv (for når du har visittkort, telefon-tips etc.)
//
// Temperatur og pipelinefase er separate begreper. Oppfølging har egen
// dato og handling. Mini-kartet viser bare et utkast frem til lagring.

import SwiftUI
import MapKit
import UIKit

private enum AlBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.06)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.45)
}

/// Én deterministisk breakpoint for hele skjemaet. Den bruker faktisk
/// vindusbredde (ikke bare device idiom), slik at iPad Split View og Stage
/// Manager får samme lesbare layout som en iPhone når vinduet blir smalt.
enum AddLeadResponsiveLayout {
    static let compactBreakpoint: CGFloat = 600

    static func usesCompactForm(
        containerWidth: CGFloat,
        isAccessibilityText: Bool
    ) -> Bool {
        containerWidth < compactBreakpoint || isAccessibilityText
    }
}

/// Holder kartets midlertidige lead-utkast adskilt fra lagrede CRM-pins.
/// Kartet viser kun `visiblePinCoordinate` mens skjemaet faktisk er åpent;
/// `end()` rydder både vanlig avbryt, swipe-dismiss og vellykket lagring.
struct AddLeadDraftFlow {
    struct Session {
        let coordinate: CLLocationCoordinate2D?
        let idempotencyKey: UUID

        init(
            coordinate: CLLocationCoordinate2D?,
            idempotencyKey: UUID = UUID()
        ) {
            self.coordinate = coordinate
            self.idempotencyKey = idempotencyKey
        }
    }

    private(set) var activeSession: Session?

    var isPresented: Bool { activeSession != nil }
    var visiblePinCoordinate: CLLocationCoordinate2D? { activeSession?.coordinate }

    mutating func begin(at coordinate: CLLocationCoordinate2D? = nil) {
        activeSession = Session(coordinate: coordinate)
    }

    mutating func end() {
        activeSession = nil
    }
}

struct AddLeadSaveError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Ren, testbar normalisering før data sendes til API-et. Skjemaet viser
/// konkrete feil i stedet for å miste eller gjette på strukturerte tall.
enum AddLeadFieldParser {
    static func organizationNumber(_ raw: String) throws -> String? {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !value.isEmpty else { return nil }
        guard value.count <= 32 else {
            throw AddLeadSaveError(message: "Organisasjonsnummer kan være maks 32 tegn.")
        }
        if value.hasPrefix("no") { value.removeFirst(2) }
        if value.hasSuffix("mva") { value.removeLast(3) }
        value = value
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00a0}", with: "")
            .replacingOccurrences(of: ".", with: "")
        guard value.count == 9, value.allSatisfy(\.isNumber) else {
            throw AddLeadSaveError(message: "Organisasjonsnummer må bestå av 9 siffer.")
        }
        let digits = value.compactMap(\.wholeNumberValue)
        let weights = [3, 2, 7, 6, 5, 4, 3, 2]
        let remainder = 11 - zip(digits.prefix(8), weights)
            .reduce(0) { $0 + $1.0 * $1.1 } % 11
        let checkDigit = remainder == 11 ? 0 : remainder
        guard checkDigit != 10, checkDigit == digits[8] else {
            throw AddLeadSaveError(message: "Organisasjonsnummeret har ugyldig kontrollsiffer.")
        }
        return value
    }

    static func email(_ raw: String) throws -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        guard value.count <= 200 else {
            throw AddLeadSaveError(message: "E-post kan være maks 200 tegn.")
        }
        guard value.range(
            of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#,
            options: .regularExpression
        ) != nil else {
            throw AddLeadSaveError(message: "E-postadressen er ugyldig.")
        }
        return value
    }

    static func website(_ raw: String) throws -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        guard value.count <= 2_048 else {
            throw AddLeadSaveError(message: "Nettadressen kan være maks 2048 tegn.")
        }
        let candidate = value.contains("://") ? value : "https://\(value)"
        let parts = URLComponents(string: candidate)
        guard parts?.host?.isEmpty == false,
              ["http", "https"].contains(parts?.scheme?.lowercased() ?? ""),
              parts?.user == nil,
              parts?.password == nil else {
            throw AddLeadSaveError(message: "Nettadressen er ugyldig.")
        }
        return value
    }

    static func employeeCount(_ raw: String) throws -> Int? {
        let value = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00a0}", with: "")
        guard !value.isEmpty else { return nil }
        guard value.allSatisfy(\.isNumber), let count = Int(value), count >= 0 else {
            throw AddLeadSaveError(message: "Ansatte må være ett helt antall, for eksempel 25.")
        }
        return count
    }

    static func annualRevenueNok(_ raw: String) throws -> Double? {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !value.isEmpty else { return nil }

        let multiplier: Double
        if value.contains("mrd") || value.contains("milliard") {
            multiplier = 1_000_000_000
        } else if value.contains("mill") || value.contains("million") {
            multiplier = 1_000_000
        } else if value.contains("tusen") || value.hasSuffix("k") {
            multiplier = 1_000
        } else {
            multiplier = 1
        }

        for token in ["milliarder", "milliard", "millioner", "million", "mill.", "mill", "mrd.", "mrd", "tusen", "nok", "kr"] {
            value = value.replacingOccurrences(of: token, with: "")
        }
        if multiplier == 1_000, value.hasSuffix("k") { value.removeLast() }
        value = value
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00a0}", with: "")

        if value.contains(",") {
            value = value.replacingOccurrences(of: ".", with: "")
            value = value.replacingOccurrences(of: ",", with: ".")
        } else if value.filter({ $0 == "." }).count > 1 {
            value = value.replacingOccurrences(of: ".", with: "")
        } else if multiplier == 1,
                  let dot = value.firstIndex(of: "."),
                  value.distance(from: value.index(after: dot), to: value.endIndex) == 3 {
            value.remove(at: dot)
        }

        guard value.filter({ $0 == "." }).count <= 1,
              value.allSatisfy({ $0.isNumber || $0 == "." }),
              let amount = Double(value), amount >= 0 else {
            throw AddLeadSaveError(message: "Omsetning må være et beløp, for eksempel 10 000 000 eller 10 mill.")
        }
        return amount * multiplier
    }
}

private extension LeadStatus {
    static let creationStages: [LeadStatus] = [
        .unvisited, .visited, .interested, .meetingBooked, .proposalSent, .won,
    ]

    var creationLabel: String {
        switch self {
        case .unvisited: return "Ny"
        case .visited: return "Kontaktet"
        case .interested: return "Interessert"
        case .meetingBooked: return "Møte booket"
        case .proposalSent: return "Tilbud sendt"
        case .won: return "Vunnet"
        default: return label
        }
    }

    var creationIcon: String {
        switch self {
        case .unvisited: return "sparkles"
        case .visited: return "phone.fill"
        case .interested: return "hand.thumbsup.fill"
        case .meetingBooked: return "calendar.badge.checkmark"
        case .proposalSent: return "paperplane.fill"
        case .won: return "trophy.fill"
        default: return "circle.fill"
        }
    }

    var creationColor: Color {
        switch self {
        case .unvisited: return AlBrand.blue
        case .visited: return AlBrand.purpleLight
        case .interested: return AlBrand.green
        case .meetingBooked: return AlBrand.yellow
        case .proposalSent: return AlBrand.orange
        case .won: return AlBrand.green
        default: return AlBrand.textSecondary
        }
    }
}

struct AddLeadSubmissionState: Equatable {
    enum Phase: Equatable {
        case idle
        case saving
        case failed(String)
        case saved
    }

    private(set) var phase: Phase = .idle

    var isSaving: Bool { phase == .saving }
    var didSave: Bool { phase == .saved }
    var errorMessage: String? {
        guard case .failed(let message) = phase else { return nil }
        return message
    }

    mutating func begin() { phase = .saving }
    mutating func fail(_ message: String) { phase = .failed(message) }
    mutating func succeed() { phase = .saved }
}

@MainActor
struct AddLeadSheet: View {
    let initialCoordinate: CLLocationCoordinate2D?
    let onCancel: @MainActor () -> Void
    let onSave: @MainActor (NewLeadData) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var mode: InputMode = .ai
    enum InputMode: String, CaseIterable {
        case ai = "AI auto-fyll"
        case manual = "Manuell"
        var icon: String {
            switch self {
            case .ai: return "sparkles"
            case .manual: return "square.and.pencil"
            }
        }
    }

    // AI-mode state
    @State private var urlOrSearch: String = ""
    @State private var scanning: Bool = false
    @State private var scanComplete: Bool = false

    // Felles state (auto-fylt eller manuelt)
    @State private var companyName: String = ""
    @State private var orgNumber: String = ""
    @State private var address: String = ""
    @State private var postalCode: String = ""
    @State private var city: String = ""
    @State private var website: String = ""
    @State private var phone: String = ""
    @State private var email: String = ""
    @State private var industry: String = ""
    @State private var employees: String = ""
    @State private var revenue: String = ""
    @State private var scanError: String?
    @State private var notat: String = ""

    @State private var contactName: String = ""
    @State private var contactRole: String = ""

    @State private var temperature: LeadTemperature = .warm
    @State private var leadStatus: LeadStatus = .unvisited
    @State private var includeFollowUp = false
    @State private var nextFollowUpAt = Date().addingTimeInterval(24 * 60 * 60)
    @State private var nextAction: String = ""
    // Selv-tildeling er default — «Lars Kristensen» var hardkodet mock-navn.
    @State private var assignTo: String = "Meg"

    @State private var pinCoord: CLLocationCoordinate2D?
    @State private var resolvingCoordinate = false
    @State private var locationConfidence: String
    @State private var submissionState = AddLeadSubmissionState()
    @State private var fieldErrors: [String: String] = [:]
    @State private var didNotifyCancel = false

    private var saving: Bool { submissionState.isSaving }
    private var saveError: String? { submissionState.errorMessage }
    private var didSave: Bool { submissionState.didSave }

    init(
        initialCoordinate: CLLocationCoordinate2D? = nil,
        onCancel: @escaping @MainActor () -> Void = {},
        onSave: @escaping @MainActor (NewLeadData) async throws -> Void
    ) {
        self.initialCoordinate = initialCoordinate
        self.onCancel = onCancel
        self.onSave = onSave
        _pinCoord = State(initialValue: initialCoordinate)
        _locationConfidence = State(initialValue: initialCoordinate == nil ? "unknown" : "exact")
    }

    struct NewLeadData {
        let companyName: String
        let organizationNumber: String?
        let websiteURL: String?
        let contactName: String?
        let contactRole: String?
        let phone: String?
        let email: String?
        let industryLabel: String?
        let employeeCountEstimate: Int?
        let annualRevenueNokEstimate: Double?
        let notes: String?
        let leadTemperature: LeadTemperature
        let leadStatus: LeadStatus
        let nextFollowUpAt: Date?
        let nextAction: String?
        let address: String
        let postalCode: String?
        let city: String?
        let coord: CLLocationCoordinate2D
        let locationConfidence: String
        let leadSource: String

        func makeCreateRequest(
            projectID: String? = nil,
            idempotencyKey: UUID = UUID()
        ) -> APIClient.CreateLeadAtPinRequest {
            APIClient.CreateLeadAtPinRequest(
                companyName: companyName,
                latitude: coord.latitude,
                longitude: coord.longitude,
                contactName: contactName,
                contactRole: contactRole,
                organizationNumber: organizationNumber,
                websiteURL: websiteURL,
                phone: phone,
                email: email,
                industryLabel: industryLabel,
                employeeCountEstimate: employeeCountEstimate,
                annualRevenueNokEstimate: annualRevenueNokEstimate,
                notes: notes,
                leadTemperature: leadTemperature.rawValue,
                leadStatus: leadStatus.rawValue,
                nextFollowUpAt: nextFollowUpAt,
                nextAction: nextAction,
                address: address,
                postalCode: postalCode,
                city: city,
                locationConfidence: locationConfidence,
                leadSource: leadSource,
                projectID: projectID,
                idempotencyKey: idempotencyKey
            )
        }
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                formContent(containerWidth: geometry.size.width)
            }
            .navigationTitle("Legg til lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { cancel() }
                        .foregroundStyle(AlBrand.purpleLight)
                        .disabled(saving)
                }
            }
            .toolbarBackground(AlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .macCatalystSheetSize(minWidth: 820, minHeight: 720)
        .interactiveDismissDisabled(saving)
        .task {
            #if DEBUG
            seedQAValidationDataIfRequested()
            #endif
            await resolveInitialAddressIfNeeded()
        }
        .onDisappear {
            notifyCancelIfNeeded()
        }
    }

    private func formContent(containerWidth: CGFloat) -> some View {
        let compact = AddLeadResponsiveLayout.usesCompactForm(
            containerWidth: containerWidth,
            isAccessibilityText: dynamicTypeSize.isAccessibilitySize
        )

        return ScrollView {
            VStack(spacing: compact ? 14 : 18) {
                modeSwitch
                if mode == .ai {
                    aiInputCard(compact: compact)
                }
                companySection(compact: compact)
                contactSection(compact: compact)
                classificationSection(compact: compact)
                pinPreviewCard
            }
            .frame(maxWidth: 820)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, compact ? 16 : 20)
            .padding(.top, compact ? 14 : 20)
            .padding(.bottom, 16)
        }
        .accessibilityIdentifier("add-lead.form")
        .scrollDismissesKeyboard(.interactively)
        .background(AlBrand.bg.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar(compact: compact)
        }
    }

    // MARK: Mode-veksler

    private var modeSwitch: some View {
        HStack(spacing: 0) {
            ForEach(InputMode.allCases, id: \.self) { m in
                Button { mode = m } label: {
                    HStack(spacing: 6) {
                        Image(systemName: m.icon)
                            .font(.appScaled(size: 12, weight: .semibold))
                        Text(m.rawValue)
                            .font(.appScaled(size: 13, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                    }
                    .foregroundStyle(mode == m ? .white : AlBrand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
                    .background(
                        mode == m ? AnyShapeStyle(LinearGradient(
                            colors: [AlBrand.purple, AlBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        )) : AnyShapeStyle(Color.clear),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(AlBrand.card, in: Capsule())
        .overlay(Capsule().stroke(AlBrand.stroke, lineWidth: 1))
    }

    // MARK: AI auto-fyll-card

    private func aiInputCard(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(AlBrand.purple.opacity(0.22))
                    Image(systemName: "sparkles")
                        .font(.appScaled(size: 14, weight: .semibold))
                        .foregroundStyle(AlBrand.purpleLight)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Leadgrid scanner og fyller ut for deg")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Lim inn nettside-URL, org.nr eller bedriftsnavn")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(AlBrand.textSecondary)
                }
                Spacer()
            }

            Group {
                if compact {
                    VStack(spacing: 10) {
                        scanInput
                        scanButton(compact: true)
                    }
                } else {
                    HStack(spacing: 8) {
                        scanInput
                        scanButton(compact: false)
                    }
                }
            }

            HStack(alignment: .top, spacing: 6) {
                Image(systemName: scanError != nil ? "exclamationmark.triangle.fill" : (scanComplete ? "checkmark.seal.fill" : "info.circle"))
                    .font(.appScaled(size: 11))
                    .foregroundStyle(scanError != nil ? AlBrand.orange : (scanComplete ? AlBrand.green : AlBrand.textTertiary))
                Text(scanError
                     ?? (scanComplete
                         ? "Hentet fra Brønnøysundregisteret. Telefon/e-post/kontaktperson må fylles inn manuelt."
                         : "Slår opp org.nr, bedriftsnavn eller nettside-domene i Brønnøysundregisteret."))
                    .font(.appScaled(size: 11))
                    .foregroundStyle(scanError != nil ? AlBrand.orange : AlBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .background(AlBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(AlBrand.purple.opacity(0.3), lineWidth: 1)
        )
    }

    private var scanInput: some View {
        HStack(spacing: 8) {
            Image(systemName: "link")
                .font(.appScaled(size: 12))
                .foregroundStyle(AlBrand.textSecondary)
            TextField("", text: $urlOrSearch,
                      prompt: Text("nordicelektro.no  •  Nordic Elektro AS  •  912 345 678")
                        .foregroundColor(AlBrand.textTertiary))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .font(.appScaled(size: 13))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1))
    }

    private func scanButton(compact: Bool) -> some View {
        Button { runScan() } label: {
            HStack(spacing: 5) {
                if scanning {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .controlSize(.small)
                } else {
                    Image(systemName: "sparkles.rectangle.stack")
                        .font(.appScaled(size: 11, weight: .bold))
                }
                Text(scanning ? "Scanner…" : "Scan")
                    .font(.appScaled(size: 13, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: compact ? .infinity : nil)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(
                LinearGradient(
                    colors: [AlBrand.purple, AlBrand.purpleLight],
                    startPoint: .leading, endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 10)
            )
        }
        .buttonStyle(.plain)
        .disabled(urlOrSearch.isEmpty || scanning)
        .opacity(urlOrSearch.isEmpty ? 0.5 : 1)
    }

    /// Ekte BRREG-oppslag (2026-08-16) — erstatter en mock som alltid fylte
    /// inn samme fiktive «Nordic Elektro AS» uansett input. Kun det BRREG
    /// faktisk har (navn/org.nr/adresse/bransje/ansatte) fylles — telefon/
    /// e-post/omsetning/kontaktperson må fortsatt fylles manuelt (ikke i
    /// Enhetsregisteret).
    private func runScan() {
        scanning = true
        scanError = nil
        Task {
            defer { scanning = false }
            guard let api = appState.api else {
                scanError = "Ikke innlogget mot backend."
                return
            }
            do {
                let result = try await api.lookupCompany(query: urlOrSearch)
                guard result.found, let c = result.company else {
                    scanError = "Fant ingen bedrift i Brønnøysundregisteret for «\(urlOrSearch)». Fyll inn manuelt."
                    return
                }
                companyName = c.name
                orgNumber = c.orgNr
                address = c.address ?? ""
                postalCode = c.postalCode ?? ""
                city = c.city ?? city
                website = c.website ?? website
                industry = c.naceDescription ?? ""
                employees = c.employees.map { "\($0)" } ?? ""
                // 2026-08-16: kartforhåndsvisningen stod hardkodet på Oslo
                // sentrum for ALLE scan-opprettede leads — Kartverket-
                // geokodet adresse fra backend flyttes nå pinnen dit den
                // faktisk hører hjemme.
                if let lat = c.latitude, let lon = c.longitude {
                    pinCoord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
                    locationConfidence = "geocoded"
                }
                scanComplete = true
            } catch {
                scanError = "Oppslag feilet — prøv igjen. (\(error.localizedDescription))"
            }
        }
    }

    // MARK: Bedrift-seksjon

    private func companySection(compact: Bool) -> some View {
        sectionCard(title: "Bedrift", icon: "building.2.fill") {
            VStack(spacing: 12) {
                field(label: "Bedriftsnavn",  placeholder: "F.eks. Nordic Elektro AS", text: $companyName)
                if compact {
                    VStack(spacing: 12) {
                        field(label: "Org.nr", placeholder: "912 345 678", text: $orgNumber)
                        field(label: "Nettside", placeholder: "nordicelektro.no", text: $website)
                    }
                } else {
                    HStack(spacing: 10) {
                        field(label: "Org.nr", placeholder: "912 345 678", text: $orgNumber)
                        field(label: "Nettside", placeholder: "nordicelektro.no", text: $website)
                    }
                }
                field(label: "Adresse", placeholder: "Storgata 12", text: $address)
                if compact {
                    VStack(spacing: 12) {
                        field(label: "Postnr", placeholder: "0184", text: $postalCode)
                        field(label: "Sted", placeholder: "Oslo", text: $city)
                    }
                } else {
                    HStack(spacing: 10) {
                        field(label: "Postnr", placeholder: "0184", text: $postalCode).frame(width: 100)
                        field(label: "Sted", placeholder: "Oslo", text: $city)
                    }
                }
            }
        }
    }

    // MARK: Kontakt-seksjon

    private func contactSection(compact: Bool) -> some View {
        sectionCard(title: "Primær kontaktperson", icon: "person.crop.circle.fill") {
            VStack(spacing: 12) {
                if compact {
                    field(label: "Navn", placeholder: "Anders Johansen", text: $contactName)
                    field(label: "Rolle", placeholder: "Daglig leder", text: $contactRole)
                    field(label: "Telefon", placeholder: "+47 22 33 44 55", text: $phone, keyboard: .phonePad)
                    field(label: "E-post", placeholder: "post@…", text: $email, keyboard: .emailAddress)
                } else {
                    HStack(spacing: 10) {
                        field(label: "Navn", placeholder: "Anders Johansen", text: $contactName)
                        field(label: "Rolle", placeholder: "Daglig leder", text: $contactRole)
                    }
                    HStack(spacing: 10) {
                        field(label: "Telefon", placeholder: "+47 22 33 44 55", text: $phone, keyboard: .phonePad)
                        field(label: "E-post",  placeholder: "post@…",          text: $email, keyboard: .emailAddress)
                    }
                }
            }
        }
    }

    // MARK: Klassifisering-seksjon

    private func classificationSection(compact: Bool) -> some View {
        sectionCard(title: "Klassifisering", icon: "tag.fill") {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    fieldLabel("Temperatur")
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 104, maximum: 160), spacing: 8)],
                        alignment: .leading,
                        spacing: 8
                    ) {
                        ForEach(LeadTemperature.allCases, id: \.self) { value in
                            temperatureChip(value)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    fieldLabel("Pipelinefase")
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 118, maximum: 180), spacing: 8)],
                        alignment: .leading,
                        spacing: 8
                    ) {
                        ForEach(LeadStatus.creationStages) { value in
                            pipelineChip(value)
                        }
                    }
                }

                if compact {
                    VStack(spacing: 12) {
                        field(label: "Bransje", placeholder: "Elektro", text: $industry)
                        field(label: "Ansatte", placeholder: "25", text: $employees, keyboard: .numberPad)
                        field(label: "Omsetning (NOK)", placeholder: "10 000 000", text: $revenue, keyboard: .decimalPad)
                    }
                } else {
                    HStack(spacing: 10) {
                        field(label: "Bransje", placeholder: "Elektro", text: $industry)
                        field(label: "Ansatte", placeholder: "25", text: $employees, keyboard: .numberPad)
                        field(label: "Omsetning (NOK)", placeholder: "10 000 000", text: $revenue, keyboard: .decimalPad)
                    }
                }

                Divider().overlay(AlBrand.stroke)

                VStack(alignment: .leading, spacing: 10) {
                    Toggle(isOn: $includeFollowUp.animation(.easeInOut(duration: 0.2))) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Planlegg neste oppfølging")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Text("Dato og handling lagres sammen med leaden")
                                .font(.appScaled(size: 10))
                                .foregroundStyle(AlBrand.textTertiary)
                        }
                    }
                    .tint(AlBrand.purple)

                    if includeFollowUp {
                        DatePicker(
                            "Tidspunkt",
                            selection: $nextFollowUpAt,
                            in: Date()...,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .font(.appScaled(size: 12, weight: .medium))
                        .foregroundStyle(.white)
                        .tint(AlBrand.purpleLight)

                        field(
                            label: "Neste handling",
                            placeholder: "F.eks. ring daglig leder",
                            text: $nextAction
                        )
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("Notat")
                    TextEditor(text: $notat)
                        .scrollContentBackground(.hidden)
                        .accessibilityLabel("Notat")
                        .accessibilityIdentifier("add-lead.field.notat")
                        .foregroundStyle(.white)
                        .font(.appScaled(size: 13))
                        .frame(minHeight: 70)
                        .padding(10)
                        .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                            fieldErrors["notat"] == nil ? AlBrand.stroke : AlBrand.red,
                            lineWidth: fieldErrors["notat"] == nil ? 1 : 1.5
                        ))
                        .overlay(alignment: .topLeading) {
                            if notat.isEmpty {
                                Text("Hvorfor er denne leaden interessant? Hva er neste steg?")
                                    .font(.appScaled(size: 13))
                                    .foregroundStyle(AlBrand.textTertiary)
                                    .padding(.horizontal, 14).padding(.vertical, 16)
                                    .allowsHitTesting(false)
                            }
                        }
                        .onChange(of: notat) { _, _ in
                            fieldErrors.removeValue(forKey: "notat")
                        }
                    if let message = fieldErrors["notat"] {
                        Text(message)
                            .font(.appScaled(size: 10, weight: .semibold))
                            .foregroundStyle(AlBrand.red)
                            .accessibilityIdentifier("add-lead.error.notat")
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("Tildelt selger")
                    HStack(spacing: 9) {
                        ZStack {
                            Circle().fill(AlBrand.purple.opacity(0.25))
                            Text(assigneeInitials)
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(AlBrand.purpleLight)
                        }
                        .frame(width: 30, height: 30)
                        Text(assignTo)
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("(deg)")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(AlBrand.textTertiary)
                        Spacer()
                        // «Endre»-knapp fjernet 2026-07-17: var død — medlems-
                        // velger for tildeling har ingen flate i denne sheeten.
                    }
                    .padding(10)
                    .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1))
                }
            }
        }
    }

    private func temperatureChip(_ value: LeadTemperature) -> some View {
        let isSelected = temperature == value
        return choiceChip(
            label: value.label,
            icon: value.icon,
            color: value.background,
            isSelected: isSelected,
            identifier: "add-lead.temperature.\(value.rawValue)"
        ) { temperature = value }
    }

    private func pipelineChip(_ value: LeadStatus) -> some View {
        let isSelected = leadStatus == value
        return choiceChip(
            label: value.creationLabel,
            icon: value.creationIcon,
            color: value.creationColor,
            isSelected: isSelected,
            identifier: "add-lead.pipeline.\(value.rawValue)"
        ) { leadStatus = value }
    }

    private func choiceChip(
        label: String,
        icon: String,
        color: Color,
        isSelected: Bool,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.appScaled(size: 10, weight: .semibold))
                Text(label)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            .foregroundStyle(isSelected ? .white : color)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(isSelected ? color : color.opacity(0.15), in: Capsule())
            .overlay(Capsule().stroke(isSelected ? Color.clear : color.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
        .accessibilityValue(isSelected ? "Valgt" : "Ikke valgt")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: Pin preview

    private var pinPreviewCard: some View {
        sectionCard(title: "Pin på kartet", icon: "mappin.and.ellipse") {
            VStack(spacing: 10) {
                ZStack {
                    if let pinCoord {
                        Map(position: .constant(.region(MKCoordinateRegion(
                            center: pinCoord,
                            span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.012)
                        ))), interactionModes: []) {
                            Annotation("", coordinate: pinCoord) {
                                ZStack {
                                    if temperature == .hot {
                                        Circle().fill(RadialGradient(
                                            colors: [AlBrand.red.opacity(0.4), AlBrand.red.opacity(0)],
                                            center: .center, startRadius: 8, endRadius: 28
                                        ))
                                        .frame(width: 60, height: 60)
                                        .blur(radius: 4)
                                    }
                                    Circle()
                                        .fill(temperature.background)
                                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                        .frame(width: 28, height: 28)
                                        .shadow(color: temperature.background.opacity(0.7), radius: 6, x: 0, y: 2)
                                    Image(systemName: "building.2.fill")
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                        }
                        .mapStyle(.standard(
                            elevation: .flat,
                            emphasis: .muted,
                            pointsOfInterest: .excludingAll
                        ))
                        .mapControls { }
                        .environment(\.colorScheme, .dark)
                    } else {
                        VStack(spacing: 10) {
                            if resolvingCoordinate {
                                ProgressView()
                                    .tint(AlBrand.purpleLight)
                                Text("Finner riktig kartposisjon …")
                            } else {
                                Image(systemName: "mappin.slash")
                                    .font(.appScaled(size: 28, weight: .semibold))
                                    .foregroundStyle(AlBrand.textTertiary)
                                Text("Kartposisjonen beregnes fra adressen når du lagrer")
                            }
                        }
                        .font(.appScaled(size: 12, weight: .medium))
                        .foregroundStyle(AlBrand.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(AlBrand.cardHi)
                    }
                }
                .frame(height: 160)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .allowsHitTesting(false)
                .overlay(
                    RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1)
                )

                HStack(spacing: 6) {
                    Image(systemName: "location.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(AlBrand.purpleLight)
                    Text(pinCoord == nil
                         ? "Ingen standardpin brukes. Fyll inn en adresse, eller start fra pin-knappen på kartet."
                         : "Dette er en midlertidig forhåndsvisning. Leaden blir først lagt til etter bekreftet lagring.")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(AlBrand.textSecondary)
                    Spacer()
                }
            }
        }
    }

    // MARK: Bottom-bar

    private func bottomBar(compact: Bool) -> some View {
        VStack(spacing: 10) {
            if let saveError {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(AlBrand.orange)
                    Text(saveError)
                        .font(.appScaled(size: 12, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(10)
                .background(AlBrand.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10)
                    .stroke(AlBrand.orange.opacity(0.35), lineWidth: 1))
                .accessibilityIdentifier("add-lead.save-error")
            }

            HStack(spacing: 10) {
                if !compact {
                    Button { cancel() } label: {
                        Text("Avbryt")
                            .font(.appScaled(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 48)
                            .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11)
                                .stroke(AlBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(saving)
                }

                Button {
                    Task { await saveLead() }
                } label: {
                    HStack(spacing: 7) {
                        if saving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "plus.circle.fill")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        Text(saving ? "Lagrer …" : "Legg til på kartet")
                            .font(.appScaled(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 48)
                    .background(
                        LinearGradient(
                            colors: [AlBrand.purple, AlBrand.purpleLight],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 11)
                    )
                }
                .buttonStyle(.plain)
                .disabled(companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving)
                .opacity(companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.55 : 1)
                .accessibilityIdentifier("add-lead.save")
                .accessibilityHint(companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? "Fyll inn bedriftsnavn først"
                    : "Lagrer leaden og plasserer den på kartet")
            }
        }
        .padding(.horizontal, compact ? 16 : 20)
        .padding(.vertical, 12)
        .background(
            AlBrand.bg
                .overlay(Rectangle().fill(AlBrand.stroke).frame(height: 1), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    // MARK: Helpers

    private func cancel() {
        notifyCancelIfNeeded()
        dismiss()
    }

    #if DEBUG
    private func seedQAValidationDataIfRequested() {
        guard ProcessInfo.processInfo.environment["QA_TOUR"] == "lead-form-validation"
        else { return }
        companyName = "Valideringstest AS"
        orgNumber = "123456789"
        website = "javascript:alert(1)"
        email = "ugyldig-epost"
    }
    #endif

    private func notifyCancelIfNeeded() {
        guard !didSave, !didNotifyCancel else { return }
        didNotifyCancel = true
        onCancel()
    }

    private func resolveInitialAddressIfNeeded() async {
        guard let initialCoordinate else { return }
        resolvingCoordinate = true
        defer { resolvingCoordinate = false }
        guard let hit = await KartverketService.shared.reverseGeocode(
            lat: initialCoordinate.latitude,
            lon: initialCoordinate.longitude,
            using: appState.api
        ) else { return }
        if address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            address = hit.address
        }
        if postalCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            postalCode = hit.postalCode
        }
        if city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            city = hit.city
        }
    }

    private struct ParsedFields {
        let organizationNumber: String?
        let website: String?
        let email: String?
        let employeeCount: Int?
        let revenue: Double?
    }

    private func validatedFields() -> ParsedFields? {
        var errors: [String: String] = [:]
        func validateLength(_ value: String, key: String, label: String, max: Int) {
            if value.trimmingCharacters(in: .whitespacesAndNewlines).count > max {
                errors[key] = "\(label) kan være maks \(max) tegn."
            }
        }
        validateLength(companyName, key: "bedriftsnavn", label: "Bedriftsnavn", max: 200)
        validateLength(contactName, key: "navn", label: "Kontaktperson", max: 240)
        validateLength(contactRole, key: "rolle", label: "Rolle", max: 160)
        validateLength(phone, key: "telefon", label: "Telefon", max: 50)
        validateLength(address, key: "adresse", label: "Adresse", max: 500)
        validateLength(postalCode, key: "postnr", label: "Postnummer", max: 20)
        validateLength(city, key: "sted", label: "Sted", max: 120)
        validateLength(industry, key: "bransje", label: "Bransje", max: 60)
        validateLength(notat, key: "notat", label: "Notat", max: 20_000)
        if includeFollowUp {
            validateLength(nextAction, key: "neste-handling", label: "Neste handling", max: 2_000)
            if nextAction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                errors["neste-handling"] = "Beskriv neste handling når oppfølging er aktivert."
            }
        }

        var parsedOrganizationNumber: String?
        var parsedWebsite: String?
        var parsedEmail: String?
        var parsedEmployeeCount: Int?
        var parsedRevenue: Double?
        do { parsedOrganizationNumber = try AddLeadFieldParser.organizationNumber(orgNumber) }
        catch { errors["org.nr"] = error.localizedDescription }
        do { parsedWebsite = try AddLeadFieldParser.website(website) }
        catch { errors["nettside"] = error.localizedDescription }
        do { parsedEmail = try AddLeadFieldParser.email(email) }
        catch { errors["e-post"] = error.localizedDescription }
        do { parsedEmployeeCount = try AddLeadFieldParser.employeeCount(employees) }
        catch { errors["ansatte"] = error.localizedDescription }
        do { parsedRevenue = try AddLeadFieldParser.annualRevenueNok(revenue) }
        catch { errors["omsetning-(nok)"] = error.localizedDescription }

        fieldErrors = errors
        guard errors.isEmpty else { return nil }
        return ParsedFields(
            organizationNumber: parsedOrganizationNumber,
            website: parsedWebsite,
            email: parsedEmail,
            employeeCount: parsedEmployeeCount,
            revenue: parsedRevenue
        )
    }

    private func saveLead() async {
        guard !saving else { return }
        let trimmedName = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        guard let parsed = validatedFields() else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            return
        }

        submissionState.begin()

        let trimmedNextAction = nextAction.trimmingCharacters(in: .whitespacesAndNewlines)

        let fullAddress = formattedAddress
        var resolvedCoordinate = pinCoord
        if resolvedCoordinate == nil {
            guard !fullAddress.isEmpty else {
                submissionState.fail("Legg inn en adresse, eller start opprettelsen fra pin-knappen på kartet.")
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                return
            }
            resolvingCoordinate = true
            do {
                let placemarks = try await CLGeocoder().geocodeAddressString(fullAddress)
                resolvedCoordinate = placemarks.first?.location?.coordinate
                if resolvedCoordinate != nil { locationConfidence = "geocoded" }
            } catch {
                resolvedCoordinate = nil
            }
            resolvingCoordinate = false
        }

        guard let resolvedCoordinate else {
            submissionState.fail("Fant ikke kartposisjonen for adressen. Kontroller adressen og prøv igjen.")
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            return
        }
        pinCoord = resolvedCoordinate

        do {
            try await onSave(NewLeadData(
                companyName: trimmedName,
                organizationNumber: parsed.organizationNumber,
                websiteURL: parsed.website,
                contactName: optionalField(contactName),
                contactRole: optionalField(contactRole),
                phone: optionalField(phone),
                email: parsed.email,
                industryLabel: optionalField(industry),
                employeeCountEstimate: parsed.employeeCount,
                annualRevenueNokEstimate: parsed.revenue,
                notes: optionalField(notat),
                leadTemperature: temperature,
                leadStatus: leadStatus,
                nextFollowUpAt: includeFollowUp ? nextFollowUpAt : nil,
                nextAction: includeFollowUp ? trimmedNextAction : nil,
                address: fullAddress,
                postalCode: optionalField(postalCode),
                city: optionalField(city),
                coord: resolvedCoordinate,
                locationConfidence: locationConfidence,
                leadSource: scanComplete ? "brreg_lookup" : (initialCoordinate == nil ? "manual_form" : "manual_pin_drop")
            ))
            submissionState.succeed()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } catch {
            let message: String
            if let saveError = error as? AddLeadSaveError {
                message = saveError.message
            } else if let apiError = error as? APIError {
                message = apiError.localizedDescription
            } else {
                message = "Kunne ikke lagre leaden. Kontroller forbindelsen og prøv igjen."
            }
            submissionState.fail(message)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }

    private func optionalField(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var formattedAddress: String {
        let street = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let locality = [
            postalCode.trimmingCharacters(in: .whitespacesAndNewlines),
            city.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        .filter { !$0.isEmpty }
        .joined(separator: " ")
        return [street, locality].filter { !$0.isEmpty }.joined(separator: ", ")
    }

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String,
                                             @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.appScaled(size: 13, weight: .semibold))
                    .foregroundStyle(AlBrand.purpleLight)
                Text(title)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            content()
        }
        .padding(16)
        .background(AlBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(AlBrand.stroke, lineWidth: 1))
    }

    private func fieldLabel(_ s: String) -> some View {
        Text(s)
            .font(.appScaled(size: 11, weight: .semibold))
            .foregroundStyle(AlBrand.textSecondary)
    }

    private var assigneeInitials: String {
        let initials = appState.displayName
            .split(whereSeparator: \.isWhitespace)
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
            .uppercased()
        return initials.isEmpty ? "ME" : initials
    }

    @ViewBuilder
    private func field(label: String, placeholder: String, text: Binding<String>,
                       keyboard: UIKeyboardType = .default) -> some View {
        let identifier = fieldIdentifier(label)
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel(label)
            TextField("", text: text, prompt: Text(placeholder).foregroundColor(AlBrand.textTertiary))
                .textFieldStyle(.plain)
                .accessibilityLabel(label)
                .accessibilityIdentifier("add-lead.field.\(identifier)")
                .foregroundStyle(.white)
                .font(.appScaled(size: 13))
                .keyboardType(keyboard)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                    fieldErrors[identifier] == nil ? AlBrand.stroke : AlBrand.red,
                    lineWidth: fieldErrors[identifier] == nil ? 1 : 1.5
                ))
                .onChange(of: text.wrappedValue) { _, _ in
                    fieldErrors.removeValue(forKey: identifier)
                }
            if let message = fieldErrors[identifier] {
                Text(message)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(AlBrand.red)
                    .accessibilityIdentifier("add-lead.error.\(identifier)")
            }
        }
    }

    private func fieldIdentifier(_ label: String) -> String {
        label
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: " ", with: "-")
            .lowercased()
    }
}
