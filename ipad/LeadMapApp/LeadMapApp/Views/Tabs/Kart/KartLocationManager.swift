// KartLocationManager.swift — ekte CoreLocation-brukerposisjon for
// "Sentrer på meg"-FAB (Pakke 10.1, 2026-07-01).
//
// Enkel singleton som:
//   - Ber om WhenInUseAuthorization ved første `requestIfNeeded()`-kall
//   - Starter oppdatering når autorisert
//   - Cacher siste kjente koordinat i `currentCoordinate`
//   - Publiserer `status` (NSNotDetermined/Denied/Authorized) for UI-fallback
//
// I prod bør Info.plist ha NSLocationWhenInUseUsageDescription (allerede der
// via project.yml + NSLocationAlwaysAndWhenInUseUsageDescription for lead-
// nærhetsvarsler i bakgrunn).

import Foundation
import CoreLocation
import CoreMotion
#if os(iOS)
import UIKit
#endif

/// Bevegelsesform slik Apples motion-koprosessor klassifiserer den.
enum MotionTransport: String, Sendable { case walking, cycling, automotive }


/// Hvor retningen kom fra. Vises ikke til brukeren, men avgjør hvor bredt
/// vi tegner lyskjeglen — og gjør det mulig å se i en logg hvorfor kartet
/// pekte som det gjorde.
enum HeadingKilde: String, Sendable {
    /// Magnetometeret. Virker stillestående.
    case kompass
    /// Kurs over bakken fra GPS. Krever fart, men er urokkelig i bil.
    case kurs
    /// Siste kjente kurs, holdt fast. En bil som står i kø har ikke snudd
    /// seg, og kompasset ligger i en magnetholder.
    case holdt
}

/// Retningen vi faktisk stoler på akkurat nå.
struct Retning: Sendable, Equatable {
    let grader: CLLocationDirection
    let kilde: HeadingKilde
    /// Usikkerhet i grader. Mater bredden på lyskjeglen.
    let usikkerhet: CLLocationDirection
}

/// Valget mellom kompass og GPS-kurs.
///
/// Det finnes ingen kilde som er best overalt:
///
/// **Kompasset** virker når du står stille — det er hele poenget med
/// lyskjeglen. Men det forstyrres av metall og magneter. En MagSafe-holder
/// i en bil er bokstavelig talt en magnet mot magnetometeret, og bilens eget
/// karosseri og høyttalere gjør resten.
///
/// **GPS-kursen** er nærmest perfekt i 60 km/t og bryr seg ikke om magneter.
/// Men den er kursen over BAKKEN: den vet bare hvor du flytter deg, ikke
/// hvilken vei du ser, og den finnes ikke i det hele tatt når du står stille.
///
/// Derfor velger vi etter reisemåte og fart, ikke etter én regel:
///
///   gange            kompass — fotgjengere snur seg på stedet
///   sykkel i fart    kurs — roligere enn et kompass som vugger med styret
///   sykkel stille    kompass — lite metall, og sykkelen kan trilles rundt
///   bil i fart       kurs
///   bil i kø         holdt kurs — bilen har ikke snudd seg, og kompasset
///                    ligger i magnetholderen
///
/// Terskelen har hysterese. Uten den flipper kilden fram og tilbake hver
/// gang farten sitrer rundt grensen, og kartet rykker.
enum Retningsvalg {
    /// Over denne farten er GPS-kursen bedre enn kompasset. 2,2 m/s er
    /// ca. 8 km/t — over rask gange, under sykkelfart.
    static let kursTerskelOpp: Double = 2.2
    /// Under denne farten går vi tilbake til kompasset. Gapet opp til
    /// `kursTerskelOpp` er hysteresen.
    static let kursTerskelNed: Double = 1.2

    /// Kompasset får et gulv på usikkerheten når det ligger i en bil.
    /// Vi kan ikke måle magnetforstyrrelsen direkte, men vi vet at den er der.
    static let kompassUsikkerhetIKjoretoy: Double = 35

