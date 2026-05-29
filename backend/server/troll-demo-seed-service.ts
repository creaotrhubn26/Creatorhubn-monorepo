/**
 * troll-demo-seed-service.ts
 *
 * Comprehensive idempotent seed for TROLL demo-prosjektet. Bruker én
 * DB-transaksjon: SLETTER eksisterende sub-data først, så INSERTer
 * en komplett representasjon av TROLL-prosjektet med:
 *
 *   • casting_projects — base
 *   • casting_roles    — 8 rolle-oppdrag
 *   • casting_candidates — 8 skuespiller-kandidater
 *   • casting_crew     — 6 crew-medlemmer
 *   • casting_locations — 5 locations
 *   • casting_user_roles — eier som director
 *   • casting_manuscripts — 1 manuskript-skall
 *   • casting_scenes   — 10 scener
 *   • casting_shot_lists — 4 shot-lister
 *   • casting_equipment — 8 utstyrspakker
 *   • casting_production_days — 6 opptaksdager
 *   • casting_consents — 4 samtykker
 *   • casting_schedules — 6 audition/fitting/rehearsal-sesjoner
 *   • casting_props — 8 TROLL-tema rekvisitter
 *   • split_sheets + split_sheet_contributors — 1 sheet med 8 bidragsytere
 *   • casting_storyboards — 4 storyboard-skall for nøkkelscener
 *   • casting_candidate_videos — 4 audition self-tapes (status='ready')
 *   • role_room_calendar_events — 6 produksjonsteam-events
 *   • role_room_budget_items — 10 budsjettlinjer (3 faser)
 *   • role_room_expenses — 5 eksempel-utgifter
 *
 * Returnerer rapport om hva som ble seedet for frontend-feedback.
 */

import type { Pool } from 'pg';

const TROLL_CANONICAL_ID = 'troll-project-2026';

interface SeedReport {
  project: { id: string; name: string };
  counts: Record<string, number>;
}

export interface SeedTrollOptions {
  /** Override target project — defaults to canonical 'troll-project-2026'. */
  projectId?: string;
  /** Override project name (only when projectId is non-canonical). */
  projectName?: string;
  /** Optional description override (only for non-canonical). */
  projectDescription?: string;
}

