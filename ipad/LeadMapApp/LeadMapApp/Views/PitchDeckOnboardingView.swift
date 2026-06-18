// PitchDeckOnboardingView.swift
//
// 5-stegs wizard som mater POST /pitch-deck/decks/onboard. Hvert steg
// er ett spørsmål som har en åpenbar plassering i salgsmøtet:
//
//   1. Industri              → bestemmer ton + sjargong
//   2. Hva selger dere?      → én skarp setning, blir cover-claimet
//   3. Målgruppe             → driver hvem solution-sliden adresserer
//   4. Tre kunde-smerter     → blir problem/insight/solution-arc
//   5. Tre differensiatorer  → blir differentiator/proof-arc
//   6. Tre proof-points      → konkrete tall/kunder/sertifikater
//
// Wizardet er bevisst tregt — vi vil at salgssjefen bruker 5 min på
// å være presis. Hvert steg har én tekstfelt + et lite eksempel som
// inspirerer uten å diktere. Etter siste steg fyrer vi onboard +
// navigerer til Studio når deck-status er 'ready'.
//
// Habit-anchor: nederste seksjon på alle steg viser "hvorfor dette
// blir bedre" — så brukeren føler at hen investerer i et verktøy
// som blir skarpere etter hvert som hen bruker det.

import SwiftUI

struct PitchDeckOnboardingView: View {
    let organizationId: String
    let onboarded: (PitchDeckBundle) -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var step: Int = 0
    @State private var industry: String = ""
    @State private var oneLiner: String = ""
    @State private var targetCustomer: String = ""
    @State private var pains: [String] = ["", "", ""]
    @State private var differentiators: [String] = ["", "", ""]
    @State private var proofPoints: [String] = ["", "", ""]
    @State private var locale: String = "nb"

    @State private var format: String = "long"   // "long" (11) | "short" (10)
    @State private var websiteUrl: String = ""
    @State private var isGenerating = false
    @State private var error: String?

