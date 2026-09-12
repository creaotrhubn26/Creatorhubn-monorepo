// KjorebokPDF.swift
//
// Leadgrid Go — genererer en profesjonelt brandet PDF-kjørebok (A4, paginert)
// on-device via UIGraphicsPDFRenderer. Full Leadgrid-branding: Leadgrid-lockup
// + «Leadgrid Go»-merke, aksent-farger, totals-band, tur-tabell over flere
// sider, og Skatteetaten-fotnote. Deles via share-sheet (samme som CSV).

import UIKit

enum KjorebokPDF {
    // A4 i punkter
    private static let pageW: CGFloat = 595.28
    private static let pageH: CGFloat = 841.89
    private static let margin: CGFloat = 40

    // Leadgrid-palett
    private static let purple = UIColor(red: 0.42, green: 0.24, blue: 0.75, alpha: 1)
    private static let purpleLt = UIColor(red: 0.66, green: 0.32, blue: 0.99, alpha: 1)
    private static let green = UIColor(red: 0.13, green: 0.62, blue: 0.42, alpha: 1)
    private static let ink = UIColor(white: 0.12, alpha: 1)
    private static let grey = UIColor(white: 0.45, alpha: 1)
    private static let hairline = UIColor(white: 0.88, alpha: 1)

    /// Lag PDF for én måned. Returnerer temp-fil-URL, eller nil ved feil.
    static func generate(
        monthLabel: String,
        trips: [Trip],
        driverName: String,
        vehicleName: String?,
        vehiclePlate: String?,
        summary: (km: Double, amount: Double, tolls: Double)
    ) -> URL? {
        let bounds = CGRect(x: 0, y: 0, width: pageW, height: pageH)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds, format: UIGraphicsPDFRendererFormat())
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Leadgrid-Go-kjorebok.pdf")

        // Kolonne-layout for tabellen
        let x0 = margin
        let colDato = x0
        let colRute = x0 + 70
        let colFormal = pageW - margin - 190
        let colKm = pageW - margin - 110
        let colKr = pageW - margin - 55
        let rowH: CGFloat = 22
        let bottomLimit = pageH - 70   // plass til fotnote

        var pageNo = 0

