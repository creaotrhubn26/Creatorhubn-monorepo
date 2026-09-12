import Foundation

/// «Bilder igjen»-estimat (E3) — selv-kalibrerende fra kortets telemetri i stedet
/// for antatte filstørrelser. For hvert nye bilde faller `freeSpaceBytes` med den
/// EKTE størrelsen kameraet skrev (RAW+JPEG); vi måler dette fallet per bilde og
/// glatter det (EMA). Estimat = ledig plass / bytes-per-skudd. nil til første ekte
/// delta er observert — vi viser hellere ingenting enn et gjettet tall.
///
/// (Preview-nedlastingene appen henter er små JPEG-er → ville grovt undervurdert
/// per-skudd-størrelsen; derfor måler vi kortets faktiske forbruk i stedet.)
struct ShotsRemainingEstimator {
    private var lastFree: Int64?
    private var lastCount: Int?
    /// Glattet bytes-per-skudd (EMA). nil = ikke kalibrert enda.
    private(set) var bytesPerShot: Double?

    /// Mat inn siste telemetri-snapshot. Registrerer et per-skudd-forbruk kun når
    /// BÅDE count økte OG ledig plass falt (et faktisk nytt bilde på kortet).
    mutating func update(freeSpaceBytes: Int64?, totalContentsCount: Int?) {
        guard let free = freeSpaceBytes, let count = totalContentsCount else { return }
        defer { lastFree = free; lastCount = count }
        guard let prevFree = lastFree, let prevCount = lastCount,
              count > prevCount, prevFree > free else { return }
        let consumed = Double(prevFree - free)
        let shots = Double(count - prevCount)
        let perShot = consumed / shots
        guard perShot > 0 else { return }
        // EMA (0.7 gammel / 0.3 ny) → robust mot enkelt-avvik (varierende JPEG-
        // kompresjon), men følger etter når objektiv/format endrer skuddstørrelse.
        bytesPerShot = bytesPerShot.map { 0.7 * $0 + 0.3 * perShot } ?? perShot
    }

    /// Estimert antall gjenstående bilder for gjeldende ledige plass. nil til
    /// kalibrert eller uten ledig-plass-tall.
    func estimate(freeSpaceBytes: Int64?) -> Int? {
        guard let free = freeSpaceBytes, let per = bytesPerShot, per > 0 else { return nil }
        return Int(Double(free) / per)
    }
}
