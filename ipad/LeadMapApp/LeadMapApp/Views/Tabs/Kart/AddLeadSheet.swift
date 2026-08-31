// AddLeadSheet.swift
//
// Modal som åpnes når salgssjefen tapper "+ Legg til lead" i Kart-toppen.
//
// To inn-veier:
//   1. AI auto-fyll — lim inn URL eller bedriftsnavn → Leadgrid scanner
//      nettsiden + Brønnøysund + Google Places → fyller automatisk navn,
//      adresse, kontakt, bransje, ansatt-antall, omsetning, kart-pin.
//   2. Manuell — fyll selv (for når du har visittkort, telefon-tips etc.)
//
// Inkluderer status-velger (Hot/Varm/Ny/Kunde/Møte/Oppfølging), pin-
// preview på mini-kart, og "Legg til på kartet"-CTA.

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

    @State private var status: MapLeadMock.PinStatus = .new
    // Selv-tildeling er default — «Lars Kristensen» var hardkodet mock-navn.
    @State private var assignTo: String = "Meg"

    @State private var pinCoord: CLLocationCoordinate2D?
    @State private var resolvingCoordinate = false
    @State private var submissionState = AddLeadSubmissionState()
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
    }

    struct NewLeadData {
        let companyName: String
        let address: String
        let status: MapLeadMock.PinStatus
        let coord: CLLocationCoordinate2D
        // 2026-08-16: phone/email persisteres nå reelt (from-pin støtter
        // dem). org.nr/nettside/kontaktperson/notat/ansatte/omsetning
        // samles fortsatt i skjemaet men har intet lagringssted i
        // crm_customers via dette endepunktet ennå — kjent gap, ikke et
        // stille datatap (se runScan()-kommentaren over).
        let phone: String
        let email: String
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
                    fieldLabel("Status")
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 104, maximum: 160), spacing: 8)],
                        alignment: .leading,
                        spacing: 8
                    ) {
                        ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
                            statusChip(st)
                        }
                    }
                }

                if compact {
                    VStack(spacing: 12) {
                        field(label: "Bransje", placeholder: "Elektro", text: $industry)
                        field(label: "Ansatte", placeholder: "25–50", text: $employees)
                        field(label: "Omsetning", placeholder: "10–20 mill.", text: $revenue)
                    }
                } else {
                    HStack(spacing: 10) {
                        field(label: "Bransje", placeholder: "Elektro", text: $industry)
                        field(label: "Ansatte", placeholder: "25–50", text: $employees)
                        field(label: "Omsetning", placeholder: "10–20 mill.", text: $revenue)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("Notat")
                    TextEditor(text: $notat)
                        .scrollContentBackground(.hidden)
                        .foregroundStyle(.white)
                        .font(.appScaled(size: 13))
                        .frame(minHeight: 70)
                        .padding(10)
                        .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1))
                        .overlay(alignment: .topLeading) {
                            if notat.isEmpty {
                                Text("Hvorfor er denne leaden interessant? Hva er neste steg?")
                                    .font(.appScaled(size: 13))
                                    .foregroundStyle(AlBrand.textTertiary)
                                    .padding(.horizontal, 14).padding(.vertical, 16)
                                    .allowsHitTesting(false)
                            }
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

    private func statusChip(_ st: MapLeadMock.PinStatus) -> some View {
        let isSelected = status == st
        return Button { status = st } label: {
            HStack(spacing: 5) {
                Image(systemName: st.icon)
                    .font(.appScaled(size: 10, weight: .semibold))
                Text(st.label)
                    .font(.appScaled(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            .foregroundStyle(isSelected ? .white : st.color)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                isSelected ? st.color : st.color.opacity(0.15),
                in: Capsule()
            )
            .overlay(
                Capsule().stroke(isSelected ? Color.clear : st.color.opacity(0.4), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(st.label)
        .accessibilityIdentifier("add-lead.status.\(st.rawValue)")
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
                                    if status == .hot {
                                        Circle().fill(RadialGradient(
                                            colors: [AlBrand.red.opacity(0.4), AlBrand.red.opacity(0)],
                                            center: .center, startRadius: 8, endRadius: 28
                                        ))
                                        .frame(width: 60, height: 60)
                                        .blur(radius: 4)
                                    }
                                    Circle()
                                        .fill(status.color)
                                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                                        .frame(width: 28, height: 28)
                                        .shadow(color: status.color.opacity(0.7), radius: 6, x: 0, y: 2)
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

    private func saveLead() async {
        guard !saving else { return }
        let trimmedName = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        submissionState.begin()

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
                address: fullAddress,
                status: status,
                coord: resolvedCoordinate,
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                email: email.trimmingCharacters(in: .whitespacesAndNewlines)
            ))
            submissionState.succeed()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } catch {
            submissionState.fail(
                (error as? AddLeadSaveError)?.message
                    ?? "Kunne ikke lagre leaden. Kontroller forbindelsen og prøv igjen."
            )
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
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
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel(label)
            TextField("", text: text, prompt: Text(placeholder).foregroundColor(AlBrand.textTertiary))
                .textFieldStyle(.plain)
                .accessibilityLabel(label)
                .accessibilityIdentifier("add-lead.field.\(fieldIdentifier(label))")
                .foregroundStyle(.white)
                .font(.appScaled(size: 13))
                .keyboardType(keyboard)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1))
        }
    }

    private func fieldIdentifier(_ label: String) -> String {
        label
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: " ", with: "-")
            .lowercased()
    }
}
