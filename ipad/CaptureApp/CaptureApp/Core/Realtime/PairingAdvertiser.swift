import Foundation
import Network
import UIKit

/// Bonjour-advertiser slik at Creatorhub One Desk (Mac-companion) kan
/// finne denne iPad-en på LAN-en under et shoot.
///
/// Vi annonserer service-typen `_creatorhubcap._tcp` med en TXT-record
/// som forteller Desk hvilken iPad det er (`device_id`) og hva den heter
/// (`device_name`) — Desk bruker `device_id` som dedup-nøkkel mellom
/// shoots, og `device_name` til UI-visning.
///
/// Spec: `docs/capture/desk-pairing.md` i monorepoet.
///
/// **Hva F5a-iPad-side gjør IKKE ennå:**
///   - Aksepterer ingen reelle paring-requests fra Desk. NWListener tar
///     imot TCP-connections og lukker dem umiddelbart. Selve pairing-
///     handshake (PIN-confirmation) skjer fortsatt manuelt på Desk-siden
///     ("Bekreft manuelt"-knapp i Desk's UI) inntil F5b leverer en HTTP-
///     bro her.
///   - Genererer eller validerer ingen PIN. Bare Desk-siden gjør det per nå.
///
/// **Hvorfor likevel verdt å shippe nå:** Uten denne advertise-en finner
/// Desk aldri iPad-er i sin "iPad-paring"-seksjon. Med den, ser Desk
/// device_id + device_name og kan lagre paringen.
///
/// **Når starte:** Fra `CaptureAppMain.task`. Lever for app-ets levetid.
/// iOS kjører `NWListener` korrekt i bakgrunnen så lenge appen ikke
/// suspenderes, og siden Capture-flowen typisk holder appen aktiv under
/// shoot, er det praktisk talt alltid tilgjengelig.
@MainActor
final class PairingAdvertiser: ObservableObject {
    static let shared = PairingAdvertiser()

    @Published private(set) var isAdvertising: Bool = false
    @Published private(set) var lastError: String?

    private var listener: NWListener?

    /// Service-typen MÅ matche Desk's mDNS-browser. Endring her krever
    /// matchende endring i `apps/creatorhub-one-desk/src-tauri/src/ipad_pairing.rs`
    /// (konstanten `SERVICE_TYPE`).
    private let serviceType = "_creatorhubcap._tcp"

    private init() {}

    /// Idempotent — kalt på nytt mens vi allerede annonserer, no-ops.
    func start() {
        guard listener == nil else { return }

        let params = NWParameters.tcp
        params.includePeerToPeer = true

        let txtRecord = buildTxtRecord()

        do {
            // Port `.any` lar systemet velge en ledig port. Desk leser
            // porten via Bonjour-oppslaget — vi trenger ikke å fastsette
            // den selv.
            let listener = try NWListener(using: params, on: .any)
            listener.service = NWListener.Service(
                name: UIDevice.current.name,
                type: serviceType,
                domain: nil,
                txtRecord: txtRecord
            )
            listener.serviceRegistrationUpdateHandler = { update in
                // Logg state-endringer. NWListener.ServiceRegistrationChange
                // har bare to caser (add/remove) per iOS-doc.
                switch update {
                case .add(let endpoint):
                    print("[pairing] Bonjour advertised: \(endpoint)")
                case .remove(let endpoint):
                    print("[pairing] Bonjour removed: \(endpoint)")
                @unknown default:
                    break
                }
            }
            listener.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                Task { @MainActor in
                    switch state {
                    case .ready:
                        self.isAdvertising = true
                        self.lastError = nil
                    case .failed(let err):
                        self.isAdvertising = false
                        self.lastError = "Listener failed: \(err.localizedDescription)"
                        self.listener = nil
                    case .cancelled:
                        self.isAdvertising = false
                        self.listener = nil
                    default:
                        break
                    }
                }
            }
            listener.newConnectionHandler = { connection in
                // F5c: hand off til PairingConnection som håndterer den
                // linje-baserte protokollen (PairingProtocol). Den viser
                // modal via PairingRequestStore og svarer OK/ERR.
                PairingConnection.handle(connection)
            }
            listener.start(queue: .main)
            self.listener = listener
        } catch {
            self.lastError = "Could not start listener: \(error.localizedDescription)"
            self.isAdvertising = false
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
        isAdvertising = false
    }

    /// Bygger TXT-record per `docs/capture/desk-pairing.md`-spec.
    /// device_id er `identifierForVendor` — stabil per iPad+vendor, dvs.
    /// den ikke flytter mellom apper men er konsistent mellom appens
    /// installasjoner på samme device. Det er det Desk vil dedup på.
    private func buildTxtRecord() -> NWTXTRecord {
        var txt = NWTXTRecord()
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        let deviceName = UIDevice.current.name
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        txt["device_id"] = deviceId
        txt["device_name"] = deviceName
        txt["app_version"] = appVersion
        return txt
    }
}
