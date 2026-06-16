// StrategySheet.swift
//
// Claude-anbefalt outreach-strategi for én lead. Speilbilde av web-
// dialogen i frontend/client (PR #586) — refleksjons-banner ØVERST
// (per Daniels feedback "tenk selv først"), så Claude-resultat.

import SwiftUI

struct StrategySheet: View {
    let lead: LeadModel
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var strategy: StrategyModel?
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    reflectionBanner
                    if loading {
                        VStack(spacing: 10) {
                            ProgressView()
                            Text("Claude analyserer leaden og bygger strategi …")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                    } else if let strategy {
                        primaryChannelCard(strategy)
                        openingLineCard(strategy)
                        sequenceList(strategy)
                        rationaleCard(strategy)
                    } else if let errorMessage {
                        ContentUnavailableView(
                            "Klarte ikke generere",
                            systemImage: "exclamationmark.triangle",
                            description: Text(errorMessage)
                        )
                        .padding(.vertical, 20)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .navigationTitle("Strategi: \(lead.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Lukk") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await generate() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(loading)
                }
            }
            .task {
                if strategy == nil { await generate() }
            }
        }
    }

    // MARK: - Sections

    private var reflectionBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Tenk selv først", systemImage: "brain.head.profile")
                .font(.caption.bold())
                .foregroundStyle(.yellow)
                .textCase(.uppercase)

            Text("AI er en hjelper, ikke fasit. Still deg disse spørsmålene før du følger anbefalingen:")
                .font(.subheadline)

            VStack(alignment: .leading, spacing: 4) {
                bulletQuestion("1.", "Hvor godt kjenner du kunden? Har du møtt dem, eller bare sett profilen?")
                bulletQuestion("2.", "Hva er deres faktiske problem du løser — har du belegg for det?")
                bulletQuestion("3.", "Hvorfor skulle de svare nettopp nå? Hva har endret seg?")
                bulletQuestion("4.", "Hva er ditt klare mål med kontakten — booke møte, avklare interesse, eller noe annet?")
                bulletQuestion("5.", "Hva er den ene tingen ved akkurat denne leaden som AI ikke vet, men du gjør?")
            }
            .padding(.top, 4)
        }
        .padding(14)
        .background(Color.yellow.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.yellow.opacity(0.32), lineWidth: 1)
        )
    }

    private func bulletQuestion(_ num: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(num).font(.caption.bold()).foregroundStyle(.secondary)
            Text(text).font(.caption).foregroundStyle(.primary)
        }
    }

    private func primaryChannelCard(_ s: StrategyModel) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                Image(systemName: channelIcon(s.primaryChannel))
                    .font(.title)
                    .foregroundStyle(.tint)
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text("PRIMÆR-KANAL")
                        .font(.caption2.bold())
                        .foregroundStyle(.tint)
                    Text(s.primaryChannel.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.title3.bold())
                    Text("Beste tid: \(s.bestTime)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                confidenceChip(s.confidence)
            }
            if !s.secondaryChannels.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(s.secondaryChannels, id: \.rawValue) { c in
                            Text(c.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.purple.opacity(0.12))
                                .foregroundStyle(.purple)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(Color.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.purple.opacity(0.32), lineWidth: 1)
        )
    }

    private func openingLineCard(_ s: StrategyModel) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("ÅPNINGSLINJE")
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    UIPasteboard.general.string = s.openingLine
                } label: {
                    Image(systemName: "doc.on.doc")
                        .foregroundStyle(.secondary)
                }
            }
            Text("\"\(s.openingLine)\"")
                .font(.body.italic())
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private func sequenceList(_ s: StrategyModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OPPFØLGINGS-SEKVENS (\(s.sequence.count) trinn)")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            ForEach(Array(s.sequence.enumerated()), id: \.offset) { _, step in
                sequenceStep(step)
            }
        }
    }

    private func sequenceStep(_ step: OutreachStep) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(step.day == 0 ? "I dag" : "+\(step.day)d")
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(step.day == 0 ? Color.yellow.opacity(0.18) : Color.purple.opacity(0.12))
                    .foregroundStyle(step.day == 0 ? .yellow : .purple)
                    .clipShape(Capsule())
                Text(step.channel.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.purple.opacity(0.12))
                    .foregroundStyle(.purple)
                    .clipShape(Capsule())
                Spacer()
                Button {
                    UIPasteboard.general.string = step.template
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Text(step.action)
                .font(.subheadline.bold())
            Text(step.template)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    private func rationaleCard(_ s: StrategyModel) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Hvorfor denne strategien?", systemImage: "lightbulb")
                .font(.caption.bold())
                .foregroundStyle(.blue)
                .textCase(.uppercase)
            Text(s.rationale)
                .font(.subheadline)
        }
        .padding(14)
        .background(Color.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.blue.opacity(0.32), lineWidth: 1)
        )
    }

    private func confidenceChip(_ confidence: String) -> some View {
        let color: Color = switch confidence {
        case "high": .green
        case "medium": .yellow
        default: .gray
        }
        return Text(confidence)
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    // MARK: - Helpers

    private func channelIcon(_ channel: OutreachChannel) -> String {
        switch channel {
        case .coldCall, .sms: return "phone.fill"
        case .email: return "envelope.fill"
        case .instagramDm: return "camera.fill"
        case .linkedin: return "person.crop.rectangle.fill"
        case .inPerson: return "figure.wave"
        case .socialProof: return "person.3.fill"
        case .googleMyBusinessReview: return "star.fill"
        }
    }

    private func generate() async {
        guard let api = appState.api else { return }
        loading = true
        errorMessage = nil
        strategy = nil
        do {
            self.strategy = try await api.generateStrategy(leadId: lead.id)
        } catch {
            errorMessage = "Uventet feil: \(error.localizedDescription)"
        }
        loading = false
    }
}