        do {
            try renderer.writePDF(to: url) { ctx in
                func startPage() {
                    ctx.beginPage()
                    pageNo += 1
                    drawFooter(pageNo: pageNo)
                }
                func drawTableHead(_ y: CGFloat) {
                    text("DATO", colDato, y, 8, .semibold, grey)
                    text("RUTE", colRute, y, 8, .semibold, grey)
                    text("FORMÅL", colFormal, y, 8, .semibold, grey)
                    text("KM", colKm, y, 8, .semibold, grey, align: .right, width: 40)
                    text("KR", colKr, y, 8, .semibold, grey, align: .right, width: 40)
                    line(x0, y + 13, pageW - margin, y + 13, hairline, 0.6)
                }

                startPage()
                var y = drawHeader(monthLabel: monthLabel, driver: driverName,
                                   vehicleName: vehicleName, vehiclePlate: vehiclePlate)
                y = drawTotals(y: y, summary: summary)
                y += 6
                drawTableHead(y)
                y += 20

                let f = DateFormatter(); f.locale = Locale(identifier: "nb_NO"); f.dateFormat = "dd.MM.yyyy"
                for t in trips {
                    if y + rowH > bottomLimit {
                        startPage()
                        y = margin + 8
                        drawTableHead(y)
                        y += 20
                    }
                    text(f.string(from: t.startDate), colDato, y, 9, .regular, ink)
                    text("\(clip(t.startPlace, 18)) → \(clip(t.endPlace, 18))", colRute, y, 9, .regular, ink, width: colFormal - colRute - 6)
                    text(purposeLabel(t.purpose), colFormal, y, 8, .semibold, purpleColorFor(t.purpose), width: colKm - colFormal - 6)
                    text(String(format: "%.1f", t.distanceKm), colKm, y, 9, .regular, ink, align: .right, width: 40)
                    text(t.mileageAmount.map { String(format: "%.0f", $0) } ?? "—", colKr, y, 9, .regular, ink, align: .right, width: 40)
                    line(x0, y + rowH - 6, pageW - margin, y + rowH - 6, hairline, 0.4)
                    y += rowH
                }
                if trips.isEmpty {
                    text("Ingen turer registrert denne måneden.", colDato, y + 4, 10, .regular, grey)
                }
            }
            return url
        } catch {
            return nil
        }
    }

    // MARK: seksjoner

    private static func drawHeader(monthLabel: String, driver: String,
                                   vehicleName: String?, vehiclePlate: String?) -> CGFloat {
        var y = margin
        // Leadgrid-lockup (venstre)
        if let logo = UIImage(named: "LeadgridLockup") {
            let h: CGFloat = 26
            let w = h * (logo.size.width / max(1, logo.size.height))
            logo.draw(in: CGRect(x: margin, y: y, width: w, height: h))
        } else {
            text("Leadgrid", margin, y + 4, 20, .heavy, purple)
        }
        // «Leadgrid Go»-merke (høyre)
        let badge = "LEADGRID GO"
        let bAttr = attr(badge, 9, .heavy, .white, tracking: 1.2)
        let bSize = bAttr.size()
        let bw = bSize.width + 18, bh: CGFloat = 20
        let bx = pageW - margin - bw
        let bpath = UIBezierPath(roundedRect: CGRect(x: bx, y: y + 2, width: bw, height: bh), cornerRadius: 6)
        purple.setFill(); bpath.fill()
        bAttr.draw(at: CGPoint(x: bx + 9, y: y + 2 + (bh - bSize.height) / 2))

        y += 40
        text("Elektronisk kjørebok", margin, y, 22, .bold, ink)
        y += 30
        text(monthLabel.capitalized, margin, y, 12, .semibold, purpleLt)
        // Sjåfør + kjøretøy (høyre-justert)
        let veh = [vehicleName, vehiclePlate].compactMap { $0 }.joined(separator: " · ")
        text("Sjåfør: \(driver)" + (veh.isEmpty ? "" : "   \(veh)"),
             margin, y, 10, .regular, grey, align: .right, width: pageW - 2 * margin)
        y += 22
        // Aksent-rule
        line(margin, y, pageW - margin, y, purpleLt, 2)
        return y + 14
    }

    private static func drawTotals(y: CGFloat, summary: (km: Double, amount: Double, tolls: Double)) -> CGFloat {
        let h: CGFloat = 54
        let rect = CGRect(x: margin, y: y, width: pageW - 2 * margin, height: h)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: 10)
        purple.setFill(); path.fill()
        let cols = [
            (String(format: "%.0f km", summary.km), "Yrkeskjøring"),
            (String(format: "%.0f kr", summary.amount), "Kjøregodtgjørelse"),
            (String(format: "%.0f kr", summary.tolls), "Bompenger"),
        ]
        let cw = rect.width / CGFloat(cols.count)
        for (i, c) in cols.enumerated() {
            let cx = rect.minX + CGFloat(i) * cw
            text(c.0, cx, y + 10, 18, .heavy, .white, align: .center, width: cw)
            text(c.1, cx, y + 34, 9, .semibold, UIColor(white: 1, alpha: 0.85), align: .center, width: cw)
        }
        return y + h + 12
    }

    private static func drawFooter(pageNo: Int) {
        let y = pageH - 48
        line(margin, y, pageW - margin, y, hairline, 0.6)
        text("Leadgrid Go · Elektronisk kjørebok — ført i samsvar med Skatteetatens dokumentasjonskrav.",
             margin, y + 8, 8, .regular, grey, width: pageW - 2 * margin - 60)
        text("Side \(pageNo)", pageW - margin - 60, y + 8, 8, .regular, grey, align: .right, width: 60)
    }

    // MARK: tegne-hjelpere

    private static func purposeLabel(_ p: TripPurpose) -> String {
        switch p {
        case .business: return "Firma"
        case .commute: return "Arbeidsreise"
        case .privateUse: return "Privat"
        case .unconfirmed: return "Ikke bekreftet"
        }
    }
    private static func purpleColorFor(_ p: TripPurpose) -> UIColor {
        switch p {
        case .business: return purple
        case .commute: return UIColor(red: 0.20, green: 0.42, blue: 0.85, alpha: 1)
        case .privateUse: return grey
        case .unconfirmed: return UIColor(red: 0.85, green: 0.5, blue: 0.1, alpha: 1)
        }
    }
    private static func clip(_ s: String, _ n: Int) -> String {
        s.count <= n ? s : String(s.prefix(n - 1)) + "…"
    }
    private static func font(_ size: CGFloat, _ w: UIFont.Weight) -> UIFont {
        UIFont.systemFont(ofSize: size, weight: w)
    }
    private static func attr(_ s: String, _ size: CGFloat, _ w: UIFont.Weight, _ color: UIColor, tracking: CGFloat = 0) -> NSAttributedString {
        NSAttributedString(string: s, attributes: [
            .font: font(size, w), .foregroundColor: color, .kern: tracking,
        ])
    }
    private static func text(_ s: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ w: UIFont.Weight,
                             _ color: UIColor, align: NSTextAlignment = .left, width: CGFloat? = nil, tracking: CGFloat = 0) {
        let para = NSMutableParagraphStyle(); para.alignment = align; para.lineBreakMode = .byTruncatingTail
        let a = NSAttributedString(string: s, attributes: [
            .font: font(size, w), .foregroundColor: color, .paragraphStyle: para, .kern: tracking,
        ])
        let w2 = width ?? (pageW - margin - x)
        a.draw(in: CGRect(x: x, y: y, width: w2, height: size + 8))
    }
    private static func line(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ color: UIColor, _ lw: CGFloat) {
        let p = UIBezierPath(); p.move(to: CGPoint(x: x1, y: y1)); p.addLine(to: CGPoint(x: x2, y: y2))
        color.setStroke(); p.lineWidth = lw; p.stroke()
    }
}
