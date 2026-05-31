# The Role Room Talents — Roadmap

## 🎯 BankID-integrasjon (P0 fremtidig)

**Målet er at consent-flowen skal kobles opp mot BankID.** Det gir oss:

### Hvorfor BankID
1. **Anti-falske profiler** — kun ekte personer kan registrere talent-profil
2. **Juridisk gyldig samtykke** — BankID-signering er likestilt skriftlig samtykke (eIDAS QES)
3. **GDPR-tryggere** — vi kan bevise hvem som faktisk ga samtykke (talent vs partner)
4. **Stella-tillit** — agency vet at "Karl Hansen" er ekte Karl Hansen, ikke en katfish

### Hvor BankID skal kobles inn
1. **Talent-profil oppretting** — første gang en talent registrerer seg → BankID-signering bekrefter fødselsdato, navn, fnr (krypter / hash på serveren)
2. **Reverse-consent accept** — når Stella foreslår Karl og Karl klikker accept-lenken → BankID-signering for å bekrefte "ja, jeg samtykker til at Stella ser min profil med disse scopes"
3. **GDPR-sletting** — slett-konto-handlingen krever BankID-signering (forhindrer ondsinnet sletting fra hijacket konto)
4. **Trekke consent** — kan gjøres uten BankID (skal være enkelt)
5. **Føderert ID-portering** — talent kan migrere profil mellom plattformer med BankID-bekreftet identitet

### Teknisk implementasjon (når vi gjør det)
- **Provider**: BankID Norge via Signicat eller direkte (krever avtale)
- **Cost**: ~3-8 NOK per signering
- **Library**: `@signicat/oidc-client` eller direkte OIDC-flyt
- **Env-vars**: `BANKID_CLIENT_ID`, `BANKID_CLIENT_SECRET`, `BANKID_REDIRECT_URI`, `BANKID_ISSUER_URL`
- **Migrasjon**: `talents.bankid_verified_at TIMESTAMPTZ`, `bankid_subject_hash VARCHAR(64)`,
  `bankid_signed_consent_id` på `talent_consent_registry`
- **UI**: BankID-knapp + redirect → BankID-app → tilbake med signature payload
- **Audit**: hver BankID-signering logges i `talent_bankid_audit` (signed_at, signature_jws, scope_signed)

### Faser
- **Fase A** (P0): BankID-verifisering ved profil-oppretting (én gang per talent)
- **Fase B** (P1): BankID-signering på consent-accept fra agency-proposal
- **Fase C** (P2): Workflow-styrking (slett-konto, audit-fix, identity-portability)

## 👶 Barne-talents (GDPR art. 8 + norsk lov)

**Norsk casting-bransje har mange barneskuespillere** (Skam, Heksene, Nokas, etc.).
Loven krever foresatte-samtykke for barn under 18, med strengere regler for barn under 16:

### Regler per alder
- **Under 13**: Foreldre/foresatt-samtykke alene. Barn skal IKKE signere selv.
  Vi mottar foreldres BankID + bekreftelse på foresatt-rolle.
- **13–15**: Foreldre/foresatt + barnets eget samtykke (parallell flyt).
  Foreldres BankID + barnets BankID (eller bekreftelse via Mitt ID).
- **16–17**: Barnet kan signere selv via BankID, men foreldre må varsles
  + ha rett til å overstyre (norsk barnelov § 33).
- **18+**: Normal flyt, kun talent signerer.

### Implementasjons-design
- Nytt felt `talents.is_minor BOOLEAN` + `guardian_user_id` FK
- Migrasjon: `talent_guardians` (talent_id, guardian_user_id,
  guardian_bankid_subject_hash, role: 'parent'|'guardian', confirmed_at)
- Reverse-consent-flow (agency foreslår barn) må sende invite til
  BÅDE talent (hvis 13+) OG foresatte → begge må akseptere
- I "Foreslå ny skuespiller"-dialogen: hvis `birthdate` viser < 18,
  vis ekstra felt for foresattes e-post → vi sender til begge
- Special-handling: `talent_consent_registry` får
  `guardian_signed_at TIMESTAMPTZ` for barn-consents
- UI: badge "👨‍👩‍👧 Foresatt-bekreftet" på barn-profiler i talent-grid

### Hva som krever ekstern hjelp
- Juridisk gjennomgang av norsk barnelov + DSA-implikasjoner
- Forsterket DPA med BankID-provider om barn-data
- Spesial-personvern-tekst for barn-profiler (lett-tilgjengelig språk)
- Risk-vurdering: hvordan håndteres tilfeller hvor en av to foresatte
  ikke samtykker (delt omsorg)?

### Personvern-implikasjon
For BARN gjelder strengere prinsipper enn for voksne:
- Data-minimering må være ekstra striks (færre felter, kortere retention)
- Showreel/media synlig for færre partnere (begrenset til verifiserte
  casting-byråer + workshop-arrangører, IKKE generelle produksjonsselskap)
- Sletting på 18-årsdagen som automatisk default (talent kan velge å beholde)

### Hva som må være på plass før vi kan bygge
1. Signicat-/BankID-avtale (Creatorhub AS som RP)
2. Risk-vurdering (PSD2/DSP2-impact, fnr-handling)
3. DPA-oppdatering for BankID-provider
4. Personvern-tekst om hva vi lagrer av BankID-data

### Audit-trail vi får gratis
Hver BankID-signert consent-rad har JWS-signature → vi kan bevise overfor
Datatilsynet at "Karl Hansen ga eksplisitt, dokumentert samtykke til Stella
Casting den 31. mai 2026 kl 14:32 for scope media_portfolio".

---

## Andre fremtidige Phases

### Phase 8 — Auditions Kanban (mockup #3)
- New Submissions → Reviewing → Shortlisted → Callback → Final Selection
- Migrate: `auditions`, `audition_submissions`, `audition_stages`
- Anthropic-integrasjon for AI Feedback (TBD i Phase 9)

### Phase 9 — Self-Tape Studio (mockup #4)
- MediaRecorder API for opptak i nettleser
- AI Feedback via Anthropic Claude: Eye Line / Pacing / Sound / Lighting / Performance
- Take Management (multiple takes per audition)
- Submission Targets med adaptive bitrate Stream-upload

### Phase 10 — Mobile-app (React Native eller PWA)
- Push-notifications når Stella ser profilen
- Self-tape opptak direkte fra telefon
- Offline-modus for å fylle ut profil
