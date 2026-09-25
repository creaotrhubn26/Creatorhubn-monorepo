//
// NexusBackendE2ETests.swift
//
// Nexus mot en EKTE backend, ikke mot demodata.
//
// De øvrige Nexus-testene kjører med QA_DEMO=1 og deterministiske lokale
// notater. De sier at flaten tegner, ikke at den snakker med serveren. Denne
// gjør det motsatte: appen peker på en vert som kjører de ekte rutene mot en
// ekte Postgres, og vi ser om notatene faktisk kommer fram.
//
// Det var nettopp denne forskjellen som skjulte at lesing svarte 500 i
// produksjon mens skriving virket.
//
// Kjøres bare når NEXUS_E2E_BASE_URL er satt, slik at den vanlige suiten
// ikke krever en kjørende backend:
//
//   NEXUS_E2E_BASE_URL=http://127.0.0.1:5199 \
//   NEXUS_E2E_PROJECT_ID=… NEXUS_E2E_ORG_ID=… \
//   xcodebuild test -only-testing:LeadMapAppUITests/NexusBackendE2ETests …
//
import XCTest

final class NexusBackendE2ETests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// Miljøet testen trenger, eller nil når den skal hoppes over.
    private func oppsett() throws -> (base: String, prosjekt: String, org: String)? {
        let env = ProcessInfo.processInfo.environment
        guard let base = env["NEXUS_E2E_BASE_URL"], !base.isEmpty,
              let prosjekt = env["NEXUS_E2E_PROJECT_ID"], !prosjekt.isEmpty,
              let org = env["NEXUS_E2E_ORG_ID"], !org.isEmpty else {
            return nil
        }
        return (base, prosjekt, org)
    }

    private func appMotBackend(_ o: (base: String, prosjekt: String, org: String)) -> XCUIApplication {
        let app = XCUIApplication()
        // Ingen QA_DEMO: vi vil ha nettverket, ikke de lokale notatene.
        app.launchEnvironment["LEADGRID_API_BASE_URL"] = o.base
        app.launchEnvironment["QA_BEARER_TOKEN"] = "e2e-token"
        app.launchEnvironment["QA_ORGANIZATION_ID"] = o.org
        app.launchEnvironment["QA_PROJECT_ID"] = o.prosjekt
        // Ingen QA_TAB: faneindeksen er ikke stabil — den avhenger av hvilke
        // moduler organisasjonen har. Vi navigerer etter navn i stedet.
        return app
    }

    func testNexusListerNotaterFraEkteBackend() throws {
        guard let o = try oppsett() else {
            throw XCTSkip("NEXUS_E2E_* ikke satt — hopper over backend-e2e.")
        }
        let app = appMotBackend(o)
        app.launch()

        // Fanen heter Nexus på omdøpings-grenen og Canvas på main. Denne
        // testen handler om DATA, ikke om navnet — så den godtar begge, og
        // lar #2487 eie navnespørsmålet.
        // Nexus skal stå i «Arbeid», synlig uten å utvide noe. Sto den
        // fortsatt under «Flere funksjoner», ville dette feilet — og det er
        // meningen: en flate man bruker i hvert møte skal ikke ligge bak en
        // sammenklappet seksjon.
        let fane = app.buttons.matching(
            NSPredicate(format: "label == %@ OR label == %@", "Nexus", "Canvas")
        ).firstMatch
        XCTAssertTrue(
            fane.waitForExistence(timeout: 40),
            "Fant ikke Nexus i sidepanelet uten å utvide «Flere funksjoner».")
        fane.tap()

        let tittel = app.staticTexts.matching(
            NSPredicate(format: "label == %@ OR label == %@", "Nexus", "Canvas")
        ).firstMatch
        if !tittel.waitForExistence(timeout: 30) {
            // Si HVA appen viser i stedet. «Fant ikke elementet» alene gjør
            // at neste person må gjette.
            let synlig = app.staticTexts.allElementsBoundByIndex
                .prefix(25).map { $0.label }.filter { !$0.isEmpty }
            let knapper = app.buttons.allElementsBoundByIndex
                .prefix(20).map { $0.label }.filter { !$0.isEmpty }
            let bilde = XCTAttachment(screenshot: app.screenshot())
            bilde.name = "nexus-e2e-fastlast"
            bilde.lifetime = .keepAlways
            add(bilde)
            XCTFail("""
                Fant verken Nexus- eller Canvas-tittelen.
                Tekster: \(synlig.joined(separator: " | "))
                Knapper: \(knapper.joined(separator: " | "))
                """)
            return
        }

        // Notatene er sådd i backend med denne tittelen. Kommer de fram, har
        // appen snakket med serveren, fått en gyldig liste, og tegnet den.
        let notat = app.buttons.containing(
            NSPredicate(format: "label CONTAINS %@", "XCUITest notat")
        ).firstMatch
        if !notat.waitForExistence(timeout: 30) {
            let tekster = app.staticTexts.allElementsBoundByIndex
                .prefix(30).map { $0.label }.filter { !$0.isEmpty }
            let bilde = XCTAttachment(screenshot: app.screenshot())
            bilde.name = "nexus-e2e-ingen-notater"
            bilde.lifetime = .keepAlways
            add(bilde)
            XCTFail("""
                Ingen notater fra backend.
                Skjermen viser: \(tekster.joined(separator: " | "))
                """)
            return
        }

        let treff = app.buttons.containing(
            NSPredicate(format: "label CONTAINS %@", "XCUITest notat")
        ).count
        XCTAssertGreaterThanOrEqual(treff, 1, "Forventet minst ett sådd notat.")

        let skjermbilde = XCTAttachment(screenshot: app.screenshot())
        skjermbilde.name = "nexus-mot-ekte-backend"
        skjermbilde.lifetime = .keepAlways
        add(skjermbilde)
    }
}
