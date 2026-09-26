// NexusEksport.swift
//
// Deling av et notat ut av appen: blekket, og det som ble sagt.
//
// PDF-en har hittil vært et bilde av flata. Det er riktig for skissen, men
// møtet er halvparten tekst — referatet ligger på lydobjektet og fulgte aldri
// med ut. Den som får PDF-en ser en tegning uten ord.
//
// Navnene er skjult som standard. En PDF forlater appen og havner i en
// e-posttråd, en Teams-kanal, en delt mappe — steder ingen samtykke-logg når.
// «Sindre Andresen sa at prisen er for høy» er personopplysninger om en
// tredjepart i rommet; «S.A.» bærer det samme for den som var der, og
// ingenting for den som ikke var det.

import Foundation
import UIKit

enum NexusEksport {

    /// Personnavn erstattet med initialer.
    ///
    /// Navnene kommer fra koblingene notatet allerede har: daglig leder og
    /// styret fra Foretaksregisteret, hentet for kunden notatet peker på. Vi
    /// gjetter altså ikke hvem som er et navn — vi vet det.
    ///
    /// Apples NLTagger kunne gjort generell navnegjenkjenning, men den har
    /// ikke `nameType` for norsk i det hele tatt (bare Language, Script og
    /// TokenType). Å tvinge den til engelsk på norsk tekst gir treff av og
    /// til og bom av og til, og en anonymisering som bommer av og til er
    /// verre enn ingen: den lover noe den ikke holder.
    ///
    /// ponytail: taket er at navn UTENFOR kontaktlista står igjen. Neste
    /// steg er personkortene (punkt 19 på lista) — da vokser lista av seg
    /// selv med dem man faktisk snakker med.
    static func anonymiser(_ tekst: String, kjenteNavn: [String]) -> String {
        guard !tekst.isEmpty, !kjenteNavn.isEmpty else { return tekst }
        var ut = tekst
        // Lengste navn først: «Sindre Andresen» skal bli «S.A.», ikke
        // «S. Andresen» fordi fornavnet ble byttet først.
        for navn in kjenteNavn.sorted(by: { $0.count > $1.count }) {
            let rent = navn.trimmingCharacters(in: .whitespacesAndNewlines)
            guard rent.count >= 3 else { continue }
            let kort = initialer(rent)
            ut = bytt(rent, med: kort, i: ut)
            // Folk sier fornavn. «Sindre mener prisen er for høy» er like
            // identifiserende som hele navnet når mottakeren kjenner kunden.
            for del in rent.split(separator: " ") where del.count >= 3 {
                ut = bytt(String(del), med: kort, i: ut)
            }
        }
        return ut
    }

    /// Bytte på ordgrense, uavhengig av store og små bokstaver.
    private static func bytt(_ fra: String, med til: String, i tekst: String) -> String {
        let mønster = "\\b" + NSRegularExpression.escapedPattern(for: fra) + "\\b"
        guard let regex = try? NSRegularExpression(
            pattern: mønster, options: [.caseInsensitive]) else { return tekst }
        return regex.stringByReplacingMatches(
            in: tekst, range: NSRange(tekst.startIndex..., in: tekst),
            withTemplate: NSRegularExpression.escapedTemplate(for: til))
    }

    /// «Sindre Andresen» → «S.A.»
    static func initialer(_ navn: String) -> String {
        let bokstaver = navn
            .split(separator: " ")
            .compactMap { $0.first }
            .map { String($0).uppercased() }
        return bokstaver.isEmpty ? navn : bokstaver.joined(separator: ".") + "."
    }

    /// Linjene referatsiden skal vise.
    ///
    /// Markørene kommer med som egne linjer. Et merke er selgerens egen
    /// «dette var viktig», og uten det må mottakeren lese alt for å finne de
    /// tjue sekundene som betydde noe.
    static func referatLinjer(_ referat: [Referatsegment], markorer: [Double],
                              skjulNavn: [String]) -> [String] {
        var linjer: [String] = []
        let merker = Set(markorer.map { Int($0.rounded()) })
        for segment in referat {
            let start = Int(segment.start.rounded())
            let merket = merker.contains(where: { abs($0 - start) <= 4 })
            let tekst = anonymiser(segment.tekst, kjenteNavn: skjulNavn)
            linjer.append("\(merket ? "★ " : "")\(klokke(segment.start))  \(tekst)")
        }
        return linjer
    }

    static func klokke(_ t: Double) -> String {
        let s = max(0, Int(t.rounded()))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    /// Tegner tekstsider i en åpen PDF-kontekst.
    ///
    /// A4 uansett hva flata måler: en referatside skal kunne skrives ut.
    static func tegnTekstsider(_ ctx: UIGraphicsPDFRendererContext,
                               tittel: String, linjer: [String],
                               navnSkjult: Bool) {
        let side = CGRect(x: 0, y: 0, width: 595, height: 842)
        let marg: CGFloat = 48
        let bredde = side.width - marg * 2
        let brod = UIFont.systemFont(ofSize: 11)
        var y = marg

        func nySide() {
            ctx.beginPage(withBounds: side, pageInfo: [:])
            y = marg
        }
        nySide()

        let overskrift = (tittel.isEmpty ? "Notat" : tittel) + " — hva som ble sagt"
        (overskrift as NSString).draw(
            in: CGRect(x: marg, y: y, width: bredde, height: 30),
            withAttributes: [.font: UIFont.boldSystemFont(ofSize: 17)])
        y += 28
        if navnSkjult {
            ("Kjente kontaktpersoner er erstattet med initialer." as NSString).draw(
                in: CGRect(x: marg, y: y, width: bredde, height: 18),
                withAttributes: [.font: UIFont.systemFont(ofSize: 9),
                                 .foregroundColor: UIColor.darkGray])
            y += 22
        }

        for linje in linjer {
            let tekst = linje as NSString
            let hoyde = ceil(tekst.boundingRect(
                with: CGSize(width: bredde, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin], attributes: [.font: brod],
                context: nil).height)
            if y + hoyde > side.height - marg { nySide() }
            tekst.draw(in: CGRect(x: marg, y: y, width: bredde, height: hoyde),
                       withAttributes: [.font: brod])
            y += hoyde + 4
        }
    }
}
