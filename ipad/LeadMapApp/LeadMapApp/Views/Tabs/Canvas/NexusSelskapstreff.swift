// NexusSelskapstreff.swift
//
// Kjenner igjen et selskapsnavn i håndskriften.
//
// To ting henger på denne: notatet som ikke er koblet til noen (da er navnet
// et forslag), og notatet som er koblet til FEIL kunde (da er navnet en
// advarsel). Begge er den samme sammenligningen, og begge gjøres på enheten
// mot leadlista som allerede ligger i minnet — ingen runde til serveren.
//
// Teksten kommer fra Vision-OCR av blekk. Den er støyete: «Neras» kan bli
// «Nems», og punktum havner tilfeldig. Derfor er regelen streng på HVA som
// teller som treff (hele ord, minst fire tegn) i stedet for å prøve å være
// smart med stavefeil. Et forslag som er feil én gang av ti blir slått av.

import Foundation

enum NexusSelskapstreff {

    /// Selskapsformer som ikke skiller noe fra noe. «Nordic Elektro AS» og
    /// «Nordic Elektro» er samme selskap, og «AS» alene er ikke et treff.
    private static let selskapsformer: Set<String> = [
        "as", "asa", "ans", "da", "ba", "sa", "nuf", "enk", "kf", "if",
        "ltd", "inc", "gmbh", "ab", "oy", "aps",
    ]

    /// Ord som er for vanlige til å bære et treff alene.
    private static let forVanlig: Set<String> = [
        "norge", "norsk", "norske", "gruppen", "group", "holding", "invest",
        "service", "senteret", "senter", "eiendom", "bygg", "partner",
        "partners", "consulting", "solutions", "systemer", "system",
    ]

    /// Navnet uten selskapsform, små bokstaver, uten aksenter og tegnsetting.
    static func ord(i navn: String) -> [String] {
        navn
            .folding(options: [.diacriticInsensitive, .caseInsensitive],
                     locale: Locale(identifier: "nb_NO"))
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .map { $0.lowercased() }
    }

    /// Ordene som faktisk identifiserer selskapet.
    static func kjerne(_ navn: String) -> [String] {
        let ordene = ord(i: navn).filter { !selskapsformer.contains($0) }
        // Et navn som BARE består av vanlige ord beholder dem — «Norsk
        // Gjenvinning» må kunne treffes. Filteret gjelder bare når det
        // finnes noe mer særegent å feste seg ved.
        let saeregne = ordene.filter { !forVanlig.contains($0) }
        return saeregne.isEmpty ? ordene : saeregne
    }

    /// Er selskapet nevnt i teksten?
    ///
    /// Krever at kjerneordene står etter hverandre, i rekkefølge. «Nordic
    /// Elektro» treffer ikke på en tekst som nevner «elektro» i én setning og
    /// «nordic» i en annen — det er to tilfeldige ord, ikke et kundenavn.
    static func nevnt(_ navn: String, i tekst: String) -> Bool {
        let kjernen = kjerne(navn)
        guard !kjernen.isEmpty else { return false }
        // Ett enkelt ord må være langt nok til å ikke treffe ved uhell.
        // «Bo AS» og «IT AS» ville ellers truffet halve norske språket.
        if kjernen.count == 1 && kjernen[0].count < 4 { return false }
        let ordene = ord(i: tekst)
        guard ordene.count >= kjernen.count else { return false }
        for start in 0...(ordene.count - kjernen.count)
        where Array(ordene[start..<(start + kjernen.count)]) == kjernen {
            return true
        }
        return false
    }

    /// Selskapene fra lista som er nevnt i teksten, lengste navn først.
    ///
    /// Rekkefølgen betyr noe: nevner teksten «Neras Direkte Bergen», og begge
    /// finnes som leads, er det den mest spesifikke brukeren mente.
    static func treff(i tekst: String, blant navn: [String]) -> [String] {
        guard !tekst.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return [] }
        return navn
            .filter { nevnt($0, i: tekst) }
            .sorted { kjerne($0).count > kjerne($1).count }
    }

    /// Selskapet notatet burde vært koblet til, gitt hva det ER koblet til.
    ///
    /// `nil` når alt stemmer: enten nevner teksten selskapet notatet allerede
    /// peker på, eller den nevner ingen. Et notat om Neras som er koblet til
    /// Neras skal ikke mase.
    static func avvik(tekst: String, koblet: String?, blant navn: [String]) -> String? {
        let funnet = treff(i: tekst, blant: navn)
        guard let forste = funnet.first else { return nil }
        guard let koblet, !koblet.trimmingCharacters(in: .whitespaces).isEmpty
        else { return forste }
        // Nevnes den koblede kunden i det hele tatt, er notatet om henne —
        // at en annen kunde også nevnes er normalt («samme som hos Neras»).
        return funnet.contains(where: { kjerne($0) == kjerne(koblet) })
            ? nil : forste
    }
}

enum NexusTittelFraTale {

    /// Åpningene et møte alltid har, og som aldri er en tittel.
    private static let apningsfraser = [
        "hei", "hallo", "god morgen", "god dag", "god ettermiddag",
        "takk for at", "hyggelig", "står til", "velkommen", "bare hyggelig",
        "unnskyld", "beklager at", "kan du høre", "hører du meg",
    ]

    /// Tittel fra det som ble sagt.
    ///
    /// Blekk-tittelen tar den øverste linja på arket. Tale er bedre kilde
    /// fordi folk sier hva møtet handler om før de skriver det ned — men
    /// ikke i første setning. Den er «hei, takk for at du tok deg tid».
    static func tittel(fra referat: [Referatsegment], maks: Int = 60) -> String? {
        for segment in referat {
            let tekst = segment.tekst.trimmingCharacters(in: .whitespacesAndNewlines)
            let lav = tekst.lowercased()
            guard tekst.split(separator: " ").count >= 4 else { continue }
            guard !apningsfraser.contains(where: { lav.hasPrefix($0) }) else { continue }
            return kort(tekst, maks: maks)
        }
        return nil
    }

    /// Kutter på ordgrense, ikke midt i et ord.
    static func kort(_ tekst: String, maks: Int) -> String {
        let rent = tekst.trimmingCharacters(in: CharacterSet(charactersIn: " .,:;-–—"))
        guard rent.count > maks else { return rent }
        var bygget = ""
        for ord in rent.split(separator: " ") {
            if bygget.count + ord.count + 1 > maks { break }
            bygget += bygget.isEmpty ? String(ord) : " " + ord
        }
        return bygget.isEmpty ? String(rent.prefix(maks)) : bygget
    }
}
