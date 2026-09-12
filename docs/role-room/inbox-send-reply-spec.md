# Inbox «Send svar» — spesifikasjon (ikke bygd: krever live Meta-test)

Status: **drafting fungerer (Kopiér), faktisk sending er BEVISST ikke implementert.**

Reply-drafting (`role-room-agent-inbox-reply.ts`) lager et utkast fra én enkelt
kommentar/DM og viser det redigerbart i `SocialInboxPanel`. Knappen «Send»
finnes ikke ennå fordi den utfører en **Meta public-write** (poster et offentlig
kommentarsvar eller sender en DM til en ekte kundes publikum). En slik handling
kan ikke verifiseres uten live Meta-credentials, og feil mål/innhold er
irreversibelt. Derfor: spec her, bygges når noen kan teste mot ekte konto.

## Hva vi har å mappe fra (`social_events`)

| kind | nøkkel-felt på raden | hva som trengs for å svare |
|---|---|---|
| `comment` / `reply` / `mention` | `external_post_id` = kommentar-/post-id, `account_id` = IG/FB-konto | Graph **comment-reply**-kall (nytt) |
| `dm` | `external_thread_id` = avsenderens id, `account_id` | resolve til en **conversation**, så eksisterende reply-endepunkt |

Eierskap er allerede skopet i Inbox via `account_id IN (ownedSocialAccountIdsSql)`.

## Path A — DM-svar (lavest risiko: gjenbruker testet kode)

Det finnes ALLEREDE et produksjons-brukt endepunkt (CRM IG-innboksen bruker det):

```
POST /api/role-room/instagram/messaging/conversations/:conversationId/reply
     { connectionId, text }
```
— det treffer Graph, respekterer Metas 24-timers-vindu + reply-only-regler, og
er eier-skopet via `getConversation(pool, conversationId, userId)`.

**Det som mangler:** en `social_events`-DM-rad bærer `external_thread_id`
(avsender-id), ikke en `conversationId`. Bygg en resolver:

1. Gitt `(account_id, external_thread_id)` fra DM-raden, slå opp conversationen i
   IG-messaging-conversations-tabellen (samme tabell `getConversation` leser) på
   deltaker/avsender + connection. Hvis DM-innboksen ikke har ingestet
   conversationen, returnér «kan ikke svare herfra — åpne CRM-innboksen».
2. Med `conversationId` + `connectionId` (utled fra `account_id` → IG-connection),
   kall reply-endepunktet over med det redigerte utkastet.

Risiko: lav for selve sendingen (gjenbruker testet Graph-kall); resolveren bør
fail-closed og live-testes på én ekte DM først.

## Path B — Kommentar-/omtale-svar (nytt Graph-kall)

Ikke noe eksisterende endepunkt. Trengs:

```
POST https://graph.facebook.com/v21.0/{external_post_id}/replies
     ?message={text}&access_token={PAGE_TOKEN}
```
(`external_post_id` = kommentar-id; PAGE_TOKEN utledes som i
`role-room-leads-producer-routes.ts` sin `getPageToken`). Eier-sjekk:
`account_id` må være i kallerens egne kontoer. Plattform-forskjeller:
IG-kommentarer vs. FB-Page-kommentarer har ulike id-formater men samme
`/replies`-mønster; TikTok/LinkedIn har egne API-er (ikke dekket).

## Anbefalt trygg utrulling

1. Nytt endepunkt `POST /api/role-room/social/inbox/:eventId/send-reply`
   (feature-flag `role-room-agent-producer` + admin-session + eier-gate +
   rate-limit, som draft-endepunktet). Body: `{ text }`.
2. Backend velger Path A/B ut fra `kind`. **Bak en egen kill-switch**
   (`ROLE_ROOM_INBOX_SEND_ENABLED=false` default) til live-testet.
3. UI: bytt «Kopiér» → «Send» bare når flagget er på; behold Kopiér som fallback.
4. Live-test: én ekte kommentar + én ekte DM på en testkonto, verifiser at svaret
   havner riktig sted, FØR flagget skrus på i prod.

## Hvorfor ikke bygd nå

Posting til ekte sosiale kontoer er en irreversibel, utadrettet handling. Uten
mulighet til å teste mot Meta ville et blindt-bygd «Send» risikere å poste feil
innhold eller til feil mål i produksjon. Spec-en over gjør det til en liten,
trygg jobb når noen har en testkonto.
