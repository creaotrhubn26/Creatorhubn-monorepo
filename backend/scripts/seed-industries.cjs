#!/usr/bin/env node
/**
 * seed-industries.cjs
 *
 * Seed-script for `industries`-tabellen (mig 329). Idempotent — kan
 * kjøres flere ganger trygt via ON CONFLICT (code) DO UPDATE.
 *
 * Seeder:
 *   1. Norge NACE-toppnivå (seksjoner A-U + 88 viktigste 2-siffer
 *      divisjoner + utvalgte 3-/4-/5-siffer for B2B-relevante bransjer
 *      vi vil at iPad-pin-ene skal kunne treffe presist).
 *   2. Daniels custom verticals (CUSTOM.* — wedding/casting/film/etc).
 *      Disse settes med scope='custom' og organization_id=NULL
 *      (globalt tilgjengelig på tvers av orgs).
 *
 * Kilde for NACE: https://www.ssb.no/klass/klassifikasjoner/6
 *
 * Bruk: `node backend/scripts/seed-industries.cjs`
 *   (DATABASE_URL fra env eller fallback til Neon-prod-pooler).
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// ---------------------------------------------------------------------
// NACE-katalog. Format: [code, name_no, name_en, parentCode, icon, color]
// ---------------------------------------------------------------------

const NACE_ROWS = [
  // ──────── Seksjon A: Jordbruk, skogbruk og fiske ────────
  ['NACE.A',       'Jordbruk, skogbruk og fiske',          'Agriculture, forestry, fishing', null,        'leaf.fill',           '#16a34a'],
  ['NACE.A.01',    'Jordbruk, jakt og tjenester tilknyttet',  'Crop and animal production',   'NACE.A',    'tractor.fill',        '#16a34a'],
  ['NACE.A.02',    'Skogbruk',                              'Forestry',                       'NACE.A',    'tree',                '#16a34a'],
  ['NACE.A.03',    'Fiske, fangst og akvakultur',           'Fishing and aquaculture',        'NACE.A',    'fish.fill',           '#0ea5e9'],

  // ──────── Seksjon B: Bergverksdrift og utvinning ────────
  ['NACE.B',       'Bergverksdrift og utvinning',           'Mining and quarrying',           null,        'mountain.2.fill',     '#78716c'],
  ['NACE.B.06',    'Utvinning av olje og naturgass',        'Oil and gas extraction',         'NACE.B',    'drop.fill',           '#0c4a6e'],
  ['NACE.B.08',    'Bryting og utvinning ellers',           'Other mining and quarrying',     'NACE.B',    'mountain.2.fill',     '#78716c'],

  // ──────── Seksjon C: Industri ────────
  ['NACE.C',       'Industri',                              'Manufacturing',                  null,        'gearshape.2.fill',    '#737373'],
  ['NACE.C.10',    'Produksjon av næringsmidler',           'Food manufacturing',             'NACE.C',    'cart.fill',           '#fb923c'],
  ['NACE.C.11',    'Produksjon av drikkevarer',             'Beverage manufacturing',         'NACE.C',    'wineglass.fill',      '#dc2626'],
  ['NACE.C.13',    'Produksjon av tekstiler',               'Textile manufacturing',          'NACE.C',    'tshirt.fill',         '#a78bfa'],
  ['NACE.C.16',    'Produksjon av trelast og varer av tre', 'Wood manufacturing',             'NACE.C',    'tree',                '#92400e'],
  ['NACE.C.18',    'Trykking og reproduksjon',              'Printing and reproduction',      'NACE.C',    'printer.fill',        '#737373'],
  ['NACE.C.22',    'Produksjon av gummi- og plastvarer',    'Rubber and plastic products',    'NACE.C',    'cube.fill',           '#737373'],
  ['NACE.C.25',    'Produksjon av metallvarer',             'Fabricated metal products',      'NACE.C',    'wrench.adjustable.fill', '#737373'],
  ['NACE.C.28',    'Produksjon av maskiner og utstyr',      'Machinery manufacturing',        'NACE.C',    'gearshape.fill',      '#737373'],
  ['NACE.C.29',    'Produksjon av motorvogner',             'Motor vehicle manufacturing',    'NACE.C',    'car.fill',            '#1e3a8a'],
  ['NACE.C.31',    'Produksjon av møbler',                  'Furniture manufacturing',        'NACE.C',    'bed.double.fill',     '#92400e'],

  // ──────── Seksjon D: Elektrisitet, gass, damp og varmtvann ────────
  ['NACE.D',       'Elektrisitets-, gass-, damp- og varmtvannsforsyning', 'Electricity, gas, steam', null, 'bolt.fill', '#facc15'],
  ['NACE.D.35',    'Elektrisitetsforsyning',                'Electricity supply',             'NACE.D',    'bolt.fill',           '#facc15'],

  // ──────── Seksjon E: Vannforsyning, avløp og renovasjon ────────
  ['NACE.E',       'Vannforsyning, avløps- og renovasjonsvirksomhet', 'Water supply, waste management', null, 'drop.fill', '#0ea5e9'],
  ['NACE.E.36',    'Uttak fra kilde og rensing av vann',    'Water collection/treatment',     'NACE.E',    'drop.fill',           '#0ea5e9'],
  ['NACE.E.38',    'Innsamling og behandling av avfall',    'Waste collection and treatment', 'NACE.E',    'trash.fill',          '#525252'],

  // ──────── Seksjon F: Bygg og anlegg ────────
  ['NACE.F',       'Bygg- og anleggsvirksomhet',            'Construction',                   null,        'hammer.fill',         '#f59e0b'],
  ['NACE.F.41',    'Oppføring av bygninger',                'Construction of buildings',      'NACE.F',    'building.2.fill',     '#f59e0b'],
  ['NACE.F.42',    'Anleggsvirksomhet',                     'Civil engineering',              'NACE.F',    'road.lanes',          '#f59e0b'],
  ['NACE.F.43',    'Spesialisert bygge- og anleggsvirksomhet', 'Specialised construction',    'NACE.F',    'hammer.fill',         '#f59e0b'],

  // ──────── Seksjon G: Varehandel, reparasjon av motorvogner ────────
  ['NACE.G',       'Varehandel, reparasjon av motorvogner', 'Wholesale and retail trade',     null,        'bag.fill',            '#10b981'],
  ['NACE.G.45',    'Motorkjøretøy — handel og reparasjon',  'Motor vehicle trade/repair',     'NACE.G',    'car.fill',            '#1e3a8a'],
  ['NACE.G.46',    'Agentur- og engroshandel',              'Wholesale trade',                'NACE.G',    'shippingbox.fill',    '#10b981'],
  ['NACE.G.47',    'Detaljhandel',                          'Retail trade',                   'NACE.G',    'bag.fill',            '#10b981'],
  ['NACE.G.47.11', 'Butikker — bredt vareutvalg',           'Supermarkets',                   'NACE.G.47', 'cart.fill',           '#10b981'],
  ['NACE.G.47.21', 'Butikker — frukt og grønnsaker',        'Fruit and vegetable stores',     'NACE.G.47', 'leaf.fill',           '#16a34a'],
  ['NACE.G.47.71', 'Butikker — klær',                       'Clothing stores',                'NACE.G.47', 'tshirt.fill',         '#a78bfa'],
  ['NACE.G.47.72', 'Butikker — sko og lærvarer',            'Footwear and leather stores',    'NACE.G.47', 'shoe.fill',           '#92400e'],

  // ──────── Seksjon H: Transport og lagring ────────
  ['NACE.H',       'Transport og lagring',                  'Transport and storage',          null,        'truck.box.fill',      '#0369a1'],
  ['NACE.H.49',    'Landtransport og rørtransport',         'Land transport',                 'NACE.H',    'truck.box.fill',      '#0369a1'],
  ['NACE.H.50',    'Sjøfart',                               'Water transport',                'NACE.H',    'sailboat.fill',       '#0369a1'],
  ['NACE.H.51',    'Lufttransport',                         'Air transport',                  'NACE.H',    'airplane',            '#0369a1'],
  ['NACE.H.52',    'Lagring og tjenester tilknyttet transport', 'Warehousing/support services', 'NACE.H',  'shippingbox.fill',    '#0369a1'],
  ['NACE.H.53',    'Post og distribusjon',                  'Postal and courier',             'NACE.H',    'envelope.fill',       '#0369a1'],

  // ──────── Seksjon I: Overnattings- og serveringsvirksomhet ────────
  ['NACE.I',       'Overnattings- og serveringsvirksomhet', 'Accommodation and food service', null,        'fork.knife',          '#dc2626'],
  ['NACE.I.55',    'Overnattingsvirksomhet',                'Accommodation',                  'NACE.I',    'bed.double.fill',     '#dc2626'],
  ['NACE.I.55.10', 'Hotellvirksomhet',                      'Hotels',                         'NACE.I.55', 'building.fill',       '#dc2626'],
  ['NACE.I.56',    'Serveringsvirksomhet',                  'Food and beverage service',      'NACE.I',    'fork.knife',          '#dc2626'],
  ['NACE.I.56.10', 'Restaurantvirksomhet',                  'Restaurants',                    'NACE.I.56', 'fork.knife',          '#dc2626'],
  ['NACE.I.56.21', 'Cateringvirksomhet',                    'Event catering',                 'NACE.I.56', 'takeoutbag.and.cup.and.straw.fill', '#dc2626'],
  ['NACE.I.56.30', 'Drift av barer og puber',               'Bars and pubs',                  'NACE.I.56', 'wineglass.fill',      '#dc2626'],

  // ──────── Seksjon J: Informasjon og kommunikasjon ────────
  ['NACE.J',       'Informasjon og kommunikasjon',          'Information and communication',  null,        'antenna.radiowaves.left.and.right', '#6366f1'],
  ['NACE.J.58',    'Forlagsvirksomhet',                     'Publishing activities',          'NACE.J',    'book.fill',           '#6366f1'],
  ['NACE.J.59',    'Film-, video- og fjernsynsproduksjon',  'Motion picture/video production', 'NACE.J',   'film.fill',           '#7c3aed'],
  ['NACE.J.59.11', 'Produksjon av filmer, video og TV-programmer', 'Motion picture production', 'NACE.J.59', 'film.fill', '#7c3aed'],
  ['NACE.J.59.12', 'Etterarbeid (filmer/video/TV)',         'Post-production',                'NACE.J.59', 'wand.and.stars',      '#7c3aed'],
  ['NACE.J.60',    'Radio- og fjernsynskringkasting',       'Broadcasting',                   'NACE.J',    'antenna.radiowaves.left.and.right', '#6366f1'],
  ['NACE.J.61',    'Telekommunikasjon',                     'Telecommunications',             'NACE.J',    'wifi',                '#6366f1'],
  ['NACE.J.62',    'IT-tjenester',                          'IT services',                    'NACE.J',    'laptopcomputer',      '#3b82f6'],
  ['NACE.J.62.01', 'Programmeringstjenester',               'Computer programming',           'NACE.J.62', 'curlybraces',         '#3b82f6'],
  ['NACE.J.62.02', 'Konsulentvirksomhet — IT',              'IT consultancy',                 'NACE.J.62', 'laptopcomputer',      '#3b82f6'],
  ['NACE.J.63',    'Informasjonstjenester',                 'Information service activities', 'NACE.J',    'cloud.fill',          '#0ea5e9'],

  // ──────── Seksjon K: Finansierings- og forsikringsvirksomhet ────────
  ['NACE.K',       'Finansierings- og forsikringsvirksomhet', 'Financial and insurance',      null,        'dollarsign.circle.fill', '#059669'],
  ['NACE.K.64',    'Finansieringsvirksomhet',               'Financial services',             'NACE.K',    'banknote.fill',       '#059669'],
  ['NACE.K.65',    'Forsikringsvirksomhet',                 'Insurance',                      'NACE.K',    'shield.fill',         '#059669'],
  ['NACE.K.66',    'Tjenester tilknyttet finansiering',     'Financial services support',     'NACE.K',    'chart.line.uptrend.xyaxis', '#059669'],

  // ──────── Seksjon L: Omsetning og drift av fast eiendom ────────
  ['NACE.L',       'Omsetning og drift av fast eiendom',    'Real estate activities',         null,        'house.fill',          '#0891b2'],
  ['NACE.L.68',    'Omsetning og drift av fast eiendom',    'Real estate activities',         'NACE.L',    'house.fill',          '#0891b2'],

  // ──────── Seksjon M: Faglig, vitenskapelig og teknisk tjenesteyting ────────
  ['NACE.M',       'Faglig, vitenskapelig og teknisk tjenesteyting', 'Professional/scientific/technical', null, 'briefcase.fill', '#7c3aed'],
  ['NACE.M.69',    'Juridisk og regnskapsmessig tjenesteyting', 'Legal and accounting',       'NACE.M',    'scale.3d',            '#7c3aed'],
  ['NACE.M.69.10', 'Juridisk tjenesteyting',                'Legal activities',               'NACE.M.69', 'scale.3d',            '#7c3aed'],
  ['NACE.M.69.20', 'Regnskap, revisjon og skatterådgivning', 'Accounting/auditing',           'NACE.M.69', 'doc.text.fill',       '#7c3aed'],
  ['NACE.M.70',    'Hovedkontortjenester, administrativ rådgivning', 'Head office/consulting', 'NACE.M',   'building.columns.fill', '#7c3aed'],
  ['NACE.M.71',    'Arkitektvirksomhet og teknisk konsulent', 'Architecture/engineering',     'NACE.M',    'compass.drawing',     '#7c3aed'],
  ['NACE.M.72',    'Forskning og utviklingsarbeid',         'Scientific research',            'NACE.M',    'flask.fill',          '#7c3aed'],
  ['NACE.M.73',    'Annonse- og reklamevirksomhet, markedsundersøkelser', 'Advertising/market research', 'NACE.M', 'megaphone.fill', '#a855f7'],
  ['NACE.M.73.11', 'Reklamebyråer',                         'Advertising agencies',           'NACE.M.73', 'megaphone.fill',      '#a855f7'],
  ['NACE.M.74',    'Annen faglig, vitenskapelig og teknisk virksomhet', 'Other professional', 'NACE.M',   'briefcase.fill',      '#7c3aed'],
  ['NACE.M.74.20', 'Fotografvirksomhet',                    'Photography',                    'NACE.M.74', 'camera.fill',         '#a855f7'],
  ['NACE.M.75',    'Veterinærtjenester',                    'Veterinary',                     'NACE.M',    'pawprint.fill',       '#dc2626'],

  // ──────── Seksjon N: Forretningsmessig tjenesteyting ────────
  ['NACE.N',       'Forretningsmessig tjenesteyting',       'Administrative/support services', null,       'person.2.fill',       '#0891b2'],
  ['NACE.N.77',    'Utleie og leasing',                     'Rental and leasing',             'NACE.N',    'arrow.left.arrow.right.circle.fill', '#0891b2'],
  ['NACE.N.78',    'Arbeidskrafttjenester',                 'Employment services',            'NACE.N',    'person.crop.rectangle.fill', '#0891b2'],
  ['NACE.N.79',    'Reisebyrå- og reisearrangørvirksomhet', 'Travel agency activities',       'NACE.N',    'airplane',            '#0891b2'],
  ['NACE.N.81',    'Tjenester tilknyttet eiendomsdrift',    'Building services',              'NACE.N',    'house.fill',          '#0891b2'],
  ['NACE.N.82',    'Annen forretningsmessig tjenesteyting', 'Other business services',        'NACE.N',    'briefcase.fill',      '#0891b2'],

  // ──────── Seksjon O: Offentlig administrasjon ────────
  ['NACE.O',       'Offentlig administrasjon og forsvar',   'Public administration',          null,        'building.columns.fill', '#475569'],

  // ──────── Seksjon P: Undervisning ────────
  ['NACE.P',       'Undervisning',                          'Education',                      null,        'graduationcap.fill',  '#2563eb'],
  ['NACE.P.85',    'Undervisning',                          'Education',                      'NACE.P',    'graduationcap.fill',  '#2563eb'],

  // ──────── Seksjon Q: Helse- og sosialtjenester ────────
  ['NACE.Q',       'Helse- og sosialtjenester',             'Human health and social work',   null,        'heart.fill',          '#ec4899'],
  ['NACE.Q.86',    'Helsetjenester',                        'Human health activities',        'NACE.Q',    'cross.case.fill',     '#ec4899'],
  ['NACE.Q.86.10', 'Sykehustjenester',                      'Hospital activities',            'NACE.Q.86', 'cross.case.fill',     '#ec4899'],
  ['NACE.Q.86.21', 'Allmennlegetjeneste',                   'General medical practice',       'NACE.Q.86', 'stethoscope',         '#ec4899'],
  ['NACE.Q.86.23', 'Tannhelsetjeneste',                     'Dental practice',                'NACE.Q.86', 'mouth.fill',          '#ec4899'],
  ['NACE.Q.87',    'Pleie- og omsorgstjenester i institusjon', 'Residential care',            'NACE.Q',    'heart.fill',          '#ec4899'],
  ['NACE.Q.88',    'Sosiale omsorgstjenester uten botilbud', 'Social work without accommodation', 'NACE.Q', 'person.2.fill',     '#ec4899'],

  // ──────── Seksjon R: Kulturell virksomhet, underholdning og fritid ────────
  ['NACE.R',       'Kulturell virksomhet, underholdning og fritid', 'Arts/entertainment',     null,        'theatermasks.fill',   '#f43f5e'],
  ['NACE.R.90',    'Kunstnerisk virksomhet og underholdning', 'Creative/arts activities',     'NACE.R',    'paintbrush.pointed.fill', '#f43f5e'],
  ['NACE.R.91',    'Drift av biblioteker, arkiver, museer',   'Libraries/museums',            'NACE.R',    'books.vertical.fill', '#f43f5e'],
  ['NACE.R.93',    'Sports- og fritidsaktiviteter',           'Sports activities',            'NACE.R',    'sportscourt.fill',    '#f43f5e'],

  // ──────── Seksjon S: Annen tjenesteyting ────────
  ['NACE.S',       'Annen tjenesteyting',                   'Other service activities',       null,        'sparkles',            '#737373'],
  ['NACE.S.95',    'Reparasjon av datamaskiner, husholdningsvarer', 'Repair of computers/household', 'NACE.S', 'wrench.adjustable.fill', '#737373'],
  ['NACE.S.96',    'Personlig tjenesteyting',               'Personal service activities',    'NACE.S',    'sparkles',            '#737373'],
  ['NACE.S.96.02', 'Frisørtjenester og annen skjønnhetspleie', 'Hairdressing/beauty',         'NACE.S.96', 'scissors',            '#a855f7'],

  // ──────── Seksjon T: Lønnet husholdningsarbeid ────────
  ['NACE.T',       'Lønnet arbeid i private husholdninger', 'Households as employers',        null,        'house.fill',          '#737373'],

  // ──────── Seksjon U: Internasjonale organer ────────
  ['NACE.U',       'Internasjonale organisasjoner og organer', 'Extraterritorial bodies',     null,        'globe',               '#475569'],
];

// ---------------------------------------------------------------------
// Custom verticals — Daniels egne segmenter han jobber med.
// ---------------------------------------------------------------------

const CUSTOM_ROWS = [
  ['CUSTOM.WEDDING_VENUE',         'Bryllupslokale',         'Wedding venue',          null,        'building.2.crop.circle.fill', '#9333ea'],
  ['CUSTOM.WEDDING_PHOTOGRAPHER',  'Bryllupsfotograf',       'Wedding photographer',   null,        'camera.fill',                 '#9333ea'],
  ['CUSTOM.WEDDING_VIDEO',         'Bryllupsfilmer',         'Wedding videographer',   null,        'video.fill',                  '#9333ea'],
  ['CUSTOM.CASTING_AGENCY',        'Castingbyrå',            'Casting agency',         null,        'person.crop.rectangle.stack.fill', '#a855f7'],
  ['CUSTOM.FILM_PRODUCTION',       'Filmproduksjon',         'Film production',        null,        'film.fill',                   '#7c3aed'],
  ['CUSTOM.PETKEY',                'Veterinærklinikk',       'Veterinary clinic',      null,        'pawprint.fill',               '#dc2626'],
  ['CUSTOM.SCOTT_LAW',             'Advokatkontor',          'Law firm',               null,        'scale.3d',                    '#7c3aed'],
  ['CUSTOM.MEDSIDE',               'Helsetech',              'Health tech',            null,        'cross.case.fill',             '#ec4899'],
];

async function upsertIndustry(client, row, scope, displayOrder, parentIdMap) {
  const [code, name_no, name_en, parentCode, icon, color] = row;
  const parentId = parentCode ? parentIdMap.get(parentCode) || null : null;
  const r = await client.query(
    `INSERT INTO industries (code, name_no, name_en, parent_id, icon, color_hex, scope, organization_id, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
     ON CONFLICT (code) DO UPDATE
       SET name_no       = EXCLUDED.name_no,
           name_en       = EXCLUDED.name_en,
           parent_id     = EXCLUDED.parent_id,
           icon          = EXCLUDED.icon,
           color_hex     = EXCLUDED.color_hex,
           scope         = EXCLUDED.scope,
           display_order = EXCLUDED.display_order,
           is_active     = TRUE,
           updated_at    = NOW()
     RETURNING id`,
    [code, name_no, name_en, parentId, icon, color, scope, displayOrder],
  );
  parentIdMap.set(code, r.rows[0].id);
  return r.rows[0].id;
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to DB.');

  // Verifiser at industries-tabellen finnes (mig 329 må være kjørt).
  const tableR = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'industries'
     ) AS exists`,
  );
  if (!tableR.rows[0].exists) {
    console.error('industries-tabellen finnes ikke — kjør mig 329 først.');
    process.exit(1);
  }

  const parentIdMap = new Map(); // code → uuid
  let count = 0;

  console.log('Seeder NACE-katalog…');
  // Sortér slik at parents alltid kommer før children (færre punktum først).
  const sortedNACE = [...NACE_ROWS].sort((a, b) => {
    const dotsA = (a[0].match(/\./g) || []).length;
    const dotsB = (b[0].match(/\./g) || []).length;
    if (dotsA !== dotsB) return dotsA - dotsB;
    return a[0].localeCompare(b[0]);
  });
  for (const row of sortedNACE) {
    await upsertIndustry(client, row, 'global', count++, parentIdMap);
  }
  console.log(`  ${sortedNACE.length} NACE-rader upserted.`);

  console.log('Seeder custom verticals…');
  for (const row of CUSTOM_ROWS) {
    await upsertIndustry(client, row, 'custom', count++, parentIdMap);
  }
  console.log(`  ${CUSTOM_ROWS.length} custom-rader upserted.`);

  // Statistikk
  const stat = await client.query(
    `SELECT scope, COUNT(*) AS n FROM industries WHERE is_active = TRUE GROUP BY scope ORDER BY scope`,
  );
  console.log('\nAktive industries i DB:');
  for (const row of stat.rows) {
    console.log(`  ${row.scope}: ${row.n}`);
  }
  const total = await client.query(`SELECT COUNT(*)::int AS n FROM industries WHERE is_active = TRUE`);
  console.log(`  TOTAL: ${total.rows[0].n}`);

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
