// LoadingProjectCard.swift
//
// Skeleton-placeholder for MapProjectCard mens fetchProjects pågår.
//
// Bug-historikk:
//   PR #993 introduserte multi-prosjekt-swipe på MapProjectCard. Den viste
//   `ProjectCardEmptyState` («Ingen prosjekter ennå») hvis `projects.isEmpty`,
//   men ved app-start er listen tom inntil fetch returnerer → brukeren så
//   empty-state i 1-2 sek selv om de hadde 4 prosjekter (MedSide, Talkit,
//   Holy Crust, Creatorhub Norge).
//
//   Denne viewen erstatter empty-state-kortet i .loading-fasen — samme
//   størrelse + brand-gradient, men med skeleton-bars og en diskret
//   shimmer-animasjon så det er klart at noe pågår, ikke at det er tomt.

import SwiftUI

/// Skeleton-placeholder som matcher MapProjectCard sin størrelse + branding.
/// Vises mens `appState.projectsLoadState == .loading` (eller `.idle`).
struct LoadingProjectCard: View {
    /// Shimmer-fase 0→1 som driver gradient-offsettet. Bruker @State +
    /// withAnimation for å gå frem-og-tilbake i en evig loop.
    @State private var shimmerPhase: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header-rad: logo-rute + tittel + status-pille
            HStack(alignment: .center, spacing: 10) {
                shimmerBar()
                    .frame(width: 38, height: 38)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 6) {
                    shimmerBar()
                        .frame(width: 140, height: 14)
                        .clipShape(Capsule())
                    shimmerBar()
                        .frame(width: 90, height: 10)
                        .clipShape(Capsule())
                }
                Spacer(minLength: 8)
                // ProgressView gjør det entydig at vi laster
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
                    .scaleEffect(0.85)
            }

            // Status-tekst — eksplisitt for screen-readers + tydelighet
            Text("Henter prosjekter…")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.85))
                .accessibilityLabel("Henter prosjekter")

            // Status-linje skeleton
            HStack(spacing: 10) {
                shimmerBar()
                    .frame(width: 110, height: 12)
                    .clipShape(Capsule())
                shimmerBar()
                    .frame(width: 90, height: 12)
                    .clipShape(Capsule())
                Spacer(minLength: 0)
            }

            // Neste-stopp skeleton
            HStack(spacing: 8) {
                shimmerBar()
                    .frame(width: 16, height: 16)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    shimmerBar()
                        .frame(width: 160, height: 10)
                        .clipShape(Capsule())
                    shimmerBar()
                        .frame(width: 80, height: 8)
                        .clipShape(Capsule())
                }
                Spacer(minLength: 0)
            }
            .padding(8)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))

            // CTA-rad skeleton
            HStack(spacing: 8) {
                shimmerBar()
                    .frame(maxWidth: .infinity)
                    .frame(height: 28)
                    .clipShape(Capsule())
                shimmerBar()
                    .frame(maxWidth: .infinity)
                    .frame(height: 28)
                    .clipShape(Capsule())
            }

            // Drag-handle — samme visuelle hint som det ekte kortet
            Capsule()
                .fill(Color.white.opacity(0.25))
                .frame(width: 36, height: 4)
                .frame(maxWidth: .infinity)
                .padding(.top, 2)
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Henter prosjekter")
        .accessibilityHint("Et øyeblikk mens vi henter dine prosjekter")
        .onAppear {
            // Start shimmer-loop. .repeatForever gjør den evig fram-tilbake.
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                shimmerPhase = 1
            }
        }
    }

    /// Skeleton-bar med shimmer-overlay. Skjønnsom og brand-konsistent —
    /// bare en mørkere skygge på det allerede mørke lilla-gradient-kortet.
    @ViewBuilder
    private func shimmerBar() -> some View {
        Rectangle()
            .fill(Color.white.opacity(0.12))
            .overlay(
                // Lys gradient som drifter til høyre = shimmer
                LinearGradient(
                    colors: [
                        Color.clear,
                        Color.white.opacity(0.28),
                        Color.clear
                    ],
                    startPoint: UnitPoint(x: shimmerPhase - 0.3, y: 0.5),
                    endPoint: UnitPoint(x: shimmerPhase + 0.3, y: 0.5)
                )
            )
    }
}

#Preview {
    LoadingProjectCard()
        .frame(height: 200)
        .padding(.horizontal, 12)
        .background(Color.black)
}
