// ProjectPicker.swift
//
// Verkkostet toolbar-picker: hvilken bedrift jobber jeg for nå?
// Tap → action sheet med prosjekter + 'Alle leads'-fjern-alternativ.

import SwiftUI

struct ProjectPicker: View {
    @Environment(AppState.self) private var appState
    @State private var sheetShown = false

    var body: some View {
        Button {
            sheetShown = true
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "folder.fill")
                    .font(.caption.bold())
                Text(currentLabel)
                    .font(.caption.bold())
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption2)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.purple.opacity(0.18), in: Capsule())
            .foregroundStyle(.purple)
        }
        .confirmationDialog("Velg prosjekt", isPresented: $sheetShown) {
            Button("Alle leads (uten filter)") {
                appState.activeProjectId = nil
            }
            ForEach(appState.projects) { project in
                Button(project.name) {
                    appState.activeProjectId = project.id
                }
            }
            Button("Avbryt", role: .cancel) {}
        } message: {
            Text("Hvilken bedrift jobber du for?")
        }
    }

    private var currentLabel: String {
        if let id = appState.activeProjectId,
           let project = appState.projects.first(where: { $0.id == id }) {
            return project.name
        }
        return "Alle leads"
    }
}

/// Stort prosjekt-kort som speil-vises i web-versjonen. Vises på
/// Map-tabben øverst når aktivt prosjekt er valgt.
struct ProjectContextCard: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        if let summary = appState.activeProjectSummary {
            content(for: summary)
                .padding(.horizontal, 12)
        }
    }

    @ViewBuilder
    private func content(for summary: ProjectSummary) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Bedrifts-logo eller fallback til initialer
            Group {
                if let urlStr = summary.brandKit?.logoUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fit).padding(4)
                        default:
                            Text(summary.project.name.prefix(2).uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.purple)
                        }
                    }
                    .frame(width: 44, height: 44)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    Text(summary.project.name.prefix(2).uppercased())
                        .font(.caption.bold())
                        .foregroundStyle(.purple)
                        .frame(width: 44, height: 44)
                        .background(Color.purple.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(summary.project.name)
                    .font(.subheadline.bold())
                if let pos = summary.brandKit?.positioningSummary {
                    Text(pos)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                HStack(spacing: 8) {
                    Label("\(summary.leads.total)", systemImage: "person.crop.circle")
                        .font(.caption2)
                        .foregroundStyle(.yellow)
                    Label("\(summary.competitorCount)", systemImage: "diamond")
                        .font(.caption2)
                        .foregroundStyle(.red)
                    if let conf = summary.marketScan?.confidence {
                        Label(conf.capitalized, systemImage: "checkmark.shield")
                            .font(.caption2)
                            .foregroundStyle(.green)
                    }
                }
            }
            Spacer()
        }
        .padding(10)
        .background(Color.purple.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.purple.opacity(0.32), lineWidth: 1)
        )
    }
}
