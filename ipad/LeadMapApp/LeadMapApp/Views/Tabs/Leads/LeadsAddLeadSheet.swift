// LeadsAddLeadSheet.swift
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

struct LeadsAddLeadSheet: View {
    let onSave: (NewLeadData) -> Void
    @Environment(\.dismiss) private var dismiss

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
    @State private var city: String = "Oslo"
    @State private var website: String = ""
    @State private var phone: String = ""
    @State private var email: String = ""
    @State private var industry: String = "Elektro"
    @State private var employees: String = "25-50"
    @State private var revenue: String = "10-20 mill."
    @State private var notat: String = ""

    @State private var contactName: String = ""
    @State private var contactRole: String = ""

    @State private var status: MapLeadMock.PinStatus = .new
    @State private var assignTo: String = "Lars Kristensen"

    @State private var pinCoord = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)

    struct NewLeadData {
        let companyName: String
        let address: String
        let status: MapLeadMock.PinStatus
        let coord: CLLocationCoordinate2D
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    modeSwitch
                    if mode == .ai {
                        aiInputCard
                    }
                    companySection
                    contactSection
                    classificationSection
                    pinPreviewCard
                    Color.clear.frame(height: 80)  // plass for bottom-bar
                }
                .padding(20)
            }
            .background(AlBrand.bg.ignoresSafeArea())
            .navigationTitle("Legg til lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .foregroundStyle(AlBrand.purpleLight)
                }
            }
            .toolbarBackground(AlBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
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
                    }
                    .foregroundStyle(mode == m ? .white : AlBrand.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
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

    private var aiInputCard: some View {
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

            HStack(spacing: 8) {
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
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1))

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
                    .padding(.horizontal, 16).padding(.vertical, 11)
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

            HStack(spacing: 6) {
                Image(systemName: scanComplete ? "checkmark.seal.fill" : "info.circle")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(scanComplete ? AlBrand.green : AlBrand.textTertiary)
                Text(scanComplete
                     ? "Auto-fylt fra nettside + Brønnøysund. Sjekk feltene under."
                     : "Henter: nettside-meta, kontakt-info, org.nr, koord., bransje, omsetning, ansatte.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(AlBrand.textSecondary)
                Spacer()
            }
        }
        .padding(16)
        .background(AlBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(AlBrand.purple.opacity(0.3), lineWidth: 1)
        )
    }

    private func runScan() {
        scanning = true
        // Mocket: fyller felter etter 1.2s
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            companyName = "Nordic Elektro AS"
            orgNumber = "912 345 678"
            address = "Storgata 12"
            postalCode = "0184"
            city = "Oslo"
            website = "nordicelektro.no"
            phone = "+47 22 33 44 55"
            email = "post@nordicelektro.no"
            industry = "Elektro"
            employees = "25-50"
            revenue = "10-20 mill."
            contactName = "Anders Johansen"
            contactRole = "Daglig leder"
            notat = "Interessert i nytt el-anlegg til kontorbygg. Følge opp prisforslag og referanseprosjekter."
            scanning = false
            scanComplete = true
        }
    }

    // MARK: Bedrift-seksjon

    private var companySection: some View {
        sectionCard(title: "Bedrift", icon: "building.2.fill") {
            VStack(spacing: 12) {
                field(label: "Bedriftsnavn",  placeholder: "F.eks. Nordic Elektro AS", text: $companyName)
                HStack(spacing: 10) {
                    field(label: "Org.nr",   placeholder: "912 345 678",     text: $orgNumber)
                    field(label: "Nettside", placeholder: "nordicelektro.no", text: $website)
                }
                field(label: "Adresse", placeholder: "Storgata 12", text: $address)
                HStack(spacing: 10) {
                    field(label: "Postnr",   placeholder: "0184", text: $postalCode).frame(width: 100)
                    field(label: "Sted",     placeholder: "Oslo", text: $city)
                }
            }
        }
    }

    // MARK: Kontakt-seksjon

    private var contactSection: some View {
        sectionCard(title: "Primær kontaktperson", icon: "person.crop.circle.fill") {
            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    field(label: "Navn", placeholder: "Anders Johansen", text: $contactName)
                    field(label: "Rolle", placeholder: "Daglig leder",   text: $contactRole)
                }
                HStack(spacing: 10) {
                    field(label: "Telefon", placeholder: "+47 22 33 44 55", text: $phone, keyboard: .phonePad)
                    field(label: "E-post",  placeholder: "post@…",          text: $email, keyboard: .emailAddress)
                }
            }
        }
    }

    // MARK: Klassifisering-seksjon

    private var classificationSection: some View {
        sectionCard(title: "Klassifisering", icon: "tag.fill") {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    fieldLabel("Status")
                    HStack(spacing: 6) {
                        ForEach(MapLeadMock.PinStatus.allCases, id: \.self) { st in
                            statusChip(st)
                        }
                    }
                }

                HStack(spacing: 10) {
                    field(label: "Bransje",   placeholder: "Elektro",      text: $industry)
                    field(label: "Ansatt",    placeholder: "25-50",        text: $employees)
                    field(label: "Omsetning", placeholder: "10-20 mill.",  text: $revenue)
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
                            Text("LK")
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
                        Button {} label: {
                            Text("Endre")
                                .font(.appScaled(size: 12, weight: .semibold))
                                .foregroundStyle(AlBrand.purpleLight)
                        }
                        .buttonStyle(.plain)
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
            }
            .foregroundStyle(isSelected ? .white : st.color)
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(
                isSelected ? st.color : st.color.opacity(0.15),
                in: Capsule()
            )
            .overlay(
                Capsule().stroke(isSelected ? Color.clear : st.color.opacity(0.4), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Pin preview

    private var pinPreviewCard: some View {
        sectionCard(title: "Pin på kartet", icon: "mappin.and.ellipse") {
            VStack(spacing: 10) {
                ZStack {
                    Map(position: .constant(.region(MKCoordinateRegion(
                        center: pinCoord,
                        span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.012)
                    ))), interactionModes: []) {
                        Annotation("", coordinate: pinCoord) {
                            ZStack {
                                if status == .hot {
                                    Circle().fill(RadialGradient(colors: [AlBrand.red.opacity(0.4), AlBrand.red.opacity(0)], center: .center, startRadius: 8, endRadius: 28))
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
                    .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
                    .mapControls { }
                    .environment(\.colorScheme, .dark)
                    .frame(height: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .allowsHitTesting(false)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1)
                )

                HStack(spacing: 6) {
                    Image(systemName: "location.fill")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(AlBrand.purpleLight)
                    Text("Pinnen plasseres automatisk fra adressen. Du kan flytte den manuelt etter at leaden er lagret.")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(AlBrand.textSecondary)
                    Spacer()
                }
            }
        }
    }

    // MARK: Bottom-bar

    private var bottomBar: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Text("Avbryt")
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(AlBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)

            Button {
                onSave(NewLeadData(
                    companyName: companyName.isEmpty ? "Ny lead" : companyName,
                    address: "\(address), \(postalCode) \(city)",
                    status: status,
                    coord: pinCoord
                ))
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                        .font(.appScaled(size: 13, weight: .bold))
                    Text("Legg til på kartet")
                        .font(.appScaled(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(
                        colors: [AlBrand.purple, AlBrand.purpleLight],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }
            .buttonStyle(.plain)
            .disabled(companyName.isEmpty)
            .opacity(companyName.isEmpty ? 0.55 : 1)
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background(
            AlBrand.bg.opacity(0.95)
                .overlay(Rectangle().fill(AlBrand.stroke).frame(height: 1), alignment: .top)
        )
    }

    // MARK: Helpers

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

    @ViewBuilder
    private func field(label: String, placeholder: String, text: Binding<String>,
                       keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel(label)
            TextField("", text: text, prompt: Text(placeholder).foregroundColor(AlBrand.textTertiary))
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .font(.appScaled(size: 13))
                .keyboardType(keyboard)
                .padding(.horizontal, 12).padding(.vertical, 11)
                .background(AlBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(AlBrand.stroke, lineWidth: 1))
        }
    }
}
