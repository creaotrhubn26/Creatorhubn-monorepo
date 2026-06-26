// ErrorProjectCard.swift
//
// Kompakt error-banner som erstatter MapProjectCard når fetchProjects feiler
// (network down, 401, server-500 osv). Samme størrelse + brand-gradient som
// LoadingProjectCard og MapProjectCard, men med ikon + kort feilmelding +
// «Prøv igjen»-knapp.

import SwiftUI

/// Vises i MapProjectCard sin posisjon hvis `appState.projectsLoadState`
/// er `.failed(...)`. Gir brukeren en synlig retry — ellers blir et
/// nettverkshikk usynlig (vi har ikke en global error-banner i Lead Map).
struct ErrorProjectCard: View {
    /// Lokalisert feilmelding fra fetchProjects (typisk URLError eller
    /// HTTP-status). Vi viser den under hoved-teksten.
    let message: String
    /// Caller starter en ny fetchProjects (typisk `Task { await appState.refreshAll() }`).
    var onRetry: () -> Void

    @State private var isRetrying = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Color.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Kunne ikke laste prosjekter")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(shortMessage)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.75))
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }

            // Retry-knapp — full-bredde så den er enkel å treffe.
            Button {
                guard !isRetrying else { return }
                isRetrying = true
                onRetry()
                // Reset etter 2s — gir visuell feedback uten å låse knappen
                // permanent hvis retry henger.
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    isRetrying = false
                }
            } label: {
                HStack(spacing: 6) {
                    if isRetrying {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(Color(red: 0.36, green: 0.18, blue: 0.62))
                            .scaleEffect(0.75)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                    Text(isRetrying ? "Prøver…" : "Prøv igjen")
                }
                .font(.caption.bold())
                .padding(.horizontal, 12).padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(Color.white, in: Capsule())
                .foregroundStyle(Color(red: 0.36, green: 0.18, blue: 0.62))
            }
            .buttonStyle(.plain)
            .disabled(isRetrying)
            .accessibilityLabel("Prøv å laste prosjekter på nytt")

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.36, green: 0.18, blue: 0.62).opacity(0.92),
                    Color(red: 0.18, green: 0.08, blue: 0.38).opacity(0.96)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 8, x: 0, y: 4)
        .accessibilityElement(children: .contain)
    }

    /// Trim eventuelle lange URLError-beskrivelser ned til noe leselig.
    /// Hvis det er tomt eller stack-trace-aktig, fall til en generisk tekst.
    private var shortMessage: String {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Sjekk forbindelsen og prøv igjen." }
        if trimmed.count > 120 { return String(trimmed.prefix(117)) + "…" }
        return trimmed
    }
}

#Preview {
    ErrorProjectCard(
        message: "Nettverket er ikke tilgjengelig",
        onRetry: {}
    )
    .frame(height: 200)
    .padding(.horizontal, 12)
    .background(Color.black)
}