export async function seedTrollDemo(
  pool: Pool,
  ownerUserId: string,
  options: SeedTrollOptions = {},
): Promise<SeedReport> {
  const TROLL_PROJECT_ID = options.projectId ?? TROLL_CANONICAL_ID;
  const isCanonical = TROLL_PROJECT_ID === TROLL_CANONICAL_ID;
  const projectName = options.projectName ?? 'TROLL';
  // Scope entity-IDer per prosjekt så seed kan kjøres for flere TROLL-kopier
  // uten PK-kollisjon. Kanonisk prosjekt beholder rå slugs for bakover-
  // kompat med eksisterende referanser/tester.
  const eid = (slug: string): string =>
    isCanonical ? slug : `${TROLL_PROJECT_ID.slice(0, 24)}-${slug}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Slett alle sub-data for å gjøre seed idempotent ───────────
    // Rekkefølge: barn-tabeller før parent (FK-cascading sikrer at
    // sletting av casting_projects ville fjerne alt, men vi vil beholde
    // selve prosjekt-raden for å unngå å bryte FKs i andre vertikaler).
    const subTables = [
      'casting_consents',
      'casting_shot_lists',
      'casting_production_days',
      'casting_schedules',
      'casting_storyboards',
      'casting_candidate_videos',
      'casting_revisions',
      'casting_dialogue',
      'casting_scenes',
      'casting_acts',
      'casting_manuscripts',
      'casting_props',
      'casting_locations',
      'casting_crew',
      'casting_candidates',
      'casting_roles',
    ];
    for (const table of subTables) {
      await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [TROLL_PROJECT_ID]);
    }
    // Rydd equipment hvis tabellen finnes (migration 097)
    await client.query(
      `DELETE FROM casting_equipment WHERE project_id = $1`,
      [TROLL_PROJECT_ID],
    ).catch(() => { /* tabell finnes ikke i alle miljøer */ });

    // ── 2. UPSERT casting_projects ───────────────────────────────────
    await client.query(
      `INSERT INTO casting_projects (
         id, name, description, status, created_by, genre, project_type,
         start_date, end_date, budget, currency, metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'active', $4, 'film', 'feature_film',
         $5, $6, 35000000, 'NOK', $7::jsonb, NOW(), NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         genre = EXCLUDED.genre,
         project_type = EXCLUDED.project_type,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         budget = EXCLUDED.budget,
         currency = EXCLUDED.currency,
         metadata = COALESCE(casting_projects.metadata, '{}'::jsonb) || EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        TROLL_PROJECT_ID,
        projectName,
        options.projectDescription
          ?? 'Norsk eventyrfilm regissert av Roar Uthaug. Når en eksplosjon i de norske fjellene avslører et urgammelt troll, må paleontologen Nora samarbeide med myndighetene for å stoppe skapningen før den når hovedstaden. En spektakulær action-eventyrfilm med VFX og storslåtte locations.',
        ownerUserId,
        '2026-01-20',
        '2026-02-15',
        JSON.stringify({
          isDemo: true,
          source: 'troll_seed_v1',
          clientName: 'Netflix / Nordisk Film',
          clientEmail: 'produksjon@troll-film.no',
        }),
      ],
    );

    // ── 3. UPSERT eier som director ──────────────────────────────────
    await client.query(
      `INSERT INTO casting_user_roles (id, project_id, user_id, role, permissions, added_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'director', $4::jsonb, $3, NOW(), NOW())
       ON CONFLICT (project_id, user_id) DO UPDATE SET
         role = EXCLUDED.role,
         permissions = EXCLUDED.permissions,
         updated_at = NOW()`,
      [
        `urole-${TROLL_PROJECT_ID}-${ownerUserId}`,
        TROLL_PROJECT_ID,
        ownerUserId,
        JSON.stringify({ canEditAll: true, canManageCrew: true, canManageCast: true }),
      ],
    );

    // ── 4. casting_roles ──────────────────────────────────────────────
    const roles = [
      {
        id: 'role-nora', name: 'Nora Tidemann', description: 'Paleontolog, tidlig 30-årene. Hovedpersonen.',
        age_range: '28-38', gender: 'female', role_type: 'lead',
        scene_ids: ['scene-3', 'scene-4', 'scene-5', 'scene-7', 'scene-9', 'scene-10'],
        status: 'filled', candidate_id: 'cand-ine',
      },
      {
        id: 'role-andreas', name: 'Andreas Isaksen', description: 'Rådgiver for Statsministerens kontor, 30-40 år.',
        age_range: '32-42', gender: 'male', role_type: 'lead',
        scene_ids: ['scene-4', 'scene-5', 'scene-9', 'scene-10'],
        status: 'filled', candidate_id: 'cand-kim',
      },
      {
        id: 'role-tobias', name: 'Tobias Tidemann', description: 'Noras far, 60-70 år. Tidligere forsker.',
        age_range: '60-72', gender: 'male', role_type: 'supporting',
        scene_ids: ['scene-10'], status: 'filled', candidate_id: 'cand-gard',
      },
      {
        id: 'role-general', name: 'General Lund', description: 'Militær leder, 50-60 år.',
        age_range: '50-62', gender: 'male', role_type: 'supporting',
        scene_ids: ['scene-4', 'scene-7'], status: 'filled', candidate_id: 'cand-fridtjov',
      },
      {
        id: 'role-statsminister', name: 'Statsminister Berit Moberg', description: 'Norges statsminister, 50-55 år.',
        age_range: '48-58', gender: 'female', role_type: 'supporting',
        scene_ids: ['scene-7'], status: 'filled', candidate_id: 'cand-anneke',
      },
      {
        id: 'role-arbeider1', name: 'Tunnelarbeider 1', description: 'Erfaren tunnelarbeider.',
        age_range: '35-50', gender: 'male', role_type: 'minor',
        scene_ids: ['scene-1', 'scene-2'], status: 'filled', candidate_id: 'cand-mads',
      },
      {
        id: 'role-arbeider2', name: 'Tunnelarbeider 2', description: 'Yngre tunnelarbeider.',
        age_range: '25-35', gender: 'male', role_type: 'minor',
        scene_ids: ['scene-1', 'scene-2'], status: 'filled', candidate_id: 'cand-eric',
      },
      {
        id: 'role-bonde', name: 'Bonden i Østerdalen', description: 'Lokal bonde, 50-65 år.',
        age_range: '50-65', gender: 'male', role_type: 'minor',
        scene_ids: ['scene-6'], status: 'casting', candidate_id: null,
      },
    ];
    for (const r of roles) {
      await client.query(
        `INSERT INTO casting_roles
           (id, project_id, name, description, age_range, gender, role_type,
            scene_ids, status, assigned_candidate_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, NOW(), NOW())`,
        [eid(r.id), TROLL_PROJECT_ID, r.name, r.description, r.age_range, r.gender,
         r.role_type, JSON.stringify(r.scene_ids.map(eid)), r.status,
         r.candidate_id ? eid(r.candidate_id) : null],
      );
    }

    // ── 5. casting_candidates ─────────────────────────────────────────
    const candidates = [
      { id: 'cand-ine', name: 'Ine Marie Wilmann', email: 'agent@inemarie.no', phone: '+47 912 34 567', notes: 'Perfekt for Nora. Sterk skuespiller fra Wisting, Exit.', status: 'confirmed', roles: ['role-nora'] },
      { id: 'cand-kim', name: 'Kim Falck', email: 'kim.falck@agent.no', phone: '+47 923 45 678', notes: 'Overbevisende som Andreas.', status: 'confirmed', roles: ['role-andreas'] },
      { id: 'cand-gard', name: 'Gard B. Eidsvold', email: 'gard@teater.no', phone: '+47 934 56 789', notes: 'Veteran skuespiller, varme og dybde.', status: 'confirmed', roles: ['role-tobias'] },
      { id: 'cand-fridtjov', name: 'Fridtjov Såheim', email: 'fridtjov@agent.no', phone: '+47 945 67 890', notes: 'Sterk tilstedeværelse, militær autoritet.', status: 'confirmed', roles: ['role-general'] },
      { id: 'cand-anneke', name: 'Anneke von der Lippe', email: 'anneke@teater.no', phone: '+47 956 78 901', notes: 'Prisbelønt, troverdig statsminister.', status: 'confirmed', roles: ['role-statsminister'] },
      { id: 'cand-mads', name: 'Mads Ousdal', email: 'mads.ousdal@email.no', phone: '+47 967 89 012', notes: 'Erfaren karakterskuespiller.', status: 'selected', roles: ['role-arbeider1'] },
      { id: 'cand-eric', name: 'Eric Vorenholt', email: 'eric.v@actors.no', phone: '+47 978 90 123', notes: 'Ung og fysisk, action-scener.', status: 'selected', roles: ['role-arbeider2'] },
      { id: 'cand-stein', name: 'Stein Winge', email: 'stein@teateragent.no', phone: '+47 989 01 234', notes: 'Erfaren teaterskuespiller — vurderes for Bonden.', status: 'pending', roles: [] },
    ];
    for (const c of candidates) {
      await client.query(
        `INSERT INTO casting_candidates
           (id, project_id, name, email, phone, notes, status, assigned_roles, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())`,
        [eid(c.id), TROLL_PROJECT_ID, c.name, c.email, c.phone, c.notes, c.status,
         JSON.stringify(c.roles.map(eid))],
      );
    }

    // ── 6. casting_crew ───────────────────────────────────────────────
    const crew = [
      { id: 'crew-roar', name: 'Roar Uthaug', role: 'director', email: 'roar@uthaug.no', phone: '+47 911 22 333', department: 'production', rate: 80000 },
      { id: 'crew-jallo', name: 'Jallo Faber', role: 'dp', email: 'jallo@cinematographers.no', phone: '+47 912 33 444', department: 'camera', rate: 35000 },
      { id: 'crew-espen', name: 'Espen Horn', role: 'producer', email: 'espen@motlysfilm.no', phone: '+47 913 44 555', department: 'production', rate: 50000 },
      { id: 'crew-hanne', name: 'Hanne Berkaak', role: 'production_designer', email: 'hanne@design.no', phone: '+47 914 55 666', department: 'art', rate: 28000 },
      { id: 'crew-stian', name: 'Stian Aadland', role: 'sound_designer', email: 'stian@sound.no', phone: '+47 915 66 777', department: 'sound', rate: 25000 },
      { id: 'crew-eva', name: 'Eva Haukeland', role: 'costume_designer', email: 'eva@costume.no', phone: '+47 916 77 888', department: 'costume', rate: 22000 },
    ];
    for (const m of crew) {
      await client.query(
        `INSERT INTO casting_crew
           (id, project_id, name, role, email, phone, department, rate, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [eid(m.id), TROLL_PROJECT_ID, m.name, m.role, m.email, m.phone, m.department, m.rate],
      );
    }

    // ── 7. casting_locations ──────────────────────────────────────────
    const locations = [
      { id: 'loc-dovre', name: 'Dovrefjell', address: 'Dovre, Innlandet', type: 'exterior', notes: 'Hovedlokasjon for fjellscener og troll-emergence.' },
      { id: 'loc-tunnel', name: 'Lærdalstunnelen', address: 'Lærdal, Vestland', type: 'interior', notes: 'Åpningsscener — tunnelarbeider-eksplosjon.' },
      { id: 'loc-oslo-stat', name: 'Statsministerens kontor (Oslo)', address: 'Akershus festning, Oslo', type: 'interior', notes: 'Krise-møter mellom statsminister, Andreas og general.' },
      { id: 'loc-osterdalen', name: 'Østerdalen gård', address: 'Tynset, Innlandet', type: 'exterior', notes: 'Bondens scene + skog-sekvens.' },
      { id: 'loc-tobias-hytte', name: 'Tobias hytte', address: 'Synnfjell, Oppland', type: 'interior', notes: 'Tobias avslører hemmelighet om trollene.' },
    ];
    for (const l of locations) {
      await client.query(
        `INSERT INTO casting_locations
           (id, project_id, name, address, type, access_notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [eid(l.id), TROLL_PROJECT_ID, l.name, l.address, l.type, l.notes],
      );
    }

    // ── 8. casting_manuscripts ────────────────────────────────────────
    // Mer utfyllende screenplay-content: tre-akts-struktur + scene-headings +
    // utdrag av faktisk dialog så Story Writer/Story Logic/Scener viser
    // realistisk arbeidsmateriale, ikke bare en placeholder-tittel.
    const manuscriptId = eid('manuscript-troll-v1');
    const manuscriptContent = `# ${projectName}

Norsk eventyrfilm. Skrevet av Espen Aukan og Roar Uthaug.

FINAL DRAFT — 2025-11-01

================================================================
AKT I — OPPDAGELSEN (scene 1–4)
================================================================

INT. LÆRDALSTUNNELEN — NATT

Mørke. Boremaskinens drønn. ARBEIDER 1 (40-tallet) og ARBEIDER 2 (50-tallet) jobber i halv-mørke ved tunnelens innerste seksjon.

ARBEIDER 1
Hvor langt inn er vi?

ARBEIDER 2
Tre meter til. Hold ut.

Borets spiss treffer noe annet enn fjell. Et HULLLT brak — sten ramler.

ARBEIDER 1
Hva i…

Bakgrunnen kollapser. Lys flimrer.

────────────────────────────────────────────────────────────────

INT. LÆRDALSTUNNELEN — NATT (forts.)

Støv fyller luften. ARBEIDER 1 prøver å klatre ut. Et enormt RØD ØYE åpner seg i mørket.

ARBEIDER 2 (skrikende)
LØP! LØP!!

────────────────────────────────────────────────────────────────

INT. NATURHISTORISK MUSEUM — DAG

NORA TIDEMANN (35, paleontolog, presis, skeptisk) studerer en fossil-skanning. Telefonen ringer. Hun ser på den. Ukjent nummer.

NORA
Tidemann.

STATSRÅDEN (V.O.)
Vi trenger deg. Nå.

────────────────────────────────────────────────────────────────

INT. STATSMINISTERENS KONTOR — DAG

NORA, ANDREAS (40, hennes ekskjæreste, sikkerhetstjenestens analytiker) og GENERAL ELVENES (60, militær, korthugget) rundt et bord. Skjermbilder fra tunnelen.

NORA
Det er ikke et jordskjelv. Se på rystelsesmønsteret — det er FOTSTEG.

GENERAL ELVENES
Det er absurd.

ANDREAS
Nora. Si det.

NORA (med tyngde)
Det er et troll.

================================================================
AKT II — KONFRONTASJONEN (scene 5–8)
================================================================

EXT. DOVRE — VEI — SKUMRING

NORA og ANDREAS i jeep, kjører mot fjellet. Stillhet. Snø-flak begynner å falle.

ANDREAS
Det er rart å være tilbake i bil sammen.

NORA
La oss ikke gjøre dette nå.

ANDREAS
Aldri en gang så vi solnedgangen.

NORA (smiler så vidt)
Du husker det.

────────────────────────────────────────────────────────────────

EXT. ØSTERDALEN GÅRD — DAG

BONDEN (70, vær-slitt, klare øyne) viser et gammelt familiebilde.

BONDEN
Bestefar tegnet dette i 1929. Han så det da han var sju.

På bildet: et trollformet skygge over fjellet.

BONDEN (forts.)
Vi sa ingenting. Det skader ingen så lenge man holdt seg fra dets stier.

────────────────────────────────────────────────────────────────

INT. STATSMINISTERENS KONTOR — NATT

STATSMINISTEREN, GENERAL ELVENES, NORA via videolink. Skjermer viser ødelagte hytter.

STATSMINISTEREN
Vi må handle.

NORA
Skyt det ikke. Ikke ennå. Hvis det er ekte — det betyr noe i vår historie.

GENERAL ELVENES
Hvis det er ekte er det ALLEREDE for sent.

────────────────────────────────────────────────────────────────

EXT. DOVREFJELL — NATT

TROLLET (40m høyt) tar lange skritt over en åskam. Det er ikke aggressivt. Det er sørgmodig.

================================================================
AKT III — OPPLØSNINGEN (scene 9–10)
================================================================

EXT. SKOG VED DOVRE — DAGGRY

NORA og ANDREAS løper. Helikopterlys fra over. Granater eksploderer i avstanden.

NORA
Vi må stoppe dem!

ANDREAS
Jeg vet hvor han vil!

────────────────────────────────────────────────────────────────

INT. TOBIAS HYTTE — DAG

TOBIAS (75, Noras far, livslang-troll-jeger som forsvant for 20 år siden) ved peisen.

NORA
Pappa…

TOBIAS
Du fant meg.

NORA
Hvorfor forlot du oss?

TOBIAS
Fordi du måtte tro at det ikke eksisterte. Slik kunne du leve som et normalt menneske.

NORA
Det går ikke. Ikke nå.

TOBIAS
Da er det din tur, min datter.

FADE OUT.

THE END.
`;
    await client.query(
      `INSERT INTO casting_manuscripts
         (id, project_id, title, format, content, version, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, 'screenplay', $4, 1, 'locked', $5::jsonb, NOW(), NOW())`,
      [
        manuscriptId,
        TROLL_PROJECT_ID,
        `${projectName} — Manuskript v1`,
        manuscriptContent,
        JSON.stringify({
          author: 'Espen Aukan & Roar Uthaug',
          draftNumber: 7,
          actCount: 3,
          totalScenes: 10,
          genre: 'eventyr/thriller',
          logline: 'En paleontolog oppdager at de norske trolleventyrene var sanne — og må stoppe staten fra å drepe en utdøende art.',
        }),
      ],
    );

    // ── 9. casting_scenes ─────────────────────────────────────────────
    // Hver scene har nå en utfyllende `description` som forteller hva som
    // skjer i scenen — viktig for Story Writer / Story Logic der breakdown-
    // og continuity-arbeidet skjer.
    const scenes = [
      { id: 'scene-1', num: 1, title: 'Tunnelen — Eksplosjonen', setting: 'Lærdalstunnelen', tod: 'NIGHT', int_ext: 'INT',
        description: 'Arbeider 1 og Arbeider 2 borer i tunnelen. Boret treffer noe annet enn fjell. Det de avdekker er ikke en geologisk anomali — det er et øye.',
        characters: ['role-arbeider1', 'role-arbeider2'] },
      { id: 'scene-2', num: 2, title: 'Tunnel-kollapsen', setting: 'Lærdalstunnelen', tod: 'NIGHT', int_ext: 'INT',
        description: 'Etter trolleten våkner og tunnelen kollapser. Arbeider 1 unnslipper så vidt. Vi får et glimt av kreaturet før alt blir mørkt.',
        characters: ['role-arbeider1', 'role-arbeider2'] },
      { id: 'scene-3', num: 3, title: 'Nora introduseres', setting: 'Naturhistorisk museum', tod: 'DAY', int_ext: 'INT',
        description: 'Nora Tidemann studerer en fossil-skanning. Hun blir kontaktet av regjeringen — Statsråden trenger henne på saken.',
        characters: ['role-nora'] },
      { id: 'scene-4', num: 4, title: 'Krise-møtet', setting: 'Statsministerens kontor', tod: 'DAY', int_ext: 'INT',
        description: 'Nora gjenforenes med eksen Andreas. Sammen med general Elvenes ser de tunnel-opptakene. Nora konkluderer det utenkelige: det er et troll. Tre-akts-struktur sceneskift: setting up the world.',
        characters: ['role-nora', 'role-andreas', 'role-general'] },
      { id: 'scene-5', num: 5, title: 'Til Dovrefjell', setting: 'Dovre — vei', tod: 'DUSK', int_ext: 'EXT',
        description: 'Nora og Andreas kjører mot fjellet. Personlig fortid blandes med oppdraget. Snøen begynner å falle.',
        characters: ['role-nora', 'role-andreas'] },
      { id: 'scene-6', num: 6, title: 'Bondens fortelling', setting: 'Østerdalen gård', tod: 'DAY', int_ext: 'EXT',
        description: 'Den gamle bonden viser dem et 1929-bilde av en trollformet skygge. Han forteller at folk har holdt det skjult i generasjoner — det skader ingen så lenge man holder seg fra dets stier.',
        characters: ['role-bonde'] },
      { id: 'scene-7', num: 7, title: 'Militær respons', setting: 'Statsministerens kontor', tod: 'NIGHT', int_ext: 'INT',
        description: 'Statsministeren gir grønt lys for militær aksjon. Nora ber dem vente. Generalen er imot. Spenningen topper seg.',
        characters: ['role-statsminister', 'role-general', 'role-nora'] },
      { id: 'scene-8', num: 8, title: 'Trollet på vandring', setting: 'Dovrefjell — natt', tod: 'NIGHT', int_ext: 'EXT',
        description: 'Vi ser trollet selv — 40 meter høyt, sørgmodig, vandrer over en åskam. Ingen dialog. Score-driven scene.',
        characters: [] },
      { id: 'scene-9', num: 9, title: 'Nora og Andreas — forfølgelse', setting: 'Skog ved Dovre', tod: 'DAWN', int_ext: 'EXT',
        description: 'Nora og Andreas løper for å komme før militæret. Drone-skudd over skog, granater i bakgrunnen. Andreas vet hvor trollet vil — opp mot Tobias gamle hytte.',
        characters: ['role-nora', 'role-andreas'] },
      { id: 'scene-10', num: 10, title: 'Fars hemmelighet', setting: 'Tobias hytte', tod: 'DAY', int_ext: 'INT',
        description: 'Nora gjenforenes med faren Tobias som forsvant for 20 år siden. Han forteller at han forlot dem for å beskytte henne — og at det er hennes tur nå.',
        characters: ['role-nora', 'role-andreas', 'role-tobias'] },
    ];
    for (const s of scenes) {
      await client.query(
        `INSERT INTO casting_scenes
           (id, project_id, manuscript_id, scene_number, title, description, setting, time_of_day, int_ext, characters, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())`,
        [eid(s.id), TROLL_PROJECT_ID, manuscriptId, s.num, s.title, s.description, s.setting, s.tod, s.int_ext,
         JSON.stringify(s.characters.map(eid))],
      );
    }

    // ── 9b. casting_acts (3-akts-struktur) ────────────────────────────
    // Migrasjon 183 opprettet casting_acts-tabellen. Seed klassisk
    // 3-akts-struktur så Story Logic / Story Writer kan vise akt-
    // organisering for scenene over.
    const acts = [
      { id: 'act-1', num: 1, title: 'Akt I — Oppdagelsen',
        description: 'Setup. Verden etableres. Trollet avdekkes i Lærdalstunnelen og Nora trekkes inn i mysteriet.',
        startScene: 1, endScene: 4 },
      { id: 'act-2', num: 2, title: 'Akt II — Konfrontasjonen',
        description: 'Konflikt eskalerer. Nora og Andreas reiser til Dovrefjell. Statens militære respons truer en utdøende skapning.',
        startScene: 5, endScene: 8 },
      { id: 'act-3', num: 3, title: 'Akt III — Oppløsningen',
        description: 'Klimaks og emosjonell oppløsning. Nora gjenforenes med faren Tobias og forstår sin egen rolle i historien.',
        startScene: 9, endScene: 10 },
    ];
    for (const a of acts) {
      await client.query(
        `INSERT INTO casting_acts
           (id, project_id, manuscript_id, act_number, title, description, start_scene_number, end_scene_number, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [eid(a.id), TROLL_PROJECT_ID, manuscriptId, a.num, a.title, a.description, a.startScene, a.endScene],
      );
    }

    // ── 9c. casting_dialogue ──────────────────────────────────────────
    // Migrasjon 184 opprettet casting_dialogue-tabellen. Seed utdrag av
    // dialog fra scene 1, 4 og 10 så Karakterer-fanen (som hentes fra
    // dialog) + Dialog-fanen viser realistisk arbeidsmateriale.
    const dialogue = [
      // Scene 1 — Tunnelen
      { id: 'dl-1', sceneId: 'scene-1', line: 1, character: 'ARBEIDER 1', text: 'Hvor langt inn er vi?', type: 'dialogue' },
      { id: 'dl-2', sceneId: 'scene-1', line: 2, character: 'ARBEIDER 2', text: 'Tre meter til. Hold ut.', type: 'dialogue' },
      { id: 'dl-3', sceneId: 'scene-1', line: 3, character: 'ARBEIDER 1', text: 'Hva i…', type: 'dialogue' },

      // Scene 2 — Tunnel-kollapsen
      { id: 'dl-4', sceneId: 'scene-2', line: 4, character: 'ARBEIDER 2', text: 'LØP! LØP!!', type: 'dialogue', parenthetical: 'skrikende' },

      // Scene 3 — Nora introduseres
      { id: 'dl-5', sceneId: 'scene-3', line: 5, character: 'NORA', text: 'Tidemann.', type: 'dialogue' },
      { id: 'dl-6', sceneId: 'scene-3', line: 6, character: 'STATSRÅDEN', text: 'Vi trenger deg. Nå.', type: 'voiceover' },

      // Scene 4 — Krise-møtet
      { id: 'dl-7', sceneId: 'scene-4', line: 7, character: 'NORA', text: 'Det er ikke et jordskjelv. Se på rystelsesmønsteret — det er FOTSTEG.', type: 'dialogue' },
      { id: 'dl-8', sceneId: 'scene-4', line: 8, character: 'GENERAL ELVENES', text: 'Det er absurd.', type: 'dialogue' },
      { id: 'dl-9', sceneId: 'scene-4', line: 9, character: 'ANDREAS', text: 'Nora. Si det.', type: 'dialogue' },
      { id: 'dl-10', sceneId: 'scene-4', line: 10, character: 'NORA', text: 'Det er et troll.', type: 'dialogue', parenthetical: 'med tyngde' },

      // Scene 5 — Til Dovrefjell
      { id: 'dl-11', sceneId: 'scene-5', line: 11, character: 'ANDREAS', text: 'Det er rart å være tilbake i bil sammen.', type: 'dialogue' },
      { id: 'dl-12', sceneId: 'scene-5', line: 12, character: 'NORA', text: 'La oss ikke gjøre dette nå.', type: 'dialogue' },
      { id: 'dl-13', sceneId: 'scene-5', line: 13, character: 'ANDREAS', text: 'Aldri en gang så vi solnedgangen.', type: 'dialogue' },
      { id: 'dl-14', sceneId: 'scene-5', line: 14, character: 'NORA', text: 'Du husker det.', type: 'dialogue', parenthetical: 'smiler så vidt' },

      // Scene 6 — Bondens fortelling
      { id: 'dl-15', sceneId: 'scene-6', line: 15, character: 'BONDEN', text: 'Bestefar tegnet dette i 1929. Han så det da han var sju.', type: 'dialogue' },
      { id: 'dl-16', sceneId: 'scene-6', line: 16, character: 'BONDEN', text: 'Vi sa ingenting. Det skader ingen så lenge man holdt seg fra dets stier.', type: 'dialogue' },

      // Scene 7 — Militær respons
      { id: 'dl-17', sceneId: 'scene-7', line: 17, character: 'STATSMINISTEREN', text: 'Vi må handle.', type: 'dialogue' },
      { id: 'dl-18', sceneId: 'scene-7', line: 18, character: 'NORA', text: 'Skyt det ikke. Ikke ennå. Hvis det er ekte — det betyr noe i vår historie.', type: 'dialogue' },
      { id: 'dl-19', sceneId: 'scene-7', line: 19, character: 'GENERAL ELVENES', text: 'Hvis det er ekte er det ALLEREDE for sent.', type: 'dialogue' },

      // Scene 9 — Forfølgelse
      { id: 'dl-20', sceneId: 'scene-9', line: 20, character: 'NORA', text: 'Vi må stoppe dem!', type: 'dialogue' },
      { id: 'dl-21', sceneId: 'scene-9', line: 21, character: 'ANDREAS', text: 'Jeg vet hvor han vil!', type: 'dialogue' },

      // Scene 10 — Fars hemmelighet
      { id: 'dl-22', sceneId: 'scene-10', line: 22, character: 'NORA', text: 'Pappa…', type: 'dialogue' },
      { id: 'dl-23', sceneId: 'scene-10', line: 23, character: 'TOBIAS', text: 'Du fant meg.', type: 'dialogue' },
      { id: 'dl-24', sceneId: 'scene-10', line: 24, character: 'NORA', text: 'Hvorfor forlot du oss?', type: 'dialogue' },
      { id: 'dl-25', sceneId: 'scene-10', line: 25, character: 'TOBIAS', text: 'Fordi du måtte tro at det ikke eksisterte. Slik kunne du leve som et normalt menneske.', type: 'dialogue' },
      { id: 'dl-26', sceneId: 'scene-10', line: 26, character: 'NORA', text: 'Det går ikke. Ikke nå.', type: 'dialogue' },
      { id: 'dl-27', sceneId: 'scene-10', line: 27, character: 'TOBIAS', text: 'Da er det din tur, min datter.', type: 'dialogue' },
    ];
    for (const d of dialogue) {
      await client.query(
        `INSERT INTO casting_dialogue
           (id, project_id, manuscript_id, scene_id, character_name, dialogue_text, dialogue_type, parenthetical, line_number, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [eid(d.id), TROLL_PROJECT_ID, manuscriptId, eid(d.sceneId), d.character, d.text, d.type, (d as any).parenthetical ?? null, d.line],
      );
    }

    // ── 9d. casting_revisions ─────────────────────────────────────────
    // Migrasjon 185 opprettet casting_revisions. Seed tre revisjoner med
    // change-summaries så Script Revisjoner & Diff Viewer kan demonstreres.
    const revisions = [
      { id: 'rev-v1', version: 'v1', summary: 'Første full draft. Etablert tre-akts-struktur.',
        notes: 'Fokus: introdusere Nora, etablere trollet som troverdig fysisk skapning, slå an emosjonell kjerne (far-datter).' },
      { id: 'rev-v2', version: 'v2', summary: 'Punch-up: dialog i Akt I + skarpere generalsfigur i Akt II.',
        notes: 'Generalen var for endimensjonal i v1. Lagt til tre replikker som etablerer hans dilemma. Pre-tunnel-replikk av Arbeider 1/2 strammet inn.' },
      { id: 'rev-v3', version: 'v3', summary: 'Final draft for produksjon. Sluttscenen mellom Nora og Tobias rebalansert.',
        notes: 'Tobias monolog kortet med 40%. Vi stoler nå på subteksten. Bonden i Akt II har fått et ekstra øyeblikk så hans gravity matcher Tobias.' },
    ];
    for (const r of revisions) {
      await client.query(
        `INSERT INTO casting_revisions
           (id, project_id, manuscript_id, version, change_summary, revision_notes, content, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [eid(r.id), TROLL_PROJECT_ID, manuscriptId, r.version, r.summary, r.notes, manuscriptContent, 'Roar Uthaug'],
      );
    }

    // ── 10. casting_shot_lists ────────────────────────────────────────
    const shotLists = [
      {
        id: 'shotlist-scene-1',
        scene_id: 'scene-1',
        shots: [
          { id: 'shot-1-1', shot_number: '1A', type: 'WIDE', description: 'Tunneldybden, arbeidere borer', duration: 8 },
          { id: 'shot-1-2', shot_number: '1B', type: 'CLOSE-UP', description: 'Borets spiss treffer hulrom', duration: 4 },
          { id: 'shot-1-3', shot_number: '1C', type: 'MEDIUM', description: 'Arbeider 1 reaksjon', duration: 5 },
        ],
      },
      {
        id: 'shotlist-scene-4',
        scene_id: 'scene-4',
        shots: [
          { id: 'shot-4-1', shot_number: '4A', type: 'WIDE', description: 'Møterom oversikt', duration: 6 },
          { id: 'shot-4-2', shot_number: '4B', type: 'OTS', description: 'Nora forklarer over skuldra til Andreas', duration: 12 },
          { id: 'shot-4-3', shot_number: '4C', type: 'CLOSE-UP', description: 'Generalens skeptiske blikk', duration: 3 },
        ],
      },
      {
        id: 'shotlist-scene-9',
        scene_id: 'scene-9',
        shots: [
          { id: 'shot-9-1', shot_number: '9A', type: 'AERIAL', description: 'Dronefor over skog', duration: 10 },
          { id: 'shot-9-2', shot_number: '9B', type: 'TRACKING', description: 'Følger Nora og Andreas løpe', duration: 15 },
        ],
      },
      {
        id: 'shotlist-scene-10',
        scene_id: 'scene-10',
        shots: [
          { id: 'shot-10-1', shot_number: '10A', type: 'WIDE', description: 'Hytten med Tobias ved peisen', duration: 8 },
          { id: 'shot-10-2', shot_number: '10B', type: 'CLOSE-UP', description: 'Tobias forteller — emosjonelt øyeblikk', duration: 20 },
        ],
      },
    ];
    for (const sl of shotLists) {
      await client.query(
        `INSERT INTO casting_shot_lists
           (id, project_id, scene_id, shots, camera_settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW(), NOW())`,
        [
          eid(sl.id), TROLL_PROJECT_ID, eid(sl.scene_id),
          JSON.stringify(sl.shots),
          JSON.stringify({ aspect: '2.39:1', resolution: '6K', fps: 24 }),
        ],
      );
    }

    // ── 11. casting_equipment (best-effort, tabell finnes kanskje ikke) ─
    const equipment = [
      { name: 'ARRI Alexa Mini LF', brand: 'ARRI', model: 'Alexa Mini LF', category: 'camera', condition: 'excellent' },
      { name: 'Cooke S7/i Full Frame Plus 32mm', brand: 'Cooke', model: 'S7/i 32mm', category: 'lens', condition: 'excellent' },
      { name: 'Cooke S7/i Full Frame Plus 50mm', brand: 'Cooke', model: 'S7/i 50mm', category: 'lens', condition: 'excellent' },
      { name: 'DJI Inspire 3', brand: 'DJI', model: 'Inspire 3', category: 'drone', condition: 'good' },
      { name: 'Sound Devices MixPre-10 II', brand: 'Sound Devices', model: 'MixPre-10 II', category: 'audio', condition: 'good' },
      { name: 'ARRI SkyPanel S60-C', brand: 'ARRI', model: 'SkyPanel S60-C', category: 'lighting', condition: 'good' },
      { name: 'Easyrig Vario 5', brand: 'Easyrig', model: 'Vario 5', category: 'support', condition: 'good' },
      { name: 'Ronin 4D 8K', brand: 'DJI', model: 'Ronin 4D 8K', category: 'gimbal', condition: 'excellent' },
    ];
    let equipmentInserted = 0;
    try {
      for (const e of equipment) {
        await client.query(
          `INSERT INTO casting_equipment
             (project_id, name, brand, model, category, status, condition, quantity, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'available', $6, 1, $7, NOW(), NOW())`,
          [TROLL_PROJECT_ID, e.name, e.brand, e.model, e.category, e.condition, ownerUserId],
        );
        equipmentInserted++;
      }
    } catch (err) {
      // casting_equipment-tabell finnes ikke i alle miljøer (migration 097)
      console.warn('Equipment seed skipped:', String(err instanceof Error ? err.message : err).slice(0, 120));
    }

    // ── 12. casting_production_days ───────────────────────────────────
    const productionDays = [
      { id: 'prodday-1', date: '2026-01-20', location: 'loc-tunnel', scenes: ['scene-1', 'scene-2'], crew: ['crew-roar', 'crew-jallo', 'crew-stian'] },
      { id: 'prodday-2', date: '2026-01-21', location: 'loc-oslo-stat', scenes: ['scene-3'], crew: ['crew-roar', 'crew-jallo'] },
      { id: 'prodday-3', date: '2026-01-22', location: 'loc-oslo-stat', scenes: ['scene-4', 'scene-7'], crew: ['crew-roar', 'crew-jallo', 'crew-eva'] },
      { id: 'prodday-4', date: '2026-01-25', location: 'loc-dovre', scenes: ['scene-5', 'scene-8'], crew: ['crew-roar', 'crew-jallo', 'crew-stian'] },
      { id: 'prodday-5', date: '2026-01-26', location: 'loc-osterdalen', scenes: ['scene-6'], crew: ['crew-roar', 'crew-jallo'] },
      { id: 'prodday-6', date: '2026-01-27', location: 'loc-tobias-hytte', scenes: ['scene-9', 'scene-10'], crew: ['crew-roar', 'crew-jallo', 'crew-stian', 'crew-eva'] },
    ];
    for (const d of productionDays) {
      await client.query(
        `INSERT INTO casting_production_days
           (id, project_id, date, scene_ids, crew_ids, location_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, 'planned', NOW(), NOW())`,
        [eid(d.id), TROLL_PROJECT_ID, d.date,
         JSON.stringify(d.scenes.map(eid)),
         JSON.stringify(d.crew.map(eid)),
         eid(d.location)],
      );
    }

    // ── 12b. casting_schedules ────────────────────────────────────────
    // Audition / callback / fitting / rehearsal-sesjoner. Tabell-skjema
    // tillater nullable role/scene/location, så vi seeder en realistisk
    // miks som dekker både pre-prod og produksjon.
    const schedules = [
      {
        id: 'sched-bonden-audition', candidate: 'cand-stein', role: 'role-bonde',
        location: 'loc-osterdalen', date: '2025-12-15', start: '14:00', end: '15:00',
        type: 'audition', status: 'completed',
        notes: 'Stein leste sidene 12-14. Sterk presence, vurderes til callback.',
      },
      {
        id: 'sched-bonden-callback', candidate: 'cand-stein', role: 'role-bonde',
        location: 'loc-osterdalen', date: '2025-12-22', start: '13:00', end: '14:00',
        type: 'callback', status: 'completed',
        notes: 'Callback med Roar — chemistry-test mot Nora-skuespilleren.',
      },
      {
        id: 'sched-nora-fitting', candidate: 'cand-ine', role: 'role-nora',
        location: null, date: '2026-01-10', start: '10:00', end: '12:00',
        type: 'fitting', status: 'scheduled',
        notes: 'Kostyme-prøve, paleontolog-feltjakke. Eva Haukeland leder.',
      },
      {
        id: 'sched-readthrough', candidate: null, role: null,
        location: null, date: '2026-01-12', start: '09:00', end: '13:00',
        type: 'rehearsal', status: 'scheduled',
        notes: 'Read-through med Ine, Kim, Gard, Fridtjov, Anneke.',
      },
      {
        id: 'sched-stunt-tunnel', candidate: null, role: 'role-arbeider1',
        location: 'loc-tunnel', date: '2026-01-18', start: '14:00', end: '17:00',
        type: 'rehearsal', status: 'scheduled',
        notes: 'Stunt-rehearsal scene 1+2 — koreografi for tunnel-kollapsen.',
      },
      {
        id: 'sched-preprod', candidate: null, role: null,
        location: 'loc-oslo-stat', date: '2026-01-19', start: '09:00', end: '12:00',
        type: 'meeting', status: 'scheduled',
        notes: 'Pre-produksjonsmøte: gjennomgang av opptaksdager 1-6.',
      },
    ];
    for (const s of schedules) {
      await client.query(
        `INSERT INTO casting_schedules
           (id, project_id, candidate_id, role_id, location_id, date,
            start_time, end_time, type, status, notes, reminders_sent,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, NOW(), NOW())`,
        [eid(s.id), TROLL_PROJECT_ID,
         s.candidate ? eid(s.candidate) : null,
         s.role ? eid(s.role) : null,
         s.location ? eid(s.location) : null,
         s.date, s.start, s.end, s.type, s.status, s.notes],
      );
    }

    // ── 12c. casting_props ────────────────────────────────────────────
    // Rekvisitter knyttet til TROLL-univers (gruvedrift, statsministerens
    // kontor, paleontologisk feltarbeid, norske fjellsymboler).
    const props = [
      { id: 'prop-borrekrone', name: 'Knust borrekrone', category: 'set_dressing',
        description: 'Ødelagt bor-spiss fra eksplosjonen i Lærdalstunnelen. Hero prop scene 1.',
        availability: 'in_storage', quantity: 1 },
      { id: 'prop-hjelm', name: 'Tunnelarbeider-hjelm', category: 'costume',
        description: 'Vernehjelm med pannelampe, brand: Petzl. Scene 1+2.',
        availability: 'rented', quantity: 8 },
      { id: 'prop-kart-dovre', name: 'Topografisk kart — Dovrefjell',
        category: 'paper_props', description: 'A2 print, sammenbrettet. Brukes i scene 4 + 7.',
        availability: 'in_storage', quantity: 2 },
      { id: 'prop-mappe', name: 'Statsministerens dokumentmappe',
        category: 'set_dressing', description: 'Skinninnbundet, embossert med riksvåpen.',
        availability: 'in_storage', quantity: 1 },
      { id: 'prop-geiger', name: 'Vintage Geiger-teller', category: 'hand_prop',
        description: 'Sovjetisk DP-5B, fungerende. Tobias bruker den i scene 10.',
        availability: 'rented', quantity: 1 },
      { id: 'prop-feltkoffert', name: 'Paleontolog-feltkoffert', category: 'hand_prop',
        description: 'Noras feltverktøy — pinsetter, lupe, prøveglass, notatbok.',
        availability: 'in_storage', quantity: 1 },
      { id: 'prop-flagg', name: 'Norsk flagg — Akershus festning',
        category: 'set_dressing', description: 'Flaggstang-størrelse, bomullsbasert.',
        availability: 'in_storage', quantity: 3 },
      { id: 'prop-runestein', name: 'Runesteen-kopi', category: 'set_dressing',
        description: 'Polyuretan-replika, Tobias hytte. Scene 10 reveal.',
        availability: 'in_production', quantity: 2 },
    ];
    for (const p of props) {
      await client.query(
        `INSERT INTO casting_props
           (id, project_id, name, category, description, availability, quantity,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [eid(p.id), TROLL_PROJECT_ID, p.name, p.category, p.description, p.availability, p.quantity],
      );
    }

    // ── 12d. split_sheets + split_sheet_contributors ──────────────────
    // Idempotent: slett eksisterende sheet for prosjektet før INSERT.
    await client.query(
      `DELETE FROM split_sheet_contributors
         WHERE split_sheet_id IN (SELECT id FROM split_sheets WHERE project_id = $1)`,
      [TROLL_PROJECT_ID],
    );
    await client.query(`DELETE FROM split_sheets WHERE project_id = $1`, [TROLL_PROJECT_ID]);

    const splitSheetRow = await client.query<{ id: string }>(
      `INSERT INTO split_sheets
         (user_id, project_id, title, description, status, total_percentage, metadata,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', 100, $5::jsonb, NOW(), NOW())
       RETURNING id`,
      [
        ownerUserId,
        TROLL_PROJECT_ID,
        'TROLL — Filmproduksjon Split Sheet',
        'Fordeling av inntekter for TROLL (2026). Bygget på Norsk Filminstitutts standard-kontrakt.',
        JSON.stringify({ source: 'troll_seed_v1', isDemo: true }),
      ],
    );
    const splitSheetId = splitSheetRow.rows[0].id;

    // role-CHECK på split_sheet_contributors er hardkodet for music-domene
    // (producer/artist/songwriter/...). Vi mapper film-roller til 'other'
    // og lagrer faktisk tittel i notes så den vises i UI.
    const contributors = [
      { name: 'Roar Uthaug', email: 'roar@uthaug.no', role: 'producer', notes: 'Regissør', percentage: 25, order: 0 },
      { name: 'Espen Horn', email: 'espen@motlysfilm.no', role: 'producer', notes: 'Produsent', percentage: 20, order: 1 },
      { name: 'Espen Aukan', email: 'espen.aukan@writer.no', role: 'songwriter', notes: 'Manusforfatter', percentage: 15, order: 2 },
      { name: 'Ine Marie Wilmann', email: 'agent@inemarie.no', role: 'artist', notes: 'Hovedrolle — Nora', percentage: 10, order: 3 },
      { name: 'Kim Falck', email: 'kim.falck@agent.no', role: 'artist', notes: 'Hovedrolle — Andreas', percentage: 10, order: 4 },
      { name: 'Jallo Faber', email: 'jallo@cinematographers.no', role: 'collaborator', notes: 'Cinematographer / DP', percentage: 10, order: 5 },
      { name: 'Hanne Berkaak', email: 'hanne@design.no', role: 'collaborator', notes: 'Production designer', percentage: 5, order: 6 },
      { name: 'Stian Aadland', email: 'stian@sound.no', role: 'mix_engineer', notes: 'Sound designer', percentage: 5, order: 7 },
    ];
    for (const c of contributors) {
      await client.query(
        `INSERT INTO split_sheet_contributors
           (split_sheet_id, name, email, role, percentage, order_index, notes,
            invitation_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'not_sent', NOW(), NOW())`,
        [splitSheetId, c.name, c.email, c.role, c.percentage, c.order, c.notes],
      );
    }

    // ── 13. casting_consents ──────────────────────────────────────────
    const consents = [
      { id: 'consent-ine', candidate: 'cand-ine', type: 'image_likeness', status: 'signed' },
      { id: 'consent-kim', candidate: 'cand-kim', type: 'image_likeness', status: 'signed' },
      { id: 'consent-gard', candidate: 'cand-gard', type: 'image_likeness', status: 'signed' },
      { id: 'consent-mads', candidate: 'cand-mads', type: 'image_likeness', status: 'pending' },
    ];
    for (const c of consents) {
      await client.query(
        `INSERT INTO casting_consents
           (id, project_id, candidate_id, type, status, signed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, ${c.status === 'signed' ? 'NOW()' : 'NULL'}, NOW(), NOW())`,
        [eid(c.id), TROLL_PROJECT_ID, eid(c.candidate), c.type, c.status],
      );
    }

    // ── 14. casting_storyboards ───────────────────────────────────────
    const storyboards = [
      { scene: 'scene-1', title: 'Tunnelen — Eksplosjonen (rough storyboard)' },
      { scene: 'scene-4', title: 'Krise-møtet (blocking)' },
      { scene: 'scene-9', title: 'Skog — forfølgelse (handheld)' },
      { scene: 'scene-10', title: 'Hytten — fars hemmelighet (intimate)' },
    ];
    for (const sb of storyboards) {
      await client.query(
        `INSERT INTO casting_storyboards
           (project_id, scene_id, title, strokes, width, height, workflow_level,
            metadata, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, '[]'::jsonb, 1920, 1080, 'rough', $4::jsonb, $5,
                 NOW(), NOW())`,
        [
          TROLL_PROJECT_ID,
          eid(sb.scene),
          sb.title,
          JSON.stringify({ source: 'troll_seed_v1', isDemo: true }),
          ownerUserId,
        ],
      );
    }

    // ── 15. casting_candidate_videos ──────────────────────────────────
    // Self-tape audition videos for filled roles. URLs peker på en
    // generisk demo-stream — i prod ville dette vært R2-uploaded clips.
    const auditionVideos = [
      {
        candidate: 'cand-ine', title: 'Self-tape — Nora monolog',
        url: 'https://demo.creatorhubn.com/troll/auditions/ine-nora.mp4',
        thumb: 'https://demo.creatorhubn.com/troll/auditions/thumbs/ine-nora.jpg',
        duration: 92, rating: 5, notes: 'Strålende. Nora cast.',
      },
      {
        candidate: 'cand-kim', title: 'Self-tape — Andreas oppvarming',
        url: 'https://demo.creatorhubn.com/troll/auditions/kim-andreas.mp4',
        thumb: 'https://demo.creatorhubn.com/troll/auditions/thumbs/kim-andreas.jpg',
        duration: 78, rating: 4, notes: 'Sterk timing. Cast.',
      },
      {
        candidate: 'cand-stein', title: 'Self-tape — Bonden-monolog',
        url: 'https://demo.creatorhubn.com/troll/auditions/stein-bonde.mp4',
        thumb: 'https://demo.creatorhubn.com/troll/auditions/thumbs/stein-bonde.jpg',
        duration: 105, rating: 3, notes: 'Solid. Vurderer mot 2 andre.',
      },
      {
        candidate: 'cand-mads', title: 'Self-tape — Tunnelarbeider 1',
        url: 'https://demo.creatorhubn.com/troll/auditions/mads-arb1.mp4',
        thumb: 'https://demo.creatorhubn.com/troll/auditions/thumbs/mads-arb1.jpg',
        duration: 64, rating: 4, notes: 'Cast. God action-sense.',
      },
    ];
    for (const v of auditionVideos) {
      await client.query(
        `INSERT INTO casting_candidate_videos
           (candidate_id, project_id, title, video_url, thumbnail_url,
            duration_seconds, mime_type, rating, status, uploaded_by, notes,
            metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'video/mp4', $7, 'ready', $8, $9,
                 $10::jsonb, NOW(), NOW())`,
        [
          eid(v.candidate), TROLL_PROJECT_ID, v.title, v.url, v.thumb,
          v.duration, v.rating, ownerUserId, v.notes,
          JSON.stringify({ source: 'troll_seed_v1', isDemo: true }),
        ],
      );
    }

    // ── 16. role_room_calendar_events (production team kalender) ──────
    // Idempotent rensing — DELETE før INSERT siden tabellen ikke er i
    // den første subTables-listen (den blir tømt nå istedenfor).
    await client.query(
      `DELETE FROM role_room_calendar_events WHERE project_id = $1`,
      [TROLL_PROJECT_ID],
    );
    const calendarEvents = [
      {
        id: 'evt-readthrough', title: 'Read-through med hovedcast',
        type: 'meeting', start: '2026-01-12T09:00:00Z', end: '2026-01-12T13:00:00Z',
        location: null, notes: 'Ine, Kim, Gard, Fridtjov, Anneke.',
      },
      {
        id: 'evt-recce-dovre', title: 'Tech recce — Dovrefjell',
        type: 'recce', start: '2026-01-15T08:00:00Z', end: '2026-01-15T17:00:00Z',
        location: 'loc-dovre', notes: 'Roar, Jallo, Stian. Lokasjons-evaluering.',
      },
      {
        id: 'evt-stunt-rehearsal', title: 'Stunt rehearsal — tunnel-kollaps',
        type: 'rehearsal', start: '2026-01-18T14:00:00Z', end: '2026-01-18T17:00:00Z',
        location: 'loc-tunnel', notes: 'Koreografi for scene 1+2.',
      },
      {
        id: 'evt-shoot-day-1', title: 'Opptaksdag 1 — Lærdalstunnelen',
        type: 'shoot', start: '2026-01-20T06:00:00Z', end: '2026-01-20T22:00:00Z',
        location: 'loc-tunnel', notes: 'Scene 1+2. Call time 06:00.',
      },
      {
        id: 'evt-shoot-day-2', title: 'Opptaksdag 2 — Statsministerens kontor',
        type: 'shoot', start: '2026-01-21T07:00:00Z', end: '2026-01-21T20:00:00Z',
        location: 'loc-oslo-stat', notes: 'Scene 3. Call time 07:00.',
      },
      {
        id: 'evt-wrap', title: 'Wrap party — TROLL',
        type: 'general', start: '2026-02-15T19:00:00Z', end: '2026-02-15T23:30:00Z',
        location: null, notes: 'Cast + crew. Lokasjon avklares.',
      },
    ];
    for (const e of calendarEvents) {
      await client.query(
        `INSERT INTO role_room_calendar_events
           (id, project_id, title, event_type, start_time, end_time,
            location_id, notes, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, NOW(), NOW())`,
        [eid(e.id), TROLL_PROJECT_ID, e.title, e.type, e.start, e.end,
         e.location ? eid(e.location) : null, e.notes, ownerUserId],
      );
    }

    // ── 17. role_room_budget_items ─────────────────────────────────────
    await client.query(
      `DELETE FROM role_room_budget_items WHERE project_id = $1`,
      [TROLL_PROJECT_ID],
    );
    const budgetItems = [
      // Pre-produksjon
      { phase: 'preproduction', category: 'Pre-produksjon', name: 'Manuskript-finalisering', estimate: 350000, approved: 350000, actual: 320000, status: 'approved' },
      { phase: 'preproduction', category: 'Pre-produksjon', name: 'Casting-prosess', estimate: 250000, approved: 250000, actual: 215000, status: 'approved' },
      // Produksjon — crew
      { phase: 'production', category: 'Crew', name: 'Roar Uthaug — regissør', estimate: 800000, approved: 800000, actual: 0, status: 'approved' },
      { phase: 'production', category: 'Crew', name: 'Espen Horn — produsent', estimate: 500000, approved: 500000, actual: 0, status: 'approved' },
      { phase: 'production', category: 'Crew', name: 'Jallo Faber — DP', estimate: 350000, approved: 350000, actual: 0, status: 'approved' },
      // Produksjon — locations
      { phase: 'production', category: 'Locations', name: 'Dovrefjell tilatelse + ranger', estimate: 75000, approved: 75000, actual: 0, status: 'approved' },
      { phase: 'production', category: 'Locations', name: 'Lærdalstunnelen — leie', estimate: 120000, approved: 120000, actual: 0, status: 'pending_approval' },
      // Produksjon — cast
      { phase: 'production', category: 'Cast', name: 'Ine Marie Wilmann — Nora', estimate: 250000, approved: 250000, actual: 0, status: 'approved' },
      // Post — VFX (hovedlinje)
      { phase: 'postproduction', category: 'VFX', name: 'Trollet — CGI hovedmodel', estimate: 8000000, approved: 7500000, actual: 0, status: 'approved' },
      { phase: 'postproduction', category: 'Lyd / Color', name: 'Stian Aadland + DI grading', estimate: 600000, approved: 600000, actual: 0, status: 'draft' },
    ];
    for (let i = 0; i < budgetItems.length; i++) {
      const b = budgetItems[i];
      await client.query(
        `INSERT INTO role_room_budget_items
           (id, project_id, phase, category, item_name, estimate, approved, actual,
            currency, status, sort_order, created_by, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'NOK', $8, $9, $10, NOW(), NOW())`,
        [TROLL_PROJECT_ID, b.phase, b.category, b.name, b.estimate, b.approved, b.actual, b.status, i, ownerUserId],
      );
    }

    // ── 18. role_room_expenses ─────────────────────────────────────────
    await client.query(
      `DELETE FROM role_room_expenses WHERE project_id = $1`,
      [TROLL_PROJECT_ID],
    );
    const expenses = [
      { title: 'Catering opptaksdag 1', merchant: 'Dovre Servering AS', date: '2026-01-20', amount: 12500, vat: 3125, category: 'Catering' },
      { title: 'Drivstoff varebil — Oslo–Lærdal', merchant: 'Circle K', date: '2026-01-19', amount: 1850, vat: 463, category: 'Transport' },
      { title: 'Hotell Dovrefjell — 6 netter', merchant: 'Dovrefjell Hotel', date: '2026-01-25', amount: 18900, vat: 2025, category: 'Hotell' },
      { title: 'Frakt utstyr — ARRI rigg', merchant: 'Bring Express', date: '2026-01-18', amount: 3200, vat: 800, category: 'Transport' },
      { title: 'Sikkerhetsgjerde Lærdal', merchant: 'Cramo Norge', date: '2026-01-17', amount: 4100, vat: 1025, category: 'Sikkerhet' },
    ];
    for (const x of expenses) {
      await client.query(
        `INSERT INTO role_room_expenses
           (id, project_id, title, merchant_name, expense_date, amount, vat_amount,
            currency, category, cost_owner, refund_status, client_approval_status,
            ocr_status, ocr_review_required, amount_validation_status,
            vat_validation_status, created_by_user_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'NOK', $7, 'production', 'not_requested',
                 'pending', 'completed', false, 'verified', 'verified', $8,
                 NOW(), NOW())`,
        [TROLL_PROJECT_ID, x.title, x.merchant, x.date, x.amount, x.vat, x.category, ownerUserId],
      );
    }

    await client.query('COMMIT');

    return {
      project: { id: TROLL_PROJECT_ID, name: 'TROLL' },
      counts: {
        roles: roles.length,
        candidates: candidates.length,
        crew: crew.length,
        locations: locations.length,
        manuscripts: 1,
        acts: acts.length,
        scenes: scenes.length,
        dialogue: dialogue.length,
        revisions: revisions.length,
        shotLists: shotLists.length,
        equipment: equipmentInserted,
        productionDays: productionDays.length,
        consents: consents.length,
        schedules: schedules.length,
        props: props.length,
        splitSheets: 1,
        splitSheetContributors: contributors.length,
        storyboards: storyboards.length,
        candidateVideos: auditionVideos.length,
        calendarEvents: calendarEvents.length,
        budgetItems: budgetItems.length,
        expenses: expenses.length,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
