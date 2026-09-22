import SwiftUI

extension View {
    /// Minste treffområde: 44×44 (Apple HIG).
    ///
    /// Brikken beholder sin egen størrelse — rammen legges rundt den, så
    /// utseendet er uendret mens flaten som tar imot trykket er stor nok.
    /// Brukes på knapper der innholdet (en 11pt-glyf, en tettpakket rad)
    /// ellers gir 26–33pt.
    ///
    /// Merk: på `.borderedProminent` og andre innebygde knappestiler er det
    /// etiketten som bestemmer knappens flate. Der må rammen ligge på
    /// etiketten, ikke utenpå knappen — ellers sentreres bare en liten knapp
    /// i et stort felt.
    func trykkflate(bredde: CGFloat = 44, hoyde: CGFloat = 44) -> some View {
        frame(minWidth: bredde, minHeight: hoyde)
            .contentShape(Rectangle())
    }
}

/// Farger som er justert for tekstkontrast (WCAG AA, 4,5:1).
enum LgKontrast {
    /// Merkelilla gir bare 3,98:1 mot hvit tekst, og den lyse varianten
    /// 2,95:1. Disse to er de samme fargene tonet ned til kravet, og brukes
    /// **bare** der fargen ligger bak tekst — fyll, streker, pins og ikoner
    /// beholder merkefargen.
    static let lillaTekstflate = Color(red: 0.52, green: 0.24, blue: 0.82)
    static let lillaTekstflateLys = Color(red: 0.585, green: 0.351, blue: 0.78)
}

extension Color {
    /// Svart eller hvit tekst — den som gir best kontrast mot denne fargen.
    ///
    /// Terskelen er WCAG-krysningspunktet: kontrasten mot hvit er
    /// `1,05 / (L + 0,05)`, mot svart `(L + 0,05) / 0,05`. De er like når
    /// `L ≈ 0,179`; over det vinner svart. Brukes på flater der bakgrunnen
    /// er data (en selgerfarge, en score-farge) og ikke kan velges fritt.
    var lesbarTekst: Color {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a) else { return .white }
        func lineær(_ c: CGFloat) -> CGFloat {
            c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        let luminans = 0.2126 * lineær(r) + 0.7152 * lineær(g) + 0.0722 * lineær(b)
        return luminans > 0.179 ? Color(white: 0.08) : .white
    }
}
