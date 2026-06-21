import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import nodemailer from "nodemailer";

let photographerProjectsSchemaReadyShared: Promise<void> | null = null;
export function ensurePhotographerProjectsSchemaShared(pool: Pool): Promise<void> {
  if (!photographerProjectsSchemaReadyShared) {
    photographerProjectsSchemaReadyShared = (async () => {
      try {
        await pool.query(`
          -- Core photographer-project columns. On prod the base projects table
          -- is the portfolio table (title/slug/category/published…), so the
          -- create/detail queries that read user_id/name/status/etc. 500'd with
          -- "column user_id does not exist". Add them (idempotent) so the whole
          -- request→project→timeline→worklog loop works. slug/category are
          -- NOT NULL on the portfolio table but unused for photographer
          -- projects, so relax them too.
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS name VARCHAR(255);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase VARCHAR(32);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10,2);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10,2);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS profession VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_data JSONB;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS settings JSONB;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC(10,2);
          ALTER TABLE projects ALTER COLUMN slug DROP NOT NULL;
          ALTER TABLE projects ALTER COLUMN category DROP NOT NULL;
          CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS service_price NUMERIC(10,2);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_overhead NUMERIC(10,2) DEFAULT 0;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 25.00;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoice_provider VARCHAR(32);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS external_invoice_id VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS external_invoice_number VARCHAR(64);
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR(255);
          CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects (client_id);
          ALTER TABLE photographer_client_galleries
            ADD COLUMN IF NOT EXISTS project_id VARCHAR(64);
          CREATE INDEX IF NOT EXISTS photographer_client_galleries_project_idx
            ON photographer_client_galleries (project_id);
          CREATE TABLE IF NOT EXISTS project_time_tracking (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id VARCHAR(64) NOT NULL,
            task_description TEXT NOT NULL,
            hours_spent NUMERIC(10,2) NOT NULL,
            date_worked DATE NOT NULL DEFAULT CURRENT_DATE,
            billable_hours NUMERIC(10,2) NOT NULL,
            rate NUMERIC(10,2) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS project_time_tracking_project_idx
            ON project_time_tracking (project_id, date_worked DESC);
          -- An older definition FK'd project_id to integrated_projects(id),
          -- but photographer projects live in `projects` — drop the stale FK
          -- so time logging works (the table is app-managed, no FK needed).
          ALTER TABLE project_time_tracking
            DROP CONSTRAINT IF EXISTS project_time_tracking_project_id_integrated_projects_id_fk;
        `);
      } catch (err) {
        console.warn('[photographer-projects] schema-ensure failed:', err);
        photographerProjectsSchemaReadyShared = null;
        throw err;
      }
    })();
  }
  return photographerProjectsSchemaReadyShared;
}

export interface PhotographerProjectsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  ensureCanonicalClientId: (
    photographerId: string,
    email: string,
    clientName: string | null,
  ) => Promise<string | null>;
  createWeddingTimelineFromProject: (input: any) => Promise<unknown>;
  escapeHtml: (value: string) => string;
}

