import SwiftUI

/// "Send til ekstern redigerer" — connect the project to the Partner Program
/// discovery: browse approved editing partners, pick one, and send the job
/// (brief + budget + services) in one step. The backend creates the editing job
/// in "requested" state assigned to that editor; files follow via the secure
/// upload (next step).
@MainActor
@Observable
final class SendToEditorModel {
    let projectId: String?
    let projectTitle: String?

    private(set) var vendors: [EditingVendor] = []
    private(set) var loading = true
    private(set) var errorMessage: String?
    var sending = false
    var sentJobId: String?

    init(projectId: String?, projectTitle: String?) {
        self.projectId = projectId
        self.projectTitle = projectTitle
    }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription; loading = false; return
        }
        loading = vendors.isEmpty
        errorMessage = nil
        do { vendors = try await client.listEditingVendors() }
        catch { if vendors.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription } }
        loading = false
    }

    func send(vendor: EditingVendor, brief: String, amountKr: Int, services: [String]) async {
        guard let client = DashboardClient.make() else { return }
        sending = true; defer { sending = false }
        do {
            let id = try await client.createEditingJob(
                projectId: projectId,
                projectTitle: projectTitle,
                vendorId: vendor.vendorUserId,
                brief: brief,
                amountCents: max(0, amountKr) * 100,
                requestedServices: services,
            )
            sentJobId = id
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }
}

struct SendToEditorView: View {
    @State private var model: SendToEditorModel
    @Environment(\.dismiss) private var dismiss
    @State private var selected: EditingVendor?

    init(projectId: String?, projectTitle: String?) {
        _model = State(initialValue: SendToEditorModel(projectId: projectId, projectTitle: projectTitle))
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.loading && model.vendors.isEmpty {
                    ProgressView("Finner redigerere…").frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let message = model.errorMessage, model.vendors.isEmpty {
                    ContentUnavailableView("Kunne ikke laste", systemImage: "person.2.slash", description: Text(message))
                } else if model.vendors.isEmpty {
                    ContentUnavailableView("Ingen redigerere ennå", systemImage: "person.2",
                                           description: Text("Godkjente partner-redigerere dukker opp her."))
                } else {
                    List {
                        Section {
                            ForEach(model.vendors) { v in
                                Button { selected = v } label: { VendorRow(vendor: v) }
                                    .listRowBackground(CHTheme.surface)
                            }
                        } header: {
                            Text("Partner-redigerere").foregroundStyle(CHTheme.textMuted)
                        } footer: {
                            Text("Fra Creatorhub Partner Program — verifiserte eksterne redigerere.")
                                .foregroundStyle(CHTheme.textMuted)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Send til redigerer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Lukk") { dismiss() } } }
            .task { await model.load() }
            .sheet(item: $selected) { v in
                SendBriefSheet(vendor: v, projectTitle: model.projectTitle, sending: model.sending) { brief, amount, services in
                    Task {
                        await model.send(vendor: v, brief: brief, amountKr: amount, services: services)
                        if model.sentJobId != nil { selected = nil; dismiss() }
                    }
                }
            }
        }
        .chBranded()
    }
}

private struct VendorRow: View {
    let vendor: EditingVendor

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(vendor.vendorName ?? "Redigerer").font(.headline).foregroundStyle(CHTheme.textPrimary)
                if let tier = vendor.tier {
                    Text(tier.capitalized).font(.caption2.weight(.bold)).foregroundStyle(CHTheme.accent)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(CHTheme.accent.opacity(0.15), in: Capsule())
                }
                Spacer()
                if let r = vendor.rating {
                    Label(String(format: "%.1f", r), systemImage: "star.fill").font(.caption).foregroundStyle(CHTheme.warning)
                }
            }
            if let tagline = vendor.tagline, !tagline.isEmpty {
                Text(tagline).font(.caption).foregroundStyle(CHTheme.textSecondary).lineLimit(2)
            }
            HStack(spacing: 12) {
                if let d = vendor.turnaroundDays { Label("\(d) dager", systemImage: "clock").font(.caption2).foregroundStyle(CHTheme.textMuted) }
                if let s = vendor.services.first, let p = s.price {
                    Text("fra \(Int(p)) \(s.currency ?? "NOK")").font(.caption2).foregroundStyle(CHTheme.accentSoft)
                }
                if vendor.isInternational {
                    Label("Utenlands", systemImage: "globe").font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
                if vendor.requiresExtraGdpr {
                    Label("GDPR-tillegg", systemImage: "lock.shield").font(.caption2).foregroundStyle(CHTheme.warning)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Brief + budget + services before sending the job to the chosen editor.
private struct SendBriefSheet: View {
    let vendor: EditingVendor
    let projectTitle: String?
    let sending: Bool
    let onSend: (String, Int, [String]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var brief: String
    @State private var amount = ""
    @State private var services: Set<String> = ["Retusjering"]

    private let serviceOptions = ["Retusjering", "Fargekorrigering", "Album-design", "Culling", "Video-redigering"]

    init(vendor: EditingVendor, projectTitle: String?, sending: Bool, onSend: @escaping (String, Int, [String]) -> Void) {
        self.vendor = vendor
        self.projectTitle = projectTitle
        self.sending = sending
        self.onSend = onSend
        _brief = State(initialValue: projectTitle.map { "Redigering for «\($0)». " } ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Redigerer") {
                    Text(vendor.vendorName ?? "Redigerer").foregroundStyle(CHTheme.textPrimary)
                        .listRowBackground(CHTheme.surface)
                }
                Section("Tjenester") {
                    ForEach(serviceOptions, id: \.self) { s in
                        Button {
                            if services.contains(s) { services.remove(s) } else { services.insert(s) }
                        } label: {
                            HStack {
                                Image(systemName: services.contains(s) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(services.contains(s) ? CHTheme.accent : CHTheme.textMuted)
                                Text(s).foregroundStyle(CHTheme.textPrimary)
                            }
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                }
                Section("Brief") {
                    TextField("Hva skal gjøres?", text: $brief, axis: .vertical).lineLimit(3...8)
                        .listRowBackground(CHTheme.surface)
                }
                Section("Budsjett (kr, valgfritt)") {
                    TextField("f.eks. 4000", text: $amount).keyboardType(.numberPad)
                        .listRowBackground(CHTheme.surface)
                }
                Section {
                    Text("Filene overføres sikkert til redigereren etter at forespørselen er sendt.")
                        .font(.caption).foregroundStyle(CHTheme.textMuted)
                        .listRowBackground(CHTheme.bg)
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Send forespørsel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(sending ? "Sender…" : "Send") {
                        onSend(brief, Int(amount) ?? 0, Array(services))
                    }
                    .disabled(sending || services.isEmpty)
                }
            }
        }
    }
}
