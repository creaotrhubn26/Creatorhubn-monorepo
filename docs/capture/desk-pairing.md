# Capture ↔ Desk: paring-protokoll

Hvordan iPad CaptureApp parres med Creatorhub One Desk (Mac) over LAN.

**Status (2026-05-30):** Mac-siden er ferdig implementert i `apps/creatorhub-one-desk/`. iPad-siden er **ikke** implementert ennå — dette dokumentet er spec'en som beskriver hva CaptureApp må gjøre.

## Arkitektur

```
┌────────────────────────────┐         ┌────────────────────────────┐
│  iPad CaptureApp           │         │  Creatorhub One Desk (Mac) │
│                            │         │                            │
│  Bonjour advertise         │ ───►    │  Bonjour browse            │
│  _creatorhubcap._tcp       │         │  _creatorhubcap._tcp       │
│                            │         │                            │
│  Vis "Par med Desk"-PIN    │ ◄───    │  Generér 4-sifret PIN     │
│  Tast inn PIN, send POST   │ ───►    │  Lagre i paired.json      │
└────────────────────────────┘         └────────────────────────────┘
```

## Bonjour-tjeneste som iPad må advertise

**Service type:** `_creatorhubcap._tcp` (vises som `_creatorhubcap._tcp.local.` på wire)
**Default port:** Anbefalt `8443` (eller hvilket som helst — iPad velger)
**Hostname:** vanlig device-hostname (f.eks. `Daniels-iPad-Pro.local.`)

**TXT-record (PÅKREVD):**
| Nøkkel | Beskrivelse | Eksempel |
|---|---|---|
| `device_id` | Stabil iPad-ID, fra `UIDevice.current.identifierForVendor.uuidString` | `1A2B3C4D-...-...` |
| `device_name` | Visningsnavn | `Daniels iPad Pro` |
| `app_version` | CaptureApp-versjon | `0.1.3` |

Hvis `device_id` mangler, vil Desk vise iPad-en i UI-listen men markere den med ⚠ og blokkere paring.

## Swift-implementasjon (CaptureApp-side)

### 1. Bonjour advertise på app-launch

```swift
import Network

final class PairingAdvertiser {
    private var listener: NWListener?

    func start() {
        guard listener == nil else { return }
        let params = NWParameters.tcp
        let listener = try? NWListener(using: params, on: 8443)
        guard let listener else { return }

        let txt = NWTXTRecord([
            "device_id": UIDevice.current.identifierForVendor?.uuidString ?? "unknown",
            "device_name": UIDevice.current.name,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0",
        ])
        listener.service = NWListener.Service(
            name: UIDevice.current.name,
            type: "_creatorhubcap._tcp",
            domain: nil,
            txtRecord: txt.data
        )
        listener.newConnectionHandler = { [weak self] conn in
            self?.handlePairRequest(conn)
        }
        listener.start(queue: .main)
        self.listener = listener
    }
}
```

### 2. PIN-confirmation-skjerm

Når brukeren navigerer til Settings → "Par med Desk", vis:
- En tekst: "Tast inn PIN som vises på Desk-appen"
- 4-sifret input
- "Bekreft"-knapp

På bekreft: send `POST` til Desk's lokale endepunkt (Desk advertiser dette i samme `_creatorhubcap._tcp`-tjeneste — eller bruker et separat `_creatorhubdesk._tcp` — TBD).

```http
POST http://<desk-ip>:<desk-port>/api/desk/pair
Content-Type: application/json

{
  "device_id": "1A2B3C4D-...",
  "device_name": "Daniels iPad Pro",
  "pin": "1234"
}
```

Desk svarer `200 OK` hvis PIN matcher, `401` ellers. Etter 200: iPad lagrer Mac's identitet (Bonjour-fullname + adresse) for fremtidige sessions.

### 3. Etter paring

Etter vellykket paring er begge sider klare for F6 (live mirror):
- iPad fortsetter å publishe assets til backend via `/api/capture/*` (uendret)
- Desk subscriber til iPad's session WebSocket (krever shared secret etablert under paring, F6-arbeid)

## Hva F5 dekker IKKE

- **Automatisk PIN-confirmation:** Per nå har Desk en "Bekreft manuelt"-knapp som operatøren klikker etter at iPad-brukeren har tastet PIN. Når CaptureApp er oppdatert med Bonjour + POST, fjernes den knappen.
- **Lokal HTTP-server på Desk:** Mac-siden mangler ennå et lokalt API-endepunkt for `POST /api/desk/pair`. Legges til når CaptureApp støtter det. For nå: PIN vises, manuell bekreft.
- **Shared secret:** Per nå brukes bare device_id. F6 introduserer en delt nøkkel etablert under paring som autentiserer WebSocket-tilkoblingen.

## Sikkerhetsnotater

- Paring er LAN-bundet. iPad og Mac må være på samme nettverk.
- PIN utløper etter 5 minutter på Desk-siden.
- Paired iPad-er lagres i `~/.creatorhub-one-desk/paired.json` med 0600-permissions.
- Ingen Bonjour-discovery sender det fysiske media-innholdet — kun metadata. Selve session-streamen i F6 vil være TLS-kryptert med shared secret.
