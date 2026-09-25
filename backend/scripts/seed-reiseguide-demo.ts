/**
 * Seed demo-innholdet for lydguide-POC-en inn i tabellene fra migrasjon
 * 0640_reiseguide_poc.sql: alle områdene i DEMO_AREAS (Kvadraturen/Akershus
 * festning/Operaen, Lørenskog og Nesoddtangen), hvert sted med sin area_id.
 *
 *   DATABASE_URL=… npm run seed:reiseguide
 *
 * I produksjon kjøres den av workflowen «SenseAid Explore seed demo-innhold»
 * (.github/workflows/senseaid-seed-demo.yml) med migrasjonsbrukeren; da settes
 * MIGRATION_OWNER_ROLE=creatorhub_schema_owner og scriptet bytter rolle før
 * det skriver, slik run-production-migrations.mjs gjør. Lokalt er variabelen tom.
 *
 * Idempotent: alle områdene kjøres i én transaksjon med upsert på id, så en ny kjøring
 * oppdaterer tekst og geodata uten å lage duplikater. Lydfiler og teksting
 * røres ikke (de hører til steg 2 og genereres fra godkjente manus), og
 * vurderinger fra brukere (guide_poi_ratings) røres aldri. Quiz-spørsmålene
 * (0641_reiseguide_after_visit.sql) skrives på nytt per sted og språk, og det
 * samme gjør spørsmålene underveis (0662_reiseguide_chapter_prompts.sql):
 * upsert per (sted, språk, kapittel, rekkefølge), og rader som ikke lenger
 * finnes i demo-dataene slettes.
 * Innholdet ligger i server/reiseguide-demo-data.ts.
 *
 * Heltebildet og krediteringen (hero_image_key, hero_image_credit …, 0663)
 * røres ikke her; de skrives av scripts/reiseguide-commons-images.ts
 * (npm run reiseguide:images). Seeden skriver bare alt-teksten per språk.
 */
import pg from "pg";
import {
  DEMO_AREAS,
  DEMO_CATEGORIES,
  DEMO_CHAPTER_PROMPTS,
  type DemoLang,
} from "../server/reiseguide-demo-data.ts";

const LANGS: DemoLang[] = ["nb", "en", "da"];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL mangler.");
    process.exit(2);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let pois = 0;
  let translations = 0;
  let scripts = 0;
  let quizQuestions = 0;
  let chapterPrompts = 0;
  try {
    await client.query("BEGIN");

    const ownerRole = (process.env.MIGRATION_OWNER_ROLE ?? "").trim();
    if (ownerRole) {
      if (!/^[a-z_][a-z0-9_]*$/.test(ownerRole)) {
        throw new Error("MIGRATION_OWNER_ROLE har et ugyldig rollenavn");
      }
      await client.query(`SET ROLE "${ownerRole}"`);
      await client.query("SET search_path TO public, pg_temp");
    }

    for (const c of DEMO_CATEGORIES) {
      await client.query(
        `INSERT INTO guide_categories (id, labels, sort_order) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (id) DO UPDATE SET labels = EXCLUDED.labels, sort_order = EXCLUDED.sort_order`,
        [c.id, JSON.stringify(c.labels), c.sortOrder],
      );
    }

    for (const area of DEMO_AREAS) {
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
          area.id, area.slug, area.name, area.defaultLang,
          area.center.lat, area.center.lng,
          area.bbox.south, area.bbox.west, area.bbox.north, area.bbox.east,
          area.priceNok,
        ],
      );

      for (const poi of area.pois) {
        pois += 1;
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
            poi.id, area.id, poi.slug, poi.categoryId, poi.lat, poi.lng, poi.triggerRadiusM,
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

          // Spørsmål underveis: rekkefølge nummereres per kapittel.
          const prompts = DEMO_CHAPTER_PROMPTS[poi.id]?.[lang] ?? [];
          const perChapter = new Map<number, number>();
          const keptKeys: string[] = [];
          for (const prompt of prompts) {
            const sortOrder = (perChapter.get(prompt.chapterNo) ?? 0) + 1;
            perChapter.set(prompt.chapterNo, sortOrder);
            keptKeys.push(`${prompt.chapterNo}:${sortOrder}`);
            await client.query(
              `INSERT INTO guide_poi_chapter_prompts (id, poi_id, lang, chapter_no, kind, at_fraction, prompt_text,
                                                      options, answer_index, reveal_text, sort_order, editorial_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, 'draft')
               ON CONFLICT (poi_id, lang, chapter_no, sort_order) DO UPDATE SET
                 kind = EXCLUDED.kind, at_fraction = EXCLUDED.at_fraction, prompt_text = EXCLUDED.prompt_text,
                 options = EXCLUDED.options, answer_index = EXCLUDED.answer_index,
                 reveal_text = EXCLUDED.reveal_text, updated_at = now()`,
              [
                `${poi.id}_${lang}_prompt_${prompt.chapterNo}_${sortOrder}`, poi.id, lang, prompt.chapterNo,
                prompt.kind, prompt.atFraction, prompt.text,
                prompt.options ? JSON.stringify(prompt.options) : null, prompt.answerIndex ?? null,
                prompt.revealText, sortOrder,
              ],
            );
            chapterPrompts += 1;
          }
          await client.query(
            `DELETE FROM guide_poi_chapter_prompts
              WHERE poi_id = $1 AND lang = $2
                AND NOT ((chapter_no::text || ':' || sort_order::text) = ANY($3::text[]))`,
            [poi.id, lang, keptKeys],
          );
        }
      }
      console.log(`Område «${area.name}» (${area.slug}): ${area.pois.length} severdigheter.`);
    }

    await client.query("COMMIT");
    console.log(
      `Seed ${DEMO_AREAS.length} områder: ${DEMO_CATEGORIES.length} kategorier, ${pois} severdigheter, ` +
        `${translations} oversettelser, ${scripts} manus, ${quizQuestions} quiz-spørsmål, ${chapterPrompts} spørsmål underveis (alle som utkast).`,
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