    /// Velger kilde. Ren funksjon — all tilstand inn, ingen ut, så den kan
    /// testes uten CoreLocation.
    ///
    /// - Parameter brukteKurs: om forrige valg landet på kurs. Bærer
    ///   hysteresen.
    /// - Returns: valgt retning (nil når vi ikke vet noe), og den nye
    ///   `brukteKurs` som kalleren skal ta vare på.
    static func velg(
        kompass: Retning?,
        kurs: Retning?,
        sisteKurs: Retning?,
        fart: Double,
        transport: MotionTransport?,
        brukteKurs: Bool
    ) -> (retning: Retning?, brukerKurs: Bool) {
        let iFart = brukteKurs ? (fart > kursTerskelNed) : (fart > kursTerskelOpp)

        // Fotgjengere: kompasset, alltid. En som går snur hodet og kroppen
        // uten å flytte seg, og det er nettopp det kjeglen skal vise.
        if transport == .walking {
            return (kompass ?? kurs ?? sisteKurs, false)
        }

        let iKjoretoy = transport == .cycling || transport == .automotive
        let dempetKompass = kompass.map { k -> Retning in
            guard iKjoretoy else { return k }
            return Retning(grader: k.grader, kilde: k.kilde,
                           usikkerhet: max(k.usikkerhet, kompassUsikkerhetIKjoretoy))
        }

        if iFart, let kurs {
            return (kurs, true)
        }

        // Stillestående bil: hold kursen. Kompasset i en magnetholder lyver
        // mer enn en kurs som er noen sekunder gammel.
        if transport == .automotive, let sisteKurs {
            return (Retning(grader: sisteKurs.grader, kilde: .holdt,
                            usikkerhet: sisteKurs.usikkerhet), false)
        }

        return (dempetKompass ?? kurs ?? sisteKurs, false)
    }
}

