/**
 * Seed demo-innholdet for lydguide-POC-en (Kvadraturen, Akershus festning og
 * Operaen) inn i tabellene fra migrasjon 0629_reiseguide_poc.sql.
 *
 *   DATABASE_URL=… npm run seed:reiseguide
 *
 * Idempotent: kjøres i én transaksjon med upsert på id, så en ny kjøring
 * oppdaterer tekst og geodata uten å lage duplikater. Lydfiler og teksting
 * røres ikke (de hører til steg 2 og genereres fra godkjente manus), og
 * vurderinger fra brukere (guide_poi_ratings) røres aldri. Quiz-spørsmålene
 * (0630_reiseguide_after_visit.sql) skrives på nytt per sted og språk.
 * Innholdet ligger i server/reiseguide-demo-data.ts.
 */
import pg from "pg";
import { DEMO_AREA, DEMO_CATEGORIES, DEMO_POIS, type DemoLang } from "../server/reiseguide-demo-data.ts";

const LANGS: DemoLang[] = ["nb", "en"];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL mangler.");
    process.exit(2);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let translations = 0;
  let scripts = 0;
  let quizQuestions = 0;
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO guide_areas (id, slug, name, default_lang, center_lat, center_lng,
                                bbox_south, bbox_west, bbox_north, bbox_east, status, price_nok)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', $11)
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug, name = EXCLUDED.name, default_lang = EXCLUDED.default_lang,
         center_lat = EXCLUDED.center_lat, center_lng = EXCLUDED.center_lng,
         bbox_south = EXCLUDED.bbox_south, bbox_west = EXCLUDED.bbox_west,
         bbox_north = EXCLUDED.bbox_north, bbox_east = EXCLUDED.bbox_east,
         status = 'published', price_nok = EXCLUDED.price_nok, updated_at = now()`,
      [
        DEMO_AREA.id, DEMO_AREA.slug, DEMO_AREA.name, DEMO_AREA.defaultLang,
        DEMO_AREA.center.lat, DEMO_AREA.center.lng,
        DEMO_AREA.bbox.south, DEMO_AREA.bbox.west, DEMO_AREA.bbox.north, DEMO_AREA.bbox.east,
        DEMO_AREA.priceNok,
      ],
    );

    for (const c of DEMO_CATEGORIES) {
      await client.query(
        `INSERT INTO guide_categories (id, labels, sort_order) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (id) DO UPDATE SET labels = EXCLUDED.labels, sort_order = EXCLUDED.sort_order`,
        [c.id, JSON.stringify(c.labels), c.sortOrder],
      );
    }

    for (const poi of DEMO_POIS) {
      await client.query(
        `INSERT INTO guide_pois (id, area_id, slug, category_id, lat, lng, trigger_radius_m,
                                 priority, sort_order, free_preview, status, source_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', $11)
         ON CONFLICT (id) DO UPDATE SET
           area_id = EXCLUDED.area_id, slug = EXCLUDED.slug, category_id = EXCLUDED.category_id,
           lat = EXCLUDED.lat, lng = EXCLUDED.lng, trigger_radius_m = EXCLUDED.trigger_radius_m,
           priority = EXCLUDED.priority, sort_order = EXCLUDED.sort_order,
           free_preview = EXCLUDED.free_preview, status = 'published',
           source_note = EXCLUDED.source_note, updated_at = now()`,
        [
          poi.id, DEMO_AREA.id, poi.slug, poi.categoryId, poi.lat, poi.lng, poi.triggerRadiusM,
          poi.priority, poi.sortOrder, poi.freePreview, poi.sourceNote,
        ],
      );

      for (const lang of LANGS) {
        const t = poi.translations[lang];
        await client.query(
          `INSERT INTO guide_poi_translations (id, poi_id, lang, title, subtitle, summary,
                                               location_label, hero_image_alt, practical_info, editorial_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'draft')
           ON CONFLICT (poi_id, lang) DO UPDATE SET
             title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, summary = EXCLUDED.summary,
             location_label = EXCLUDED.location_label, hero_image_alt = EXCLUDED.hero_image_alt,
             practical_info = EXCLUDED.practical_info, updated_at = now()`,
          [
            `${poi.id}_${lang}`, poi.id, lang, t.title, t.subtitle, t.summary,
            t.locationLabel, t.heroImageAlt, JSON.stringify(t.practicalInfo),
          ],
        );
        translations += 1;

        for (const s of poi.scripts[lang]) {
          await client.query(
            `INSERT INTO guide_poi_scripts (id, poi_id, lang, kind, chapter_no, title, script_text,
                                            estimated_duration_s, editorial_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
             ON CONFLICT (poi_id, lang, kind, chapter_no) DO UPDATE SET
               title = EXCLUDED.title, script_text = EXCLUDED.script_text,
               estimated_duration_s = EXCLUDED.estimated_duration_s, updated_at = now()`,
            [
              `${poi.id}_${lang}_${s.kind}_${s.chapterNo}`, poi.id, lang, s.kind, s.chapterNo,
              s.title, s.text, s.estimatedDurationS,
            ],
          );
          scripts += 1;
        }

        const questions = poi.quiz[lang];
        for (const [index, q] of questions.entries()) {
          await client.query(
            `INSERT INTO guide_poi_quiz_questions (id, poi_id, lang, sort_order, question, options,
                                                   correct_index, explanation, editorial_status)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'draft')
             ON CONFLICT (poi_id, lang, sort_order) DO UPDATE SET
               question = EXCLUDED.question, options = EXCLUDED.options,
               correct_index = EXCLUDED.correct_index, explanation = EXCLUDED.explanation,
               updated_at = now()`,
            [
              `${poi.id}_${lang}_quiz_${index + 1}`, poi.id, lang, index + 1, q.question,
              JSON.stringify(q.options), q.correctIndex, q.explanation,
            ],
          );
          quizQuestions += 1;
        }
        await client.query(
          `DELETE FROM guide_poi_quiz_questions WHERE poi_id = $1 AND lang = $2 AND sort_order > $3`,
          [poi.id, lang, questions.length],
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      `Seed «${DEMO_AREA.name}»: ${DEMO_CATEGORIES.length} kategorier, ${DEMO_POIS.length} severdigheter, ` +
        `${translations} oversettelser, ${scripts} manus, ${quizQuestions} quiz-spørsmål (alle som utkast).`,
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
