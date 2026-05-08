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
 *
 * Returnerer rapport om hva som ble seedet for frontend-feedback.
 */

import type { Pool } from 'pg';

const TROLL_PROJECT_ID = 'troll-project-2026';

interface SeedReport {
  project: { id: string; name: string };
  counts: Record<string, number>;
}

export async function seedTrollDemo(
  pool: Pool,
  ownerUserId: string,
): Promise<SeedReport> {
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
      'casting_scenes',
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
        'TROLL',
        'Norsk eventyrfilm regissert av Roar Uthaug. Når en eksplosjon i de norske fjellene avslører et urgammelt troll, må paleontologen Nora samarbeide med myndighetene for å stoppe skapningen før den når hovedstaden. En spektakulær action-eventyrfilm med VFX og storslåtte locations.',
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
        [r.id, TROLL_PROJECT_ID, r.name, r.description, r.age_range, r.gender,
         r.role_type, JSON.stringify(r.scene_ids), r.status, r.candidate_id],
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
        [c.id, TROLL_PROJECT_ID, c.name, c.email, c.phone, c.notes, c.status, JSON.stringify(c.roles)],
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
        [m.id, TROLL_PROJECT_ID, m.name, m.role, m.email, m.phone, m.department, m.rate],
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
        [l.id, TROLL_PROJECT_ID, l.name, l.address, l.type, l.notes],
      );
    }

    // ── 8. casting_manuscripts ────────────────────────────────────────
    const manuscriptId = 'manuscript-troll-v1';
    await client.query(
      `INSERT INTO casting_manuscripts
         (id, project_id, title, format, content, version, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, 'screenplay', $4, 1, 'locked', $5::jsonb, NOW(), NOW())`,
      [
        manuscriptId,
        TROLL_PROJECT_ID,
        'TROLL — Manuskript v1',
        '# TROLL\n\nNorsk eventyrfilm. Skrevet av Espen Aukan og Roar Uthaug.\n\nFINAL DRAFT — 2025-11-01',
        JSON.stringify({ author: 'Espen Aukan & Roar Uthaug', draftNumber: 7 }),
      ],
    );

    // ── 9. casting_scenes ─────────────────────────────────────────────
    const scenes = [
      { id: 'scene-1', num: 1, title: 'Tunnelen — Eksplosjonen', setting: 'Lærdalstunnelen', tod: 'NIGHT', int_ext: 'INT', characters: ['role-arbeider1', 'role-arbeider2'] },
      { id: 'scene-2', num: 2, title: 'Tunnel-kollapsen', setting: 'Lærdalstunnelen', tod: 'NIGHT', int_ext: 'INT', characters: ['role-arbeider1', 'role-arbeider2'] },
      { id: 'scene-3', num: 3, title: 'Nora introduseres', setting: 'Naturhistorisk museum', tod: 'DAY', int_ext: 'INT', characters: ['role-nora'] },
      { id: 'scene-4', num: 4, title: 'Krise-møtet', setting: 'Statsministerens kontor', tod: 'DAY', int_ext: 'INT', characters: ['role-nora', 'role-andreas', 'role-general'] },
      { id: 'scene-5', num: 5, title: 'Til Dovrefjell', setting: 'Dovre — vei', tod: 'DUSK', int_ext: 'EXT', characters: ['role-nora', 'role-andreas'] },
      { id: 'scene-6', num: 6, title: 'Bondens fortelling', setting: 'Østerdalen gård', tod: 'DAY', int_ext: 'EXT', characters: ['role-bonde'] },
      { id: 'scene-7', num: 7, title: 'Militær respons', setting: 'Statsministerens kontor', tod: 'NIGHT', int_ext: 'INT', characters: ['role-statsminister', 'role-general', 'role-nora'] },
      { id: 'scene-8', num: 8, title: 'Trollet på vandring', setting: 'Dovrefjell — natt', tod: 'NIGHT', int_ext: 'EXT', characters: [] },
      { id: 'scene-9', num: 9, title: 'Nora og Andreas — forfølgelse', setting: 'Skog ved Dovre', tod: 'DAWN', int_ext: 'EXT', characters: ['role-nora', 'role-andreas'] },
      { id: 'scene-10', num: 10, title: 'Fars hemmelighet', setting: 'Tobias hytte', tod: 'DAY', int_ext: 'INT', characters: ['role-nora', 'role-andreas', 'role-tobias'] },
    ];
    for (const s of scenes) {
      await client.query(
        `INSERT INTO casting_scenes
           (id, project_id, manuscript_id, scene_number, title, setting, time_of_day, int_ext, characters, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW(), NOW())`,
        [s.id, TROLL_PROJECT_ID, manuscriptId, s.num, s.title, s.setting, s.tod, s.int_ext, JSON.stringify(s.characters)],
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
          sl.id, TROLL_PROJECT_ID, sl.scene_id,
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
        [d.id, TROLL_PROJECT_ID, d.date, JSON.stringify(d.scenes), JSON.stringify(d.crew), d.location],
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
        [s.id, TROLL_PROJECT_ID, s.candidate, s.role, s.location, s.date,
         s.start, s.end, s.type, s.status, s.notes],
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
        [p.id, TROLL_PROJECT_ID, p.name, p.category, p.description, p.availability, p.quantity],
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

    const contributors = [
      { name: 'Roar Uthaug', email: 'roar@uthaug.no', role: 'director', percentage: 25, order: 0 },
      { name: 'Espen Horn', email: 'espen@motlysfilm.no', role: 'producer', percentage: 20, order: 1 },
      { name: 'Espen Aukan', email: 'espen.aukan@writer.no', role: 'writer', percentage: 15, order: 2 },
      { name: 'Ine Marie Wilmann', email: 'agent@inemarie.no', role: 'lead_actor', percentage: 10, order: 3 },
      { name: 'Kim Falck', email: 'kim.falck@agent.no', role: 'lead_actor', percentage: 10, order: 4 },
      { name: 'Jallo Faber', email: 'jallo@cinematographers.no', role: 'cinematographer', percentage: 10, order: 5 },
      { name: 'Hanne Berkaak', email: 'hanne@design.no', role: 'production_designer', percentage: 5, order: 6 },
      { name: 'Stian Aadland', email: 'stian@sound.no', role: 'sound_designer', percentage: 5, order: 7 },
    ];
    for (const c of contributors) {
      await client.query(
        `INSERT INTO split_sheet_contributors
           (split_sheet_id, name, email, role, percentage, order_index, invitation_status,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'not_sent', NOW(), NOW())`,
        [splitSheetId, c.name, c.email, c.role, c.percentage, c.order],
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
        [c.id, TROLL_PROJECT_ID, c.candidate, c.type, c.status],
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
        scenes: scenes.length,
        shotLists: shotLists.length,
        equipment: equipmentInserted,
        productionDays: productionDays.length,
        consents: consents.length,
        schedules: schedules.length,
        props: props.length,
        splitSheets: 1,
        splitSheetContributors: contributors.length,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
