// NexusSelskapstreffTests.swift
//
// Et forslag som er feil blir slått av. Derfor er de negative testene her
// like viktige som de positive.

import XCTest
@testable import LeadMapApp

final class NexusSelskapstreffTests: XCTestCase {

    private let leads = ["Neras Direkte AS", "Nordic Elektro AS",
                         "Bo AS", "Norsk Gjenvinning AS"]

    // MARK: Gjenkjenning

    func testFinnerSelskapetIHandskriften() {
        XCTAssertEqual(
            NexusSelskapstreff.treff(i: "Møte med Neras Direkte om pris",
                                     blant: leads),
            ["Neras Direkte AS"])
    }

    func testSelskapsformErIkkeNodvendig() {
        XCTAssertTrue(NexusSelskapstreff.nevnt("Nordic Elektro AS",
                                               i: "ringte nordic elektro i dag"))
    }

    func testTalerStorBokstavOgSaeretegn() {
        // Folding er lik på begge sider: å blir a, æ og ø står. Det som
        // betyr noe er at STORE BOKSTAVER fra OCR-en treffer likevel.
        XCTAssertTrue(NexusSelskapstreff.nevnt("Bærum Rør AS",
                                               i: "BÆRUM RØR kommer tilbake"))
        XCTAssertTrue(NexusSelskapstreff.nevnt("Håkons Bygg AS",
                                               i: "hakons bygg ringte"))
    }

    // MARK: Det som IKKE skal treffe

    func testOrdSpredtUtoverTellerIkke() {
        // «nordic» i én setning og «elektro» i en annen er to ord, ikke en
        // kunde. Ellers ville forslaget kommet på halvparten av notatene.
        XCTAssertFalse(NexusSelskapstreff.nevnt(
            "Nordic Elektro AS", i: "nordic design er fint. elektro er dyrt."))
    }

    func testKorteNavnTrefferIkkeVedUhell() {
        XCTAssertFalse(NexusSelskapstreff.nevnt("Bo AS", i: "vi bo her i byen"))
        XCTAssertTrue(NexusSelskapstreff.treff(i: "bo", blant: leads).isEmpty)
    }

    func testDelAvEtOrdErIkkeEtTreff() {
        XCTAssertFalse(NexusSelskapstreff.nevnt("Neras Direkte AS",
                                                i: "nerastoppen borettslag"))
    }

    func testNavnAvBareVanligeOrdBeholderDem() {
        // Filtrerer vi bort «norsk» og «gjenvinning» står navnet igjen tomt.
        XCTAssertTrue(NexusSelskapstreff.nevnt("Norsk Gjenvinning AS",
                                               i: "avtale med norsk gjenvinning"))
    }

    func testTomTekstGirIngenting() {
        XCTAssertTrue(NexusSelskapstreff.treff(i: "   ", blant: leads).isEmpty)
    }

    // MARK: Avvik — feil kunde

    func testUkobletNotatFaarForslag() {
        XCTAssertEqual(
            NexusSelskapstreff.avvik(tekst: "befaring hos Nordic Elektro",
                                     koblet: nil, blant: leads),
            "Nordic Elektro AS")
    }

    func testRiktigKobletNotatMaserIkke() {
        XCTAssertNil(NexusSelskapstreff.avvik(
            tekst: "befaring hos Nordic Elektro", koblet: "Nordic Elektro AS",
            blant: leads))
    }

    func testNevntSammenMedEgenKundeErIkkeAvvik() {
        // «samme løsning som hos Neras» i et Nordic-notat er normalt.
        XCTAssertNil(NexusSelskapstreff.avvik(
            tekst: "Nordic Elektro vil ha samme som Neras Direkte",
            koblet: "Nordic Elektro AS", blant: leads))
    }

    func testHeltAnnenKundeErEtAvvik() {
        XCTAssertEqual(
            NexusSelskapstreff.avvik(tekst: "tilbud til Neras Direkte sendt",
                                     koblet: "Nordic Elektro AS", blant: leads),
            "Neras Direkte AS")
    }

    // MARK: Tittel fra tale

    func testHopperOverHilsenen() {
        let referat: [Referatsegment] = [
            .init(start: 0, varighet: 2, tekst: "Hei, takk for at du tok deg tid"),
            .init(start: 3, varighet: 4, tekst: "Vi vil bytte ut hele varmeanlegget"),
        ]
        XCTAssertEqual(NexusTittelFraTale.tittel(fra: referat),
                       "Vi vil bytte ut hele varmeanlegget")
    }

    func testKorteUtropBlirIkkeTittel() {
        let referat: [Referatsegment] = [
            .init(start: 0, varighet: 1, tekst: "Ja"),
            .init(start: 1, varighet: 1, tekst: "Mhm, ok"),
            .init(start: 2, varighet: 4, tekst: "Prisen er det eneste hinderet nå"),
        ]
        XCTAssertEqual(NexusTittelFraTale.tittel(fra: referat),
                       "Prisen er det eneste hinderet nå")
    }

    func testKutterPaaOrdgrense() {
        let lang = "Vi har bestemt oss for å bytte ut hele ventilasjonsanlegget i bygget"
        let kort = NexusTittelFraTale.kort(lang, maks: 30)
        XCTAssertLessThanOrEqual(kort.count, 30)
        XCTAssertFalse(kort.hasSuffix(" "))
        XCTAssertTrue(lang.hasPrefix(kort), "Kuttet midt i et ord: \(kort)")
    }

    func testBareHilsenerGirIngenTittel() {
        XCTAssertNil(NexusTittelFraTale.tittel(fra: [
            .init(start: 0, varighet: 2, tekst: "Hei hei, hyggelig å se deg"),
        ]))
    }
}
