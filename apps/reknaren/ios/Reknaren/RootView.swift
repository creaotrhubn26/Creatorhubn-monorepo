import SwiftUI

/// Navigasjons-mål. Speiler web-nav; utvides fase for fase. `NavigationSplitView`
/// gir sidebar på iPad og kollapser automatisk til stack på iPhone → universell.
enum Screen: String, CaseIterable, Identifiable {
    case capture, concierge, overview, bank, invoices, pay, purchase, vendors, calendar, deadlines, deduction, tax, mva, fixedAssets
    var id: String { rawValue }

    var label: String {
        switch self {
        case .capture: return "Ny kvittering"
        case .concierge: return "Til godkjenning"
        case .overview: return "Oversikt"
        case .bank: return "Bank og avstemming"
        case .invoices: return "Salg og faktura"
        case .pay: return "Betal leverandører"
        case .purchase: return "Registrer kjøp"
        case .vendors: return "Faste leverandører"
        case .calendar: return "Framover"
        case .deadlines: return "Frister"
        case .deduction: return "Spør: fradrag"
        case .tax: return "Skatt"
        case .mva: return "MVA"
        case .fixedAssets: return "Anleggsmidler"
        }
    }
    var systemImage: String {
        switch self {
        case .capture: return "camera.viewfinder"
        case .concierge: return "checkmark.circle"
        case .overview: return "square.grid.2x2"
        case .bank: return "building.columns"
        case .invoices: return "doc.text"
        case .pay: return "creditcard"
        case .purchase: return "cart.badge.plus"
        case .vendors: return "shippingbox"
        case .calendar: return "calendar"
        case .deadlines: return "clock.badge.exclamationmark"
        case .deduction: return "questionmark.circle"
        case .tax: return "banknote"
        case .mva: return "doc.badge.gearshape"
        case .fixedAssets: return "shippingbox.and.arrow.backward"
        }
    }
    var section: String {
        switch self {
        case .capture, .concierge, .overview, .bank: return "Virksomhet"
        case .invoices: return "Salg"
        case .pay, .purchase, .vendors: return "Betaling"
        case .calendar, .deadlines, .deduction: return "Innsikt"
        case .tax, .mva, .fixedAssets: return "Avslutning og skatt"
        }
    }
}

struct RootView: View {
    @Environment(Session.self) private var session
    @Environment(AppState.self) private var app
    @Environment(PushRouter.self) private var push
    @State private var selection: Screen? = .concierge

    // Daglig bruk øverst, periodisk (skatt/avslutning) nederst — ikke alfabetisk.
    private static let sectionOrder = ["Virksomhet", "Salg", "Betaling", "Innsikt", "Avslutning og skatt"]
    private var sections: [(name: String, items: [Screen])] {
        let grouped = Dictionary(grouping: Screen.allCases, by: \.section)
        return Self.sectionOrder.compactMap { name in
            grouped[name].map { (name, $0) }
        }
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                ForEach(sections, id: \.name) { section in
                    Section(section.name) {
                        ForEach(section.items) { screen in
                            HStack(spacing: 12) {
                                Image(systemName: screen.systemImage)
                                    .foregroundStyle(Color.reknarenGreen)
                                    .frame(width: 26)
                                Text(screen.label)
                            }
                            .tag(screen)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.reknarenGround.ignoresSafeArea())
            .navigationTitle("Reknaren")
            .toolbar {
                if app.orgs.count > 1 {
                    ToolbarItem(placement: .topBarLeading) { orgPicker }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Logg ut") { Task { await session.signOut() } }
                }
            }
        } detail: {
            Group {
                switch selection {
                case .overview:
                    OverviewView()
                case .capture:
                    orgScoped { CaptureView(orgId: $0) }
                case .concierge, .none:
                    orgScoped { ConciergeView(orgId: $0) }
                case .bank:
                    orgScoped { BankView(orgId: $0) }
                case .invoices:
                    orgScoped { InvoicesView(orgId: $0) }
                case .pay:
                    orgScoped { PayView(orgId: $0) }
                case .purchase:
                    orgScoped { RegistrerKjopView(orgId: $0) }
                case .vendors:
                    orgScoped { VendorsView(orgId: $0) }
                case .calendar:
                    orgScoped { CalendarView(orgId: $0) }
                case .deadlines:
                    orgScoped { DeadlinesView(orgId: $0) }
                case .deduction:
                    orgScoped { DeductionView(orgId: $0) }
                case .tax:
                    orgScoped { SkattView(orgId: $0) }
                case .mva:
                    orgScoped { MvaView(orgId: $0) }
                case .fixedAssets:
                    orgScoped { FixedAssetsView(orgId: $0) }
                }
            }
            // Varm merkevare-bunn på alle skjermer (skjuler kald system-grå).
            .scrollContentBackground(.hidden)
            .background(Color.reknarenGround.ignoresSafeArea())
        }
        .onChange(of: push.pendingScreen) { _, screen in
            if screen == "concierge" { selection = .concierge; push.pendingScreen = nil }
        }
    }

    @ViewBuilder private func orgScoped<Content: View>(@ViewBuilder _ content: (String) -> Content) -> some View {
        if let orgId = app.activeOrgId {
            content(orgId)
        } else {
            ContentUnavailableView("Velg en virksomhet", systemImage: "building.2",
                                   description: Text("Opprett en virksomhet i web-appen først."))
        }
    }

    @ViewBuilder private var orgPicker: some View {
        @Bindable var app = app
        Menu {
            Picker("Virksomhet", selection: $app.activeOrgId) {
                ForEach(app.orgs) { org in Text(org.name).tag(Optional(org.id)) }
            }
        } label: {
            Label(app.activeOrg?.name ?? "Virksomhet", systemImage: "building.2")
        }
    }
}

struct PlaceholderView: View {
    let title: String
    let note: String
    var body: some View {
        ContentUnavailableView(title, systemImage: "hammer", description: Text(note))
            .navigationTitle(title)
    }
}
