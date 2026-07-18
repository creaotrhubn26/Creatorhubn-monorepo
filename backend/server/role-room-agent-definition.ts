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
- audit_site_setup — foreslå en teknisk audit av klientens nettsted (analytics/GEO: GA4, GTM, Meta Pixel, Clarity, consent, sitemap, robots, AI-bot-serving). Auditen er read-only mot nettstedet og kjøres av plattformen etter bekreftelse; du gjetter ALDRI på resultatet selv.
- generate_event_plan — foreslå en event-plan (GA4-events, key events, Meta-bro) ut fra klientens forretningsmål. Deterministisk katalog — plattformen genererer planen; du velger målene ut fra briefen og begrunner dem.
- generate_analytics_bootstrap — foreslå generering av consent-gatet analytics-snippet (GA4/GTM/Clarity/Meta Pixel) med klientens IDer. Plattformen genererer koden etter bekreftelse; du skriver ALDRI sporingskode selv, og du ber aldri om passord — kun offentlige måle-IDer.
- guide_platform_setup — foreslå skreddersydd sjekkliste for oppsett som krever klientens egen innlogging (GSC/GA4/GTM/Meta Pixel/Clarity/Bing). Plattformen krysser guiden med site-auditen av klientens domene; stegene gjøres av klienten selv — du ber ALDRI om innloggingsdetaljer.
- submit_indexnow — foreslå IndexNow-innmelding av URL-er til Bing/ChatGPT-indeksen. Ekstern innsending — skjer kun etter eksplisitt bekreftelse, og krever at nøkkelfilen allerede er deployet på klientens domene.
- generate_geo_prerender_plan — foreslå GEO-plan (prerendering for AI-boter) når auditen viser at klientens innhold er usynlig for ChatGPT/Claude/Perplexity. Plattformen bygger planen deterministisk fra auditen (robots-linjer, serving-oppskrift per plattform, prioriterte sider, JSON-LD-mal); du dikter ALDRI opp tekniske detaljer selv.

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
  {
    name: 'audit_site_setup',
    description:
      'Foreslå en teknisk audit av klientens nettsted (doc 14 F1): hva er allerede på plass av GA4/GTM/Meta Pixel/Clarity/consent/sitemap/robots/AI-bot-serving, og hva mangler. Read-only mot nettstedet; plattformen kjører selve auditen (POST /api/integrations/site-audit) etter brukerbekreftelse. Bruk når klienten/produsenten vil sette opp analytics eller GEO og først trenger status.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Klientens domene eller URL (offentlig adresse — private adresser avvises av auditen).',
        },
        reason: {
          type: 'string',
          description: 'Hvorfor auditen foreslås nå (1 setning, vises i bekreftelsesdialogen).',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'generate_event_plan',
    description:
      'Foreslå event-plan for klientens måloppsett (doc 14 F3): velg forretningsmål ut fra briefen, plattformen genererer deterministisk GA4-events, key-event-anbefaling og Meta-standardevent-bro. Bruk FØR generate_analytics_bootstrap.',
    input_schema: {
      type: 'object',
      properties: {
        goals: {
          type: 'array',
          items: { type: 'string', enum: ['lead', 'booking', 'purchase', 'signup', 'newsletter'] },
          description: 'Forretningsmål utledet av briefen (projectGoal/deliverables).',
        },
        rationale: {
          type: 'string',
          description: 'Hvorfor disse målene — siter brief-feltet (f.eks. brief.projectGoal).',
        },
      },
      required: ['goals', 'rationale'],
    },
  },
  {
    name: 'generate_analytics_bootstrap',
    description:
      'Foreslå generering av consent-gatet analytics-snippet (doc 14 F2) med klientens offentlige måle-IDer. Plattformen genererer koden (POST /api/integrations/analytics-bootstrap) etter bekreftelse. Spør ALDRI om passord eller tokens — kun måle-IDer (G-…, GTM-…, pixel-tall, Clarity-ID).',
    input_schema: {
      type: 'object',
      properties: {
        ga4_measurement_id: { type: 'string', description: 'G-… (valgfri)' },
        gtm_id: { type: 'string', description: 'GTM-… (valgfri)' },
        clarity_project_id: { type: 'string', description: 'Clarity-prosjekt-ID (valgfri)' },
        meta_pixel_id: { type: 'string', description: 'Pixel-ID, kun sifre (valgfri)' },
        goals: {
          type: 'array',
          items: { type: 'string', enum: ['lead', 'booking', 'purchase', 'signup', 'newsletter'] },
          description: 'Mål fra event-planen — styrer Meta-broen i snippeten.',
        },
      },
    },
  },
  {
    name: 'guide_platform_setup',
    description:
      'Foreslå skreddersydd oppsett-sjekkliste (doc 14 F4) for en plattform som krever klientens egen innlogging. Plattformen henter guiden krysset med site-auditen av klientens domene (POST /api/integrations/setup-guides/tailored). Be ALDRI om innloggingsdetaljer — stegene utføres av klienten i egne kontoer.',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['gsc', 'ga4', 'gtm', 'meta_pixel', 'clarity', 'bing', 'alle'],
          description: 'Hvilken plattform guiden gjelder — «alle» gir hele den prioriterte planen.',
        },
        website_url: { type: 'string', description: 'Klientens domene — guiden skreddersys mot site-auditen av dette.' },
        reason: { type: 'string', description: 'Hvorfor dette oppsettet trengs nå (1 setning).' },
      },
      required: ['platform', 'website_url'],
    },
  },
  {
    name: 'generate_geo_prerender_plan',
    description:
      'Foreslå GEO-plan (doc 14 F5) når klientens innhold er usynlig for AI-boter. Plattformen bygger planen deterministisk fra site-auditen (POST /api/integrations/geo-prerender-plan): robots-linjer, serving-oppskrift per plattform (Vercel-/nginx-/Netlify-fellene dokumentert), prioriterte sider fra sitemapen, JSON-LD-mal. Dikt ALDRI opp tekniske detaljer selv.',
    input_schema: {
      type: 'object',
      properties: {
        website_url: { type: 'string', description: 'Klientens domene.' },
        reason: { type: 'string', description: 'Audit-funnet som utløser planen (1 setning).' },
      },
      required: ['website_url'],
    },
  },
  {
    name: 'submit_indexnow',
    description:
      'Foreslå IndexNow-innmelding av URL-er (doc 14 F6) til Bing/ChatGPT-søkeindeksen. EKSTERN EFFEKT: innsendingen skjer kun etter eksplisitt brukerbekreftelse, og forutsetter at nøkkelfilen er deployet på klientens domene (https://<host>/<key>.txt).',
    input_schema: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Domenet URL-ene tilhører.' },
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'HTTPS-URL-er på samme host, maks 100.',
        },
        reason: { type: 'string', description: 'Hva som er nytt/endret som gjør innmelding riktig nå.' },
      },
      required: ['host', 'urls'],
    },
  },
];

export type RoleRoomAgentToolName =
  | 'summarize_brief_gaps'
  | 'draft_review_request'
  | 'propose_timeline_item'
  | 'flag_scope_impact'
  | 'suggest_next_decision'
  | 'generate_community_post'
  | 'audit_site_setup'
  | 'generate_event_plan'
  | 'generate_analytics_bootstrap'
  | 'guide_platform_setup'
  | 'submit_indexnow'
  | 'generate_geo_prerender_plan';

export const ROLE_ROOM_AGENT_DEFAULT_MAX_TOKENS = 1200;
