// NexusMedieKo.swift
//
// Offline-kø for medier på Nexus-flata: lyd og video som ble spilt inn i
// felt uten dekning.
//
// Notatene har hatt offline-kø lenge (OfflineActionQueue). Mediene har ikke.
// Et opptak som ikke kom gjennom lå bare i minnet med en peker til en fil på
// disk — og minnet er borte neste gang appen startes. Da ligger bytesene der
// uten at noe vet at de finnes. Et møteopptak man ikke får igjen er det
// dyreste vi kan miste.
//
// Køen ligger for seg selv, ikke i OfflineActionQueue, fordi den skriver hele
// JSON-fila si ved hver endring. Tjue megabyte base64 gjennom den fila ved
// hvert tastetrykk er ikke en kø, det er en bremse. Her ligger bytesene som
// filer, og JSON-en er bare en liste over hva som mangler.

import Foundation

struct VentendeMedie: Codable, Identifiable, Sendable, Equatable {
    var id: String { dokId }
    let dokId: String
    let notatId: String
    let prosjektId: String
    let navn: String
    /// «lyd» / «video» / «pdf» — samme slag som dokument-endepunktet tar.
    let slag: String
    /// Filnavnet i kø-mappa, ikke en full sti.
    ///
    /// iOS bytter containerstien mellom oppstarter. En lagret absolutt URL
    /// peker på ingenting neste gang appen åpnes, og det er akkurat da køen
    /// skal virke.
    let filnavn: String
    let lagtTil: Date
    var forsok: Int
}

actor NexusMedieKo {
    static let delt = NexusMedieKo()

    private let mappe: URL
    private let indeks: URL
    private var koen: [VentendeMedie] = []

    /// Egen mappe gjør køen testbar uten å skrive i appens ekte katalog.
    init(mappe valgt: URL? = nil) {
        let katalog = valgt ?? FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("nexus-medier", isDirectory: true)
        let indeksfil = katalog.appendingPathComponent("ko.json")
        self.mappe = katalog
        self.indeks = indeksfil
        try? FileManager.default.createDirectory(
            at: katalog, withIntermediateDirectories: true)
        if let data = try? Data(contentsOf: indeksfil),
           let lest = try? JSONDecoder().decode([VentendeMedie].self, from: data) {
            // Oppføringer uten fil er tapt uansett — de skal ikke bli
            // liggende og love et opptak som ikke finnes.
            self.koen = lest.filter {
                FileManager.default.fileExists(
                    atPath: katalog.appendingPathComponent($0.filnavn).path)
            }
        }
    }

    var ventende: [VentendeMedie] { koen }

    func ventende(iNotat notatId: String) -> [VentendeMedie] {
        koen.filter { $0.notatId == notatId }
    }

    func venter(dokId: String) -> Bool {
        koen.contains { $0.dokId == dokId }
    }

    /// Legger bytesene på disk og oppføringen i køen.
    ///
    /// Kalles FØR første opplastingsforsøk, ikke etter at det feilet: krasjer
    /// appen midt i opplastingen, er opptaket ellers borte.
    @discardableResult
    func leggTil(dokId: String, notatId: String, prosjektId: String,
                 navn: String, slag: String, data: Data) -> VentendeMedie? {
        let filnavn = "\(dokId).bin"
        let fil = mappe.appendingPathComponent(filnavn)
        do {
            try data.write(to: fil, options: [.atomic, .completeFileProtection])
        } catch {
            return nil
        }
        let ny = VentendeMedie(
            dokId: dokId, notatId: notatId, prosjektId: prosjektId,
            navn: navn, slag: slag, filnavn: filnavn,
            lagtTil: Date(), forsok: 0)
        koen.removeAll { $0.dokId == dokId }
        koen.append(ny)
        lagre()
        return ny
    }

    func bytes(for medie: VentendeMedie) -> Data? {
        try? Data(contentsOf: mappe.appendingPathComponent(medie.filnavn))
    }

    /// Opplastingen kom gjennom: både oppføringen og kopien skal bort.
    func fjern(dokId: String) {
        guard let i = koen.firstIndex(where: { $0.dokId == dokId }) else { return }
        try? FileManager.default.removeItem(
            at: mappe.appendingPathComponent(koen[i].filnavn))
        koen.remove(at: i)
        lagre()
    }

    func bomTur(dokId: String) {
        guard let i = koen.firstIndex(where: { $0.dokId == dokId }) else { return }
        koen[i].forsok += 1
        lagre()
    }

    private func lagre() {
        guard let data = try? JSONEncoder().encode(koen) else { return }
        try? data.write(to: indeks, options: [.atomic, .completeFileProtection])
    }
}
