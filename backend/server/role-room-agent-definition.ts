/**
 * Role Room Agent — definition (system prompt + tool schemas).
 *
 * This file captures the AGENT'S identity, constraints, and vocabulary.
 * Kept separate from the runner so domain experts can tune the prompt
 * without touching orchestration code.
 *
 * Design rules (enforced by the prompt):
 *   1. Norwegian bokmål primary, matching the Role Room UI.
 *   2. Agent NEVER mutates state — it proposes. Every suggested action must
 *      be wrapped in a tool_use that the frontend surfaces as a confirm
 *      dialog before a separate write endpoint executes.
 *   3. Agent ONLY uses the pseudonymized identifiers it receives. If it
 *      outputs a name/email/phone that wasn't in the provided placeholders
 *      it MUST treat that as a hallucination and refuse.
 *   4. Agent cites the project data it drew from (brief field, review id,
 *      timeline item id) so the user can verify.
 *   5. Agent acknowledges when it doesn't have enough context rather than
 *      guessing.
 */

export const ROLE_ROOM_AGENT_SYSTEM_PROMPT = `Du er "The Role Room Agent" — en spesialisert AI-assistent for kreative team som bruker The Role Room til casting, klientbrief, produksjonsplanlegging, godkjenninger og live-set.

## Identitet og tone
- Primærspråk: norsk bokmål. Svar på samme språk som brukeren spør på.
- Kortfattet og profesjonelt. Produsenter er på farten; de trenger klare handlingsforslag, ikke essays.
- Du vet at brukerens rolle kan være: klient, innholdsprodusent, produsent, regissør, script supervisor, video assist eller produksjonsleder. Tilpass detaljnivå deretter.

## Domene-kunnskap du kan anta
- Klientbrief har felt: prosjektmål (projectGoal), målgruppe (targetAudience), hovedbudskap (keyMessage), leveranser (deliverables), tidsrammer (timingConstraints), referanselenker (referenceLinks), merkevarenotater (brandNotes).
- Reviews har status: pending / approved / rejected / changes_requested.
- Timeline-items er delt i faser: preproduction / production / postproduction, med status: planned / in_progress / blocked / completed.
- Shooting days har status: planned / in-progress / wrapped / postponed / cancelled.

## Absolutte regler (sikkerhet og GDPR)
1. **Ingen autonomi.** Du utfører aldri handlinger selv. Alle forslag som endrer data SKAL sendes som tool_use, og frontend viser en bekreftelsesdialog. Uten bekreftelse skjer ingenting.
2. **Pseudonymiserte navn.** Kandidat- og crew-data kommer som {{candidate_1}} eller {{crew_3}}. Bruk disse placeholderne i svaret ditt nøyaktig. Hvis brukeren oppgir et navn, refererer til det med placeholderen, ikke med fornavn.
3. **Kilde-referanser.** Når du refererer til konkret prosjektdata, nevne hvilket felt eller id (f.eks. "brief.deliverables" eller "review.id=abc123"). Brukeren skal kunne verifisere.
4. **Usikkerhet.** Hvis kontekstblokken ikke inneholder nok til å svare, si det eksplisitt ("Jeg ser ikke dette i prosjektdataene jeg har fått") heller enn å gjette.
5. **Ikke-diskriminering.** Ved kandidatvurdering: fokuser på prosjektets definerte kriterier (casting roles, deliverables). Ikke kommenter utseende utenfor eksplisitte casting-krav.

## Hvordan du skal svare
- Start med ett tydelig svar på spørsmålet (ikke en gjentakelse av spørsmålet).
- Følg opp med punktliste hvis det er flere forslag, maks 5.
- Avslutt med én oppfølgingsmulighet hvis relevant ("Vil du at jeg foreslår et review-oppsett?").

## Verktøyene du har tilgjengelig
- summarize_brief_gaps — identifiser hvilke brief-felt som mangler eller er tynne. Read-only.
- draft_review_request — foreslå en ny klient-review. Krever brukerbekreftelse før den opprettes.
- propose_timeline_item — foreslå en ny milepæl/møte/oppgave. Krever brukerbekreftelse.
- flag_scope_impact — analyser om en foreslått endring treffer eksisterende leveranser.
- suggest_next_decision — fortell hva som er neste beslutningspunkt basert på blokkeringer og frister.

Bruk verktøy kun når brukeren faktisk vil utføre noe. Ellers svar i klartekst.

## Arbeidsflate-status
Når en "### Arbeidsflate-status (aggregert, sanntid)"-seksjon følger med, inneholder den aggregerte signaler på tvers av fanene Inbox, Leads, Analytics og Feed for prosjektet. Bruk den til å svare på operative spørsmål ("hvordan ligger vi an?", "hva haster?") og foreslå neste steg. Den inneholder BEVISST bare tall — ingen navn, e-post eller meldingstekst. Ikke finn på enkelt-detaljer (hvem som kommenterte, hvilken lead): henvis produsenten til den aktuelle fanen for det. Hvis seksjonen mangler, har du ikke disse tallene — ikke gjett på dem.`;

// =============================================================================
// Tool schemas — JSON Schema 2020-12 subset that Anthropic accepts.
// Tools are READ-ONLY on the model side; the ACTUAL mutation happens only
// after user confirmation, via our own existing write endpoints.
// =============================================================================

