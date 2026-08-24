// GearProfileView.swift — brukeren registrerer kamerahus + objektiver.
// Anbefalingene klippes til det brukeren faktisk eier.

import SwiftUI

struct GearProfileView: View {
    @Environment(AppModel.self) private var model
    @State private var newName = ""
    @State private var newMin = ""
    @State private var newMax = ""

    private var gear: GearStore { model.gear }

    var body: some View {
        Form {
            Section("Kamerahus") {
                Picker("Type", selection: Binding(
                    get: { gear.body },
                    set: { gear.body = $0 }
                )) {
                    ForEach(BodyKind.allCases, id: \.self) { kind in
                        Text("\(kind.label) · \(String(format: "%.1f", kind.cropFactor))×").tag(kind)
                    }
                }
                Text("Crop-faktor gir mer rekkevidde: 400 mm på et \(String(format: "%.1f", gear.body.cropFactor))×-hus tilsvarer \(Int(400 * gear.body.cropFactor)) mm på fullformat.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Objektiver") {
                ForEach(gear.lenses) { lens in
                    HStack {
                        Image(systemName: "camera.aperture").foregroundStyle(Theme.primaryBright)
                        Text(lens.name)
                        Spacer()
                        Text(lens.minMm == lens.maxMm ? "\(lens.minMm) mm" : "\(lens.minMm)–\(lens.maxMm) mm")
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete { gear.lenses.remove(atOffsets: $0) }

                VStack(spacing: 8) {
                    TextField("Navn (f.eks. RF 100–500mm)", text: $newName)
                    HStack {
                        TextField("Min mm", text: $newMin).keyboardType(.numberPad)
                        TextField("Maks mm", text: $newMax).keyboardType(.numberPad)
                        Button {
                            addLens()
                        } label: { Image(systemName: "plus.circle.fill") }
                            .disabled(!canAdd)
                    }
                }
            }

            if gear.hasGear, let range = gear.ownedLensRange {
                Section {
                    Label("Du dekker \(range.lowerBound)–\(range.upperBound) mm (\(Int(Double(range.upperBound) * gear.body.cropFactor)) mm ekvivalent)",
                          systemImage: "checkmark.seal.fill")
                        .foregroundStyle(Theme.success)
                        .font(.subheadline)
                }
            }
        }
        .navigationTitle("Mitt utstyr")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var canAdd: Bool {
        !newName.trimmingCharacters(in: .whitespaces).isEmpty &&
        Int(newMin) != nil && Int(newMax) != nil
    }

    private func addLens() {
        guard let lo = Int(newMin), let hi = Int(newMax) else { return }
        gear.lenses.append(LensSpec(
            name: newName.trimmingCharacters(in: .whitespaces),
            minMm: min(lo, hi), maxMm: max(lo, hi)
        ))
        newName = ""; newMin = ""; newMax = ""
    }
}
