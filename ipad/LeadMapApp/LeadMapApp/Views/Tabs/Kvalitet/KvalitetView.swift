// KvalitetView.swift
//
// Kvalitet-avdelingen (Sales QA): et vunnet salg er ikke et salg før kvalitet
// har verifisert det. Kontrolløren ringer kunden med en samtale-MAL (intro +
// spørsmål m/ sjekk-hint per produkt), krysser av OK/avvik mot salgsdataene,
// og feller verdikt: Verifisert / Underkjent (m/ årsakskode) / Følg opp.
//
// Roller: kvalitet + admin/salgssjef (server håndhever; klienten skjuler bare
// inngangen). Egen struct + AnyView-terskler — jf. KartView-stack-overflow.

import SwiftUI

struct KvalitetView: View {
    /// true når viewet pushes i en ytre NavigationStack (iPhone Mer-fanen) —
    /// nestet NavigationStack i push tripper SwiftUI-assertion på enhet.
    var embedded = false

    @Environment(AppState.self) private var appState
    @State private var items: [SalesVerification] = []
    @State private var counts: [String: Int] = [:]
    @State private var templates: [VerificationTemplate] = []
    @State private var sellerStats: [QualitySellerStat] = []
    @State private var reasonStats: [QualityReasonStat] = []
    @State private var loading = false
    @State private var loadFailed = false
    @State private var active: SalesVerification?
    @State private var showTemplates = false

    var body: some View {
        Group {
            if embedded {
                inner
            } else {
                NavigationStack { inner.toolbar(.hidden, for: .navigationBar) }
            }
        }
        .gated(.leadgridKvalitet)   // tilleggstjeneste — låst uten entitlement
        .fullScreenCover(item: $active) { v in
            VerificationCallView(verification: v, templates: templates) {
                active = nil
                Task { await reload() }
            }
        }
        .sheet(isPresented: $showTemplates) {
            TemplateListSheet(templates: $templates)
        }
        .task { await reload() }
    }

    /// Demo-aware datakilde for header-badges (samme gating som søsterfanene).
    private var headerLeads: [LeadModel] {
        DemoModeManager.isActiveNonisolated
            ? DemoModeManager.shared.mockLeads
            : appState.leads
    }

