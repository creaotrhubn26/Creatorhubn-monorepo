# Post Agent Bridge — UXP-plugin for Photoshop

Lokal bro mellom **The Role Room Post Agent** (Tauri-app) og Adobe Photoshop.
Pluginen åpner en WebSocket-tilkobling til `ws://localhost:1733` som Post Agent
lytter på, og oversetter innkommende kommandoer til Photoshop-handlinger.

## Hva pluginen kan i v1

| Kommando                | Beskrivelse                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `ping`                  | Helse-sjekk, returnerer `{ pong: true, time }`.                   |
| `app.info`              | Photoshop-versjon + liste over åpne dokumenter.                   |
| `doc.open`              | Åpne en `.psd`/`.psb`/`.jpg`/`.tiff` fra absolutt path.           |
| `doc.save`              | Lagre aktivt dokument i stedet.                                   |
| `doc.export`            | Eksporter aktivt dokument til JPG / PNG / PSD / TIFF.             |
| `smartObject.replace`   | Bytt innhold i et navngitt smart-object-layer.                    |
| `text.setContents`      | Endre tekst i et navngitt text-layer.                             |
| `layer.toggle`          | Skru et navngitt layer av/på.                                     |

Pluginen pusher også `photoshop.action`-events ved `open` / `close` /
`select` / `make`, så Post Agent kan reagere på doc-bytte i sanntid.

## Sideload for utvikling

1. Installer **Adobe UXP Developer Tool** (UDT) — gratis fra Creative Cloud.
2. Start UDT.
3. **Add Plugin** → velg `apps/post-agent-photoshop-plugin/manifest.json`.
4. Med Photoshop åpent → klikk **Load** på rad-en.
5. I Photoshop: **Window → Extensions (UXP) → Post Agent Bridge**.

Panelet skal vise grønn prikk + "Tilkoblet Post Agent" så snart Post Agent-
appen kjører lokalt og hører på port 1733.

Endrer du `index.js`, klikk **Reload** i UDT — ingen restart av Photoshop
nødvendig.

## Trådmodell

- All Photoshop DOM-mutasjon kjøres i `core.executeAsModal()`.
- WebSocket auto-reconnecter med exponensiell backoff
  (`500ms → 8s` max), og pluginen sender `hello` ved hver vellykkede
  tilkobling slik at Tauri-siden vet hvilken versjon som kjører.

## Distribusjon senere

For v1 sideloader vi via UDT (gratis, ingen Adobe-konto kreves utover
en Creative Cloud-bruker). Når vi er klare for ekte distribusjon kan vi:

1. Pakke som `.ccx` via UDT (lokal installer).
2. Sende inn til **Adobe Exchange** for offentlig listing (krever Adobe
   Developer-konto + review-prosess).

Inntil videre — UDT sideload.

## Begrensninger

- Krever Photoshop 23+ (UXP-host floor).
- Bare én aktiv plugin-instans per Post Agent-app om gangen — en
  ny tilkobling overskriver den forrige (Tauri-siden teller siste
  vinner).
- Smart-object-replace bruker `placedLayerReplaceContents` via
  batchPlay; layer må allerede være et smart object.
