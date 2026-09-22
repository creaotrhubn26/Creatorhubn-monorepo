import SwiftUI

/// «Vi fant flere adresser som passer — hvilken er riktig?»
///
/// Systemet plasserer selv når adressen er entydig. Når den ikke er det,
/// gjetter det ikke: en pin i feil kommune ser like riktig ut som en riktig
/// pin, og selgeren oppdager det først når hen står der. Svaret herfra er
/// fasit, også for neste lead på samme adresse.
struct LeadPlacementVerifySheet: View {
    let leads: [AmbiguousLeadPlacement]
    let onVelg: (AmbiguousLeadPlacement, LeadPlacementOption) -> Void
    let onHoppOver: (AmbiguousLeadPlacement) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var behandlede: Set<String> = []

    private var gjenstående: [AmbiguousLeadPlacement] {
        leads.filter { !behandlede.contains($0.leadId) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if gjenstående.isEmpty {
                    ContentUnavailableView(
                        "Alle er plassert",
                        systemImage: "checkmark.circle",
                        description: Text("Bedriftene vises nå på kartet."))
                } else {
                    List {
                        ForEach(gjenstående) { lead in
                            Section {
                                ForEach(lead.options) { option in
                                    Button {
                                        behandlede.insert(lead.leadId)
                                        onVelg(lead, option)
                                        if gjenstående.isEmpty { dismiss() }
                                    } label: {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(option.label)
                                                .font(.body.weight(.semibold))
                                            if let kommune = option.municipality {
                                                Text(kommune)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .frame(minHeight: 44)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                }
                                Button("Ingen av disse") {
                                    behandlede.insert(lead.leadId)
                                    onHoppOver(lead)
                                    if gjenstående.isEmpty { dismiss() }
                                }
                                .frame(minHeight: 44)
                                .foregroundStyle(.secondary)
                            } header: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(lead.name)
                                    if let adresse = lead.address {
                                        Text("Registrert adresse: \(adresse)")
                                            .font(.caption2)
                                            .textCase(nil)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Hvilken adresse er riktig?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
        .accessibilityIdentifier("kart.placement.verify")
    }
}
