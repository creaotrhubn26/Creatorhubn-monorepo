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

    /// Har vi noe å vise?
    var hasData: Bool {
        camera != nil || fNumber != nil || exposureTime != nil || iso != nil || focalLength != nil
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
        return info.hasData ? info : nil
    }
}
