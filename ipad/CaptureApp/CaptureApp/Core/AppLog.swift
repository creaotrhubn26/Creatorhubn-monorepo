import os

/// Sentraliserte os.Logger-kategorier for CaptureApp. Erstatter `print()` med
/// strukturert logging (nivåer + Console.app-filtrering). Diagnostikk-verdier
/// markeres `.public` siden de ikke er sensitive (kamera-IP, asset-IDer, feil).
enum AppLog {
    private static let subsystem = "com.creatorhubn.capture"
    static let capture = Logger(subsystem: subsystem, category: "capture")
    static let sync = Logger(subsystem: subsystem, category: "sync")
    static let liveCapture = Logger(subsystem: subsystem, category: "liveCapture")
}
