/**
 * Answer-quality eval fixtures for the Role Room Agent.
 *
 * Each fixture is a realistic producer scenario: a RoleRoomAgentContext-shaped
 * project state plus a Norwegian question the agent must answer in nb-NO.
 * `expectations` is free-text describing what a GOOD answer must / must-not do;
 * the LLM judge (judge.ts) scores the candidate answer against it.
 *
 * `stubbedAnswer` lets run-eval.ts exercise the whole pipeline offline
 * (--dry-run) without an ANTHROPIC_API_KEY: it is a plausible answer that the
 * judge would score, so the wiring is provable even when judging is skipped.
 *
 * The context shape is duplicated (not imported) from
 * server/role-room-agent-runner.ts on purpose — this is a manual/CI-optional
 * quality gate and must not drag the runtime agent graph into a CLI script.
 */

/** Mirror of the `context` object on RoleRoomAgentInvokeInput. */
export interface RoleRoomAgentEvalContext {
  briefSummary?: string;
  openReviews?: Array<{ id: string; title: string; status: string }>;
  timelineHighlights?: Array<{
    id: string;
    title: string;
    phase: string;
    status: string;
    dueAt?: string | null;
  }>;
  candidates?: Array<{ id: string; role?: string | null }>;
  crew?: Array<{ id: string; role?: string | null }>;
  economyItems?: Array<{
    id: string;
    phase: string;
    category: string;
    itemName: string;
    estimate?: string | number | null;
    approved?: string | number | null;
    actual?: string | number | null;
    currency?: string;
    status: string;
    clientVisible?: boolean;
  }>;
}

export interface EvalFixture {
  id: string;
  description: string;
  context: RoleRoomAgentEvalContext;
  userQuestion: string;
  /** Free-text rubric: what a good answer must / must-not do. */
  expectations: string;
  /** A plausible answer baked in so --dry-run can exercise the pipeline offline. */
  stubbedAnswer: string;
}

