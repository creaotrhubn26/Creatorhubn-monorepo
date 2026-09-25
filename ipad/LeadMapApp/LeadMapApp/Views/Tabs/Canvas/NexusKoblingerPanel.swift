// NexusKoblingerPanel.swift
//
// «Hva henger sammen med dette notatet?»
//
// Backenden har svart på dette siden #2497, men appen har aldri spurt. Den
// utleder koblingene fra data som allerede finnes — samme kunde, samme møte,
// samme sted, samme selskap — og legger ved hvem du sannsynligvis sitter
// overfor, hentet fra Foretaksregisteret.
//
// Panelet er derfor ikke et søk. Det er en liste som allerede er riktig når
// du åpner den. Forskjellen er hele poenget: et arkiv svarer når du spør, et
// koblingspunkt har svaret klart.
//
// Å dra et notat herfra og ut på flata gjør det til et levende kort — se
// NexusNotatKort. Lenken blir da eksplisitt, og synlig fra begge sider.

import SwiftUI

@MainActor
@Observable
final class NexusKoblingerStore {
    fileprivate(set) var koblinger: [NexusKoblingDTO] = []
    fileprivate(set) var personer: [NexusPersonDTO] = []
    private(set) var laster = false
    private(set) var feil: String?

    /// Notatet lista gjelder. Bytter den, er innholdet ugyldig.
    private var forNotatId: String?

    #if DEBUG
    /// Designflaten (NexusVisning) setter disse for å vise panelet uten
    /// nettverk. Finnes ikke i release.
    var demoKoblinger: [NexusKoblingDTO] = [] {
        didSet { koblinger = demoKoblinger }
    }
    var demoPersoner: [NexusPersonDTO] = [] {
        didSet { personer = demoPersoner }
    }
    #endif

    func last(notatId: String, projectId: String, api: APIClient?) async {
        guard let api else { return }
        if forNotatId != notatId {
            koblinger = []; personer = []; forNotatId = notatId
        }
        laster = true; feil = nil
        do {
            let svar = try await api.hentCanvasKoblinger(
                notatId: notatId, projectId: projectId)
            koblinger = svar.koblinger
            personer = svar.personer
        } catch {
            // Et notat skal kunne åpnes selv om koblingene ikke kan hentes.
            feil = "Fikk ikke hentet koblingene."
        }
        laster = false
    }
}

/// Hvorfor en kobling dukket opp. En kobling uten begrunnelse er støy, så
/// kilden får både ikon og farge — man skal kunne skumme lista.
private func kildeIkon(_ kilde: String) -> String {
    switch kilde {
    case "lead": return "person.crop.rectangle.stack.fill"
    case "mote": return "person.2.wave.2.fill"
    case "sted": return "mappin.and.ellipse"
    case "selskap": return "building.2.fill"
    case "manuell": return "link"
    default: return "circle"
    }
}

private func kildeFarge(_ kilde: String) -> Color {
    switch kilde {
    case "lead": return CvBrand.orange
    case "mote": return CvBrand.purpleLight
    case "sted": return CvBrand.green
    case "selskap": return CvBrand.blue
    case "manuell": return CvBrand.yellow
    default: return CvBrand.textSecondary
    }
}

struct NexusKoblingerPanel: View {
    let store: NexusKoblingerStore
    /// Dra ut på flata — eller tapp for å legge til.
    let leggPaaFlata: (NexusKoblingDTO) -> Void
    let apne: (NexusKoblingDTO) -> Void

    var body: some View {
        List {
            if !store.personer.isEmpty {
                Section {
                    ForEach(store.personer) { p in
                        HStack(spacing: 11) {
                            Image(systemName: "person.crop.circle.fill")
                                .foregroundStyle(CvBrand.purpleLight)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.navn)
                                    .font(.appScaled(size: 15, weight: .semibold))
                                Text(p.rolle)
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(CvBrand.textSecondary)
                            }
                        }
                        .frame(minHeight: 44)
                        .listRowBackground(CvBrand.card)
                    }
                } header: {
                    Text("Sannsynlig i rommet")
                } footer: {
                    // Sier hvor det kommer fra, så ingen tror vi har gjettet.
                    Text("Daglig leder og styret, fra Foretaksregisteret.")
                }
            }

