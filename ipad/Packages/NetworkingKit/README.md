# NetworkingKit

Transportlaget iPad-appenes API-klienter deles om.

## Hvorfor pakken finnes

`CaptureApp` hadde to HTTP-klienter med hver sin halvdel av det riktige:

| | `BackendClient` | `DashboardClient` |
|---|---|---|
| Feilmapping (401/403, 404) | ✅ | delvis |
| Timeout | ❌ | ✅ 30 s |
| Retry m/backoff og jitter | ❌ | ✅ |

En tredje app ville arvet én av halvdelene, ikke begge. Denne pakken er
begge.

## Hva den ikke gjør

Den kjenner ingen endepunkter. `BackendClient` sine ~40 domenemetoder —
`deliverToShowcase`, `submitAssetVoiceReview`, `fetchWeddingTimelineBrief` —
blir liggende i appen. Dette er røret, ikke det som går gjennom det.

## Regelen som betyr mest

**Bare idempotente kall gjentas.** En POST som ser ut til å ha feilet kan ha
kommet fram likevel, og et blindt nytt forsøk gir dobbel innsending. På et
filmsett med 4G som kommer og går er det ikke en teoretisk fare.

`HTTPTransport` avgjør dette selv av metoden — kallstedet kan ikke be om
retry på en POST.

## Bruk

```swift
let transport = HTTPTransport(
    baseURL: URL(string: "https://api.example.no")!,
    authHeaders: ["Authorization": "Bearer …"],
)

let projects: ProjectList = try await transport.get("/api/projects?limit=50")
try await transport.postIgnoringResponse("/api/events", body: batch)
```

For kall som ikke er JSON inn/JSON ut — multipart, signerte S3-PUT-er — bygg
forespørselen med `makeRequest(path:method:)` og send den med `send(_:)`.