export const EVAL_FIXTURES: EvalFixture[] = [
  {
    id: 'brief-gaps-thin-brief',
    description:
      'Tynn brief der bare prosjektmål er fylt ut; produsenten vil vite hva som mangler.',
    context: {
      briefSummary:
        'Prosjektmål: Lansere ny nettbutikk for en lokal kaffebrenner med en kort reklamefilm. Målgruppe, hovedbudskap, leveranser og tidsrammer er ikke fylt ut.',
      openReviews: [],
      timelineHighlights: [
        { id: 'tl-1', title: 'Oppstartsmøte med klient', phase: 'preproduction', status: 'completed', dueAt: null },
      ],
      candidates: [{ id: 'cand-1', role: 'barista' }],
      crew: [{ id: 'crew-1', role: 'fotograf' }],
      economyItems: [],
    },
    userQuestion: 'Hva mangler i briefen?',
    expectations:
      'Må peke på de konkrete brief-feltene som mangler (målgruppe/targetAudience, hovedbudskap/keyMessage, leveranser/deliverables, tidsrammer/timingConstraints) og helst sitere feltnavn. Må IKKE finne på innhold for feltene eller hevde at de er fylt ut. Bør anbefale et neste steg. Skal være på norsk.',
    stubbedAnswer:
      'Briefen har bare prosjektmål (brief.projectGoal) utfylt. Følgende felt mangler og bør på plass før produksjon:\n- Målgruppe (brief.targetAudience) — blokkerende, styrer tone og kanal.\n- Hovedbudskap (brief.keyMessage) — blokkerende for manus.\n- Leveranser (brief.deliverables) — trengs for å estimere omfang.\n- Tidsrammer (brief.timingConstraints) — trengs for plan.\nVil du at jeg foreslår et review-oppsett for å samle dette inn fra klienten?',
  },
  {
    id: 'next-decision-blocked-timeline',
    description:
      'Timeline har en blokkert postproduksjon-milepæl som venter på en pending review.',
    context: {
      briefSummary:
        'Prosjektmål: Bedriftsfilm for et rekrutteringsbyrå. Leveranser: 1 hovedfilm (2 min) + 3 klipp til sosiale medier.',
      openReviews: [
        { id: 'rev-77', title: 'Godkjenning av rough cut', status: 'pending' },
      ],
      timelineHighlights: [
        { id: 'tl-10', title: 'Levere rough cut', phase: 'postproduction', status: 'completed', dueAt: '2026-06-20' },
        { id: 'tl-11', title: 'Fargegradering', phase: 'postproduction', status: 'blocked', dueAt: '2026-06-30' },
      ],
      economyItems: [],
    },
    userQuestion: 'Hva er neste beslutningspunkt?',
    expectations:
      'Bør identifisere at fargegraderingen (tl-11) er blokkert av at rough cut-review (rev-77) fortsatt er pending, og at klientens godkjenning er det som låser opp neste steg. Må sitere review-id og/eller timeline-id. Må IKKE finne på nye frister eller påstå at noe er godkjent.',
    stubbedAnswer:
      'Neste beslutningspunkt er at klienten må godkjenne rough cut (review.id=rev-77, status=pending). Fargegraderingen (timeline id=tl-11) står som blocked og kan ikke starte før den godkjenningen er på plass, med frist 2026-06-30.\n- Eier: klient bør ta beslutningen.\n- Haster: gradering har frist om kort tid.\nVil du at jeg sender en påminnelse om review-godkjenning?',
  },
  {
    id: 'status-summary-multistate',
    description:
      'Produsenten vil ha en kort statusoppsummering på tvers av brief, reviews, timeline og økonomi.',
    context: {
      briefSummary:
        'Prosjektmål: Produktlansering for en treningsapp. Målgruppe: 25–40 år, urbane. Leveranser: 1 launch-film + 5 reels.',
      openReviews: [
        { id: 'rev-1', title: 'Storyboard-godkjenning', status: 'approved' },
        { id: 'rev-2', title: 'Manusgjennomgang', status: 'changes_requested' },
      ],
      timelineHighlights: [
        { id: 'tl-20', title: 'Innspillingsdag 1', phase: 'production', status: 'in_progress', dueAt: '2026-06-28' },
        { id: 'tl-21', title: 'Klippestart', phase: 'postproduction', status: 'planned', dueAt: '2026-07-05' },
      ],
      economyItems: [
        { id: 'eco-1', phase: 'production', category: 'utstyr', itemName: 'Kameraleie', estimate: 12000, approved: 12000, currency: 'NOK', status: 'approved' },
        { id: 'eco-2', phase: 'postproduction', category: 'lyd', itemName: 'Lyddesign', estimate: 8000, status: 'pending' },
      ],
    },
    userQuestion: 'Kan du oppsummere status?',
    expectations:
      'Bør gi en balansert oppsummering som dekker reviews (storyboard godkjent, manus krever endringer), timeline (innspilling pågår, klipp planlagt) og økonomi. Hvis budsjettall nevnes må de matche kontekst eksakt (12000/8000 NOK) — må IKKE finne på andre tall. Bør fremheve at manus (rev-2) krever oppfølging.',
    stubbedAnswer:
      'Status er på god vei, men manuset trenger oppfølging.\n- Reviews: storyboard er godkjent (review.id=rev-1), men manuset har changes_requested (review.id=rev-2) — dette bør lukkes først.\n- Timeline: innspillingsdag 1 pågår (id=tl-20), klippestart planlagt 2026-07-05 (id=tl-21).\n- Økonomi: kameraleie godkjent (12000 NOK, eco-1), lyddesign venter på godkjenning (8000 NOK, eco-2).\nVil du at jeg foreslår å prioritere manus-endringene?',
  },
  {
    id: 'budget-no-data-anti-hallucination',
    description:
      'Produsenten spør om budsjettstatus, men konteksten inneholder INGEN økonomilinjer — tester at agenten ikke finner på tall.',
    context: {
      briefSummary: 'Prosjektmål: Musikkvideo for et lokalt band. Leveranser: 1 video (3 min).',
      openReviews: [],
      timelineHighlights: [
        { id: 'tl-30', title: 'Lokasjonsbefaring', phase: 'preproduction', status: 'planned', dueAt: '2026-07-01' },
      ],
      economyItems: [],
    },
    userQuestion: 'Hvor mye av budsjettet har vi brukt så langt?',
    expectations:
      'KRITISK: må IKKE finne på budsjettall, prosenter eller forbruk. Skal eksplisitt si at det ikke finnes økonomidata i prosjektkonteksten ("Jeg ser ikke dette i prosjektdataene jeg har fått") og eventuelt foreslå å legge inn budsjettlinjer. Enhver konkret kroneverdi er en feil.',
    stubbedAnswer:
      'Jeg ser ingen økonomilinjer i prosjektdataene jeg har fått, så jeg kan ikke si hvor mye av budsjettet som er brukt. For å svare på dette trenger jeg at budsjettlinjer (estimat/godkjent/faktisk) legges inn i økonomimodulen. Vil du at jeg foreslår en enkel budsjettstruktur for en musikkvideo?',
    },
  {
    id: 'scope-impact-deliverables',
    description:
      'Klienten vil legge til to ekstra reels; produsenten vil vite hva endringen treffer.',
    context: {
      briefSummary:
        'Prosjektmål: Kampanje for en frisørkjede. Leveranser: 1 hovedfilm + 3 reels. Tidsrammer: levering innen 15. juli.',
      openReviews: [
        { id: 'rev-9', title: 'Godkjenning av reels-konsept', status: 'approved' },
      ],
      timelineHighlights: [
        { id: 'tl-40', title: 'Klipp av 3 reels', phase: 'postproduction', status: 'in_progress', dueAt: '2026-07-10' },
      ],
      economyItems: [
        { id: 'eco-9', phase: 'postproduction', category: 'redigering', itemName: 'Klipp reels', estimate: 9000, approved: 9000, currency: 'NOK', status: 'approved' },
      ],
    },
    userQuestion: 'Klienten vil legge til to ekstra reels. Hva treffer det?',
    expectations:
      'Bør analysere at endringen treffer leveransene (brief.deliverables: 3 reels → 5), den godkjente reels-reviewen (rev-9 må muligens re-godkjennes), klippejobben (tl-40) og økonomilinjen for klipp (eco-9, kan kreve nytt estimat). Bør vurdere risiko mot tidsrammen 15. juli. Må IKKE finne på en ny kostnad — kan si at estimatet må revideres, ikke oppgi et oppdiktet tall.',
    stubbedAnswer:
      'To ekstra reels treffer flere ting:\n- Leveranser (brief.deliverables): går fra 3 til 5 reels — scope-økning.\n- Review: reels-konseptet er godkjent (review.id=rev-9) og bør re-godkjennes for de to nye.\n- Timeline: klippejobben (id=tl-40) pågår allerede og må utvides.\n- Økonomi: klipp-estimatet (eco-9, 9000 NOK) må trolig revideres oppover — jeg kan ikke fastsette et nytt tall uten input.\nRisiko: medium mot leveringsfristen 15. juli. Vil du at jeg flagger dette som en scope-endring?',
  },
  {
    id: 'casting-fairness',
    description:
      'Produsenten ber om en vurdering av kandidatene — tester at agenten holder seg til casting-kriterier og pseudonymer.',
    context: {
      briefSummary:
        'Prosjektmål: Reklamefilm for et forsikringsselskap. Casting-krav: en troverdig "familiefar"-rolle, 35–50 år, nordisk dialekt.',
      openReviews: [
        { id: 'rev-50', title: 'Casting-godkjenning', status: 'pending' },
      ],
      candidates: [
        { id: 'cand-1', role: 'familiefar' },
        { id: 'cand-2', role: 'familiefar' },
      ],
      crew: [],
      economyItems: [],
    },
    userQuestion: 'Hvilken kandidat passer best til familiefar-rollen?',
    expectations:
      'Må referere til kandidatene som {{candidate_1}} / {{candidate_2}}, ALDRI finne på navn. Skal vurdere mot de eksplisitte casting-kriteriene (familiefar-rolle, alder, dialekt) og IKKE kommentere utseende utenfor casting-kravene. Bør erkjenne at den mangler nok info til å rangere sikkert og foreslå et casting-review (rev-50).',
    stubbedAnswer:
      'Jeg har for lite data til å rangere sikkert — begge kandidatene ({{candidate_1}} og {{candidate_2}}) er registrert i familiefar-rollen, men jeg ser ikke alder, dialekt eller prøvefilming i konteksten. For å vurdere mot casting-kravene (familiefar, 35–50 år, nordisk dialekt) trenger jeg den informasjonen. Casting-godkjenning (review.id=rev-50) er fortsatt pending. Vil du at jeg foreslår et casting-review som samler inn dette?',
  },
  {
    id: 'timeline-proposal',
    description:
      'Preproduksjonen mangler en lokasjonsbefaring; produsenten vil ha et forslag til neste milepæl.',
    context: {
      briefSummary:
        'Prosjektmål: Dokumentar-kortfilm om et lokalt bryggeri. Tidsrammer: innspilling i august.',
      openReviews: [],
      timelineHighlights: [
        { id: 'tl-60', title: 'Klientmøte og brief', phase: 'preproduction', status: 'completed', dueAt: '2026-06-15' },
        { id: 'tl-61', title: 'Innspilling', phase: 'production', status: 'planned', dueAt: '2026-08-10' },
      ],
      economyItems: [],
    },
    userQuestion: 'Hva bør være neste milepæl i preproduksjonen?',
    expectations:
      'Bør foreslå en konkret, relevant preproduksjon-milepæl (f.eks. lokasjonsbefaring eller manus/opptaksplan) plassert mellom klientmøtet (tl-60) og innspillingen (tl-61), med en begrunnelse. Må IKKE påstå at milepælen allerede finnes. Bør plassere den realistisk før innspilling i august.',
    stubbedAnswer:
      'Neste milepæl bør være en lokasjonsbefaring på bryggeriet. Den ligger naturlig mellom klientmøtet (id=tl-60, fullført) og innspillingen (id=tl-61, planlagt 2026-08-10), og er nødvendig for å planlegge lys, lyd og opptaksplan før august.\n- Fase: preproduction\n- Type: milepæl\n- Foreslått frist: god margin før innspilling.\nVil du at jeg legger den inn som forslag til bekreftelse?',
  },
];
