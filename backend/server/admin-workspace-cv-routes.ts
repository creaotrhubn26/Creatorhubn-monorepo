import type { Pool, PoolClient } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import {
  CV_CATEGORIES,
  CV_GAP_QUESTIONS,
  CV_VERIFICATION_STATUSES,
  extractCvClaims,
  renderCvMarkdown,
  type CvCategory,
  type CvClaimForRender,
  type CvQuestionForRender,
  type CvVerificationStatus,
} from "./admin-workspace-cv-service";

const MAX_SOURCE_TEXT = 750_000;

function hasOwn(source: unknown, key: string): boolean {
  return Boolean(source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, key));
}

function textValue(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .trim()
    .slice(0, maxLength);
  if (!allowEmpty && !cleaned) return null;
  return cleaned;
}

function linkedInProfileUrl(value: unknown): string | null {
  const raw = textValue(value, 2_000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLocaleLowerCase("en-US");
    const isLinkedIn = host === "linkedin.com" || host.endsWith(".linkedin.com");
    if (url.protocol !== "https:" || !isLinkedIn || !/^\/in\/[^/]+\/?$/u.test(url.pathname)) {
      return null;
    }
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (value === null || value === "") return null;
  return textValue(value, maxLength);
}

async function fetchCvDetail(pool: Pool, projectId: string, profileId: string, userId: string) {
  const profileResult = await pool.query(
    `SELECT p.id::text, p.project_id::text, p.source_project_file_id::text,
            p.person_name, p.headline, p.professional_summary, p.source_url,
            p.import_status, p.source_checked_at, p.generated_document_id::text,
            p.metadata, p.created_at, p.updated_at,
            f.file_name AS source_file_name, f.version_no AS source_file_version,
            f.extraction_status AS source_file_status,
            d.title AS generated_document_title
       FROM admin_cv_profiles p
       JOIN admin_workspace_projects project
         ON project.id = p.project_id AND project.user_id = p.user_id
       JOIN admin_workspace_project_files f
         ON f.id = p.source_project_file_id AND f.user_id = p.user_id
       LEFT JOIN admin_documents d
         ON d.id = p.generated_document_id AND d.user_id = p.user_id AND d.deleted_at IS NULL
      WHERE p.id::text = $1 AND p.project_id::text = $2 AND p.user_id::text = $3`,
    [profileId, projectId, userId],
  );
  if (!profileResult.rows.length) return null;

  const [claimResult, questionResult] = await Promise.all([
    pool.query(
      `SELECT id::text, profile_id::text, category, label, organization, role_title,
              start_value, end_value, description, evidence_text, source_url,
              confidence::float8 AS confidence, verification_status, sort_order,
              created_at, updated_at
         FROM admin_cv_claims
        WHERE profile_id::text = $1 AND user_id::text = $2
        ORDER BY sort_order, created_at`,
      [profileId, userId],
    ),
    pool.query(
      `SELECT id::text, profile_id::text, field_key, question, answer, status,
              required, sort_order, created_at, updated_at
         FROM admin_cv_questions
        WHERE profile_id::text = $1 AND user_id::text = $2
        ORDER BY sort_order, created_at`,
      [profileId, userId],
    ),
  ]);
  const profile = profileResult.rows[0];
  const claims = claimResult.rows as CvClaimForRender[];
  const questions = questionResult.rows as CvQuestionForRender[];
  const previewMarkdown = renderCvMarkdown(profile, claims, questions);
  const counts = claims.reduce<Record<string, number>>((result, claim) => {
    result[claim.verification_status] = (result[claim.verification_status] ?? 0) + 1;
    return result;
  }, {
    source_supported: 0,
    user_confirmed: 0,
    needs_confirmation: 0,
    rejected: 0,
  });

  return {
    profile,
    claims,
    questions,
    preview_markdown: previewMarkdown,
    counts: {
      ...counts,
      open_questions: questions.filter((question) => question.status === "open").length,
      required_open_questions: questionResult.rows.filter(
        (question) => question.required && question.status === "open",
      ).length,
    },
  };
}

async function insertDocumentSnapshot(
  client: PoolClient,
  documentId: string,
  userId: string,
  versionNumber: number,
  changeNote: string,
): Promise<void> {
  await client.query(
    `INSERT INTO admin_document_versions
       (document_id, user_id, version_number, title, summary, content,
        document_type, status, product_key, due_date, next_action, tags,
        source_kind, external_url, change_note, created_by)
     SELECT id, user_id, $3, title, summary, content,
            document_type, status, product_key, due_date, next_action, tags,
            source_kind, external_url, $4, $5
       FROM admin_documents
      WHERE id = $1 AND user_id::text = $2`,
    [documentId, userId, versionNumber, changeNote, userId],
  );
}

export function setupAdminWorkspaceCvRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/workspace/projects/:id/cv-profiles", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT p.id::text, p.project_id::text, p.source_project_file_id::text,
                p.person_name, p.headline, p.professional_summary, p.source_url,
                p.import_status, p.source_checked_at, p.generated_document_id::text,
                p.metadata, p.created_at, p.updated_at,
                f.file_name AS source_file_name,
                (SELECT COUNT(*)::int FROM admin_cv_claims c
                  WHERE c.profile_id = p.id AND c.user_id = p.user_id) AS claim_count,
                (SELECT COUNT(*)::int FROM admin_cv_questions q
                  WHERE q.profile_id = p.id AND q.user_id = p.user_id AND q.status = 'open') AS open_question_count
           FROM admin_cv_profiles p
           JOIN admin_workspace_projects project
             ON project.id = p.project_id AND project.user_id = p.user_id
           JOIN admin_workspace_project_files f
             ON f.id = p.source_project_file_id AND f.user_id = p.user_id
          WHERE p.project_id::text = $1 AND p.user_id::text = $2
          ORDER BY p.updated_at DESC, p.person_name`,
        [req.params.id, session.userId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error("[admin-workspace cv] list error", error);
      res.status(500).json({ error: "Kunne ikke hente CV-profilene" });
    }
  });

  app.get("/api/admin-room/workspace/projects/:id/cv-profiles/:profileId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const detail = await fetchCvDetail(pool, req.params.id, req.params.profileId, session.userId);
      if (!detail) {
        res.status(404).json({ error: "CV-profilen finnes ikke" });
        return;
      }
      res.json(detail);
    } catch (error) {
      console.error("[admin-workspace cv] detail error", error);
      res.status(500).json({ error: "Kunne ikke hente CV-profilen" });
    }
  });

  app.post("/api/admin-room/workspace/projects/:id/cv-profiles/import", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const personName = textValue(req.body?.personName, 180);
    const sourceProjectFileId = textValue(req.body?.sourceProjectFileId, 80);
    const sourceUrlInput = textValue(req.body?.sourceUrl, 2_000);
    const sourceUrl = sourceUrlInput ? linkedInProfileUrl(sourceUrlInput) : null;
    if (!personName || !sourceProjectFileId) {
      res.status(400).json({ error: "Navn og en ferdig behandlet prosjektfil er påkrevd" });
      return;
    }
    if (sourceUrlInput && !sourceUrl) {
      res.status(400).json({ error: "LinkedIn-lenken må være en gyldig https-adresse til /in/-profilen" });
      return;
    }

    try {
      const fileResult = await pool.query(
        `SELECT f.id::text, f.file_name, f.extraction_status
           FROM admin_workspace_project_files f
           JOIN admin_workspace_projects p
             ON p.id = f.project_id AND p.user_id = f.user_id
          WHERE f.id::text = $1 AND f.project_id::text = $2 AND f.user_id::text = $3`,
        [sourceProjectFileId, req.params.id, session.userId],
      );
      if (!fileResult.rows.length) {
        res.status(404).json({ error: "Prosjektfilen finnes ikke" });
        return;
      }
      if (fileResult.rows[0].extraction_status !== "ready") {
        res.status(409).json({ error: "Prosjektfilen må være ferdig behandlet før CV-fakta kan hentes" });
        return;
      }
      const chunksResult = await pool.query<{ content: string }>(
        `SELECT content
           FROM admin_workspace_project_file_chunks
          WHERE project_file_id::text = $1 AND project_id::text = $2 AND user_id::text = $3
          ORDER BY chunk_index`,
        [sourceProjectFileId, req.params.id, session.userId],
      );
      const sourceText = chunksResult.rows
        .map((row) => row.content)
        .join("\n\n")
        .slice(0, MAX_SOURCE_TEXT);
      if (!sourceText.trim()) {
        res.status(409).json({ error: "Fant ingen lesbar tekst i prosjektfilen" });
        return;
      }
      const claims = extractCvClaims(sourceText, sourceUrl);
      if (!claims.length) {
        res.status(422).json({ error: "Fant ingen CV-fakta i filen. Kontroller filinnholdet og prøv igjen." });
        return;
      }

      const client = await pool.connect();
      let profileId = "";
      try {
        await client.query("BEGIN");
        const profileResult = await client.query(
          `INSERT INTO admin_cv_profiles
             (project_id, user_id, source_project_file_id, person_name, source_url,
              import_status, source_checked_at, metadata)
           VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), $6::jsonb)
           ON CONFLICT (project_id, person_name) DO UPDATE SET
             source_project_file_id = EXCLUDED.source_project_file_id,
             source_url = EXCLUDED.source_url,
             import_status = 'draft',
             source_checked_at = NOW(),
             metadata = admin_cv_profiles.metadata || EXCLUDED.metadata,
             updated_at = NOW()
           RETURNING id::text`,
          [
            req.params.id,
            session.userId,
            sourceProjectFileId,
            personName,
            sourceUrl,
            JSON.stringify({ importMethod: "project_file", sourceFileName: fileResult.rows[0].file_name }),
          ],
        );
        profileId = profileResult.rows[0].id;
        await client.query(
          `DELETE FROM admin_cv_claims
            WHERE profile_id = $1 AND user_id = $2
              AND verification_status <> 'user_confirmed'`,
          [profileId, session.userId],
        );
        for (const claim of claims) {
          await client.query(
            `INSERT INTO admin_cv_claims
               (profile_id, user_id, category, label, organization, role_title,
                start_value, end_value, description, evidence_text, source_url,
                confidence, verification_status, sort_order, fingerprint)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (profile_id, fingerprint) DO UPDATE SET
               evidence_text = EXCLUDED.evidence_text,
               source_url = EXCLUDED.source_url,
               confidence = EXCLUDED.confidence,
               sort_order = EXCLUDED.sort_order,
               updated_at = NOW()
             WHERE admin_cv_claims.verification_status <> 'user_confirmed'`,
            [
              profileId,
              session.userId,
              claim.category,
              claim.label,
              claim.organization,
              claim.roleTitle,
              claim.startValue,
              claim.endValue,
              claim.description,
              claim.evidenceText,
              claim.sourceUrl,
              claim.confidence,
              claim.verificationStatus,
              claim.sortOrder,
              claim.fingerprint,
            ],
          );
        }
        for (const question of CV_GAP_QUESTIONS) {
          await client.query(
            `INSERT INTO admin_cv_questions
               (profile_id, user_id, field_key, question, required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (profile_id, field_key) DO UPDATE SET
               question = EXCLUDED.question,
               required = EXCLUDED.required,
               sort_order = EXCLUDED.sort_order,
               updated_at = NOW()`,
            [profileId, session.userId, question.fieldKey, question.question, question.required, question.sortOrder],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: req.params.id,
        action: "cv_source_imported",
        summary: `Hentet ${claims.length} CV-fakta for ${personName} fra «${fileResult.rows[0].file_name}»`,
        details: { profileId, sourceProjectFileId, sourceUrl, claimCount: claims.length },
      });
      const detail = await fetchCvDetail(pool, req.params.id, profileId, session.userId);
      res.status(201).json(detail);
    } catch (error) {
      console.error("[admin-workspace cv] import error", error);
      res.status(500).json({ error: "Kunne ikke hente CV-fakta fra prosjektfilen" });
    }
  });

  app.patch("/api/admin-room/workspace/projects/:id/cv-profiles/:profileId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (hasOwn(req.body, "personName")) {
      const value = textValue(req.body.personName, 180);
      if (!value) return void res.status(400).json({ error: "Navnet kan ikke være tomt" });
      add("person_name", value);
    }
    if (hasOwn(req.body, "headline")) add("headline", nullableText(req.body.headline, 240));
    if (hasOwn(req.body, "professionalSummary")) {
      add("professional_summary", nullableText(req.body.professionalSummary, 8_000));
    }
    if (hasOwn(req.body, "importStatus")) {
      const value = textValue(req.body.importStatus, 20);
      if (!value || !new Set(["draft", "review", "verified"]).has(value)) {
        return void res.status(400).json({ error: "Ugyldig CV-status" });
      }
      add("import_status", value);
    }
    if (!sets.length) return void res.status(400).json({ error: "Ingen CV-felter å lagre" });
    values.push(req.params.profileId, req.params.id, session.userId);
    try {
      const result = await pool.query(
        `UPDATE admin_cv_profiles
            SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id::text = $${values.length - 2}
            AND project_id::text = $${values.length - 1}
            AND user_id::text = $${values.length}
          RETURNING id::text`,
        values,
      );
      if (!result.rows.length) return void res.status(404).json({ error: "CV-profilen finnes ikke" });
      res.json(await fetchCvDetail(pool, req.params.id, req.params.profileId, session.userId));
    } catch (error) {
      console.error("[admin-workspace cv] profile update error", error);
      res.status(500).json({ error: "Kunne ikke lagre CV-profilen" });
    }
  });

  app.patch("/api/admin-room/workspace/projects/:id/cv-profiles/:profileId/claims/:claimId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (hasOwn(req.body, "category")) {
      const value = textValue(req.body.category, 30) as CvCategory | null;
      if (!value || !CV_CATEGORIES.includes(value)) {
        return void res.status(400).json({ error: "Ugyldig faktakategori" });
      }
      add("category", value);
    }
    if (hasOwn(req.body, "label")) {
      const value = textValue(req.body.label, 300);
      if (!value) return void res.status(400).json({ error: "Faktatittelen kan ikke være tom" });
      add("label", value);
    }
    const nullableFields: Array<[string, string, number]> = [
      ["organization", "organization", 240],
      ["roleTitle", "role_title", 240],
      ["startValue", "start_value", 40],
      ["endValue", "end_value", 40],
      ["description", "description", 4_000],
    ];
    for (const [bodyKey, column, maxLength] of nullableFields) {
      if (hasOwn(req.body, bodyKey)) add(column, nullableText(req.body[bodyKey], maxLength));
    }
    if (hasOwn(req.body, "verificationStatus")) {
      const value = textValue(req.body.verificationStatus, 30) as CvVerificationStatus | null;
      if (!value || !CV_VERIFICATION_STATUSES.includes(value)) {
        return void res.status(400).json({ error: "Ugyldig verifiseringsstatus" });
      }
      add("verification_status", value);
      if (value === "user_confirmed") add("confidence", 1);
    }
    if (!sets.length) return void res.status(400).json({ error: "Ingen faktafelter å lagre" });
    values.push(req.params.claimId, req.params.profileId, req.params.id, session.userId);
    try {
      const result = await pool.query(
        `UPDATE admin_cv_claims claim
            SET ${sets.join(", ")}, updated_at = NOW()
           FROM admin_cv_profiles profile
          WHERE claim.id::text = $${values.length - 3}
            AND claim.profile_id::text = $${values.length - 2}
            AND claim.user_id::text = $${values.length}
            AND profile.id = claim.profile_id
            AND profile.user_id = claim.user_id
            AND profile.project_id::text = $${values.length - 1}
          RETURNING claim.id::text`,
        values,
      );
      if (!result.rows.length) return void res.status(404).json({ error: "CV-faktaet finnes ikke" });
      res.json(await fetchCvDetail(pool, req.params.id, req.params.profileId, session.userId));
    } catch (error) {
      console.error("[admin-workspace cv] claim update error", error);
      res.status(500).json({ error: "Kunne ikke oppdatere CV-faktaet" });
    }
  });

  app.patch("/api/admin-room/workspace/projects/:id/cv-profiles/:profileId/questions/:questionId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!hasOwn(req.body, "answer")) {
      res.status(400).json({ error: "Svarfeltet mangler" });
      return;
    }
    const answer = nullableText(req.body.answer, 12_000);
    try {
      const result = await pool.query(
        `UPDATE admin_cv_questions question
            SET answer = $5,
                status = CASE WHEN $5::text IS NULL THEN 'open' ELSE 'answered' END,
                updated_at = NOW()
           FROM admin_cv_profiles profile
          WHERE question.id::text = $1
            AND question.profile_id::text = $2
            AND question.user_id::text = $4
            AND profile.id = question.profile_id
            AND profile.user_id = question.user_id
            AND profile.project_id::text = $3
          RETURNING question.id::text`,
        [req.params.questionId, req.params.profileId, req.params.id, session.userId, answer],
      );
      if (!result.rows.length) return void res.status(404).json({ error: "CV-spørsmålet finnes ikke" });
      res.json(await fetchCvDetail(pool, req.params.id, req.params.profileId, session.userId));
    } catch (error) {
      console.error("[admin-workspace cv] question update error", error);
      res.status(500).json({ error: "Kunne ikke lagre CV-svaret" });
    }
  });

  app.post("/api/admin-room/workspace/projects/:id/cv-profiles/:profileId/generate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const detail = await fetchCvDetail(pool, req.params.id, req.params.profileId, session.userId);
      if (!detail) {
        res.status(404).json({ error: "CV-profilen finnes ikke" });
        return;
      }
      const content = detail.preview_markdown;
      const client = await pool.connect();
      let documentId = "";
      let versionNumber = 1;
      let connectedDocumentCount = 0;
      try {
        await client.query("BEGIN");
        const locked = await client.query(
          `SELECT p.generated_document_id::text, p.person_name, p.professional_summary,
                  project.product_key
             FROM admin_cv_profiles p
             JOIN admin_workspace_projects project
               ON project.id = p.project_id AND project.user_id = p.user_id
            WHERE p.id::text = $1 AND p.project_id::text = $2 AND p.user_id::text = $3
            FOR UPDATE OF p`,
          [req.params.profileId, req.params.id, session.userId],
        );
        if (!locked.rows.length) throw new Error("CV_PROFILE_NOT_FOUND");
        const profile = locked.rows[0];
        const title = `CV — ${profile.person_name}`.slice(0, 240);
        const summary = profile.professional_summary
          || `Sporbart CV-grunnlag for ${profile.person_name}, bygget fra prosjektfil og brukerbekreftede fakta.`;
        const existing = profile.generated_document_id
          ? await client.query(
              `SELECT id::text, version_no
                 FROM admin_documents
                WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
                FOR UPDATE`,
              [profile.generated_document_id, session.userId],
            )
          : { rows: [] };
        if (existing.rows.length) {
          documentId = existing.rows[0].id;
          versionNumber = Number(existing.rows[0].version_no) + 1;
          await client.query(
            `UPDATE admin_documents
                SET title = $3, summary = $4, content = $5, document_type = 'cv',
                    product_key = $6, version_no = $7, status = 'draft',
                    metadata = metadata || $8::jsonb,
                    updated_at = NOW(), updated_by = $2
              WHERE id = $1 AND user_id = $2`,
            [
              documentId,
              session.userId,
              title,
              summary,
              content,
              profile.product_key,
              versionNumber,
              JSON.stringify({ cvProfileId: req.params.profileId, generatedFrom: "cv_verification" }),
            ],
          );
        } else {
          const documentResult = await client.query(
            `INSERT INTO admin_documents
               (user_id, product_key, title, summary, content, document_type, status,
                tags, source_kind, metadata, updated_by)
             VALUES ($1, $2, $3, $4, $5, 'cv', 'draft', $6, 'workspace', $7::jsonb, $1)
             RETURNING id::text`,
            [
              session.userId,
              profile.product_key,
              title,
              summary,
              content,
              ["cv", "prosjektkilde"],
              JSON.stringify({ cvProfileId: req.params.profileId, generatedFrom: "cv_verification" }),
            ],
          );
          documentId = documentResult.rows[0].id;
        }
        await insertDocumentSnapshot(
          client,
          documentId,
          session.userId,
          versionNumber,
          versionNumber === 1 ? "Opprettet fra CV-verifisering" : "Oppdatert fra CV-verifisering",
        );
        await client.query(
          `INSERT INTO admin_document_links (document_id, user_id, entity_type, entity_id)
           VALUES ($1, $2, 'workspace_project', $3)
           ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING`,
          [documentId, session.userId, req.params.id],
        );
        const contextResult = await client.query(
          `INSERT INTO admin_document_context_sources
             (target_document_id, user_id, source_document_id, enabled)
           SELECT link.document_id, link.user_id, $1, TRUE
             FROM admin_document_links link
             JOIN admin_documents target
               ON target.id = link.document_id AND target.user_id = link.user_id
            WHERE link.user_id = $2
              AND link.entity_type = 'workspace_project'
              AND link.entity_id = $3
              AND link.document_id <> $1
              AND target.deleted_at IS NULL
           ON CONFLICT (target_document_id, source_document_id)
             WHERE source_document_id IS NOT NULL
           DO UPDATE SET enabled = TRUE
           RETURNING id`,
          [documentId, session.userId, req.params.id],
        );
        connectedDocumentCount = contextResult.rowCount ?? 0;
        await client.query(
          `UPDATE admin_cv_profiles
              SET generated_document_id = $4,
                  import_status = CASE
                    WHEN EXISTS (
                      SELECT 1 FROM admin_cv_questions q
                       WHERE q.profile_id = admin_cv_profiles.id
                         AND q.user_id = admin_cv_profiles.user_id
                         AND q.required = TRUE AND q.status = 'open'
                    ) THEN 'review'
                    WHEN EXISTS (
                      SELECT 1 FROM admin_cv_claims c
                       WHERE c.profile_id = admin_cv_profiles.id
                         AND c.user_id = admin_cv_profiles.user_id
                         AND c.verification_status = 'needs_confirmation'
                    ) THEN 'review'
                    ELSE 'verified'
                  END,
                  updated_at = NOW()
            WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3`,
          [req.params.profileId, req.params.id, session.userId, documentId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: documentId,
        action: "cv_generated",
        summary: `Genererte CV-dokumentet «CV — ${detail.profile.person_name}»`,
        details: { projectId: req.params.id, profileId: req.params.profileId, versionNumber, connectedDocumentCount },
      });
      const updated = await fetchCvDetail(pool, req.params.id, req.params.profileId, session.userId);
      res.json({
        ...updated,
        generated_document_id: documentId,
        connected_document_count: connectedDocumentCount,
      });
    } catch (error) {
      console.error("[admin-workspace cv] generate error", error);
      res.status(500).json({ error: "Kunne ikke generere CV-dokumentet" });
    }
  });
}
