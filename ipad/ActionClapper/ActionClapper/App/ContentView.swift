import SwiftUI

/// Hovedskjerm: hele enheten er klaffebrettet. Ingen dashboard — bare slaten,
/// den interaktive armen, og en kompakt innstillingslinje nederst.
@MainActor
struct ContentView: View {
    @State private var model = SlateModel()

    var body: some View {
        GeometryReader { geo in
            let scale = sizeScale(in: geo.size)

            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 0) {
                    HeaderBar()

                    Spacer(minLength: 6)

                    SlateView(model: model, scale: scale)

                    Spacer(minLength: 10)

                    SettingsPanel(model: model, scale: scale)

                    Spacer(minLength: 6)
                }
                .padding(.horizontal, max(16, geo.size.width * 0.03))
                .padding(.top, 8)
                .padding(.bottom, 10)
            }
        }
        .persistSlate(model)
        .task { model.volumeMonitor.start() }
        .onDisappear { model.volumeMonitor.stop() }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
    }

    /// Skalerer typografi og mellomrom slik at slaten fyller skjermen både i
    /// stående og liggende retning uten å se tynn eller oppblåst ut.
    private func sizeScale(in size: CGSize) -> CGFloat {
        let base = min(size.width, size.height)
        return min(max(base / 800, 0.78), 1.35)
    }
}

// MARK: - Persistence (UserDefaults)

/// Skriver alle endringer til UserDefaults. Lasting skjer i `SlateModel.init`.
/// Deles opp i små hjelpere for å holde type-checkeren rask.
private struct PersistSlate: ViewModifier {
    let model: SlateModel

    func body(content: Content) -> some View {
        content
            .persistHeader(model)
            .persistGrid(model)
            .persistMeta(model)
            .persistSettings(model)
    }
}

private extension View {
    func persistHeader(_ model: SlateModel) -> some View {
        onChange(of: model.production) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.production) }
            .onChange(of: model.tagline) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.tagline) }
    }

    func persistGrid(_ model: SlateModel) -> some View {
        onChange(of: model.scene) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.scene) }
            .onChange(of: model.roll) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.roll) }
            .onChange(of: model.take) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.take) }
    }

    func persistMeta(_ model: SlateModel) -> some View {
        onChange(of: model.director) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.director) }
            .onChange(of: model.camera) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.camera) }
            .onChange(of: model.date) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.date) }
    }

    func persistSettings(_ model: SlateModel) -> some View {
        onChange(of: model.clapSoundEnabled) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.clapSound) }
            .onChange(of: model.autoIncrementTake) { _, v in UserDefaults.standard.set(v, forKey: SlateKeys.autoTake) }
    }
}

private extension View {
    func persistSlate(_ model: SlateModel) -> some View {
        modifier(PersistSlate(model: model))
    }
}