            Section {
                if store.laster && store.koblinger.isEmpty {
                    // Skjelett, ikke spinner: lista har en form, og formen
                    // skal ikke forsvinne mens innholdet kommer.
                    ForEach(0..<3, id: \.self) { i in
                        HStack(spacing: 11) {
                            Circle().fill(Color.white.opacity(0.07))
                                .frame(width: 20, height: 20)
                            VStack(alignment: .leading, spacing: 6) {
                                Capsule().fill(Color.white.opacity(0.07))
                                    .frame(width: [180.0, 140.0, 165.0][i], height: 9)
                                Capsule().fill(Color.white.opacity(0.05))
                                    .frame(width: [90.0, 120.0, 70.0][i], height: 7)
                            }
                        }
                        .frame(minHeight: 44)
                        .accessibilityHidden(true)
                    }
                } else if let feil = store.feil {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(feil)
                            .font(.appScaled(size: 14, weight: .semibold))
                        Text("Notatet er trygt. Lukk og åpne panelet igjen "
                             + "når du har dekning.")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(CvBrand.textSecondary)
                    }
                    .padding(.vertical, 4)
                } else if store.koblinger.isEmpty {
                    // Tom er en ekte tilstand, ikke en feil.
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ingenting koblet ennå")
                            .font(.appScaled(size: 14, weight: .semibold))
                        Text("Knytt notatet til et lead, eller skriv det på "
                             + "samme sted som et annet notat, så dukker de "
                             + "opp her av seg selv.")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(CvBrand.textSecondary)
                    }
                    .padding(.vertical, 4)
                } else {
                    ForEach(store.koblinger) { k in
                        HStack(spacing: 12) {
                            Button { apne(k) } label: {
                                HStack(spacing: 11) {
                                    // Ikonet bærer kilden. Fargen er det
                                    // eneste mettede i raden, og den betyr
                                    // noe: hvorfor dukket denne opp?
                                    Image(systemName: kildeIkon(k.kilde))
                                        .font(.appScaled(size: 14, weight: .semibold))
                                        .foregroundStyle(kildeFarge(k.kilde))
                                        .frame(width: 26)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(k.tittel)
                                            .font(.appScaled(size: 15, weight: .semibold))
                                            .lineLimit(1)
                                        Text(k.begrunnelse)
                                            .font(.appScaled(size: 12))
                                            .foregroundStyle(CvBrand.textSecondary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            if k.type == "notat" {
                                // Bare notater kan bo på flata. Knappen er
                                // 44×44 — den treffes stående, med hanske.
                                Button { leggPaaFlata(k) } label: {
                                    Image(systemName: "plus.rectangle.on.rectangle")
                                        .font(.appScaled(size: 16, weight: .semibold))
                                        .foregroundStyle(CvBrand.purpleLight)
                                        .frame(width: 44, height: 44)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Legg «\(k.tittel)» på flata")
                            }
                        }
                        // Dra rett ut på flata. Knappen gjør det samme for
                        // den som ikke oppdager draget — to veier til samme
                        // sted, ingen av dem skjult.
                        .draggable(k.id) {
                            Label(k.tittel, systemImage: "doc.text.fill")
                        }
                        .listRowBackground(CvBrand.card)
                    }
                }
            } header: {
                Text("Funnet av seg selv")
            } footer: {
                if !store.koblinger.isEmpty {
                    Text("Utledet fra kunde, sted og møte. Ingenting av dette "
                         + "er skrevet inn for hånd.")
                }
            }
        }
        .listStyle(.insetGrouped)
        // Appens palett, ikke systemets: panelet ligger oppå Nexus-flata og
        // skal høre til der. Uten dette blir lista nesten svart mot den
        // lilla-tonede bakgrunnen.
        .scrollContentBackground(.hidden)
        .background(CvBrand.bg)
        .environment(\.defaultMinListRowHeight, 44)
    }
}