    private var header: some View {
        LeadgridTabHeader(
            subtitle: "Verifiser at salgene er riktige — før de teller.",
            leads: headerLeads
        ) {
            Button { showTemplates = true } label: {
                Label("Maler", systemImage: "list.bullet.rectangle.portrait.fill")
                    .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(NavPOIBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
        }
    }

    private var inner: some View {
        VStack(spacing: 0) {
            AnyView(header)
                .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 12)
            ScrollView {
                VStack(spacing: 14) {
                    AnyView(kpiRow)
                    AnyView(queueCard)
                    if !sellerStats.isEmpty {
                        AnyView(QualityStatsCard(sellers: sellerStats, reasons: reasonStats))
                    }
                    Color.clear.frame(height: 24)
                }
                .padding(16)
            }
            .refreshable { await reload() }
        }
        .background(NavPOIBrand.bg.ignoresSafeArea())
    }

    private var kpiRow: some View {
        HStack(spacing: 10) {
            kpiTile("\(counts["pending"] ?? 0)", "Til verifisering", NavPOIBrand.purpleLight)
            kpiTile("\(counts["verified"] ?? 0)", "Verifisert", NavPOIBrand.green)
            kpiTile("\(counts["needs_followup"] ?? 0)", "Følg opp", NavPOIBrand.orange)
            kpiTile("\(counts["rejected"] ?? 0)", "Underkjent", NavPOIBrand.red)
        }
    }

    private func kpiTile(_ value: String, _ label: String, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.appScaled(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
            Text(label).font(.appScaled(size: 8, weight: .semibold)).foregroundStyle(tint)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(tint.opacity(0.25), lineWidth: 1))
    }

    private var queueCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(NavPOIBrand.purpleLight)
                Text("Verifiseringskø").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                Spacer()
                if loading { ProgressView().tint(.white).scaleEffect(0.8) }
            }
            if loadFailed {
                Text("Kunne ikke laste køen — krever kvalitet-, salgssjef- eller admin-rolle.")
                    .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
            } else if items.isEmpty && !loading {
                Text("Ingen salg i køen. Vunnede salg dukker opp her automatisk.")
                    .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
            } else {
                ForEach(items) { row($0) }
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.purple.opacity(0.3), lineWidth: 1))
    }

    private func row(_ v: SalesVerification) -> some View {
        Button {
            if v.status == "pending" || v.status == "needs_followup" { active = v }
        } label: {
            HStack(spacing: 11) {
                statusIcon(v.status)
                VStack(alignment: .leading, spacing: 2) {
                    Text(v.customerName.isEmpty ? "Ukjent kunde" : v.customerName)
                        .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                    HStack(spacing: 6) {
                        if let seller = v.sellerName {
                            Text("Selger: \(seller)").font(.appScaled(size: 9))
                                .foregroundStyle(NavPOIBrand.textSecondary).lineLimit(1)
                        }
                        if let amount = v.dealAmount {
                            Text("\(Int(amount)) \(v.dealCurrency ?? "kr")")
                                .font(.appScaled(size: 9, weight: .bold)).foregroundStyle(NavPOIBrand.green)
                        }
                        if v.status == "rejected", let r = v.reasonCode,
                           let reason = QualityReason(rawValue: r) {
                            Text(reason.label).font(.appScaled(size: 8, weight: .bold))
                                .foregroundStyle(NavPOIBrand.red)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(NavPOIBrand.red.opacity(0.15), in: Capsule())
                        }
                    }
                }
                Spacer()
                statusBadge(v.status)
                if v.status == "pending" || v.status == "needs_followup" {
                    Image(systemName: "chevron.right")
                        .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
                }
            }
            .padding(10)
            .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        }
        .buttonStyle(.plain)
    }

    private func statusIcon(_ status: String) -> some View {
        let (icon, tint): (String, Color) = switch status {
        case "verified": ("checkmark.seal.fill", NavPOIBrand.green)
        case "rejected": ("xmark.seal.fill", NavPOIBrand.red)
        case "needs_followup": ("arrow.uturn.left.circle.fill", NavPOIBrand.orange)
        default: ("phone.badge.waveform.fill", NavPOIBrand.purpleLight)
        }
        return ZStack {
            Circle().fill(tint.opacity(0.18))
            Image(systemName: icon).font(.appScaled(size: 14)).foregroundStyle(tint)
        }
        .frame(width: 36, height: 36)
    }

    private func statusBadge(_ status: String) -> some View {
        let (text, tint): (String, Color) = switch status {
        case "verified": ("Verifisert", NavPOIBrand.green)
        case "rejected": ("Underkjent", NavPOIBrand.red)
        case "needs_followup": ("Følg opp", NavPOIBrand.orange)
        default: ("Venter", NavPOIBrand.purpleLight)
        }
        return Text(text).font(.appScaled(size: 9, weight: .bold)).foregroundStyle(tint)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(tint.opacity(0.15), in: Capsule())
    }

    private func reload() async {
        // Demo-modus: kø/KPI/stats fra in-memory demo-store — Kvalitet fylles
        // ellers kun av EKTE vunnede salg og ville stått tom i en salgsdemo.
        if DemoModeManager.isActiveNonisolated {
            let d = KvalitetDemoStore.shared
            items = d.items; counts = d.counts
            templates = d.templates
            sellerStats = d.sellerStats; reasonStats = d.reasonStats
            loading = false; loadFailed = false
            return
        }
        loading = true; loadFailed = false
        async let q = QualityService.shared.queue(using: appState.api)
        async let t = QualityService.shared.templates(using: appState.api)
        async let s = QualityService.shared.stats(using: appState.api)
        if let result = await q {
            items = result.items; counts = result.counts
        } else {
            loadFailed = true
        }
        templates = await t
        if let stats = await s {
            sellerStats = stats.sellers.filter { $0.total > 0 }
            reasonStats = stats.reasons
        }
        loading = false
    }
}

// MARK: - Kvalitetsstats (salgssjef-innsikt: kvalitetsgrad per selger + årsaker)

