// PhotoMetadata.swift
//
// EXIF + filnavn for et bilde et notat gjelder. Registreres automatisk når
// fotografen lager notat på et bilde hen jobber med / nettopp har tatt, og
// mates inn i on-device-AI-en (NotesIntelligence) så innsikten blir
// fototeknisk (høy ISO → støy, vid blenderåpning → grunn dybdeskarphet osv).
//
// Ekstraheres via ImageIO (CGImageSource) — rent, ingen nettverk.

import Foundation
import ImageIO

struct PhotoMetadata: Codable, Sendable, Equatable, Hashable {
    var fileName: String? = nil
    var cameraMake: String? = nil
    var cameraModel: String? = nil
    var lens: String? = nil
    var focalLengthMM: Double? = nil
    var aperture: Double? = nil          // f-tall
    var shutter: String? = nil           // f.eks. "1/250"
    var iso: Int? = nil
    var dateTaken: String? = nil
    var pixelWidth: Int? = nil
    var pixelHeight: Int? = nil
    var latitude: Double? = nil
    var longitude: Double? = nil

    var isEmpty: Bool {
        fileName == nil && cameraModel == nil && lens == nil && iso == nil
            && aperture == nil && shutter == nil && focalLengthMM == nil
    }

    /// Kompakt linje for AI-prompt + notat-fot, f.eks.
    /// "IMG_2043.CR3 · Canon EOS R5 · RF50mm F1.2 · 50mm · f/1.4 · 1/250s · ISO 400".
    var summaryLine: String {
        var parts: [String] = []
        if let fileName, !fileName.isEmpty { parts.append(fileName) }
        if let cameraModel { parts.append(cameraModel) }
        if let lens { parts.append(lens) }
        if let focalLengthMM { parts.append("\(Int(focalLengthMM.rounded()))mm") }
        if let aperture { parts.append("f/\(String(format: "%.1f", aperture))") }
        if let shutter { parts.append("\(shutter)s") }
        if let iso { parts.append("ISO \(iso)") }
        if let pixelWidth, let pixelHeight { parts.append("\(pixelWidth)×\(pixelHeight)") }
        if let dateTaken { parts.append(dateTaken) }
        return parts.joined(separator: " · ")
    }
}

enum PhotoMetadataExtractor {
    /// Ekstraher metadata fra rå bilde-data (RAW/JPEG/HEIC). `fileName`
    /// oppgis separat siden PhotosPicker/tethering leverer navnet ved siden av.
    static func extract(from data: Data, fileName: String? = nil) -> PhotoMetadata {
        var meta = PhotoMetadata()
        meta.fileName = fileName
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else {
            return meta
        }
        meta.pixelWidth = props[kCGImagePropertyPixelWidth] as? Int
        meta.pixelHeight = props[kCGImagePropertyPixelHeight] as? Int

        if let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any] {
            meta.cameraMake = tiff[kCGImagePropertyTIFFMake] as? String
            meta.cameraModel = tiff[kCGImagePropertyTIFFModel] as? String
        }
        if let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any] {
            if let isoValues = exif[kCGImagePropertyExifISOSpeedRatings] as? [Int] {
                meta.iso = isoValues.first
            }
            meta.aperture = exif[kCGImagePropertyExifFNumber] as? Double
            meta.focalLengthMM = exif[kCGImagePropertyExifFocalLength] as? Double
            meta.lens = exif[kCGImagePropertyExifLensModel] as? String
            meta.dateTaken = exif[kCGImagePropertyExifDateTimeOriginal] as? String
            if let exposure = exif[kCGImagePropertyExifExposureTime] as? Double {
                meta.shutter = formatShutter(exposure)
            }
        }
        if let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any] {
            meta.latitude = signedCoordinate(
                gps[kCGImagePropertyGPSLatitude] as? Double,
                ref: gps[kCGImagePropertyGPSLatitudeRef] as? String, negativeRef: "S")
            meta.longitude = signedCoordinate(
                gps[kCGImagePropertyGPSLongitude] as? Double,
                ref: gps[kCGImagePropertyGPSLongitudeRef] as? String, negativeRef: "W")
        }
        return meta
    }

    static func extract(from url: URL) -> PhotoMetadata {
        guard let data = try? Data(contentsOf: url) else {
            return PhotoMetadata(fileName: url.lastPathComponent)
        }
        return extract(from: data, fileName: url.lastPathComponent)
    }

    /// Lukkertid → menneskelesbar streng ("1/250" eller "2" sekunder).
    static func formatShutter(_ seconds: Double) -> String {
        guard seconds > 0 else { return "" }
        if seconds >= 1 { return String(format: "%.0f", seconds) }
        return "1/\(Int((1 / seconds).rounded()))"
    }

    private static func signedCoordinate(_ value: Double?, ref: String?, negativeRef: String) -> Double? {
        guard let value else { return nil }
        return ref == negativeRef ? -value : value
    }
}