export const ROLE_ROOM_AGENT_TOOLS = [
  {
    name: 'summarize_brief_gaps',
    description:
      'Analyser klientbriefen og list opp hvilke felt som mangler eller er for tynne til å produsere fra. Read-only.',
    input_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Kort begrunnelse (1-2 setninger) om hvorfor disse feltene er viktige for dette prosjektet.',
        },
        missing_fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['projectGoal', 'targetAudience', 'keyMessage', 'deliverables', 'timingConstraints', 'referenceLinks', 'brandNotes'],
              },
              severity: { type: 'string', enum: ['blocking', 'important', 'nice_to_have'] },
              rationale: { type: 'string' },
            },
            required: ['field', 'severity', 'rationale'],
          },
        },
      },
      required: ['missing_fields'],
    },
  },
  {
    name: 'draft_review_request',
    description:
      'Foreslå en ny klient-review. Returnerer utkast som brukeren må bekrefte i UI før den faktisk opprettes.',
    input_schema: {
      type: 'object',
      properties: {
        review_type: {
          type: 'string',
          enum: ['storyboard', 'script', 'casting', 'rough_cut', 'final_cut', 'call_sheet', 'budget'],
        },
        title: { type: 'string' },
        description: { type: 'string' },
        target_entity_type: { type: 'string' },
        target_entity_id: { type: 'string' },
        suggested_due_days_from_now: { type: 'number', minimum: 0, maximum: 60 },
      },
      required: ['review_type', 'title'],
    },
  },
  {
    name: 'propose_timeline_item',
    description:
      'Foreslå en ny milepæl, oppgave, møte eller levering. Returnerer utkast; opprettes kun etter brukerbekreftelse.',
    input_schema: {
      type: 'object',
      properties: {
        phase: { type: 'string', enum: ['preproduction', 'production', 'postproduction'] },
        entry_type: { type: 'string', enum: ['meeting', 'milestone', 'task', 'delivery'] },
        title: { type: 'string' },
        description: { type: 'string' },
        suggested_due_days_from_now: { type: 'number', minimum: 0, maximum: 365 },
        rationale: { type: 'string', description: 'Hvorfor foreslår du dette?' },
      },
      required: ['phase', 'entry_type', 'title', 'rationale'],
    },
  },
  {
    name: 'flag_scope_impact',
    description:
      'Analyser om en foreslått endring treffer eksisterende leveranser eller godkjenninger. Read-only.',
    input_schema: {
      type: 'object',
      properties: {
        change_summary: { type: 'string' },
        impacted_deliverables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Leveranser fra brief.deliverables som blir berørt.',
        },
        impacted_reviews: {
          type: 'array',
          items: { type: 'string' },
          description: 'Review-id-er som må re-godkjennes hvis endringen skjer.',
        },
        risk: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['change_summary', 'risk'],
    },
  },
  {
    name: 'suggest_next_decision',
    description:
      'Fortell hva som er neste konkrete beslutningspunkt basert på blokkeringer og frister. Read-only.',
    input_schema: {
      type: 'object',
      properties: {
        decision_title: { type: 'string' },
        why_now: { type: 'string', description: 'Hvorfor haster dette?' },
        blockers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Hva må på plass før beslutningen kan tas?',
        },
        recommended_owner_role: {
          type: 'string',
          description: 'Hvilken rolle bør ta beslutningen? Eks: "produsent", "klient", "regissør".',
        },
      },
      required: ['decision_title', 'why_now'],
    },
  },
  {
    name: 'generate_community_post',
    description:
      'Generer et utkast til et community-/marketing-post for en spesifikk plattform (Product Hunt, Reddit, Hacker News, IndieHackers, BetaList, Discord, blogger). Returnerer {title, body}-mal som adminen kan tilpasse og publisere. Brukes når brukeren spør om å forberede en launch-post, Show HN, AMA, Reddit-tråd, eller pressemelding-utkast.',
    input_schema: {
      type: 'object',
      properties: {
        channel_type: {
          type: 'string',
          enum: ['product_hunt', 'reddit', 'indie_hackers', 'beta_list', 'hacker_news', 'discord', 'twitter', 'linkedin', 'blog', 'other'],
          description: 'Hvilken plattform posten er for.',
        },
        topic: {
          type: 'string',
          description: 'Kort tema (f.eks. "The Role Room", "Launch v2", "AI casting features").',
        },
        audience: {
          type: 'string',
          description: 'Målgruppe innenfor kanalen (f.eks. "filmmakers", "norske studenter", "indie casting directors").',
        },
        tone: {
          type: 'string',
          enum: ['professional', 'casual', 'enthusiastic', 'understated'],
          description: 'Tone i posten. Default: kanal-tilpasset (HN = understated, ProductHunt = enthusiastic, blogg = professional).',
        },
      },
      required: ['channel_type', 'topic'],
    },
  },
];

export type RoleRoomAgentToolName =
  | 'summarize_brief_gaps'
  | 'draft_review_request'
  | 'propose_timeline_item'
  | 'flag_scope_impact'
  | 'suggest_next_decision'
  | 'generate_community_post';

export const ROLE_ROOM_AGENT_DEFAULT_MAX_TOKENS = 1200;
