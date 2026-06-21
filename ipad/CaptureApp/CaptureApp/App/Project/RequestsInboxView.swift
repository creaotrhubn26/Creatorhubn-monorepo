import SwiftUI

/// "Forespørsler" — the inbound client requests inbox, the entry point of the
/// request→project→timeline→worklog loop. Tap a request to read the full
/// inquiry, then turn it into a project with one tap (the backend links the
/// submission to the new project and seeds worklog phases).
@MainActor
@Observable
final class RequestsModel {
    private(set) var submissions: [Submission] = []
    private(set) var loading = true
    private(set) var errorMessage: String?

    var newCount: Int { submissions.filter(\.isNew).count }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription; loading = false; return
        }
        loading = submissions.isEmpty
        errorMessage = nil
        do { submissions = try await client.listSubmissions() }
        catch { if submissions.isEmpty { errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription } }
        loading = false
    }
}

struct RequestsInboxView: View {
    @State private var model = RequestsModel()

    var body: some View {
        Group {
            if model.loading && model.submissions.isEmpty {
                ProgressView("Laster forespørsler…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let message = model.errorMessage, model.submissions.isEmpty {
                ContentUnavailableView("Kunne ikke laste", systemImage: "tray.and.arrow.down", description: Text(message))
            } else if model.submissions.isEmpty {
                ContentUnavailableView("Ingen forespørsler", systemImage: "tray", description: Text("Nye kundehenvendelser dukker opp her."))
            } else {
                List {
                    ForEach(model.submissions) { s in
                        NavigationLink {
                            RequestDetailView(submission: s) { await model.load() }
                        } label: {
                            RequestRow(submission: s)
                        }
                        .listRowBackground(CHTheme.surface)
                        .listRowSeparatorTint(CHTheme.border)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .refreshable { await model.load() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle("Forespørsler")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
    }
}

/// Compact inbox row — name, NY/star, type · location · budget, time.
private struct RequestRow: View {
    let submission: Submission

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Text(submission.name ?? "Ukjent").font(.headline).foregroundStyle(CHTheme.textPrimary).lineLimit(1)
                if submission.isStarred { Image(systemName: "star.fill").font(.caption2).foregroundStyle(CHTheme.warning) }
                if submission.isConverted {
                    Label("Prosjekt", systemImage: "checkmark.circle.fill").font(.caption2.weight(.semibold)).foregroundStyle(CHTheme.success)
                } else if submission.isNew {
                    Text("NY").font(.caption2.weight(.bold)).foregroundStyle(CHTheme.bg)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(CHTheme.accent, in: Capsule())
                }
                Spacer()
                if let at = submission.submittedAt {
                    Text(DashboardDate.relative(at)).font(.caption2).foregroundStyle(CHTheme.textMuted)
                }
            }
            HStack(spacing: 12) {
                if let t = submission.projectType { Label(t, systemImage: "camera").font(.caption).foregroundStyle(CHTheme.textSecondary) }
                if let loc = submission.location, !loc.isEmpty { Label(loc, systemImage: "mappin").font(.caption).foregroundStyle(CHTheme.textMuted) }
                if let b = submission.budget { Text("kr \(Int(b))").font(.caption).foregroundStyle(CHTheme.accentSoft) }
            }
            if let d = submission.description, !d.isEmpty {
                Text(d).font(.caption).foregroundStyle(CHTheme.textMuted).lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Full request detail — everything the client submitted + actions.
struct RequestDetailView: View {
    let submission: Submission
    var onChanged: () async -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @State private var working = false
    @State private var errorMessage: String?
    @State private var createdProjectId: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if !submission.isConverted { responseAdviceCard }
                contactCard
                projectCard
                if hasText(submission.description) || hasText(submission.specialRequests) || hasText(submission.clientNotes) {
                    detailsCard
                }
                statusCard
                createButton
                if let errorMessage {
                    Text(errorMessage).font(.caption).foregroundStyle(CHTheme.danger)
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(submission.name ?? "Forespørsel")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $createdProjectId) { pid in
            ProjectDetailView(projectId: pid, title: submission.name)
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(submission.name ?? "Ukjent").font(.title3.bold()).foregroundStyle(CHTheme.textPrimary)
                if let t = submission.projectType { Text(t).font(.subheadline).foregroundStyle(CHTheme.accentSoft) }
            }
            Spacer()
            if submission.isNew {
                Text("NY").font(.caption.weight(.bold)).foregroundStyle(CHTheme.bg)
                    .padding(.horizontal, 8).padding(.vertical, 3).background(CHTheme.accent, in: Capsule())
            }
            if let p = submission.priority, p.lowercased() != "medium" {
                Text(p.capitalized).font(.caption2.weight(.semibold)).foregroundStyle(CHTheme.warning)
                    .padding(.horizontal, 8).padding(.vertical, 3).background(CHTheme.warning.opacity(0.15), in: Capsule())
            }
        }
    }

    private var contactCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                cardTitle("Kontakt", "person.crop.circle")
                if let email = submission.email, !email.isEmpty {
                    contactRow("envelope", email, url: URL(string: "mailto:\(email)"))
                }
                if let phone = submission.phone, !phone.isEmpty {
                    contactRow("phone", phone, url: URL(string: "tel:\(phone.filter { !$0.isWhitespace })"))
                }
                if let c = submission.company, !c.isEmpty { contactRow("building.2", c, url: nil) }
                if let pref = submission.contactPreference, !pref.isEmpty {
                    infoRow("Foretrekker", pref.capitalized)
                }
                if let ref = submission.referralSource, !ref.isEmpty {
                    infoRow("Fant deg via", ref)
                }
            }
        }
    }

    private var projectCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                cardTitle("Prosjektdetaljer", "camera.aperture")
                if let d = submission.eventDate, !d.isEmpty { infoRow("Dato", DashboardDate.shortDate(d)) }
                if let loc = submission.location, !loc.isEmpty { infoRow("Sted", loc) }
                if let b = submission.budget { infoRow("Budsjett", "kr \(Int(b))") }
                if let tf = submission.timeframe, !tf.isEmpty { infoRow("Tidsramme", tf) }
                if submission.budget == nil && (submission.location ?? "").isEmpty && (submission.eventDate ?? "").isEmpty {
                    Text("Ingen prosjektdetaljer oppgitt.").font(.caption).foregroundStyle(CHTheme.textMuted)
                }
            }
        }
    }

    private var detailsCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                cardTitle("Beskrivelse & ønsker", "text.alignleft")
                if hasText(submission.description) { paragraph("Melding", submission.description!) }
                if hasText(submission.specialRequests) { paragraph("Spesielle ønsker", submission.specialRequests!) }
                if hasText(submission.clientNotes) { paragraph("Notater", submission.clientNotes!) }
            }
        }
    }

    private var statusCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                cardTitle("Status", "flag")
                HStack(spacing: 10) {
                    statusChip("Tilbud sendt", submission.quoteSent, "doc.text")
                    statusChip("Kontrakt sendt", submission.contractSent, "signature")
                    statusChip("Depositum", submission.depositReceived, "creditcard")
                }
                if submission.quoteSent, let qa = submission.quoteAmount {
                    infoRow("Tilbudssum", "kr \(Int(qa))")
                }
            }
        }
    }

    /// "Anbefalt svar" — when the client didn't state a deadline, advise when
    /// to reply and why. Photographers win bookings on speed: clients usually
    /// message several photographers, and the first solid reply often takes the
    /// job. Urgency escalates with how long the request has already waited.
    private var responseAdviceCard: some View {
        let advice = responseAdvice
        return CHCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "clock.badge.exclamationmark")
                    .font(.title3).foregroundStyle(advice.tint)
                VStack(alignment: .leading, spacing: 3) {
                    Text(advice.headline).font(.subheadline.weight(.semibold)).foregroundStyle(advice.tint)
                    Text(advice.reason).font(.caption).foregroundStyle(CHTheme.textSecondary)
                }
                Spacer(minLength: 0)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(advice.tint.opacity(0.4), lineWidth: 1))
    }

    private struct Advice { let headline: String; let reason: String; let tint: Color }

    private var responseAdvice: Advice {
        // Respect a client-stated deadline — then no generic advice needed.
        if let tf = submission.timeframe, !tf.trimmingCharacters(in: .whitespaces).isEmpty {
            return Advice(
                headline: "Kunden ønsker svar: \(tf)",
                reason: "Svar i god tid før dette — raske svar gir flere bookinger.",
                tint: CHTheme.accentSoft,
            )
        }
        let why = "Kunder kontakter ofte flere fotografer samtidig — den som svarer først og grundigst vinner som regel oppdraget. Forespørsler besvart raskt bookes langt oftere."
        let waited = submission.submittedAt.flatMap { DashboardDate.parse($0) }
            .map { Date().timeIntervalSince($0) } ?? 0
        let hours = waited / 3600
        if hours >= 24 {
            let days = Int(hours / 24)
            return Advice(headline: "Svar nå — har ventet \(days) \(days == 1 ? "dag" : "dager")",
                          reason: why, tint: CHTheme.danger)
        } else if hours >= 3 {
            return Advice(headline: "Svar i dag — har ventet \(Int(hours)) t",
                          reason: why, tint: CHTheme.warning)
        } else {
            return Advice(headline: "Svar innen 1 time",
                          reason: why, tint: CHTheme.success)
        }
    }

    @ViewBuilder
    private var createButton: some View {
        if submission.isConverted, let pid = submission.projectId, !pid.isEmpty {
            NavigationLink {
                ProjectDetailView(projectId: pid, title: submission.name)
            } label: {
                Label("Åpne prosjekt", systemImage: "folder.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        } else {
            Button {
                Task { await create() }
            } label: {
                HStack {
                    if working { ProgressView().controlSize(.small) }
                    else { Image(systemName: "folder.badge.plus") }
                    Text(working ? "Oppretter prosjekt…" : "Opprett prosjekt")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(working)
        }
    }

    private func create() async {
        guard let client = DashboardClient.make() else { return }
        working = true; defer { working = false }
        do {
            let pid = try await client.createProjectFromSubmission(submission)
            await onChanged()
            createdProjectId = pid
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    // MARK: - Bits

    private func hasText(_ s: String?) -> Bool { !(s ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    private func cardTitle(_ t: String, _ icon: String) -> some View {
        Label(t, systemImage: icon).font(.headline).foregroundStyle(CHTheme.textPrimary)
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(CHTheme.textMuted)
            Spacer()
            Text(value).font(.subheadline).foregroundStyle(CHTheme.textPrimary).multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    private func contactRow(_ icon: String, _ value: String, url: URL?) -> some View {
        if let url {
            Link(destination: url) {
                Label(value, systemImage: icon).font(.subheadline).foregroundStyle(CHTheme.accentSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            Label(value, systemImage: icon).font(.subheadline).foregroundStyle(CHTheme.textSecondary)
        }
    }

    private func paragraph(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(CHTheme.textMuted)
            Text(text).font(.subheadline).foregroundStyle(CHTheme.textSecondary)
        }
    }

    private func statusChip(_ label: String, _ on: Bool, _ icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: on ? "checkmark.circle.fill" : icon)
                .foregroundStyle(on ? CHTheme.success : CHTheme.textMuted)
            Text(label).font(.caption2).foregroundStyle(on ? CHTheme.textSecondary : CHTheme.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}
