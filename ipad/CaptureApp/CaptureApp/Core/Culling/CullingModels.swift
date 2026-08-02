// CullingModels.swift
//
// Smart culling: ranger en shoot etter kvalitet og finn nesten-identiske
// frames — helt on-device via Vision (gratis). Denne fila er den RENE,
// TESTBARE kjernen: score-modell + rank/dedupe-logikk uten Vision-avhengighet.
// Vision-analysen (score + feature-print) bor i VisionCullAnalyzer.swift.

import Foundation

/// Kvalitets-score for ett bilde (0…1-verdier fra Vision).
struct PhotoScore: Sendable, Equatable {
    let id: String
    /// Estetikk-score (CalculateImageAestheticsScoresRequest.overallScore, ~ -1…1
    /// normalisert til 0…1 av analysatoren).
    let aesthetics: Float
    /// Apples «utility»-flagg: kvittering/skjermbilde/dokument o.l. → demoteres.
    let isUtility: Bool
    /// Beste ansikts-fangst-kvalitet i bildet (DetectFaceCaptureQuality), eller
    /// nil hvis ingen ansikter (landskap/produkt).
    let faceQuality: Float?

    /// Fase 2b — signaler fra den samlede ``AssetAnalysis`` (delt måling). nil
    /// når ingen analyse/ansikt. `eyesOpen == false` og `faceSoft == true` er
    /// nettopp de kaste-grunnene estetikk + faceQuality alene bommer på.
    var eyesOpen: Bool?
    var faceSoft: Bool?

    /// Samlet rangerings-score. Vekter estetikk + ansikts-kvalitet (når ansikt
    /// finnes); lukkede øyne demoterer hardt, mykt/bommet ansikt moderat;
    /// utility halverer.
    var rank: Float {
        let face = faceQuality ?? aesthetics
        var combined = faceQuality == nil ? aesthetics : (0.6 * aesthetics + 0.4 * face)
        // Lukkede øyne på hovedpersonen = nesten alltid kastekandidat i en burst.
        if eyesOpen == false { combined *= 0.4 }
        // Bommet fokus på ansiktet (ikke vakker bokeh) = moderat demotering.
        if faceSoft == true { combined *= 0.7 }
        return isUtility ? combined * 0.5 : combined
    }
}

struct CullingResult: Sendable, Equatable {
    /// Alle bilder, beste først.
    let ranked: [PhotoScore]
    /// Anbefalte «keepers» — beste av hver duplikat-gruppe + alle unike.
    let keep: [String]
    /// Grupper av nesten-identiske bilder (hver gruppe > 1). Andre enn beste
    /// i gruppen er kandidater for å skjules.
    let duplicates: [[String]]
    /// #6 Scene-/oppsett-klynger i opptaksrekkefølge (alle bilder, inkl.
    /// singletons). Lar fotografen culle én scene av gangen. Tom hvis ikke
    /// beregnet.
    let scenes: [[String]]

    init(ranked: [PhotoScore], keep: [String], duplicates: [[String]], scenes: [[String]] = []) {
        self.ranked = ranked
        self.keep = keep
        self.duplicates = duplicates
        self.scenes = scenes
    }
}

enum CullingEngine {
    /// Grupper bilder hvis parvise feature-print-distanse er under terskelen
    /// (union-find). Returnerer kun ekte grupper (> 1 medlem).
    static func groupDuplicates(
        ids: [String],
        threshold: Double,
        distance: (String, String) -> Double
    ) -> [[String]] {
        var parent: [String: String] = [:]
        for id in ids { parent[id] = id }
        func find(_ x: String) -> String {
            var r = x
            while let p = parent[r], p != r { r = p }
            return r
        }
        func union(_ a: String, _ b: String) { parent[find(a)] = find(b) }

        for i in 0..<ids.count {
            for j in (i + 1)..<ids.count where distance(ids[i], ids[j]) < threshold {
                union(ids[i], ids[j])
            }
        }
        var groups: [String: [String]] = [:]
        for id in ids { groups[find(id), default: []].append(id) }
        return groups.values.filter { $0.count > 1 }.map { $0.sorted() }.sorted { $0[0] < $1[0] }
    }

    /// Ranger + velg keepers. Beholder høyest-rangerte i hver duplikat-gruppe.
    static func cull(scores: [PhotoScore], duplicateGroups: [[String]]) -> CullingResult {
        let ranked = scores.sorted { $0.rank > $1.rank }
        let byId = Dictionary(scores.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

        var demoted = Set<String>()
        for group in duplicateGroups {
            let best = group.max { (byId[$0]?.rank ?? 0) < (byId[$1]?.rank ?? 0) }
            for id in group where id != best { demoted.insert(id) }
        }
        let keep = ranked.map(\.id).filter { !demoted.contains($0) }
        return CullingResult(ranked: ranked, keep: keep, duplicates: duplicateGroups)
    }

    /// #6 Auto-grupper etter scene/oppsett (setup) — så fotografen kan culle
    /// ÉN scene av gangen. Sekvensiell klynging i OPPTAKSREKKEFØLGE: start en
    /// ny scene når feature-print-distansen fra scenens ANKER (første frame)
    /// overstiger `threshold`. Terskelen er STØRRE enn dedupe-terskelen —
    /// dedupe fanger nesten-identiske frames, scene-klynging fanger et helt
    /// oppsett (antrekk/bakgrunn/lokasjon).
    ///
    /// Sekvensiell (ikke union-find på tvers) fordi shoots flyter i tid: alle
    /// bildene i oppsett A, så oppsett B. Det unngår å slå sammen to atskilte
    /// scener som tilfeldigvis ligner (samme bakgrunn, nytt antrekk). `ids`
    /// antas sortert på opptakstid. Returnerer sammenhengende grupper (alle
    /// bilder, inkl. singletons), i rekkefølge.
    static func groupByScene(
        ids: [String],
        threshold: Double,
        distance: (String, String) -> Double
    ) -> [[String]] {
        guard let first = ids.first else { return [] }
        var scenes: [[String]] = []
        var current: [String] = [first]
        var anchor = first
        for id in ids.dropFirst() {
            if distance(anchor, id) < threshold {
                current.append(id)
            } else {
                scenes.append(current)
                current = [id]
                anchor = id
            }
        }
        scenes.append(current)
        return scenes
    }
}