struct QualityStatsCard: View {
    let sellers: [QualitySellerStat]
    let reasons: [QualityReasonStat]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "chart.bar.fill").foregroundStyle(NavPOIBrand.green)
                Text("Kvalitet per selger").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text("Verifisert av ferdigbehandlede").font(.appScaled(size: 9))
                    .foregroundStyle(NavPOIBrand.textSecondary)
            }
            ForEach(sellers) { sellerRow($0) }

            if !reasons.isEmpty {
                Divider().overlay(NavPOIBrand.stroke)
                Text("Underkjenningsårsaker").font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(NavPOIBrand.textSecondary)
                ForEach(reasons) { reasonRow($0) }
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.green.opacity(0.3), lineWidth: 1))
    }

    private func sellerRow(_ s: QualitySellerStat) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(s.sellerName ?? "Ukjent selger")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                Text("\(s.verified) verifisert · \(s.rejected) underkjent · \(s.pending) venter")
                    .font(.appScaled(size: 9)).foregroundStyle(NavPOIBrand.textSecondary)
            }
            Spacer()
            if let rate = s.qualityRate {
                let pct = Int((rate * 100).rounded())
                let tint: Color = rate >= 0.9 ? NavPOIBrand.green
                    : rate >= 0.7 ? NavPOIBrand.orange : NavPOIBrand.red
                Text("\(pct) %")
                    .font(.appScaled(size: 14, weight: .black, design: .rounded))
                    .foregroundStyle(tint).monospacedDigit()
                ZStack(alignment: .leading) {
                    Capsule().fill(NavPOIBrand.cardHi).frame(width: 74, height: 7)
                    Capsule().fill(tint).frame(width: max(5, 74 * rate), height: 7)
                }
            } else {
                Text("—").font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(NavPOIBrand.textSecondary)
            }
        }
        .padding(10)
        .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
    }

    private func reasonRow(_ r: QualityReasonStat) -> some View {
        HStack(spacing: 8) {
            Text(QualityReason(rawValue: r.reasonCode)?.label ?? r.reasonCode)
                .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(.white)
            // Pondus-kobling: årsaken peker på en trenbar dimensjon → coach der.
            if let dim = QualityReason(rawValue: r.reasonCode)?.pondusDimension {
                Text("Pondus: \(dim)")
                    .font(.appScaled(size: 8, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(NavPOIBrand.purple.opacity(0.15), in: Capsule())
            }
            Spacer()
            Text("\(r.count)")
                .font(.appScaled(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(NavPOIBrand.red).monospacedDigit()
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Verifiseringssamtalen (fullScreenCover — egen NavigationStack er lovlig her)

struct VerificationCallView: View {
    @Environment(AppState.self) private var appState
    let verification: SalesVerification
    let templates: [VerificationTemplate]
    var onDone: () -> Void

    @State private var template: VerificationTemplate?
    @State private var results: [String: String] = [:]   // questionId → ok|avvik|ikke_svart
    @State private var notes: [String: String] = [:]
    @State private var generalNote = ""
    @State private var callOutcome = "reached"
    @State private var showRejectReasons = false
    @State private var flagAsExample = false
    @State private var submitting = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    AnyView(saleCard)
                    AnyView(templatePicker)
                    if let t = template {
                        if let intro = t.introScript, !intro.isEmpty {
                            AnyView(scriptCard("Intro", intro, "quote.opening"))
                        }
                        ForEach(t.questions) { q in
                            AnyView(questionCard(q))
                        }
                        if let outro = t.outroScript, !outro.isEmpty {
                            AnyView(scriptCard("Avslutning", outro, "quote.closing"))
                        }
                    }
                    AnyView(outcomeCard)
                    AnyView(verdictButtons)
                    Color.clear.frame(height: 30)
                }
                .padding(16)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Verifiseringssamtale")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { onDone() }.foregroundStyle(NavPOIBrand.purpleLight)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            // Forvalg: mal hvis produktnavn matcher, ellers første aktive.
            if template == nil { template = templates.first(where: { $0.isActive ?? true }) }
        }
        .confirmationDialog("Årsak til underkjenning", isPresented: $showRejectReasons, titleVisibility: .visible) {
            ForEach(QualityReason.allCases, id: \.rawValue) { reason in
                Button(reason.label, role: .destructive) {
                    Task { await submit(status: "rejected", reason: reason.rawValue) }
                }
            }
            Button("Avbryt", role: .cancel) {}
        }
    }

    /// Salgsdataene kontrolløren sjekker kundens svar MOT.
    private var saleCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                Image(systemName: "doc.text.magnifyingglass").foregroundStyle(NavPOIBrand.green)
                Text("Salget som verifiseres").font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
            }
            saleRow("Kunde", verification.customerName.isEmpty ? "Ukjent" : verification.customerName)
            if let seller = verification.sellerName { saleRow("Selger", seller) }
            if let amount = verification.dealAmount {
                saleRow("Beløp", "\(Int(amount)) \(verification.dealCurrency ?? "kr")")
            }
            if let won = verification.wonAt { saleRow("Vunnet", String(won.prefix(10))) }
            if let phone = verification.customerPhone, !phone.isEmpty {
                Button {
                    let clean = phone.replacingOccurrences(of: " ", with: "")
                    if let url = URL(string: "tel://\(clean)") { UIApplication.shared.open(url) }
                } label: {
                    Label("Ring \(phone)", systemImage: "phone.fill")
                        .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(NavPOIBrand.green, in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.green.opacity(0.3), lineWidth: 1))
    }

    private func saleRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
            Spacer()
            Text(value).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
        }
    }

    private var templatePicker: some View {
        Menu {
            ForEach(templates.filter { $0.isActive ?? true }) { t in
                Button {
                    template = t; results = [:]; notes = [:]
                } label: {
                    Text(t.productName?.isEmpty == false ? "\(t.name) · \(t.productName!)" : t.name)
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "list.bullet.rectangle.portrait.fill").foregroundStyle(NavPOIBrand.purpleLight)
                Text(template?.name ?? "Velg samtale-mal")
                    .font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
            }
            .padding(11).background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        }
    }

    private func scriptCard(_ title: String, _ text: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.appScaled(size: 10, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
            Text(text).font(.appScaled(size: 13)).foregroundStyle(.white.opacity(0.92))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(NavPOIBrand.purple.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func questionCard(_ q: TemplateQuestion) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(q.question).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            if let hint = q.checkHint, !hint.isEmpty {
                Label(hint, systemImage: "checkmark.circle")
                    .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 8) {
                resultButton(q.id, "ok", "Stemmer", NavPOIBrand.green)
                resultButton(q.id, "avvik", "Avvik", NavPOIBrand.red)
                resultButton(q.id, "ikke_svart", "Ikke svart", NavPOIBrand.textSecondary)
            }
            if results[q.id] == "avvik" {
                TextField("Hva var avviket?", text: noteBinding(q.id), axis: .vertical)
                    .font(.appScaled(size: 12)).foregroundStyle(.white).padding(9)
                    .background(NavPOIBrand.red.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .padding(12)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func resultButton(_ qid: String, _ value: String, _ label: String, _ tint: Color) -> some View {
        let selected = results[qid] == value
        return Button {
            results[qid] = value
        } label: {
            Text(label).font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(selected ? .white : tint)
                .frame(maxWidth: .infinity).padding(.vertical, 8)
                .background(selected ? tint : tint.opacity(0.13), in: RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }

    private func noteBinding(_ qid: String) -> Binding<String> {
        Binding(get: { notes[qid] ?? "" }, set: { notes[qid] = $0 })
    }

    private var outcomeCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Samtaleutfall").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
            HStack(spacing: 8) {
                outcomeButton("reached", "Nådde kunden")
                outcomeButton("no_answer", "Ikke svar")
                outcomeButton("callback", "Ring tilbake")
            }
            TextField("Notat (valgfritt)", text: $generalNote, axis: .vertical)
                .font(.appScaled(size: 12)).foregroundStyle(.white).padding(10)
                .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private func outcomeButton(_ value: String, _ label: String) -> some View {
        let selected = callOutcome == value
        return Button { callOutcome = value } label: {
            Text(label).font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(selected ? .white : NavPOIBrand.purpleLight)
                .frame(maxWidth: .infinity).padding(.vertical, 8)
                .background(selected ? NavPOIBrand.purple : NavPOIBrand.purple.opacity(0.13),
                            in: RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }

    private var verdictButtons: some View {
        VStack(spacing: 9) {
            if let e = errorMsg {
                Text(e).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.red)
            }
            if hasDeviations {
                Label("Avvik registrert — vurder underkjenning eller oppfølging.",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.orange)
            }
            // «Flagg som eksempel» (2026-07-17): samtalen var lærerik →
            // backend oppretter draft i Leadbook-eksempel-køen som salgssjef
            // kuraterer og publiserer i Eksempler-fanen.
            Toggle(isOn: $flagAsExample) {
                Label("Flagg som eksempel til Leadbook",
                      systemImage: "star.bubble.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .tint(NavPOIBrand.purpleLight)
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(NavPOIBrand.stroke, lineWidth: 1))
            Button { Task { await submit(status: "verified", reason: nil) } } label: {
                verdictLabel("Verifisert — alt stemmer", "checkmark.seal.fill", NavPOIBrand.green)
            }
            .buttonStyle(.plain).disabled(submitting)
            HStack(spacing: 9) {
                Button { Task { await submit(status: "needs_followup", reason: nil) } } label: {
                    verdictLabel("Følg opp", "arrow.uturn.left.circle.fill", NavPOIBrand.orange)
                }
                .buttonStyle(.plain).disabled(submitting)
                Button { showRejectReasons = true } label: {
                    verdictLabel("Underkjenn", "xmark.seal.fill", NavPOIBrand.red)
                }
                .buttonStyle(.plain).disabled(submitting)
            }
        }
    }

    private func verdictLabel(_ text: String, _ icon: String, _ tint: Color) -> some View {
        HStack(spacing: 6) {
            if submitting { ProgressView().tint(.white) }
            else { Image(systemName: icon).font(.appScaled(size: 13, weight: .bold)) }
            Text(text).font(.appScaled(size: 13, weight: .bold))
        }
        .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
        .background(tint, in: RoundedRectangle(cornerRadius: 12))
    }

    private var hasDeviations: Bool { results.values.contains("avvik") }

    private func submit(status: String, reason: String?) async {
        // Demo: verdiktet muterer kun demo-storen (aldri backend) — køen og
        // KPI-tallene oppdateres live når vi lukker og relaster.
        if DemoModeManager.isActiveNonisolated {
            KvalitetDemoStore.shared.apply(id: verification.id, status: status, reason: reason)
            onDone()
            return
        }
        submitting = true; errorMsg = nil
        defer { submitting = false }
        let answers: [VerificationAnswer] = (template?.questions ?? []).compactMap { q in
            guard let r = results[q.id] else { return nil }
            return VerificationAnswer(questionId: q.id, question: q.question,
                                      result: r, note: notes[q.id] ?? "")
        }
        let body = QualityService.VerdictBody(
            status: status, answers: answers, reasonCode: reason,
            note: generalNote, callOutcome: callOutcome, templateId: template?.id,
            flagAsExample: flagAsExample ? true : nil)
        if let err = await QualityService.shared.submitVerdict(
            id: verification.id, body, using: appState.api) {
            errorMsg = "Kunne ikke lagre verdikt (\(err))."
            return
        }
        onDone()
    }
}

// MARK: - Mal-liste + editor (admin)

struct TemplateListSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Binding var templates: [VerificationTemplate]
    @State private var editing: VerificationTemplate?
    @State private var creatingNew = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(templates) { t in
                        Button { editing = t } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "list.bullet.rectangle.portrait.fill")
                                    .foregroundStyle(NavPOIBrand.purpleLight)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(t.name).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                                    Text(t.productName?.isEmpty == false
                                         ? "Produkt: \(t.productName!)" : "Alle produkter · \(t.questions.count) spørsmål")
                                        .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
                            }
                            .padding(12)
                            .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                    Button { creatingNew = true } label: {
                        Label("Ny mal", systemImage: "plus.circle.fill")
                            .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(NavPOIBrand.purple, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Samtale-maler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(NavPOIBrand.purpleLight)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
        .sheet(item: $editing) { t in
            TemplateEditorSheet(existing: t) { await refresh() }
        }
        .sheet(isPresented: $creatingNew) {
            TemplateEditorSheet(existing: nil) { await refresh() }
        }
    }

    private func refresh() async {
        templates = await QualityService.shared.templates(using: appState.api)
    }
}

struct TemplateEditorSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    let existing: VerificationTemplate?
    var onSaved: () async -> Void

    @State private var name = ""
    @State private var productName = ""
    @State private var intro = ""
    @State private var outro = ""
    @State private var questions: [TemplateQuestion] = []
    @State private var saving = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    field("Navn på malen", $name, "F.eks. Velkomstsamtale Fiber")
                    field("Produkt (valgfritt — matcher salget)", $productName, "F.eks. Fiber 1000")
                    scriptField("Intro — det du sier først", $intro)

                    Text("Spørsmål").font(.appScaled(size: 11, weight: .bold))
                        .foregroundStyle(NavPOIBrand.textSecondary)
                    ForEach($questions) { $q in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                TextField("Spørsmål til kunden", text: $q.question, axis: .vertical)
                                    .font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                                Button {
                                    questions.removeAll { $0.id == q.id }
                                } label: {
                                    Image(systemName: "trash").font(.appScaled(size: 12))
                                        .foregroundStyle(NavPOIBrand.red)
                                }
                                .buttonStyle(.plain)
                            }
                            TextField("Sjekk-hint: hva skal stemme mot produktet?",
                                      text: Binding(get: { q.checkHint ?? "" }, set: { q.checkHint = $0 }),
                                      axis: .vertical)
                                .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
                        }
                        .padding(11)
                        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    }
                    Button {
                        questions.append(TemplateQuestion(id: UUID().uuidString, question: "", checkHint: ""))
                    } label: {
                        Label("Legg til spørsmål", systemImage: "plus.circle")
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
                    }
                    .buttonStyle(.plain)

                    scriptField("Avslutning", $outro)

                    if let e = errorMsg {
                        Text(e).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.red)
                    }
                    Button { Task { await save() } } label: {
                        HStack(spacing: 6) {
                            if saving { ProgressView().tint(.white) }
                            Text(existing == nil ? "Opprett mal" : "Lagre endringer")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(LinearGradient(colors: [NavPOIBrand.purple, NavPOIBrand.purpleLight],
                                                   startPoint: .leading, endPoint: .trailing),
                                    in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(16)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle(existing == nil ? "Ny mal" : "Rediger mal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(NavPOIBrand.purpleLight)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            guard let t = existing else { return }
            name = t.name; productName = t.productName ?? ""
            intro = t.introScript ?? ""; outro = t.outroScript ?? ""
            questions = t.questions
        }
    }

    private func field(_ label: String, _ text: Binding<String>, _ placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
            TextField(placeholder, text: text)
                .font(.appScaled(size: 13)).foregroundStyle(.white).padding(11)
                .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        }
    }

    private func scriptField(_ label: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
            TextField("Skriv manus …", text: text, axis: .vertical)
                .lineLimit(3...8)
                .font(.appScaled(size: 12)).foregroundStyle(.white).padding(11)
                .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
        }
    }

    private func save() async {
        saving = true; errorMsg = nil
        defer { saving = false }
        let cleanQuestions = questions.filter { !$0.question.trimmingCharacters(in: .whitespaces).isEmpty }
        let ok: Bool
        if let t = existing {
            ok = await QualityService.shared.updateTemplate(
                id: t.id,
                .init(name: name, productName: productName, introScript: intro,
                      questions: cleanQuestions, outroScript: outro),
                using: appState.api)
        } else {
            ok = await QualityService.shared.createTemplate(
                .init(name: name, productName: productName, introScript: intro,
                      questions: cleanQuestions, outroScript: outro),
                using: appState.api)
        }
        if ok { await onSaved(); dismiss() }
        else { errorMsg = "Kunne ikke lagre malen (krever admin/salgssjef)." }
    }
}
