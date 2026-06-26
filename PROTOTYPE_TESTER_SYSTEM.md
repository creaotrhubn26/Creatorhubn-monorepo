# Prototype-tester-system & Orbit-onboarding — status

_Sist oppdatert: 2026-06-26._

Dette dokumentet oppsummerer hele prototype-tester-systemet for redigerings­partnere
(editing vendors), onboardingen av første tester (Orbit Graphics), og UX-/branding-
arbeidet rundt — pluss hva som gjenstår.

---

## 1. Hva er bygget (alt LIVE i prod)

### Prototype-tester-kjernen
| PR | Innhold | Migrasjon |
|----|---------|-----------|
| **#948** | B: mikro-feedback per levert jobb · A: «du sa → vi gjorde»-sløyfe · E: insentiv (0%-verdi) · F: avtale + graduering · D: AI-temaklynging (admin) · 🔒 personvern-fiks på `GET /api/prototype-testing/feedback` (admin=alt / innlogget=egen / anonym=ingen) | — |
| **#950** | C: atferdssignaler (`prototype_activity_signals`) + `PrototypeWelcome` førstegangs-opplevelse + interaktiv guide som ÅPNER feedback-verktøyet | `0344` |
| **#952** | Trådet feedback-SAMTALE (`prototype_feedback_messages`) — chat-bobler, toveis, varm AI/mal-kvittering, delt `FeedbackConversation` (vendor + admin) | `0345` |

### UX- og handlings-pass
| PR | Innhold | Migrasjon |
|----|---------|-----------|
| **#963** | UniversalChatWidget: admin-gatet Feedback-kontroller + trimmet irrelevante faner for `vendor`-profil | — |
| **#964** | Chat-polish (auto-scroll, tidsstempler, avatarer, skjeletter, tomtilstander, layout) · «Nytt svar»-badge på feedback-sløyfa · ulest-indikator på foto↔vendor job-chat | `0347` |
| (i #964) | **`EditingJobActions`** — smarte hurtighandlinger i job-chatten (deliver/approve/be om revisjon), egen løsning · **`ClientActions`** — mal-handlinger i fotograf↔klient-chat (`ProjectChatPanel`) | — |

### Orbit-readiness + kritiske fikser
| PR | Innhold | Migrasjon |
|----|---------|-----------|
| **#955** | UniversalDashboard `vendor`-profil viste fotograf-shoot-prosjektmodal → nå `VendorProductManager`; shoot-modal avstengt for vendor | — |
| **#960** | `GET /api/editing/vendor/jobs` lakk klient-PII (`photographer_email`, Stripe-ID-er, token, plattformøkonomi) via `SELECT *` → stram allow-list | `0346` (gjør `prototype_feedback.project_id/client_id/feedback` nullable — innsending var 100% ødelagt) |
| **#967** 🛑 | **KRITISK:** `vendor_onboarding_profiles.id`-default var den literale strengen `'gen_random_uuid()'` → PK-kollisjon → 500 på ALL partner-godkjenning. Fiks: default + eksplisitt `crypto.randomUUID()` | `0348` |

### Konsoll-opprydding
| PR | Innhold |
|----|---------|
| **#970 + #974** | `GET /api/communication/conversations` 500 → tom-identitet short-circuit + rå SQL med eksplisitte `ARRAY[...]` (drizzle bandt array-param feil) |
| **#976** | Implementerte de manglende valgfrie analyse-endepunktene (`crm/analytics/leads|sales`, `admin/analytics/business`, `admin/academy/refunds`) — var 404-støy |

### E-postrapport + branding
| PR | Innhold |
|----|---------|
| **#978** | Fremdriftsrapport på e-post om prototype-testerne + admin-innstillinger (mottaker + på/av + «Send nå») + ukentlig GitHub Actions-cron |
| **#980 + #983** | E-post-branding: `composeEmail(brand:'creatorhub')` byttet bare logoen — badge/footer/copyright OG hele paletten var Role Room. Nå merkevare-bevisst (oransje «Creatorhub» + varm mørk palett). Retter ALLE Creatorhub-e-poster |

---

## 2. Orbit Graphics LTD — status

- **Godkjent** som prototype-tester: 0% gebyr til **2026-12-26** (deretter 15%), engelsk-flyt (`language=en`), BD/utenfor-EØS.
- **Logget inn** 26.6 kl. 14:05 (fra Bangladesh), **så velkomst-opplevelsen**, utforsker workspacet — særlig **compliance-fanen** (SCC/TIA kreves for ikke-EØS).
- Velkomst-e-post levert (`editing_partner_portal_welcome`, sent).
- Ingen feedback eller oppdrag ennå (forventet på dag 1).
- Andre tester i systemet: **GoldWeddingMedia** (ikke logget inn ennå).

---

## 3. Operasjonelle notater

- **Migrasjoner 0344–0348** er påført prod **manuelt via psql** (`/tmp/dburl`). Start-scriptet er `node server.js` (IKKE `migrate.sh`), så migrasjoner kjører **ikke** automatisk på deploy. De nye tabellene selv-opprettes også lazily (`ensureTable`) i backend, men en fersk DB-bygging må kjøre migrate.sh.
- **Frontend deployer IKKE automatisk** på merge — manuell `vercel --prod` fra eksakt `origin/main` (creatorhub-frontend). Backend auto-deployer på Render fra main.
- **Backend har ingen tsc-gate** (esbuild) — verifiser SQL direkte mot prod før deploy.
- **Rapport-cron:** «Prototype-tester fremdriftsrapport» (GitHub Actions, mandager 08:00 UTC) + `CRON_TRIGGER_TOKEN`. Mottaker/på-av styres i admin-dashbordet (Redigeringspartnere → Prototype-testere). «Send nå» for on-demand.

---

## 4. Hva gjenstår / neste steg

1. **Orbit:** fullføre compliance (SCC + TIA) → så klar for første oppdrag. Følg med på første tilbakemelding for å se samtale-sløyfen + AI-kvitteringen live.
2. 🔑 **Roter eksponerte nøkler** (stående siden tidligere): Render API-key, ASC issuer/key, RunPod-key, eventuelle sesjons-tokens.
3. **AI-temaklynging (D):** ingen data ennå — verifiser at `ANTHROPIC_API_KEY` funker ved første reelle bruk (den er satt i Render).
4. **Rapport-finjustering (valgfritt):** daglig frekvens i onboarding-fasen? Flere mottakere? Mer detalj per tester (siste feedback-tittel, compliance-status)?
5. **Analyse-endepunkter:** scopet til innlogget brukers EGNE kunder (owner/assigned). Bekreft at det er ønsket scope for admin (vs. org-bredt).
6. **C (atferdssignaler) videre:** vurder å vise signal-tidslinje per tester i admin (ikke bare aggregat-chip).
7. **Branding:** bekreft at den oransje/varme e-post-paletten treffer; juster nyanse ved behov.
