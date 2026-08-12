import Foundation
import Observation

/// Tilstanden til selve klaffebrettet.
enum SlateState: Equatable {
    case ready      // armen er oppe og klar til å slå ned
    case closing    // armen svinger ned mot slaten
    case closed     // armen ligger på slaten — klappen er registrert
}

/// UserDefaults-nøkler for persistente slate-verdier.
enum SlateKeys {
    static let production = "clapper.production"
    static let tagline = "clapper.tagline"
    static let scene = "clapper.scene"
    static let roll = "clapper.roll"
    static let take = "clapper.take"
    static let director = "clapper.director"
    static let camera = "clapper.camera"
    static let date = "clapper.date"
    static let clapSound = "clapper.clapSoundEnabled"
    static let autoTake = "clapper.autoIncrementTake"
    static let clapStrength = "clapper.clapStrength"
    static let frameRate = "clapper.frameRate"
    static let timecodeMode = "clapper.timecodeMode"
    static let freeRunReference = "clapper.freeRunReference"
}

/// Alt UI-en trenger: slate-verdier, innstillinger, klaffetilstand og lyd/haptikk.
@MainActor
@Observable
final class SlateModel {
    // MARK: - Slate-verdier (redigeres direkte på slaten)
    var production: String
    var tagline: String
    var scene: String
    var roll: String
    var take: String
    var director: String
    var camera: String
    var date: String

    // MARK: - Innstillinger
    var clapSoundEnabled: Bool
    var autoIncrementTake: Bool
    /// Klaff-styrke (0.2–1.0) — volumet på klaffelyden.
    var clapStrength: Double {
        didSet {
            UserDefaults.standard.set(clapStrength, forKey: SlateKeys.clapStrength)
        }
    }
    var frameRate: FrameRate {
        didSet {
            UserDefaults.standard.set(frameRate.rawValue, forKey: SlateKeys.frameRate)
            timecodeEngine.frameRate = frameRate
        }
    }

    /// Kilde for timecode-en (veggklokke eller fri løpende fra 00:00:00:00).
    var timecodeMode: TimecodeMode {
        didSet {
            UserDefaults.standard.set(timecodeMode.rawValue, forKey: SlateKeys.timecodeMode)
        }
    }

    /// Referansepunkt for fri løpende timecode.
    private(set) var freeRunReference: Date {
        didSet {
            UserDefaults.standard.set(freeRunReference, forKey: SlateKeys.freeRunReference)
        }
    }

    // MARK: - Kjøretid
    private(set) var slateState: SlateState = .ready
    private(set) var claps: [ClapRecord] = []

    var timecodeEngine = TimecodeEngine()
    let soundPlayer = ClapperSoundPlayer()
    let haptics = HapticsManager()
    let volumeMonitor = VolumeButtonMonitor()

    var lastClap: ClapRecord? { claps.last }
    var isClosed: Bool { slateState == .closed }

    /// Armenes hvilevinkel i åpen (klar) tilstand, i grader.
    static let openAngle: Double = -34

    init() {
        let d = UserDefaults.standard
        production = d.string(forKey: SlateKeys.production) ?? "THE ROLE ROOM"
        tagline = d.string(forKey: SlateKeys.tagline) ?? "Casting. Roles. Together."
        scene = d.string(forKey: SlateKeys.scene) ?? "12A"
        roll = d.string(forKey: SlateKeys.roll) ?? "A001"
        take = d.string(forKey: SlateKeys.take) ?? "03"
        director = d.string(forKey: SlateKeys.director) ?? "Daniel Qazi"
        camera = d.string(forKey: SlateKeys.camera) ?? "Sony FX6"
        date = d.string(forKey: SlateKeys.date) ?? "today"
        clapSoundEnabled = d.object(forKey: SlateKeys.clapSound) as? Bool ?? true
        autoIncrementTake = d.object(forKey: SlateKeys.autoTake) as? Bool ?? true
        clapStrength = d.object(forKey: SlateKeys.clapStrength) as? Double ?? 0.9
        if let raw = d.string(forKey: SlateKeys.frameRate), let fr = FrameRate(rawValue: raw) {
            frameRate = fr
        } else {
            frameRate = .fps25
        }
        timecodeMode = TimecodeMode(rawValue: d.string(forKey: SlateKeys.timecodeMode) ?? "") ?? .wallClock
        freeRunReference = (d.object(forKey: SlateKeys.freeRunReference) as? Date) ?? .now
        timecodeEngine.frameRate = frameRate
        volumeMonitor.onVolumePress = { [weak self] in self?.volumeClap() }
    }

    func resetTake() {
        take = "01"
    }

    /// Gjeldende timecode-streng i valgt modus (veggklokke eller fri løpende).
    func timecode(at date: Date = .now) -> String {
        timecodeEngine.string(at: date, mode: timecodeMode, freeRunReference: freeRunReference)
    }

    /// Nullstiller fri løpende timecode til 00:00:00:00.
    func resetFreeRun() {
        freeRunReference = .now
    }

    /// Armen slås ned — starter lukke-animasjonen. Selve nedslaget skjer i
    /// `completeClapImpact`, akkurat når armen treffer slaten.
    func clap() {
        guard slateState == .ready else { return }
        haptics.prepare()
        slateState = .closing
    }

    /// Kalles nøyaktig i nedslagsøyeblikket: fanger metadata, spiller klaffelyd
    /// og trigger haptisk nedslag.
    func completeClapImpact() {
        guard slateState == .closing else { return }

        claps.append(ClapRecord(
            timestamp: .now,
            timecode: timecode(),
            production: production,
            scene: scene,
            roll: roll,
            take: take,
            director: director,
            camera: camera
        ))

        if clapSoundEnabled {
            soundPlayer.play(strength: Float(clapStrength))
        }
        haptics.impact()

        slateState = .closed
    }

    /// Armen løftes igjen — tilbake til READY. Med Auto Take økes take én.
    func open() {
        guard slateState == .closed else { return }
        if autoIncrementTake, let n = Int(take) {
            take = String(format: "%02d", min(n + 1, 999))
        }
        slateState = .ready
    }

    /// Volumknappen er trykket: klar → klapp, lukket → åpne for neste take.
    func volumeClap() {
        switch slateState {
        case .ready: clap()
        case .closed: open()
        case .closing: break
        }
    }
}