export function setupPhotographerProjectsRoutes(
  deps: PhotographerProjectsRoutesDeps,
): void {
  const {
    app,
    pool,
    requireUserSession,
    ensureCanonicalClientId,
    createWeddingTimelineFromProject,
    escapeHtml,
  } = deps;

  const ensurePhotographerProjectsSchema = () =>
    ensurePhotographerProjectsSchemaShared(pool);

  // GET /api/photographer/projects — liste over fotografens prosjekter.
  // Returnerer projects + clients-join + aggregert tracked hours og kostnad.
  app.get("/api/photographer/projects", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    try {
      await ensurePhotographerProjectsSchema();
      const result = await pool.query(
        `SELECT
           p.id, p.title, p.name, p.client_name, p.client_id,
           p.project_type, p.status, p.phase, p.event_date, p.location,
           p.service_price, p.hourly_rate, p.cost_overhead,
           p.estimated_hours, p.actual_hours,
           p.created_at, p.updated_at,
           c.first_name AS client_first_name,
           c.last_name  AS client_last_name,
           c.email      AS client_email,
           COALESCE(t.tracked_hours, 0)::numeric AS tracked_hours,
           COALESCE(t.tracked_cost, 0)::numeric  AS tracked_cost
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         LEFT JOIN (
           SELECT project_id,
                  SUM(billable_hours) AS tracked_hours,
                  SUM(billable_hours * rate) AS tracked_cost
             FROM project_time_tracking
            GROUP BY project_id
         ) t ON t.project_id = p.id
         WHERE p.user_id = $1
         ORDER BY COALESCE(p.event_date, p.created_at::date) DESC NULLS LAST`,
        [photographerId],
      );
      res.json({
        projects: result.rows.map((r: Record<string, unknown>) => {
          const price = Number(r.service_price ?? 0);
          const cost = Number(r.tracked_cost ?? 0) + Number(r.cost_overhead ?? 0);
          const margin = price > 0 ? ((price - cost) / price) * 100 : null;
          const clientDisplay = [r.client_first_name, r.client_last_name]
            .filter(Boolean).join(' ') || (r.client_email as string | null) || (r.client_name as string | null) || null;
          return {
            id: r.id,
            title: r.title ?? r.name ?? 'Uten tittel',
            clientId: r.client_id ?? null,
            clientName: clientDisplay,
            clientEmail: r.client_email ?? null,
            projectType: r.project_type ?? null,
            status: r.status ?? 'active',
            phase: r.phase ?? null,
            eventDate: r.event_date ?? null,
            location: r.location ?? null,
            servicePrice: price,
            hourlyRate: Number(r.hourly_rate ?? 0),
            costOverhead: Number(r.cost_overhead ?? 0),
            estimatedHours: r.estimated_hours ?? null,
            trackedHours: Number(r.tracked_hours ?? 0),
            trackedCost: Number(r.tracked_cost ?? 0),
            marginPct: margin,
            profitAmount: price > 0 ? price - cost : null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        }),
      });
    } catch (err) {
      // Schema-feil eller manglende tabeller skal ikke krasje admin dashboard.
      // Returner tom liste i stedet for 500 — UI viser allerede empty-state.
      console.warn('[photographer-projects] list failed, returning empty:', err);
      res.json({ projects: [], schemaWarning: err instanceof Error ? err.message : String(err) });
    }
  });

  // Slice 9X.14 — auto-genererer fotograf-relevante timeline-milestones
  // for nye prosjekter. Stine får dermed ferdig progresjon i stedet for
  // å starte fra blank tidslinje. Templater er valgt ut fra projectType
  // og datoer beregnes relativt til eventDate (dersom satt) eller "nå".
  interface PhotographerTimelineSeed {
    projectId: string;
    userId: string;
    projectType: string | null;
    eventDate: string | null;          // YYYY-MM-DD
    clientName: string | null;
    servicePrice: number | null;
  }

  interface MilestoneSeed {
    title: string;
    description: string;
    category: string;       // 'planning' | 'production' | 'post' | 'delivery' | 'billing'
    type: string;           // 'meeting' | 'milestone' | 'contract' | 'photo_session' | 'editing' | 'review' | 'delivery' | 'deadline'
    daysFromAnchor: number; // offset i dager fra event_date (eller nå hvis ikke satt)
    anchor: 'event' | 'now';
    clientVisible: boolean;
    requiresClientApproval: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }

  function buildPhotographerMilestoneTemplate(projectType: string | null): MilestoneSeed[] {
    const t = (projectType || '').toLowerCase().trim();

    if (t === 'bryllup' || t.includes('wedding')) {
      return [
        { title: 'Førstegangskontakt', description: 'Bekreft prosjekt, send velkomst-mail',
          category: 'planning', type: 'meeting', daysFromAnchor: -60, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'high' },
        { title: 'Konsultasjons-møte', description: 'Gå gjennom dag, ønsker, shotlist',
          category: 'planning', type: 'meeting', daysFromAnchor: -45, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'high' },
        { title: 'Kontrakt signert', description: 'Bekreft og send kontrakt via Google Sign',
          category: 'planning', type: 'contract', daysFromAnchor: -42, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'critical' },
        { title: 'Forskudd 50% mottatt', description: 'Bekreft betaling for å reservere dato',
          category: 'billing', type: 'milestone', daysFromAnchor: -35, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'critical' },
        { title: 'Pre-wedding gjennomgang', description: 'Endelig timeline, lokasjoner, kontaktpersoner',
          category: 'planning', type: 'meeting', daysFromAnchor: -7, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'high' },
        { title: 'Bryllupsdagen — skyte', description: 'Hovedoppdraget',
          category: 'production', type: 'photo_session', daysFromAnchor: 0, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'critical' },
        { title: 'Backup + utvalg', description: 'Sikker lagring og første kulling',
          category: 'post', type: 'editing', daysFromAnchor: 2, anchor: 'event',
          clientVisible: false, requiresClientApproval: false, priority: 'high' },
        { title: 'Sneak peek — 10 bilder', description: 'Send forsmak til kunde på social',
          category: 'post', type: 'review', daysFromAnchor: 7, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'medium' },
        { title: 'Redigering av full leveranse', description: 'Color grade, retouch, sortering',
          category: 'post', type: 'editing', daysFromAnchor: 28, anchor: 'event',
          clientVisible: false, requiresClientApproval: false, priority: 'high' },
        { title: 'Galleri-leveranse til klient', description: 'Publiser via UniversalShowcase, send link',
          category: 'delivery', type: 'delivery', daysFromAnchor: 42, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'critical' },
        { title: 'Klient godkjent + restbetaling', description: 'Bekreft og fakturer restbeløp',
          category: 'billing', type: 'milestone', daysFromAnchor: 56, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'critical' },
      ];
    }

    if (t === 'portrett' || t === 'portrait' || t.includes('portrett')) {
      return [
        { title: 'Førstegangskontakt', description: 'Avtal stil, lokasjon og pris',
          category: 'planning', type: 'meeting', daysFromAnchor: -14, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'high' },
        { title: 'Kontrakt signert', description: 'Send kort kontrakt via Google Sign',
          category: 'planning', type: 'contract', daysFromAnchor: -10, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'high' },
        { title: 'Portrett-økt', description: 'Hovedoppdraget',
          category: 'production', type: 'photo_session', daysFromAnchor: 0, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'critical' },
        { title: 'Utvalg + redigering', description: 'Topp 20 bilder kuleres og redigeres',
          category: 'post', type: 'editing', daysFromAnchor: 5, anchor: 'event',
          clientVisible: false, requiresClientApproval: false, priority: 'high' },
        { title: 'Galleri-leveranse', description: 'Publiser via UniversalShowcase',
          category: 'delivery', type: 'delivery', daysFromAnchor: 10, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'high' },
        { title: 'Faktura sendt', description: 'Generér faktura via PowerOffice',
          category: 'billing', type: 'milestone', daysFromAnchor: 11, anchor: 'event',
          clientVisible: false, requiresClientApproval: false, priority: 'high' },
      ];
    }

    if (t === 'commercial' || t === 'kommersiell' || t === 'produkt') {
      return [
        { title: 'Briefing-møte', description: 'Klargjør deliverables, brand-guidelines, dead­line',
          category: 'planning', type: 'meeting', daysFromAnchor: -14, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'high' },
        { title: 'Kontrakt signert', description: 'Spesifiser bruksrettigheter, deliverables',
          category: 'planning', type: 'contract', daysFromAnchor: -10, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'critical' },
        { title: 'Mood board + shot list', description: 'Send til klient for godkjenning',
          category: 'planning', type: 'review', daysFromAnchor: -5, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'high' },
        { title: 'Produksjons-dag', description: 'Skyte',
          category: 'production', type: 'photo_session', daysFromAnchor: 0, anchor: 'event',
          clientVisible: true, requiresClientApproval: false, priority: 'critical' },
        { title: 'Redigering — runde 1', description: 'Første utvalg + grading',
          category: 'post', type: 'editing', daysFromAnchor: 7, anchor: 'event',
          clientVisible: false, requiresClientApproval: false, priority: 'high' },
        { title: 'Klient-review', description: 'Vis utvalg, samle feedback for revisjoner',
          category: 'post', type: 'review', daysFromAnchor: 10, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'high' },
        { title: 'Endelig leveranse', description: 'Hi-res via UniversalShowcase + nedlasting',
          category: 'delivery', type: 'delivery', daysFromAnchor: 14, anchor: 'event',
          clientVisible: true, requiresClientApproval: true, priority: 'critical' },
        { title: 'Faktura', description: 'Generér via PowerOffice',
          category: 'billing', type: 'milestone', daysFromAnchor: 15, anchor: 'event',
          clientVisible: false, requiresClientApproval: false, priority: 'high' },
      ];
    }

    // Default fallback for ukjent type
    return [
      { title: 'Førstegangskontakt', description: 'Bekreft prosjekt med klient',
        category: 'planning', type: 'meeting', daysFromAnchor: 0, anchor: 'now',
        clientVisible: true, requiresClientApproval: false, priority: 'high' },
      { title: 'Kontrakt signert', description: 'Send kontrakt via Google Sign',
        category: 'planning', type: 'contract', daysFromAnchor: 3, anchor: 'now',
        clientVisible: true, requiresClientApproval: true, priority: 'critical' },
      { title: 'Produksjon', description: 'Hovedoppdraget',
        category: 'production', type: 'photo_session', daysFromAnchor: 14, anchor: 'now',
        clientVisible: true, requiresClientApproval: false, priority: 'high' },
      { title: 'Leveranse', description: 'Send ferdig materiale via UniversalShowcase',
        category: 'delivery', type: 'delivery', daysFromAnchor: 28, anchor: 'now',
        clientVisible: true, requiresClientApproval: true, priority: 'high' },
      { title: 'Faktura', description: 'Generér via PowerOffice',
        category: 'billing', type: 'milestone', daysFromAnchor: 30, anchor: 'now',
        clientVisible: false, requiresClientApproval: false, priority: 'high' },
    ];
  }

  async function generatePhotographerTimeline(seed: PhotographerTimelineSeed): Promise<void> {
    const template = buildPhotographerMilestoneTemplate(seed.projectType);
    if (template.length === 0) return;

    // Beregn dato per milestone. Hvis vi har eventDate, bruk den som anker;
    // ellers bruk nå.
    const anchorEventTs = seed.eventDate ? new Date(seed.eventDate).getTime() : null;
    const anchorNowTs = Date.now();

    const values: unknown[] = [];
    const tuples: string[] = [];
    let i = 1;
    for (const m of template) {
      const baseTs = m.anchor === 'event' && anchorEventTs !== null ? anchorEventTs : anchorNowTs;
      const dueIso = new Date(baseTs + m.daysFromAnchor * 86_400_000).toISOString();
      tuples.push(
        `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}::timestamptz, 'not_started', 0, $${i++}, $${i++}, $${i++}, true)`,
      );
      values.push(
        seed.projectId,
        seed.userId,
        m.title,
        m.description,
        m.category,
        m.type,
        dueIso,
        m.priority,
        m.clientVisible,
        m.requiresClientApproval,
      );
    }

    await pool.query(
      `INSERT INTO project_milestones
         (project_id, user_id, title, description, category, type, due_date,
          status, progress, priority, client_visible, requires_client_approval,
          automated_reminders)
       VALUES ${tuples.join(', ')}`,
      values,
    );
  }

  // POST /api/photographer/projects — opprett prosjekt, valgfritt knyttet til klient.
  // Aksepterer også payload fra ProjectCreationWithMemoryCards (inquiry → project)
  // med clientEmail/clientPhone/budget/submissionId/projectData (memory cards etc).
  app.post("/api/photographer/projects", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const {
      title, clientId, clientName, clientEmail, clientPhone,
      projectType, eventDate, location,
      servicePrice, hourlyRate, costOverhead, estimatedHours, description,
      submissionId, budget, projectData: projectDataPayload, settings,
    } = req.body ?? {};

    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (!trimmedTitle) return res.status(400).json({ error: 'title_required' });

    try {
      await ensurePhotographerProjectsSchema();
      let effectiveClientId: string | null = clientId || null;

      // Hvis clientId er gitt, sjekk at klienten tilhører fotografen (sikkerhet).
      if (effectiveClientId) {
        const owned = await pool.query(
          `SELECT 1 FROM clients WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
          [effectiveClientId, photographerId],
        );
        if (owned.rowCount === 0) {
          return res.status(403).json({ error: 'client_not_owned' });
        }
      }

      // Slice 9X.13 — auto-CRM-opprettelse fra inquiry-payload.
      // Hvis vi har email + (navn) men ingen clientId, ensureCanonicalClientId
      // gjør oppslag/insert mot clients-tabellen og returnerer kanonisk id.
      // Også oppdater telefon hvis gitt (ensureCanonicalClientId håndterer
      // ikke phone — gjøres her som ekstra-update).
      const trimmedEmail = typeof clientEmail === 'string' ? clientEmail.trim().toLowerCase() : '';
      const trimmedName = typeof clientName === 'string' ? clientName.trim() : '';
      const trimmedPhone = typeof clientPhone === 'string' ? clientPhone.trim() : '';
      if (!effectiveClientId && trimmedEmail) {
        const canonId = await ensureCanonicalClientId(photographerId, trimmedEmail, trimmedName || null);
        if (canonId) {
          effectiveClientId = canonId;
          if (trimmedPhone) {
            await pool.query(
              `UPDATE clients SET phone = $1, updated_at = NOW()
                WHERE id = $2 AND (phone IS NULL OR phone = '')`,
              [trimmedPhone, canonId],
            ).catch(() => undefined);
          }
        }
      }

      // Memory cards + shot list etc lagres i projectData JSONB så
      // ProjectCreationWithMemoryCards kan hente det tilbake ved redigering.
      const projectDataJson: Record<string, unknown> = {};
      if (projectDataPayload && typeof projectDataPayload === 'object') {
        Object.assign(projectDataJson, projectDataPayload);
      }
      if (submissionId) projectDataJson.submissionId = String(submissionId);
      if (budget !== undefined && budget !== null) projectDataJson.budget = budget;

      const result = await pool.query(
        `INSERT INTO projects
           (user_id, title, name, profession, client_id, client_name,
            project_type, status, phase, event_date, location, description,
            service_price, hourly_rate, cost_overhead, estimated_hours,
            project_data, settings, budget,
            created_at, updated_at)
         VALUES ($1, $2, $16, 'photographer', $3, $4,
                 $5, 'active', 'planning', $6, $7, $8,
                 $9, $10, $11, $12,
                 $13::jsonb, $14::jsonb, $15,
                 NOW(), NOW())
         RETURNING id`,
        [
          photographerId,
          trimmedTitle,
          effectiveClientId,
          trimmedName || null,
          typeof projectType === 'string' && projectType.trim() ? projectType.trim() : null,
          eventDate || null,
          typeof location === 'string' && location.trim() ? location.trim() : null,
          typeof description === 'string' && description.trim() ? description.trim() : null,
          Number.isFinite(Number(servicePrice)) ? Number(servicePrice)
            : (Number.isFinite(Number(budget)) ? Number(budget) : null),
          Number.isFinite(Number(hourlyRate)) ? Number(hourlyRate) : null,
          Number.isFinite(Number(costOverhead)) ? Number(costOverhead) : 0,
          Number.isFinite(Number(estimatedHours)) ? Number(estimatedHours) : null,
          Object.keys(projectDataJson).length > 0 ? JSON.stringify(projectDataJson) : null,
          settings && typeof settings === 'object' ? JSON.stringify(settings) : null,
          Number.isFinite(Number(budget)) ? Number(budget) : null,
          // $16 — `name` gets its own placeholder (reusing $2 for title+name
          // makes Postgres throw "inconsistent types deduced for parameter $2").
          trimmedTitle,
        ],
      );
      const newProjectId = result.rows[0]?.id;

      // Slice 9X.13 — logg prosjekt-opprettelse til client_communications
      // så CRM-historikken viser konvertering (inquiry → project) og
      // generelle nye prosjekter for klient. Best-effort.
      if (newProjectId && effectiveClientId) {
        try {
          const sourceText = submissionId
            ? `Konvertert fra innkommende forespørsel (submission ${String(submissionId).slice(0, 8)})`
            : 'Opprettet manuelt fra dashboard';
          await pool.query(
            `INSERT INTO client_communications
               (user_id, client_id, project_id, communication_type, direction,
                subject, content, status, requires_response, priority,
                category, tags, created_at)
             VALUES ($1, $2, $3, 'project_created', 'internal',
                     $4, $5, 'read', false, 'normal',
                     'project_lifecycle', ARRAY['project','created'], NOW())`,
            [
              photographerId,
              effectiveClientId,
              newProjectId,
              `Nytt prosjekt: ${trimmedTitle}`,
              `${sourceText}. Type: ${projectType || 'ukategorisert'}. `
                + `Dato: ${eventDate || 'ikke satt'}. `
                + `Avtalt pris: ${servicePrice ?? budget ?? 'ikke satt'} kr.`,
            ],
          );
        } catch (crmErr) {
          console.warn('[photographer-projects] CRM log failed (non-fatal):', crmErr);
        }
      }

      // Marker submission som konvertert hvis fra inquiry-flyt.
      if (newProjectId && submissionId) {
        try {
          await pool.query(
            `UPDATE client_submissions
                SET converted_to_project_id = $1, converted_at = NOW(), updated_at = NOW()
              WHERE id = $2`,
            [newProjectId, submissionId],
          );
        } catch { /* tabellen finnes kanskje ikke i alle env */ }
      }

      // Slice 9X.22 — auto-opprett wedding_timeline + send invite hvis bryllup.
      if (newProjectId && projectType && String(projectType).toLowerCase() === 'bryllup') {
        try {
          await createWeddingTimelineFromProject({
            projectId: newProjectId,
            photographerId,
            clientName: trimmedName || null,
            clientEmail: trimmedEmail || null,
            eventDate: eventDate || null,
            projectTitle: trimmedTitle,
          });
        } catch (weddingErr) {
          console.warn('[photographer-projects] wedding-timeline auto-create failed (non-fatal):', weddingErr);
        }
      }

      // Slice 9X.14 — auto-generér standard timeline-milestones for foto.
      // Etter dette har Stine en ferdig progresjon å klikke seg gjennom
      // på prosjekt-detalj-siden. Templater er valgt ut fra projectType.
      if (newProjectId) {
        try {
          await generatePhotographerTimeline({
            projectId: newProjectId,
            userId: photographerId,
            projectType: typeof projectType === 'string' ? projectType : null,
            eventDate: eventDate || null,
            clientName: trimmedName || null,
            servicePrice: Number.isFinite(Number(servicePrice)) ? Number(servicePrice)
              : (Number.isFinite(Number(budget)) ? Number(budget) : null),
          });
        } catch (timelineErr) {
          console.warn('[photographer-projects] auto-timeline failed (non-fatal):', timelineErr);
        }
      }

      // Google Calendar-sync — best-effort. Hvis fotografen ikke har koblet
      // Google Workspace, returnerer helperen skipped uten å kaste.
      if (newProjectId && eventDate) {
        try {
          const { syncProjectCalendarEvent } = await import('./google-calendar-project.js');
          const clientLookup = clientId
            ? await pool.query(`SELECT first_name, last_name, email FROM clients WHERE id = $1 LIMIT 1`, [clientId])
            : null;
          const clientRow = clientLookup?.rows[0];
          const calResult = await syncProjectCalendarEvent(pool, {
            photographerId,
            projectId: newProjectId,
            title: trimmedTitle,
            eventDate,
            location: typeof location === 'string' ? location : null,
            description: typeof description === 'string' ? description : null,
            clientName: clientRow
              ? [clientRow.first_name, clientRow.last_name].filter(Boolean).join(' ')
              : (typeof clientName === 'string' ? clientName : null),
            clientEmail: clientRow?.email ?? null,
          });
          if (calResult.eventId) {
            await pool.query(
              `UPDATE projects SET google_calendar_event_id = $1 WHERE id = $2`,
              [calResult.eventId, newProjectId],
            );
          }
        } catch (err) {
          console.warn('[photographer-projects] calendar sync after create failed:', err);
        }
      }

      res.status(201).json({ id: newProjectId });

      // Slice 9X.79 — Event-trigger: nytt prosjekt opprettet
      void (async () => {
        try {
          const { fireWorkflowTrigger } = await import('./workflow-triggers.js');
          await fireWorkflowTrigger({
            pool,
            eventType: 'project.created',
            userId: photographerId,
            payload: {
              project_id: newProjectId,
              project_type: projectType || null,
              client_id: effectiveClientId,
              client_email: trimmedEmail || null,
              client_name: trimmedName || null,
              from_submission: !!submissionId,
            },
          });
        } catch (e: any) {
          console.warn('[workflow-triggers] project.created fire failed:', e.message);
        }
      })();
    } catch (err) {
      console.error('[photographer-projects] create failed:', err);
      res.status(500).json({ error: 'create_project_failed' });
    }
  });

  // GET /api/photographer/projects/:projectId — detalj med time-logg + galleri-link.
  app.get("/api/photographer/projects/:projectId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    try {
      await ensurePhotographerProjectsSchema();
      const projectQ = await pool.query(
        `SELECT
           p.id, p.title, p.name, p.client_id, p.client_name, p.description,
           p.project_type, p.status, p.phase, p.event_date, p.location,
           p.service_price, p.hourly_rate, p.cost_overhead, p.vat_rate,
           p.estimated_hours, p.actual_hours,
           p.invoice_provider, p.external_invoice_id, p.external_invoice_number, p.invoiced_at,
           p.google_calendar_event_id,
           p.created_at, p.updated_at,
           c.first_name, c.last_name, c.email, c.phone
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE p.id = $1 AND p.user_id = $2
         LIMIT 1`,
        [projectId, photographerId],
      );
      if (projectQ.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });
      const p = projectQ.rows[0];

      const [timeQ, galleryQ] = await Promise.all([
        pool
          .query(
            `SELECT id, task_description, hours_spent, billable_hours, rate, date_worked, created_at
               FROM project_time_tracking
              WHERE project_id = $1
              ORDER BY date_worked DESC, created_at DESC`,
            [projectId],
          )
          .catch(() => ({ rows: [] as Record<string, unknown>[] })),
        pool.query(
          `SELECT id, project_title, access_token, status, created_at, completed_at
             FROM photographer_client_galleries
            WHERE photographer_id = $1 AND project_id = $2
            ORDER BY created_at DESC`,
          [photographerId, projectId],
        ).catch(() => ({ rows: [] as Record<string, unknown>[] })),
      ]);

      const timeEntries = timeQ.rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        taskDescription: r.task_description,
        hoursSpent: Number(r.hours_spent),
        billableHours: Number(r.billable_hours),
        rate: Number(r.rate),
        dateWorked: r.date_worked,
        createdAt: r.created_at,
      }));
      const trackedHours = timeEntries.reduce((sum, t) => sum + t.billableHours, 0);
      const trackedCost = timeEntries.reduce((sum, t) => sum + t.billableHours * t.rate, 0);
      const servicePriceGross = Number(p.service_price ?? 0);
      const vatRate = Number(p.vat_rate ?? 25);
      const servicePriceNet = vatRate > 0 ? servicePriceGross / (1 + vatRate / 100) : servicePriceGross;
      const totalCost = trackedCost + Number(p.cost_overhead ?? 0);
      // Margin mot NETTO (riktig for AS — MVA er gjennomgangspost).
      const marginPct = servicePriceNet > 0 ? ((servicePriceNet - totalCost) / servicePriceNet) * 100 : null;

      res.json({
        project: {
          id: p.id,
          title: p.title ?? p.name ?? 'Uten tittel',
          clientId: p.client_id ?? null,
          clientName: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.client_name || null,
          clientEmail: p.email ?? null,
          clientPhone: p.phone ?? null,
          description: p.description ?? null,
          projectType: p.project_type ?? null,
          status: p.status ?? 'active',
          phase: p.phase ?? null,
          eventDate: p.event_date ?? null,
          location: p.location ?? null,
          servicePrice: servicePriceGross,    // bakoverkompat
          servicePriceGross,
          servicePriceNet,
          vatRate,
          vatAmount: servicePriceGross - servicePriceNet,
          hourlyRate: Number(p.hourly_rate ?? 0),
          costOverhead: Number(p.cost_overhead ?? 0),
          estimatedHours: p.estimated_hours ?? null,
          trackedHours,
          trackedCost,
          totalCost,
          marginPct,
          profitAmount: servicePriceNet > 0 ? servicePriceNet - totalCost : null,
          invoiceProvider: p.invoice_provider ?? null,
          externalInvoiceId: p.external_invoice_id ?? null,
          externalInvoiceNumber: p.external_invoice_number ?? null,
          invoicedAt: p.invoiced_at ?? null,
          googleCalendarEventId: p.google_calendar_event_id ?? null,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          // Slice 9X.23 — eksponer wedding_id hvis prosjektet er bryllup
          // så frontend kan rendre WeddingTimelineEventsPanel.
          weddingId: await pool.query(
            `SELECT id FROM wedding_timelines WHERE project_id = $1 LIMIT 1`,
            [projectId],
          ).then((r) => r.rows[0]?.id ?? null).catch(() => null),
        },
        timeEntries,
        galleries: (galleryQ.rows as Record<string, unknown>[]).map((g) => ({
          id: g.id,
          title: g.project_title,
          accessToken: g.access_token,
          status: g.status,
          createdAt: g.created_at,
          completedAt: g.completed_at,
        })),
      });
    } catch (err) {
      console.error('[photographer-projects] detail failed:', err);
      res.status(500).json({ error: 'project_detail_failed' });
    }
  });

  // PATCH /api/photographer/projects/:projectId — oppdater felter.
  app.patch("/api/photographer/projects/:projectId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    const {
      title, projectType, status, phase, eventDate, location,
      servicePrice, hourlyRate, costOverhead, estimatedHours, description, clientId,
    } = req.body ?? {};

    try {
      await ensurePhotographerProjectsSchema();
      if (clientId) {
        const owned = await pool.query(
          `SELECT 1 FROM clients WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
          [clientId, photographerId],
        );
        if (owned.rowCount === 0) return res.status(403).json({ error: 'client_not_owned' });
      }
      // Slice 9X.79 — Fang previous status så vi kan trigge bare ved faktisk endring
      let previousStatus: string | null = null;
      if (typeof status === 'string' && status.trim()) {
        const before = await pool.query(
          `SELECT status FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
          [projectId, photographerId],
        );
        previousStatus = (before.rows[0]?.status as string) || null;
      }
      const result = await pool.query(
        `UPDATE projects SET
           title          = COALESCE($1, title),
           project_type   = COALESCE($2, project_type),
           status         = COALESCE($3, status),
           phase          = COALESCE($4, phase),
           event_date     = COALESCE($5, event_date),
           location       = COALESCE($6, location),
           service_price  = COALESCE($7, service_price),
           hourly_rate    = COALESCE($8, hourly_rate),
           cost_overhead  = COALESCE($9, cost_overhead),
           estimated_hours= COALESCE($10, estimated_hours),
           description    = COALESCE($11, description),
           client_id      = COALESCE($12, client_id),
           updated_at     = NOW()
         WHERE id = $13 AND user_id = $14
         RETURNING id, title, event_date, location, description, client_id,
                   google_calendar_event_id`,
        [
          typeof title === 'string' && title.trim() ? title.trim() : null,
          typeof projectType === 'string' && projectType.trim() ? projectType.trim() : null,
          typeof status === 'string' && status.trim() ? status.trim() : null,
          typeof phase === 'string' && phase.trim() ? phase.trim() : null,
          eventDate || null,
          typeof location === 'string' && location.trim() ? location.trim() : null,
          Number.isFinite(Number(servicePrice)) ? Number(servicePrice) : null,
          Number.isFinite(Number(hourlyRate)) ? Number(hourlyRate) : null,
          Number.isFinite(Number(costOverhead)) ? Number(costOverhead) : null,
          Number.isFinite(Number(estimatedHours)) ? Number(estimatedHours) : null,
          typeof description === 'string' ? description : null,
          clientId || null,
          projectId,
          photographerId,
        ],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });

      // Google Calendar-sync — best-effort. Resynk hvis tittel/lokasjon/dato endret.
      const updated = result.rows[0];
      const hasCalendarRelevantChange =
        title !== undefined || eventDate !== undefined
        || location !== undefined || description !== undefined;
      if (hasCalendarRelevantChange) {
        try {
          const { syncProjectCalendarEvent } = await import('./google-calendar-project.js');
          const clientLookup = updated.client_id
            ? await pool.query(`SELECT first_name, last_name, email FROM clients WHERE id = $1 LIMIT 1`, [updated.client_id])
            : null;
          const clientRow = clientLookup?.rows[0];
          const calResult = await syncProjectCalendarEvent(pool, {
            photographerId,
            projectId,
            title: updated.title ?? 'Uten tittel',
            eventDate: updated.event_date,
            location: updated.location ?? null,
            description: updated.description ?? null,
            clientName: clientRow
              ? [clientRow.first_name, clientRow.last_name].filter(Boolean).join(' ')
              : null,
            clientEmail: clientRow?.email ?? null,
            existingEventId: updated.google_calendar_event_id ?? null,
          });
          if (calResult.action === 'deleted') {
            await pool.query(`UPDATE projects SET google_calendar_event_id = NULL WHERE id = $1`, [projectId]);
          } else if (calResult.eventId && calResult.eventId !== updated.google_calendar_event_id) {
            await pool.query(
              `UPDATE projects SET google_calendar_event_id = $1 WHERE id = $2`,
              [calResult.eventId, projectId],
            );
          }
        } catch (err) {
          console.warn('[photographer-projects] calendar sync after update failed:', err);
        }
      }

      res.json({ success: true });

      // Slice 9X.79 — Event-trigger: status endret
      if (typeof status === 'string' && status.trim() && status.trim() !== previousStatus) {
        void (async () => {
          try {
            const { fireWorkflowTrigger } = await import('./workflow-triggers.js');
            await fireWorkflowTrigger({
              pool,
              eventType: 'project.status_changed',
              userId: photographerId,
              payload: {
                project_id: projectId,
                old_status: previousStatus,
                new_status: status.trim(),
                project_type: projectType || null,
              },
            });
          } catch (e: any) {
            console.warn('[workflow-triggers] project.status_changed fire failed:', e.message);
          }
        })();
      }
    } catch (err) {
      console.error('[photographer-projects] update failed:', err);
      res.status(500).json({ error: 'update_project_failed' });
    }
  });

  // POST /api/photographer/projects/:projectId/time — logg time-entry.
  app.post("/api/photographer/projects/:projectId/time", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    const { taskDescription, hoursSpent, billableHours, rate, dateWorked } = req.body ?? {};

    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });
    if (!taskDescription || typeof taskDescription !== 'string') {
      return res.status(400).json({ error: 'task_description_required' });
    }
    if (!Number.isFinite(Number(hoursSpent))) return res.status(400).json({ error: 'hours_invalid' });

    try {
      await ensurePhotographerProjectsSchema();
      const owned = await pool.query(
        `SELECT hourly_rate FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });
      const defaultRate = Number(owned.rows[0]?.hourly_rate ?? 0);
      const finalRate = Number.isFinite(Number(rate)) ? Number(rate) : defaultRate;
      const billable = Number.isFinite(Number(billableHours)) ? Number(billableHours) : Number(hoursSpent);

      const ins = await pool.query(
        `INSERT INTO project_time_tracking
           (project_id, task_description, hours_spent, billable_hours, rate, date_worked, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), NOW())
         RETURNING id`,
        [projectId, taskDescription.trim(), Number(hoursSpent), billable, finalRate, dateWorked || null],
      );
      res.status(201).json({ id: ins.rows[0]?.id });
    } catch (err) {
      console.error('[photographer-projects] time-log failed:', err);
      res.status(500).json({ error: 'time_log_failed' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PowerOffice GO integrasjon (faktura-push for fotograf-prosjekter)
  // ─────────────────────────────────────────────────────────────────────────
  // Per-fotograf clientKey lagres i photographer_integrations (migrasjon 0092).
  // ClientKey returneres ALDRI til frontend — kun connected/status.

  let photographerIntegrationsSchemaReady: Promise<void> | null = null;
  function ensurePhotographerIntegrationsSchema(): Promise<void> {
    if (!photographerIntegrationsSchemaReady) {
      photographerIntegrationsSchemaReady = (async () => {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS photographer_integrations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              photographer_id VARCHAR(64) NOT NULL,
              provider VARCHAR(32) NOT NULL,
              client_key TEXT NOT NULL,
              label TEXT,
              status VARCHAR(32) DEFAULT 'active',
              last_verified_at TIMESTAMPTZ,
              last_used_at TIMESTAMPTZ,
              last_error TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              UNIQUE (photographer_id, provider)
            );
            CREATE INDEX IF NOT EXISTS photographer_integrations_photographer_idx
              ON photographer_integrations (photographer_id);
            -- 0093: PO Go v2-flow trenger Product-referanse på SalesOrder-linjer.
            -- Vi cacher auto-opprettet produkt-id per tenant her.
            ALTER TABLE photographer_integrations
              ADD COLUMN IF NOT EXISTS default_product_id BIGINT;
            ALTER TABLE photographer_integrations
              ADD COLUMN IF NOT EXISTS default_product_synced_at TIMESTAMPTZ;
            -- 0093: customer_type på clients (person | company) — PO Go v2
            -- har forskjellige required fields per CustomerPostDto.IsPerson.
            ALTER TABLE clients
              ADD COLUMN IF NOT EXISTS customer_type VARCHAR(16) DEFAULT 'person';
            ALTER TABLE clients
              ADD COLUMN IF NOT EXISTS organization_number VARCHAR(32);
`);
        } catch (err) {
          console.warn('[photographer-integrations] schema-ensure failed:', err);
          photographerIntegrationsSchemaReady = null;
          throw err;
        }
      })();
    }
    return photographerIntegrationsSchemaReady;
  }

  // GET /api/photographer/integrations/poweroffice/status — er fotografen koblet?
  // Returnerer kun publik state, aldri clientKey.
  app.get("/api/photographer/integrations/poweroffice/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePhotographerIntegrationsSchema();
      const { isPowerOfficeConfigured } = await import('./poweroffice.js');
      const r = await pool.query(
        `SELECT id, label, status, last_verified_at, last_used_at, last_error, created_at
           FROM photographer_integrations
          WHERE photographer_id = $1 AND provider = 'poweroffice'
          LIMIT 1`,
        [session.userId],
      );
      if (r.rowCount === 0) {
        return res.json({
          connected: false,
          serverConfigured: isPowerOfficeConfigured(),
        });
      }
      const row = r.rows[0];
      res.json({
        connected: true,
        serverConfigured: isPowerOfficeConfigured(),
        label: row.label,
        status: row.status,
        lastVerifiedAt: row.last_verified_at,
        lastUsedAt: row.last_used_at,
        lastError: row.last_error,
        createdAt: row.created_at,
      });
    } catch (err) {
      console.error('[poweroffice] status failed:', err);
      res.status(500).json({ error: 'status_failed' });
    }
  });

  // POST /api/photographer/integrations/poweroffice/connect — verifiser + lagre clientKey.
  // Body: { clientKey: string, label?: string }
  app.post("/api/photographer/integrations/poweroffice/connect", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const clientKey = typeof req.body?.clientKey === 'string' ? req.body.clientKey.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 200) : null;
    if (!clientKey) return res.status(400).json({ error: 'client_key_required' });

    try {
      await ensurePhotographerIntegrationsSchema();
      const { verifyClientKey, isPowerOfficeConfigured, PowerOfficeAuthError } = await import('./poweroffice.js');
      if (!isPowerOfficeConfigured()) {
        return res.status(503).json({
          error: 'server_not_configured',
          message: 'PowerOffice APPLICATION_KEY/SUBSCRIPTION_KEY mangler i ENV. Be admin sette dem i Render.',
        });
      }
      const ok = await verifyClientKey(clientKey).catch((e: unknown) => {
        if (e instanceof PowerOfficeAuthError) return false;
        throw e;
      });
      if (!ok) {
        return res.status(401).json({
          error: 'invalid_client_key',
          message: 'PowerOffice avviste ClientKey. Sjekk at den er kopiert riktig fra Innstillinger → API-klienter i GO.',
        });
      }
      await pool.query(
        `INSERT INTO photographer_integrations
           (photographer_id, provider, client_key, label, status, last_verified_at, updated_at)
         VALUES ($1, 'poweroffice', $2, $3, 'active', NOW(), NOW())
         ON CONFLICT (photographer_id, provider) DO UPDATE SET
           client_key = EXCLUDED.client_key,
           label = COALESCE(EXCLUDED.label, photographer_integrations.label),
           status = 'active',
           last_verified_at = NOW(),
           last_error = NULL,
           updated_at = NOW()`,
        [session.userId, clientKey, label],
      );
      res.json({ connected: true });
    } catch (err) {
      console.error('[poweroffice] connect failed:', err);
      res.status(500).json({ error: 'connect_failed' });
    }
  });

  // DELETE /api/photographer/integrations/poweroffice — fjern lagret clientKey.
  app.delete("/api/photographer/integrations/poweroffice", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePhotographerIntegrationsSchema();
      await pool.query(
        `DELETE FROM photographer_integrations
          WHERE photographer_id = $1 AND provider = 'poweroffice'`,
        [session.userId],
      );
      res.json({ disconnected: true });
    } catch (err) {
      console.error('[poweroffice] disconnect failed:', err);
      res.status(500).json({ error: 'disconnect_failed' });
    }
  });

  // POST /api/photographer/projects/:projectId/invoice — lag faktura i PowerOffice.
  // Bruker prosjektets service_price + vat_rate + client-info.
  app.post("/api/photographer/projects/:projectId/invoice", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    try {
      await ensurePhotographerProjectsSchema();
      await ensurePhotographerIntegrationsSchema();

      // Hent integrasjon (inkluderer cached PO-product-id)
      const intQ = await pool.query(
        `SELECT client_key, status, default_product_id FROM photographer_integrations
          WHERE photographer_id = $1 AND provider = 'poweroffice' LIMIT 1`,
        [photographerId],
      );
      if (intQ.rowCount === 0) {
        return res.status(412).json({
          error: 'poweroffice_not_connected',
          message: 'Koble til PowerOffice først via /photographer/settings/integrations.',
        });
      }
      const { client_key, status, default_product_id } = intQ.rows[0];
      if (status !== 'active') {
        return res.status(412).json({ error: 'integration_not_active', integrationStatus: status });
      }

      // Hent prosjekt + klient med customer_type
      const projQ = await pool.query(
        `SELECT
           p.id, p.title, p.service_price, p.vat_rate,
           p.invoice_provider, p.external_invoice_id, p.external_invoice_number,
           c.first_name, c.last_name, c.email AS client_email,
           c.phone AS client_phone,
           COALESCE(c.customer_type, 'person') AS customer_type,
           c.organization_number,
           p.client_name AS fallback_client_name
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         WHERE p.id = $1 AND p.user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (projQ.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });
      const p = projQ.rows[0];

      // Idempotens: hvis allerede fakturert via PO, returner eksisterende.
      if (p.invoice_provider === 'poweroffice' && p.external_invoice_id) {
        return res.json({
          alreadyInvoiced: true,
          salesOrderId: p.external_invoice_id,
          salesOrderNumber: p.external_invoice_number,
        });
      }

      if (!p.client_email) {
        return res.status(400).json({ error: 'client_email_required', message: 'Prosjektet må ha klient med epost-adresse.' });
      }
      const serviceGross = Number(p.service_price || 0);
      if (serviceGross <= 0) {
        return res.status(400).json({ error: 'service_price_required', message: 'Sett en avtalt pris på prosjektet før fakturering.' });
      }
      const vatRate = Number(p.vat_rate ?? 25);
      const unitPriceNet = vatRate > 0 ? serviceGross / (1 + vatRate / 100) : serviceGross;

      // Bygg klient-navn: bruk first+last hvis de finnes, ellers fallback fra prosjekt.
      const clientName = [p.first_name, p.last_name].filter(Boolean).join(' ')
        || p.fallback_client_name
        || 'Kunde';

      const { createInvoiceViaSalesOrder, PowerOfficeApiError, PowerOfficeAuthError } = await import('./poweroffice.js');
      let result;
      try {
        result = await createInvoiceViaSalesOrder({
          clientKey: client_key,
          cachedProductId: default_product_id ? Number(default_product_id) : null,
          customer: {
            type: p.customer_type === 'company' ? 'company' : 'person',
            name: clientName,
            email: p.client_email,
            organizationNumber: p.organization_number ?? null,
            phone: p.client_phone ?? null,
          },
          reference: p.title,
          lines: [
            {
              description: p.title || 'Fotograf-leveranse',
              quantity: 1,
              unitPriceNet: Math.round(unitPriceNet * 100) / 100,
            },
          ],
          deliveryType: 'Auto',
        });
      } catch (err) {
        // Auth-feil — marker integrasjonen som invalid så fotograf får clear feedback.
        if (err instanceof PowerOfficeAuthError) {
          await pool.query(
            `UPDATE photographer_integrations
                SET status = 'invalid', last_error = $2, updated_at = NOW()
              WHERE photographer_id = $1 AND provider = 'poweroffice'`,
            [photographerId, err.message.slice(0, 500)],
          );
          return res.status(401).json({
            error: 'poweroffice_auth_failed',
            message: 'PowerOffice-tilkoblingen er ikke gyldig lenger. Reconnect via innstillinger.',
          });
        }
        if (err instanceof PowerOfficeApiError) {
          await pool.query(
            `UPDATE photographer_integrations
                SET last_error = $2, updated_at = NOW()
              WHERE photographer_id = $1 AND provider = 'poweroffice'`,
            [photographerId, `${err.status}: ${err.message}`.slice(0, 500)],
          );
          return res.status(502).json({
            error: 'poweroffice_api_failed',
            status: err.status,
            detail: err.body,
          });
        }
        throw err;
      }

      // Lagre invoice-koblingen på prosjektet (external_invoice_id = SalesOrder UUID).
      // VIKTIG: vi committer dette ALLTID når SalesOrderen er opprettet i PO,
      // selv om send-stegen feilet — ellers vil retry skape en duplikat-ordre.
      // SalesOrderNo er null inntil PO posterer fakturaen, men vi lagrer den
      // hvis returnert.
      await pool.query(
        `UPDATE projects SET
           invoice_provider = 'poweroffice',
           external_invoice_id = $1,
           external_invoice_number = $2,
           invoiced_at = NOW(),
           updated_at = NOW()
         WHERE id = $3 AND user_id = $4`,
        [result.salesOrderId, result.salesOrderNumber != null ? String(result.salesOrderNumber) : null, projectId, photographerId],
      );

      // Persistér nyopprettet PO-product-id (gjenbrukes for senere fakturaer).
      // Lagrer også sendError som last_error så fotograf ser feilen i status.
      const lastErrorForIntegration = result.sendError
        ? `Send blokkert (${result.sendError.status}): ${JSON.stringify(result.sendError.detail).slice(0, 400)}`
        : null;
      if (result.productJustCreated) {
        await pool.query(
          `UPDATE photographer_integrations
              SET default_product_id = $2,
                  default_product_synced_at = NOW(),
                  last_used_at = NOW(),
                  last_error = $3,
                  updated_at = NOW()
            WHERE photographer_id = $1 AND provider = 'poweroffice'`,
          [photographerId, result.productId, lastErrorForIntegration],
        );
      } else {
        await pool.query(
          `UPDATE photographer_integrations
              SET last_used_at = NOW(),
                  last_error = $2,
                  updated_at = NOW()
            WHERE photographer_id = $1 AND provider = 'poweroffice'`,
          [photographerId, lastErrorForIntegration],
        );
      }

      res.status(202).json({
        salesOrderId: result.salesOrderId,
        salesOrderNumber: result.salesOrderNumber,
        sendStatus: result.sendStatus,
        // Hvis sett: SalesOrderen er opprettet, men send-stegen feilet i PO
        // (typisk "Missing privilege"). Fotograf kan sende manuelt fra
        // PowerOffice GO → Salg → Salgsordrer.
        sendError: result.sendError,
        provider: 'poweroffice',
        // Indikerer at faktura-sending er asynkron i PO og det endelige
        // fakturanummeret tildeles av PO etter postering.
        async: true,
      });
    } catch (err) {
      console.error('[poweroffice] invoice creation failed:', err);
      res.status(500).json({ error: 'invoice_failed' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Photographer project milestones (Slice 9X.14 — timeline + next-steps)
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/photographer/projects/:projectId/milestones — list timeline for
  // prosjekt + identifiser "neste steg" (første pending milestone) som
  // frontend bruker til "Next steps"-card.
  app.get("/api/photographer/projects/:projectId/milestones", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    try {
      // Verify project ownership
      const owned = await pool.query(
        `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });

      const r = await pool.query(
        `SELECT id, title, description, category, type, due_date, scheduled_date,
                status, progress, priority, client_visible, requires_client_approval,
                client_approval_status, google_calendar_event_id,
                actual_cost, budget_allocated, created_at, updated_at
           FROM project_milestones
          WHERE project_id = $1 AND user_id = $2
          ORDER BY due_date ASC NULLS LAST, created_at ASC`,
        [projectId, photographerId],
      );

      const milestones = r.rows.map((m: Record<string, unknown>) => ({
        id: m.id,
        title: m.title,
        description: m.description ?? null,
        category: m.category,
        type: m.type,
        dueDate: m.due_date,
        scheduledDate: m.scheduled_date,
        status: m.status,
        progress: Number(m.progress ?? 0),
        priority: m.priority,
        clientVisible: !!m.client_visible,
        requiresClientApproval: !!m.requires_client_approval,
        clientApprovalStatus: m.client_approval_status ?? null,
        googleCalendarEventId: m.google_calendar_event_id ?? null,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));

      // "Neste steg" = første milestone som ikke er completed/cancelled.
      // Frontend bruker denne til CTA-card øverst på prosjekt-detalj.
      const nextStep = milestones.find(
        (m) => m.status !== 'completed' && m.status !== 'cancelled',
      ) ?? null;
      const completed = milestones.filter((m) => m.status === 'completed').length;
      const totalProgress = milestones.length > 0
        ? Math.round((completed / milestones.length) * 100)
        : 0;

      res.json({ milestones, nextStep, totalProgress, completedCount: completed });
    } catch (err) {
      // Manglende project_milestones-tabell skal ikke krasje prosjekt-detalj.
      // Returner tom liste i stedet for 500.
      console.warn('[photographer-milestones] list degraded:', (err as any)?.message || err);
      res.json({ milestones: [], nextStep: null, totalProgress: 0, completedCount: 0 });
    }
  });

  // PATCH /api/photographer/projects/:projectId/milestones/:milestoneId — oppdater
  // status (in_progress, completed, cancelled), progress (0-100), notes.
  app.patch("/api/photographer/projects/:projectId/milestones/:milestoneId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    const milestoneId = String(req.params.milestoneId || '').trim();
    if (!projectId || !milestoneId) return res.status(400).json({ error: 'ids_required' });

    const { status, progress, googleCalendarEventId } = req.body ?? {};

    try {
      const r = await pool.query(
        `UPDATE project_milestones SET
           status = COALESCE($1, status),
           progress = COALESCE($2, progress),
           google_calendar_event_id = COALESCE($3, google_calendar_event_id),
           updated_at = NOW()
         WHERE id = $4 AND project_id = $5 AND user_id = $6`,
        [
          typeof status === 'string' && status.trim() ? status.trim() : null,
          Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(progress))) : null,
          typeof googleCalendarEventId === 'string' && googleCalendarEventId.trim()
            ? googleCalendarEventId.trim() : null,
          milestoneId, projectId, photographerId,
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'milestone_not_found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[photographer-milestones] update failed:', err);
      res.status(500).json({ error: 'update_failed' });
    }
  });

  // POST /api/photographer/projects/:projectId/meet — opprett Google Meet-event
  // koblet til milestone. Bruker eksisterende createGoogleMeetLink-helper.
  app.post("/api/photographer/projects/:projectId/meet", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    const { milestoneId, date, time, duration, title, description } = req.body ?? {};

    try {
      // Verify project + hent klient-info
      const projQ = await pool.query(
        `SELECT p.id, p.title, p.client_id,
                COALESCE(c.email, '') AS client_email,
                COALESCE(c.first_name || ' ' || c.last_name, p.client_name) AS client_display
           FROM projects p
           LEFT JOIN clients c ON c.id = p.client_id
          WHERE p.id = $1 AND p.user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (projQ.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });
      const p = projQ.rows[0];

      const { createGoogleMeetLink } = await import('./google-meet.js');
      const result = await createGoogleMeetLink(pool, {
        title: typeof title === 'string' && title.trim() ? title : `Møte: ${p.title}`,
        description: typeof description === 'string' ? description : undefined,
        date,
        time,
        duration: Number.isFinite(Number(duration)) ? Number(duration) : 60,
        projectId,
        projectName: p.title,
        clientName: p.client_display ?? undefined,
        attendees: p.client_email ? [p.client_email] : undefined,
      }, photographerId);

      // Hvis milestoneId gitt: lagre calendar-event-id på milestone
      if (milestoneId && result.calendarEventId) {
        await pool.query(
          `UPDATE project_milestones
              SET google_calendar_event_id = $1,
                  scheduled_date = $2::timestamptz,
                  status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
                  updated_at = NOW()
            WHERE id = $3 AND project_id = $4 AND user_id = $5`,
          [result.calendarEventId, result.scheduledAt, milestoneId, projectId, photographerId],
        );
      }

      // CRM-log
      if (p.client_id) {
        await pool.query(
          `INSERT INTO client_communications
             (user_id, client_id, project_id, communication_type, direction,
              subject, content, meeting_url, status, requires_response,
              priority, category, tags, created_at)
           VALUES ($1, $2, $3, 'meeting', 'outbound',
                   $4, $5, $6, 'sent', false,
                   'normal', 'meeting_scheduled', ARRAY['meeting','google_meet'], NOW())`,
          [
            photographerId, p.client_id, projectId,
            `Google Meet planlagt: ${result.title}`,
            `Møte planlagt ${result.scheduledAt}. Link: ${result.meetLink}`,
            result.meetLink,
          ],
        ).catch((e) => console.warn('[meet] CRM log failed:', e));
      }

      res.status(201).json({
        meetLink: result.meetLink,
        title: result.title,
        scheduledAt: result.scheduledAt,
        calendarEventId: result.calendarEventId,
        webViewUrl: result.webViewUrl,
      });
    } catch (err: any) {
      console.error('[photographer-meet] create failed:', err);
      res.status(500).json({ error: 'meet_create_failed', message: String(err?.message || '').slice(0, 200) });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Photographer upload session (Slice 9X.16 — batch foto-upload)
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/photographer/projects/:projectId/upload-session — get-or-create
  // en capture_session knyttet til prosjektet. Returnerer session-id som
  // frontend bruker mot eksisterende /api/capture/sessions/:id/assets +
  // multipart-upload-endepunktene. Forenkler upload-UI så Stine slipper å
  // vite om capture-sessions er en separat ting.
  app.get("/api/photographer/projects/:projectId/upload-session", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    try {
      // Verifiser prosjekt-eierskap
      const projQ = await pool.query(
        `SELECT title, event_date FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (projQ.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });
      const proj = projQ.rows[0];

      // Sjekk om det allerede finnes en aktiv capture_session for prosjektet
      let existing = await pool.query(
        `SELECT id, name, status, starts_at, created_at
           FROM capture_sessions
          WHERE owner_user_id = $1 AND project_id = $2 AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1`,
        [photographerId, projectId],
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

      let sessionRow = existing.rows[0];

      // Hvis ingen: opprett ny
      if (!sessionRow) {
        const startsAt = proj.event_date
          ? new Date(proj.event_date).toISOString()
          : new Date().toISOString();
        const insert = await pool.query(
          `INSERT INTO capture_sessions (owner_user_id, name, project_id, starts_at, status)
           VALUES ($1, $2, $3, $4::timestamptz, 'active')
           RETURNING id, name, status, starts_at, created_at`,
          [photographerId, proj.title || 'Upload session', projectId, startsAt],
        );
        sessionRow = insert.rows[0];
      }

      // Hent eksisterende asset-count
      const countQ = await pool.query(
        `SELECT COUNT(*)::int AS asset_count
           FROM capture_assets
          WHERE session_id = $1 AND deleted_at IS NULL`,
        [sessionRow.id],
      ).catch(() => ({ rows: [{ asset_count: 0 }] }));

      res.json({
        session: {
          id: sessionRow.id,
          name: sessionRow.name,
          status: sessionRow.status,
          startsAt: sessionRow.starts_at,
          createdAt: sessionRow.created_at,
        },
        assetCount: Number(countQ.rows[0]?.asset_count ?? 0),
      });
    } catch (err) {
      console.error('[photographer-upload-session] failed:', err);
      res.status(500).json({ error: 'upload_session_failed' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Chat-over-email bridge (Slice 9X.18 — UniversalChat med Gmail under)
  // ─────────────────────────────────────────────────────────────────────────
  // Bobler-chat i UI mellom fotograf og klient. Hver melding lagres i
  // client_communications + sendes som Gmail-mail med RFC 2822-threading-
  // headers (Message-ID, In-Reply-To, References) så klientens svar går
  // i samme tråd i deres innboks. Innkommende svar polles separat.

  const CHAT_MESSAGE_ID_DOMAIN = process.env.PUBLIC_APP_HOSTNAME || 'creatorhubn.com';

  function generateChatMessageId(projectId: string): string {
    // RFC 5322 message-id: lokal-del må være globalt unik. Inkluderer
    // project-id-prefix så Gmail-poll-løperen senere kan filtrere på det.
    const random = crypto.randomBytes(12).toString('hex');
    return `<chat-${projectId.slice(0, 8)}-${random}@${CHAT_MESSAGE_ID_DOMAIN}>`;
  }

  // POST /api/photographer/projects/:projectId/messages — send chat-melding.
  // Body: { content: string }
  // Lagrer i client_communications + sender Gmail til klienten med riktig
  // threading-headers. Returnerer den lagrede meldingen.
  app.post("/api/photographer/projects/:projectId/messages", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'content_required' });
    if (content.length > 10_000) return res.status(413).json({ error: 'content_too_long' });

    try {
      // Hent prosjekt + klient + fotograf-info
      const ctxQ = await pool.query(
        `SELECT
           p.id, p.title, p.client_id,
           c.email AS client_email,
           COALESCE(c.first_name || ' ' || c.last_name, p.client_name, c.email) AS client_display,
           u.email AS photographer_email,
           COALESCE(u.first_name || ' ' || u.last_name, u.company_name, 'Creatorhubn') AS photographer_display
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         LEFT JOIN users u ON u.id = $2::varchar
         WHERE p.id = $1 AND p.user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (ctxQ.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });
      const ctx = ctxQ.rows[0];

      if (!ctx.client_id) {
        return res.status(412).json({ error: 'no_client_linked', message: 'Prosjektet må ha klient med epost-adresse for chat.' });
      }
      if (!ctx.client_email) {
        return res.status(412).json({ error: 'no_client_email' });
      }

      // Hent tråd-historikk for å sette In-Reply-To + References
      // (samtlige tidligere message-ids på samme prosjekt).
      const threadQ = await pool.query(
        `SELECT google_email_id
           FROM client_communications
          WHERE project_id = $1
            AND is_universal_chat = true
            AND google_email_id IS NOT NULL
          ORDER BY created_at ASC
          LIMIT 50`,
        [projectId],
      );
      const allMessageIds = threadQ.rows
        .map((r: Record<string, unknown>) => r.google_email_id)
        .filter((x: unknown): x is string => typeof x === 'string' && x.length > 0);
      const lastMessageId = allMessageIds[allMessageIds.length - 1] ?? null;

      // Universal thread id = stabilt prosjekt-id-prefix
      const universalThreadId = `proj-${projectId}`;

      const newMessageId = generateChatMessageId(projectId);

      // Send Gmail (best-effort — chat-rad lagres uansett så Stine ikke mister meldingen)
      let emailSent = false;
      let gmailMessageError: string | null = null;
      const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || '').trim();
      const mailPass = (process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '');

      if (mailUser && mailPass) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: mailUser, pass: mailPass },
          });
          const headers: Record<string, string> = {
            'Message-ID': newMessageId,
          };
          if (lastMessageId) {
            headers['In-Reply-To'] = lastMessageId;
            headers['References'] = allMessageIds.join(' ');
          }

          const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <p style="font-size:15px;line-height:1.6;color:#333;white-space:pre-wrap;">${escapeHtml(content)}</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">
              <p style="font-size:12px;color:#999;">
                Sendt fra ${escapeHtml(ctx.photographer_display)} via Creatorhubn.
                Du kan svare på denne meldingen — svaret blir lagt til i samme tråd.
              </p>
            </div>
          `;

          await transporter.sendMail({
            from: `"${ctx.photographer_display}" <${mailUser}>`,
            to: ctx.client_email,
            replyTo: ctx.photographer_email || mailUser,
            subject: lastMessageId
              ? `Re: ${ctx.title}`
              : `${ctx.title}`,
            text: content,
            html,
            headers,
          });
          emailSent = true;
        } catch (mailErr: any) {
          gmailMessageError = String(mailErr?.message || mailErr).slice(0, 200);
          console.warn('[chat] Gmail send failed:', gmailMessageError);
        }
      } else {
        gmailMessageError = 'GMAIL_USER/GMAIL_APP_PASSWORD ikke satt';
      }

      // Lagre i client_communications (selv om epost feilet — fotograf ser meldingen sin)
      const ins = await pool.query(
        `INSERT INTO client_communications
           (user_id, client_id, project_id, communication_type, direction,
            subject, content, from_email, to_email, status, requires_response,
            priority, category, tags, universal_thread_id, is_universal_chat,
            google_email_id, created_at)
         VALUES ($1, $2, $3, 'chat', 'outbound',
                 $4, $5, $6, $7, 'sent', false,
                 'normal', 'chat', ARRAY['chat','outbound'], $8, true,
                 $9, NOW())
         RETURNING id, created_at`,
        [
          photographerId, ctx.client_id, projectId,
          `Chat: ${ctx.title}`,
          content,
          mailUser || ctx.photographer_email || null,
          ctx.client_email,
          universalThreadId,
          newMessageId,
        ],
      );

      res.status(201).json({
        id: ins.rows[0].id,
        content,
        direction: 'outbound',
        fromEmail: mailUser || ctx.photographer_email,
        toEmail: ctx.client_email,
        messageId: newMessageId,
        emailSent,
        emailError: gmailMessageError,
        createdAt: ins.rows[0].created_at,
      });
    } catch (err) {
      console.error('[chat] message send failed:', err);
      res.status(500).json({ error: 'send_failed' });
    }
  });

  // GET /api/photographer/projects/:projectId/messages — hent hele chat-tråden.
  // Trigger automatisk Gmail-poll i bakgrunnen så innkommende svar dukker
  // opp uten manuell refresh (debounced via in-memory lock for å unngå spam).
  const chatPollLastRunByProject = new Map<string, number>();
  const CHAT_POLL_MIN_INTERVAL_MS = 20_000;

  app.get("/api/photographer/projects/:projectId/messages", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    try {
      const owned = await pool.query(
        `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });

      // Best-effort bakgrunns-poll. Debounced så vi ikke hammrer Gmail
      // når frontend auto-refreshes hver 30s. Kjøres etter response.
      const lastRun = chatPollLastRunByProject.get(projectId) ?? 0;
      if (Date.now() - lastRun > CHAT_POLL_MIN_INTERVAL_MS) {
        chatPollLastRunByProject.set(projectId, Date.now());
        // Fire and forget — chat-listen returneres uten å vente
        (async () => {
          try {
            const { pollProjectGmailReplies } = await import('./chat-gmail-poller.js');
            await pollProjectGmailReplies(pool, { photographerId, projectId });
          } catch (err) {
            console.warn('[chat] background poll failed:', err);
          }
        })();
      }

      const r = await pool.query(
        `SELECT id, communication_type, direction, content, from_email, to_email,
                google_email_id, google_thread_id, created_at, status
           FROM client_communications
          WHERE project_id = $1
            AND (is_universal_chat = true OR communication_type IN ('chat', 'email'))
          ORDER BY created_at ASC
          LIMIT 500`,
        [projectId],
      );

      res.json({
        messages: r.rows.map((m: Record<string, unknown>) => ({
          id: m.id,
          type: m.communication_type,
          direction: m.direction,
          content: m.content,
          fromEmail: m.from_email,
          toEmail: m.to_email,
          messageId: m.google_email_id ?? null,
          threadId: m.google_thread_id ?? null,
          status: m.status,
          createdAt: m.created_at,
        })),
      });
    } catch (err) {
      // Manglende client_communications-tabell/kolonner skal ikke krasje
      // chat-fanen. Returner tom liste istedet for 500.
      console.warn('[chat] list degraded:', (err as any)?.message || err);
      res.json({ messages: [] });
    }
  });

  // POST /api/photographer/projects/:projectId/messages/refresh — manuell
  // trigger av Gmail-poll for innkommende svar. Returnerer antall nye
  // meldinger funnet + status-info så UI kan vise feedback ved scope-feil.
  app.post("/api/photographer/projects/:projectId/messages/refresh", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'missing_project_id' });

    try {
      const owned = await pool.query(
        `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [projectId, photographerId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'project_not_found' });

      const { pollProjectGmailReplies } = await import('./chat-gmail-poller.js');
      const result = await pollProjectGmailReplies(pool, { photographerId, projectId });
      chatPollLastRunByProject.set(projectId, Date.now());
      res.json(result);
    } catch (err) {
      console.error('[chat] refresh failed:', err);
      res.status(500).json({ error: 'refresh_failed' });
    }
  });
}
