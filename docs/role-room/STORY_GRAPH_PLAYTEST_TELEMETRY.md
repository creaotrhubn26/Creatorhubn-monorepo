# Story Graph — spilltest-telemetri (Fase 8e)

Spillet sender hendelser per scene til Story Graph, og scenekortets **Spilltest**-fane viser økter,
drop-off (økter som slutter i scenen uten `complete`), median tid, dødsfall og valgfordeling.
Hjem-KPI «Spilltest» viser økter siste 7 dager og verste drop-off.

## Flyt

1. **Integrasjoner-fanen** (`?tab=integrations`) → «Opprett token». Tokenet (`sgp_…`) vises **én gang**
   og lagres kun som sha256-hash. Legg det i spillets build-konfigurasjon (xcconfig/secrets), ikke i kildekoden.
   Tokens utløper etter 90 dager (1–365 kan settes) og tilbakekalles i samme fane.
2. Spillet sender batcher (≤ 500 hendelser) til
   `POST /api/role-room/narrative/playtest/events` med `Authorization: Bearer sgp_…`.
3. Svar er **alltid 204** — også for ukjent/tilbakekalt token (hendelsene droppes stille) og for
   ugyldige enkelt-hendelser. Kun to unntak: `413` ved > 500 hendelser i én batch, `429` ved > 600
   kall/min per token (`Retry-After: 60`). Spillet skal aldri blokkere på svaret.

## Payload

```json
{ "events": [
  { "sessionId": "8f3e…", "sceneCode": "P01", "event": "enter",  "build": "1.0 (42)", "deviceClass": "iPad Pro M1" },
  { "sessionId": "8f3e…", "sceneCode": "P01", "event": "choice", "connectionId": "ncn_…", "tMs": 12000 },
  { "sessionId": "8f3e…", "sceneCode": "P01", "event": "exit",   "tMs": 41000 },
  { "sessionId": "8f3e…", "sceneCode": "P02", "event": "death",  "tMs": 9000, "payload": { "cause": "bound" } }
]}
```

| Felt | Krav |
|---|---|
| `sessionId` | 1–80 tegn, **tilfeldig per spilløkt** (aldri bruker-id, enhets-id eller e-post) |
| `sceneCode` | scenekode eller arbeids-ID (`P01`, `G03A`); normaliseres til store bokstaver |
| `event` | `enter · exit · choice · checkpoint · death · complete · custom` |
| `tMs` | valgfri, ms siden scenen ble entret (`exit` med `tMs` gir median tid) |
| `connectionId` | valgfri, koblings-id fra `export.json` (gir valgfordeling) |
| `build`, `deviceClass` | valgfrie (≤ 100 / ≤ 40 tegn); `build` kan filtreres på i UI |
| `payload` | valgfritt objekt ≤ 2 000 tegn serialisert (større erstattes med `{ "truncated": true }`) |

Ingen PII: tabellen `narrative_playtest_events` (migrasjon `0644_narrative_playtest.sql`) har ingen
bruker-kolonner. Retensjon 90 dager: `DELETE FROM narrative_playtest_events WHERE received_at < now() - interval '90 days'`
(kjøres manuelt eller i en vedlikeholdsjobb; ikke automatisert ennå).

## Fra runtime-motoren (`onEvent`)

`createPlaySession(graph, { onEvent })` i JS-pakken (`@creatorhub/story-graph-runtime`) og
`StoryGraphSession.onEvent` i Swift-pakken gir `enter/choose/branch/jumper/restart/set/back` med
element-id, koblings-id og mål-id. Spillet mapper element → scenekode selv (f.eks. via `customId`).
Eksempel: `packages/story-graph-runtime/js/examples/playtest-telemetry.mjs`.

## Swift (iPad-runtime)

```swift
final class PlaytestTelemetry {
    private let url: URL; private let token: String
    private var queue: [[String: Any]] = []
    private let sessionId = UUID().uuidString
    init(baseURL: URL, token: String) { url = baseURL.appendingPathComponent("api/role-room/narrative/playtest/events"); self.token = token }

    func track(_ event: String, scene: String, tMs: Int? = nil, connectionId: String? = nil) {
        var e: [String: Any] = ["sessionId": sessionId, "sceneCode": scene, "event": event,
                                "build": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "",
                                "deviceClass": UIDevice.current.model]
        if let tMs { e["tMs"] = tMs }
        if let connectionId { e["connectionId"] = connectionId }
        queue.append(e)
        if queue.count >= 50 { flush() }
    }

    func flush() {
        guard !queue.isEmpty, let body = try? JSONSerialization.data(withJSONObject: ["events": queue]) else { return }
        queue.removeAll()
        var req = URLRequest(url: url); req.httpMethod = "POST"; req.httpBody = body
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        URLSession.shared.dataTask(with: req).resume() // fire-and-forget: svaret er alltid 204
    }
}
```

Koble til runtime: `session.onEvent = { ev in telemetry.track(ev.kind == .choose ? "choice" : "enter", scene: sceneCode(for: ev.elementId), connectionId: ev.connectionId) }`,
og kall `telemetry.flush()` ved `applicationDidEnterBackground`.

## Sikkerhet

- Token-hash (sha256) i `narrative_playtest_tokens.token_hash`; råtokenet finnes bare hos spillet.
- Ukjent token svarer likt som gyldig (204) — ingen enumerering. Per-token rate-limit i minnet.
- Aggregat-endepunktet `GET /projects/:id/playtest/summary?build=&days=` krever prosjekttilgang.

Kode: `backend/server/role-room-narrative-playtest.ts` (+ test), ruter i `role-room-narrative-routes.ts`,
UI `narrative/scenes/ScenePlaytestTab.tsx` og `narrative/integrations/IntegrationsPanel.tsx`.
