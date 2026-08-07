# StageOne fase 5 — AI-assistent

**Dato:** 2026-08-07. Bygger på fase 4 (PR #1946). Backend: PR #1947
(stacked på #1945, `feat/stageone-assistant`).

## Flyt

Studio → «AI Assistant»-knappen (tidl. «kommer»-chip) → panel m/ tekstfelt.
Instruks (norsk/engelsk) + gjeldende scene POST-es til
`POST /api/stageone/assistant` (requireUserSession — krever fase 4-innlogging;
utlogget viser «logg inn»-tilstand). Claude (`claude-sonnet-5` via repoets
`callClaudeForJson`, cachet system-prompt) svarer med kompakt patch:

```
{ summary, updatedNodes?: [Node], removedNodeIds?: [String],
  environment?: String, shots?: [Shot] }
```

Node-JSON = Swift-Codable-formen appen selv lagrer (enum-params
`{"light":{"_0":{…}}}`) — Claude speiler scenen den får.

## Applisering (iPad)

`ScenePatcher.apply` (ren funksjon) inne i ÉN `document.mutate` → hele
AI-endringen er én undo:
- upsert per node-id; nye noder legges i riktig gruppe (lights/cameras/talent/studio)
- removedNodeIds renser noder + grupper + shots som pekte på fjernet kamera
- shots-erstatning filtrerer bort ukjente kamera-referanser
- tom patch (kun summary — «umulig instruks») = no-op

Panelet viser kommando-historikk (instruks + AI-summary, rød ved feil) + busy.

## Testing

6 ScenePatcher-tester (upsert/insert+gruppe/remove+rens/shots-filter/no-op/
backend-JSON-dekoding) + full suite. E2E mot prod etter merge av #1945+#1947.

## Ikke i fase 5

Streaming-svar, flerstegs-samtale m/ kontekst (hver instruks er uavhengig),
bilde-input, AI på Lights/Cameras-skjermene (panelet bor i Studio).