@MainActor
@Observable
final class KartLocationManager: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    static let shared = KartLocationManager()

    private let manager: CLLocationManager
    private(set) var currentCoordinate: CLLocationCoordinate2D?
    private(set) var status: CLAuthorizationStatus
    /// Apple Core Motion aktivitets-klassifikator (M-koprosessor) — skiller
    /// gå/sykkel/bil ved å fusjonere akselerometer + gyro, uavhengig av GPS.
    /// Nav-modus bruker denne til å auto-velge rute-type. `nil` til klassifisert
    /// (eller på macOS, som faller tilbake til hastighet).
    private(set) var motionTransport: MotionTransport? = nil
    #if os(iOS)
    private let activityManager = CMMotionActivityManager()
    private var activityRunning = false
    #endif
    /// Bevegelses-flag basert på CLLocation.speed. True når user beveger
    /// seg > 0.5 m/s (~1.8 km/h — gange). Går tilbake til false ~3s etter
    /// user stopper (så MeMapPin ikke flakker mellom stille/beveger).
    private(set) var isMoving: Bool = false
    /// Retning i grader (0-360, nord=0, øst=90). Brukes til å rotere
    /// MeMapPin når user beveger seg. `nil` når stille (course er ugyldig).
    private(set) var heading: CLLocationDirection?
    /// Sist rapporterte hastighet i meter/sekund (>= 0). `nil` når stille eller
    /// speed er ugyldig (CLLocation.speed < 0). Brukes av HUD-navigasjon.
    private(set) var speedMps: Double?

    /// Hvilken vei enheten PEKER, fra kompasset — ikke hvilken vei du går.
    ///
    /// `heading` over er `CLLocation.course`, altså kursen over bakken. Den
    /// krever at du beveger deg, og er `nil` når du står stille. Står du på
    /// et fortau og snur deg mot inngangen, sier den ingenting.
    ///
    /// Dette er `CLHeading` fra magnetometeret. Den virker stillestående, og
    /// det er den lyskjeglen rundt avataren skal følge.
    ///
    /// 0 = nord, 90 = øst. `nil` til første måling eller hvis enheten mangler
    /// kompass (simulator).
    private(set) var deviceHeading: CLLocationDirection?
    /// Kompassets egen usikkerhet i grader. Er den høy, er magnetometeret
    /// forstyrret — av en bilholder, en høyttaler eller et metallbord — og
    /// kjeglen skal tegnes bredere i stedet for å lyve om presisjon.
    private(set) var headingAccuracy: CLLocationDirection = -1
    private var headingRunning = false

    /// Retningen kartet skal bruke — kompass eller GPS-kurs, valgt av
    /// `Retningsvalg`. Dette er den lyskjeglen og nav-kameraet leser.
    private(set) var retning: Retning?
    /// Siste gyldige GPS-kurs, beholdt etter at du har stoppet. En bil i kø
    /// har ikke snudd seg.
    private var sisteKurs: Retning?
    /// Bærer hysteresen i kildevalget.
    private var brukerKurs = false
    private var isMovingResetTask: Task<Void, Never>?

    override init() {
        self.manager = CLLocationManager()
        self.status = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest  // Best for speed-detection
        manager.distanceFilter = 5                          // Oppdater hvert 5m for jevn bevegelses-tracking
        manager.headingFilter = 2                           // Grader — under dette rykker kjeglen uten å si noe nytt
    }

    // MARK: - Kompass

    /// Start kompass-oppdatering. Kalles når kartet vises.
    ///
    /// Idempotent. No-op når enheten ikke har magnetometer (simulator), slik
    /// at kjeglen bare uteblir i stedet for at kartet feiler.
    func startHeadingUpdates() {
        #if os(iOS)
        guard CLLocationManager.headingAvailable(), !headingRunning else { return }
        headingRunning = true
        oppdaterHeadingOrientasjon()
        manager.startUpdatingHeading()
        #endif
    }

    /// Stopp kompasset når kartet forsvinner. Magnetometeret er billig, men
    /// ikke gratis, og en selger har appen åpen hele dagen.
    func stopHeadingUpdates() {
        #if os(iOS)
        guard headingRunning else { return }
        headingRunning = false
        manager.stopUpdatingHeading()
        #endif
        deviceHeading = nil
        headingAccuracy = -1
        oppdaterRetning()
    }

    /// CoreLocation antar portrett med mindre vi sier noe annet.
    ///
    /// En selger holder iPaden i landskap. Uten dette peker kjeglen 90 grader
    /// feil — verre enn ingen kjegle, fordi den ser riktig ut.
    func oppdaterHeadingOrientasjon() {
        #if os(iOS)
        manager.headingOrientation = switch UIDevice.current.orientation {
        case .landscapeLeft: .landscapeLeft
        case .landscapeRight: .landscapeRight
        case .portraitUpsideDown: .portraitUpsideDown
        case .portrait: .portrait
        // flat/ukjent: behold forrige. Et bord-liggende nettbrett skal ikke
        // nullstille orienteringen til portrett.
        default: manager.headingOrientation
        }
        #endif
    }

    /// Ber om tilgang hvis vi ikke har spurt før. Idempotent — trygg å kalle
    /// hver gang «Sentrer på meg»-FAB tappes.
    func requestIfNeeded() {
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        case .denied, .restricted:
            break  // KartView fallback til Oslo + viser toast
        @unknown default:
            break
        }
    }

    // MARK: - Transport-deteksjon (gå/sykkel/bil)

    /// Start Core Motion aktivitets-klassifisering. Kalles når nav-modus åpnes.
    /// No-op på macOS eller når klassifikatoren ikke er tilgjengelig.
    func startTransportDetection() {
        #if os(iOS)
        guard CMMotionActivityManager.isActivityAvailable(), !activityRunning else { return }
        activityRunning = true
        activityManager.startActivityUpdates(to: .main) { [weak self] activity in
            guard let self, let a = activity, a.confidence != .low else { return }
            let t: MotionTransport?
            if a.automotive { t = .automotive }
            else if a.cycling { t = .cycling }
            else if a.walking || a.running { t = .walking }
            else { t = nil }   // stationary/unknown → behold forrige
            Task { @MainActor in if let t { self.motionTransport = t } }
        }
        #endif
    }

    /// Stopp aktivitets-klassifisering (spar batteri) når nav-modus lukkes.
    func stopTransportDetection() {
        #if os(iOS)
        guard activityRunning else { return }
        activityRunning = false
        activityManager.stopActivityUpdates()
        #endif
        motionTransport = nil
    }

    /// Skru på/av høyeste GPS-nøyaktighet for turn-by-turn. `BestForNavigation`
    /// bruker ekstra sensorer (bl.a. bevegelses-koprosessor) og gir tettere,
    /// mer presise fixes — men mer batteri, så vi slår det kun på under nav.
    func setNavigationMode(_ on: Bool) {
        manager.desiredAccuracy = on ? kCLLocationAccuracyBestForNavigation : kCLLocationAccuracyBest
        manager.distanceFilter = on ? kCLDistanceFilterNone : 5
        #if os(iOS)
        manager.activityType = on ? .automotiveNavigation : .other
        #endif
    }

    /// Regner ut hvilken retning kartet skal bruke nå.
    ///
    /// Kalles ved hver posisjon, hver kompassmåling og når bevegelsen dør ut,
    /// fordi alle tre kan snu valget.
    private func oppdaterRetning() {
        let kompassRetning = deviceHeading.map {
            Retning(grader: $0, kilde: .kompass,
                    // CoreLocation sender -1 før kalibrering. Da vet vi
                    // ingenting, og 20 grader er en ærlig gjetning.
                    usikkerhet: headingAccuracy >= 0 ? headingAccuracy : 20)
        }
        // `heading` er live kurs — den nulles når du står stille. `sisteKurs`
        // overlever, og er det «holdt» bygger på.
        let liveKurs = heading.map {
            Retning(grader: $0, kilde: .kurs, usikkerhet: sisteKurs?.usikkerhet ?? 12)
        }
        let valg = Retningsvalg.velg(
            kompass: kompassRetning,
            kurs: liveKurs,
            sisteKurs: sisteKurs,
            fart: speedMps ?? 0,
            transport: motionTransport,
            brukteKurs: brukerKurs)
        retning = valg.retning
        brukerKurs = valg.brukerKurs
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let newStatus = manager.authorizationStatus
        Task { @MainActor in
            self.status = newStatus
            if newStatus == .authorizedWhenInUse || newStatus == .authorizedAlways {
                self.manager.startUpdatingLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        let coord = loc.coordinate
        let speed = loc.speed  // m/s, -1 hvis ugyldig
        let course = loc.course  // grader, -1 hvis ugyldig
        let courseAcc = loc.courseAccuracy  // grader, negativ hvis ugyldig
        Task { @MainActor in
            self.currentCoordinate = coord

            // Bevegelses-deteksjon: > 0.5 m/s = ganger/kjører.
            // Reset-task venter 3s uten bevegelse før isMoving=false —
            // hindrer flakking når speed midlertidig dropper.
            if speed > 0.5 {
                self.isMoving = true
                self.speedMps = speed
                if course >= 0 {
                    self.heading = course
                    self.sisteKurs = Retning(grader: course, kilde: .kurs,
                                             usikkerhet: courseAcc >= 0 ? courseAcc : 12)
                }
                // Restart reset-timeren ved hver bevegelse
                self.isMovingResetTask?.cancel()
                self.isMovingResetTask = Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    guard !Task.isCancelled else { return }
                    self?.isMoving = false
                    self?.heading = nil
                    self?.speedMps = nil
                    // Bevegelsen døde ut: kilden kan ha byttet til kompass.
                    // `sisteKurs` beholdes med vilje — bilen står, men peker
                    // fortsatt samme vei.
                    self?.oppdaterRetning()
                }
            }
            self.oppdaterRetning()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        // trueHeading krever posisjonsfix (den korrigerer for misvisning).
        // Uten fix er den negativ, og da er magnetisk nord det beste vi har.
        let grader = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        let nøyaktighet = newHeading.headingAccuracy
        guard grader >= 0 else { return }
        Task { @MainActor in
            self.deviceHeading = grader
            self.headingAccuracy = nøyaktighet
            self.oppdaterRetning()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Ikke logg spam — bare la KartView bruke fallback.
    }
}
