import Foundation
import ImageIO

/// Kamera-EXIF (ISO, blender, lukker, brennvidde, kamera/objektiv) lest fra RAW-
/// eller JPEG-fila via ImageIO. Editoren viste tidligere INGEN opptaksdata — kun
/// orienterings-taggen ble lest (for rotasjon). Fotografen vil se de tekniske
/// verdiene ved retusj (og de er grunnlag for fototeknisk innsikt).
struct ExifInfo: Equatable, Sendable {
    var camera: String?        // «Canon EOS R50»
    var lens: String?          // «RF75-300mm F4-5.6»
    var focalLength: Double?   // mm
    var fNumber: Double?       // blender (f-tall)
    var exposureTime: Double?  // lukker i sekunder
    var iso: Int?

    /// Blits (produsent-uavhengig — standard EXIF Flash-bitmaske + Aux-kompensasjon;
    /// dekker Godox/Profoto/Canon Speedlite osv. som skriver EXIF via kameraet).
    var flashFired: Bool?          // bit 0 — blitsen fyrte
    var flashReturnDetected: Bool? // bit 1–2 == 0b11 — lys kom tilbake fra motiv
    var flashCompensation: Double? // EXIF Aux, EV — Connect Pro / AirX-justering

    /// Har vi noe å vise?
    var hasData: Bool {
        camera != nil || fNumber != nil || exposureTime != nil || iso != nil
            || focalLength != nil || flashFired != nil
    }

    /// Lukker som «1/1000» eller «0.5s».
    var shutterText: String? {
        guard let t = exposureTime, t > 0 else { return nil }
        if t >= 1 { return String(format: "%.0fs", t) }
        return "1/\(Int((1.0 / t).rounded()))"
    }

    /// Kompakt teknisk linje: «190mm · ƒ/16 · 1/1000 · ISO 400».
    var techLine: String {
        var parts: [String] = []
        if let f = focalLength { parts.append("\(Int(f.rounded()))mm") }
        if let n = fNumber { parts.append("ƒ/\(n == n.rounded() ? String(Int(n)) : String(format: "%.1f", n))") }
        if let s = shutterText { parts.append(s) }
        if let iso { parts.append("ISO \(iso)") }
        if flashFired == true {
            parts.append(flashCompensation.map { String(format: "⚡︎%+.1f", $0) } ?? "⚡︎")
        }
        return parts.joined(separator: " · ")
    }

    /// Les EXIF fra en fil-sti (RAW eller JPEG). Nil hvis ingen lesbar metadata.
    static func read(fromPath path: String?) -> ExifInfo? {
        guard let path, !path.isEmpty else { return nil }
        let url = URL(fileURLWithPath: path)
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
        else { return nil }
        let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any] ?? [:]
        let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any] ?? [:]
        let aux = props[kCGImagePropertyExifAuxDictionary] as? [CFString: Any] ?? [:]

        var info = ExifInfo()
        if let model = tiff[kCGImagePropertyTIFFModel] as? String {
            let make = (tiff[kCGImagePropertyTIFFMake] as? String) ?? ""
            // «Canon Canon EOS R50» → «Canon EOS R50» (unngå dobbel merkevare).
            info.camera = model.hasPrefix(make) || make.isEmpty ? model : "\(make) \(model)"
        }
        info.lens = (exif[kCGImagePropertyExifLensModel] as? String)
            ?? (aux[kCGImagePropertyExifAuxLensModel] as? String)
        info.focalLength = exif[kCGImagePropertyExifFocalLength] as? Double
        info.fNumber = exif[kCGImagePropertyExifFNumber] as? Double
        info.exposureTime = exif[kCGImagePropertyExifExposureTime] as? Double
        if let isos = exif[kCGImagePropertyExifISOSpeedRatings] as? [Int], let first = isos.first {
            info.iso = first
        } else if let iso = exif[kCGImagePropertyExifISOSpeedRatings] as? Int {
            info.iso = iso
        }
        // Blits — EXIF Flash er en bitmaske: bit 0 = fyrte, bit 1–2 = retur-status,
        // bit 5 = «ingen blitsfunksjon». Aux bærer blits-kompensasjonen (EV).
        if let flash = exif[kCGImagePropertyExifFlash] as? Int {
            let noFunction = (flash & 0b100000) != 0
            if !noFunction {
                info.flashFired = (flash & 0b1) != 0
                let ret = (flash >> 1) & 0b11
                if ret != 0 { info.flashReturnDetected = (ret == 0b11) }
            }
        }
        info.flashCompensation = aux[kCGImagePropertyExifAuxFlashCompensation] as? Double
        return info.hasData ? info : nil
    }

    /// «Lys endret» — vesentlig blits-endring mellom to bilder: fyrte-status
    /// flippet, ELLER blits-kompensasjon endret > 0.3 EV. Ren + testbar. Grunnlag
    /// for thumbnail-badgen OG for at «Sync forrige» ikke blindt arver en recipe
    /// tunet for annet lys (assistenten bumpet blitsen mellom to formals).
    static func lightChanged(previousFired: Bool?, previousComp: Double?,
                             currentFired: Bool?, currentComp: Double?) -> Bool {
        if (previousFired ?? false) != (currentFired ?? false) { return true }
        return abs((previousComp ?? 0) - (currentComp ?? 0)) > 0.3
    }

    /// Les EXIF `DateTimeOriginal` (EKTE opptakstid) fra en fil (RAW/JPEG). Nil
    /// hvis feltet mangler. Formatet er «yyyy:MM:dd HH:mm:ss» (kameraets lokale tid
    /// uten sone → tolkes i gjeldende sone). Brukes til å sette `Asset.captureTime`
    /// = ekte skuddtid i stedet for nedlastings-`Date()`, som driver opptaks-
    /// rekkefølge + burst-gruppering + «forrige bilde»-arv.
    static func captureDate(fromPath path: String?) -> Date? {
        guard let path, !path.isEmpty,
              let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
        else { return nil }
        let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any] ?? [:]
        let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any] ?? [:]
        guard let raw = (exif[kCGImagePropertyExifDateTimeOriginal] as? String)
            ?? (tiff[kCGImagePropertyTIFFDateTime] as? String)
        else { return nil }
        // Lokal DateFormatter (kalles én gang per preview-nedlasting, ikke hot path)
        // → unngår delt ikke-Sendable statisk formatter.
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy:MM:dd HH:mm:ss"
        return formatter.date(from: raw)
    }
}