    private static let totalSteps = 6

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                progressBar
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        stepContent
                            .padding(.top, 32)
                        Spacer(minLength: 16)
                        whyItGetsBetter
                    }
                    .padding(.horizontal, 32)
                    .padding(.bottom, 32)
                }
                navigation
            }
            .background(
                BrandedHeroBackground(.backdrop3, darkenFrom: 0.55, darkenTo: 0.97)
                    .ignoresSafeArea()
            )
            .navigationTitle("Nytt pitch deck")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt", role: .cancel) { dismiss() }
                }
            }
            .alert("Generering feilet", isPresented: errorBinding) {
                Button("OK") { error = nil }
            } message: {
                Text(error ?? "")
            }
            .overlay {
                if isGenerating { generatingOverlay }
            }
        }
    }

    // MARK: - Progressbar

    private var progressBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(0..<Self.totalSteps, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? Color.accentColor : Color.secondary.opacity(0.2))
                        .frame(height: 4)
                }
            }
            HStack {
                Text("Steg \(step + 1) av \(Self.totalSteps)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
            }
        }
        .padding(.horizontal, 32)
        .padding(.top, 8)
    }

    // MARK: - Steg-innhold

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: industryStep
        case 1: oneLinerStep
        case 2: targetCustomerStep
        case 3: painsStep
        case 4: differentiatorsStep
        default: proofPointsStep
        }
    }

    private var industryStep: some View {
        StepShell(
            kicker: "1 av 6",
            title: "Hvilken bransje er dere i?",
            help: "Bestemmer tonen Claude bruker. Vær mer presis enn én sektor — «sosial-media-byrå» slår «markedsføring»."
        ) {
            TextField("F.eks. SaaS-personalisering for e-handel", text: $industry, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...4)
            ExampleHint(
                examples: ["B2B-SaaS for HR-team",
                           "Digital-byrå spesialisert på fashion",
                           "Helsetech for kommune-helsetjenester"]
            )
            // Format-switcher + website (auto-cover-fetch). Plassert
            // inline i steg 1 så de ikke tar et helt eget steg.
            VStack(alignment: .leading, spacing: 10) {
                Text("Lengde")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Picker("Format", selection: $format) {
                    Text("Master (11 slides)").tag("long")
                    Text("Kort (10 slides)").tag("short")
                }
                .pickerStyle(.segmented)
                Text(format == "short"
                     ? "For salgsmøter. Drop core_features siden før/etter dekker det."
                     : "Full fortelling. Bruk når du har 15+ min m/ kunden.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
            VStack(alignment: .leading, spacing: 6) {
                Text("Bedriftens nettside (valgfritt)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                TextField("https://eksempel.no", text: $websiteUrl)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                Text("Vi henter logo + tagline til cover-sliden automatisk.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
        }
    }

    private var oneLinerStep: some View {
        StepShell(
            kicker: "2 av 6",
            title: "Hva selger dere — i én setning?",
            help: "Dette blir cover-claimet. Vær spesifikk; «vi hjelper bedrifter» er for vagt."
        ) {
            TextField("F.eks. Vi gjør at HR-team ansetter 40% raskere", text: $oneLiner, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...5)
            ExampleHint(
                examples: ["Plattformen som lar e-handlere personalisere uten devs",
                           "AI-skribenten som forfatter pressemeldinger i farger fra brand-kit'et",
                           "Den eneste DAW'en med real-time samarbeid for orkestrale sessions"]
            )
        }
    }

    private var targetCustomerStep: some View {
        StepShell(
            kicker: "3 av 6",
            title: "Hvem kjøper dette?",
            help: "Beskriv kjøperen — ikke sluttbrukeren. Inkludér tittel + størrelse hvis det skiller seg."
        ) {
            TextField("F.eks. Talent-acquisition-manager i selskap m/ 200+ ansatte", text: $targetCustomer, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...5)
            ExampleHint(
                examples: ["VP Marketing i scale-ups, 50–500 ansatte",
                           "CMO i klesmerker med >10 butikker"]
            )
        }
    }

    private var painsStep: some View {
        StepShell(
            kicker: "4 av 6",
            title: "Hvilke tre kjøpe-smerter løser dere?",
            help: "Skriv det kunden selv ville sagt høyt. Ikke «mangler digital transformasjon». Mer «vi mister kandidater til konkurrenter på 3 dager»."
        ) {
            ForEach(0..<3, id: \.self) { i in
                TextField("Smerte \(i + 1)", text: $pains[i], axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...3)
            }
        }
    }

    private var differentiatorsStep: some View {
        StepShell(
            kicker: "5 av 6",
            title: "Hva gjør dere som konkurrentene ikke gjør?",
            help: "Tre konkrete forskjeller. Hvis ditt eneste differensieringspunkt er «pris» eller «service», så er det ingen differensiering."
        ) {
            ForEach(0..<3, id: \.self) { i in
                TextField("Differensiator \(i + 1)", text: $differentiators[i], axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...3)
            }
        }
    }

    private var proofPointsStep: some View {
        StepShell(
            kicker: "6 av 6",
            title: "Hva beviser at det funker?",
            help: "Tall, navn på kunder, sertifiseringer. Konkrete bevis Claude kan sitere — ikke generaliseringer."
        ) {
            ForEach(0..<3, id: \.self) { i in
                TextField("Bevis \(i + 1)", text: $proofPoints[i], axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...3)
            }
        }
    }

    // MARK: - Hvorfor det blir bedre

    private var whyItGetsBetter: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Dette gjør pitchen bedre over tid", systemImage: "arrow.up.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text("Hver gang du eller en kollega regenererer en slide, beholder vi konteksten du oppga her. Dere kan låse slides dere er fornøyde med — Claude rører dem ikke. Etter første presentasjonsrunde anbefaler vi å regenerere de slidene som ikke landet.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Navigasjon

    private var navigation: some View {
        HStack {
            if step > 0 {
                Button {
                    withAnimation { step -= 1 }
                } label: {
                    Label("Tilbake", systemImage: "chevron.left")
                }
                .buttonStyle(.bordered)
            }
            Spacer()
            if step < Self.totalSteps - 1 {
                Button {
                    withAnimation { step += 1 }
                } label: {
                    Label("Neste", systemImage: "chevron.right")
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canAdvance)
            } else {
                Button {
                    Task { await onboard() }
                } label: {
                    Label("Generér pitch", systemImage: "arrow.right.circle.fill")
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canAdvance || isGenerating)
            }
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 16)
        .background(.bar)
    }

    private var canAdvance: Bool {
        switch step {
        case 0: return industry.trimmingCharacters(in: .whitespaces).count > 1
        case 1: return oneLiner.trimmingCharacters(in: .whitespaces).count > 4
        case 2: return targetCustomer.trimmingCharacters(in: .whitespaces).count > 4
        case 3: return pains.allSatisfy { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        case 4: return differentiators.allSatisfy { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        default: return proofPoints.allSatisfy { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        }
    }

    // MARK: - Generering

    private var generatingOverlay: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView().controlSize(.large).tint(.white)
                Text("Claude bygger 9 slides …")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text("~15–25 sekunder")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(32)
            .background(Color.black.opacity(0.85),
                        in: RoundedRectangle(cornerRadius: 20))
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { error != nil },
            set: { if !$0 { error = nil } }
        )
    }

    private func onboard() async {
        guard let api = appState.api else {
            error = "Mangler API-klient. Logg inn på nytt."
            return
        }
        let payload = PitchOnboardingPayload(
            organizationId: organizationId,
            name: "Master pitch",
            industry: industry.trimmingCharacters(in: .whitespaces),
            oneLiner: oneLiner.trimmingCharacters(in: .whitespaces),
            targetCustomer: targetCustomer.trimmingCharacters(in: .whitespaces),
            pains: pains.map { $0.trimmingCharacters(in: .whitespaces) },
            differentiators: differentiators.map { $0.trimmingCharacters(in: .whitespaces) },
            proofPoints: proofPoints.map { $0.trimmingCharacters(in: .whitespaces) },
            locale: locale,
            format: format,
            websiteUrl: websiteUrl.trimmingCharacters(in: .whitespaces).isEmpty
                ? nil : websiteUrl.trimmingCharacters(in: .whitespaces)
        )
        isGenerating = true
        defer { isGenerating = false }
        do {
            let bundle = try await api.onboardPitchDeck(payload: payload)
            onboarded(bundle)
            dismiss()
        } catch {
            self.error = String(describing: error)
        }
    }
}

// MARK: - StepShell

private struct StepShell<Content: View>: View {
    let kicker: String
    let title: String
    let help: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(kicker)
                .font(.caption.weight(.bold))
                .foregroundStyle(.tint)
                .textCase(.uppercase)
            Text(title)
                .font(.largeTitle.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            Text(help)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: 12) { content() }
                .padding(.top, 12)
        }
    }
}

// MARK: - ExampleHint

private struct ExampleHint: View {
    let examples: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Eksempler")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            ForEach(examples, id: \.self) { ex in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "quote.opening")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    Text(ex).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06),
                    in: RoundedRectangle(cornerRadius: 10))
    }
}
