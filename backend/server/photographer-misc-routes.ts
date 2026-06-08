import express from "express";
import type { Pool } from "pg";
import { ensurePhotographerProjectsSchemaShared } from "./photographer-projects-routes";

export interface PhotographerMiscRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  ensurePrintStoreSchema: () => Promise<void>;
}

export function setupPhotographerMiscRoutes(
  deps: PhotographerMiscRoutesDeps,
): void {
  const { app, pool, requireUserSession, ensurePrintStoreSchema } = deps;

  app.get("/api/photographer/dashboard-badges", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;

    const safeCount = async (label: string, run: () => Promise<number>): Promise<number> => {
      try {
        return await run();
      } catch (err) {
        console.warn(`[dashboard-badges] ${label} failed:`, err);
        return 0;
      }
    };

    const [unreadMessages, newGallerySubmissions, pendingPrintOrders] = await Promise.all([
      safeCount('unread_messages', async () => {
        const r = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM communication_messages
           WHERE recipient_id = $1 AND COALESCE(is_read, false) = false`,
          [photographerId],
        );
        return Number(r.rows[0]?.c ?? 0);
      }),
      safeCount('gallery_submissions', async () => {
        // "Nye" = laget innen siste 7 dager + ikke vurdert. Uten tidsvinduet
        // bygger vi opp historisk gjeld der hver gammel ikke-vurdert
        // selection forblir telt for alltid.
        const r = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM client_selections sel
           JOIN client_gallery_sessions s ON s.id = sel.session_id
           WHERE s.photographer_id = $1
             AND sel.is_selected = true
             AND sel.photographer_approved IS NULL
             AND sel.created_at > NOW() - INTERVAL '7 days'`,
          [photographerId],
        );
        return Number(r.rows[0]?.c ?? 0);
      }),
      safeCount('pending_print_orders', async () => {
        await ensurePrintStoreSchema();
        const r = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM print_orders
           WHERE photographer_id = $1
             AND payment_status = 'paid'
             AND COALESCE(fulfillment_status, 'pending') = 'pending'`,
          [photographerId],
        );
        return Number(r.rows[0]?.c ?? 0);
      }),
    ]);

    res.json({ unreadMessages, newGallerySubmissions, pendingPrintOrders });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Photographer Settings (Slice 9X.21 — overview + profil + Drive-folder)
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/photographer/settings/overview — alt-i-én for settings-siden:
  // profil + abonnement-status + Drive-tilkobling + lagring + integrasjoner.
  app.get("/api/photographer/settings/overview", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    try {
      // Profil (users-tabell)
      const profileQ = await pool.query(
        `SELECT id, email, first_name, last_name, phone_number,
                company_name, organization_number, business_address,
                website, vat_number, profile_image_url, profession,
                google_workspace_connected, google_drive_connected,
                gmail_connected, google_calendar_connected,
                created_at
           FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const profile = profileQ.rows[0] ?? null;

      // Antall prosjekter + aktive klienter (for context)
      const counts = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM projects WHERE user_id = $1) AS projects_count,
           (SELECT COUNT(*)::int FROM clients WHERE photographer_id = $1) AS clients_count,
           (SELECT COUNT(*)::int FROM photographer_client_galleries WHERE photographer_id = $1) AS galleries_count`,
        [userId],
      ).catch(() => ({ rows: [{ projects_count: 0, clients_count: 0, galleries_count: 0 }] }));

      // Integrasjons-status: PowerOffice
      let poStatus: { connected: boolean; status: string | null } = { connected: false, status: null };
      try {
        const po = await pool.query(
          `SELECT status FROM photographer_integrations
            WHERE photographer_id = $1 AND provider = 'poweroffice' LIMIT 1`,
          [userId],
        );
        if ((po.rowCount ?? 0) > 0) {
          poStatus = { connected: true, status: po.rows[0].status };
        }
      } catch { /* tabellen finnes kanskje ikke */ }

      res.json({
        profile: profile ? {
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          phoneNumber: profile.phone_number,
          companyName: profile.company_name,
          organizationNumber: profile.organization_number,
          businessAddress: profile.business_address,
          website: profile.website,
          vatNumber: profile.vat_number,
          profileImageUrl: profile.profile_image_url,
          profession: profile.profession,
          createdAt: profile.created_at,
        } : null,
        google: {
          workspaceConnected: !!profile?.google_workspace_connected,
          driveConnected: !!profile?.google_drive_connected,
          gmailConnected: !!profile?.gmail_connected,
          calendarConnected: !!profile?.google_calendar_connected,
        },
        counts: {
          projects: Number(counts.rows[0]?.projects_count ?? 0),
          clients: Number(counts.rows[0]?.clients_count ?? 0),
          galleries: Number(counts.rows[0]?.galleries_count ?? 0),
        },
        integrations: {
          poweroffice: poStatus,
        },
      });
    } catch (err) {
      console.error('[photographer-settings] overview failed:', err);
      res.status(500).json({ error: 'overview_failed' });
    }
  });

  // PATCH /api/photographer/profile — oppdater fotografens business-info.
  app.patch("/api/photographer/profile", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;
    const {
      firstName, lastName, phoneNumber, companyName,
      organizationNumber, businessAddress, website, vatNumber,
    } = req.body ?? {};

    try {
      const r = await pool.query(
        `UPDATE users SET
           first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone_number = COALESCE($3, phone_number),
           company_name = COALESCE($4, company_name),
           organization_number = COALESCE($5, organization_number),
           business_address = COALESCE($6, business_address),
           website = COALESCE($7, website),
           vat_number = COALESCE($8, vat_number),
           updated_at = NOW()
         WHERE id = $9`,
        [
          typeof firstName === 'string' ? firstName : null,
          typeof lastName === 'string' ? lastName : null,
          typeof phoneNumber === 'string' ? phoneNumber : null,
          typeof companyName === 'string' ? companyName : null,
          typeof organizationNumber === 'string' ? organizationNumber : null,
          typeof businessAddress === 'string' ? businessAddress : null,
          typeof website === 'string' ? website : null,
          typeof vatNumber === 'string' ? vatNumber : null,
          userId,
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'user_not_found' });
      res.json({ success: true });
    } catch (err) {
      console.error('[photographer-profile] update failed:', err);
      res.status(500).json({ error: 'update_failed' });
    }
  });

  // POST /api/photographer/google-drive/setup-folders — idempotent oppretting
  // av standard fotograf-folder-struktur i Google Drive. Lager:
  //   /Creatorhubn Photographer
  //     /01-RAW
  //     /02-Selected
  //     /03-Edited
  //     /04-Delivery
  //     /05-Contracts
  // Stine kopierer template-struktur per prosjekt eller bruker root-mappene direkte.
  const PHOTOGRAPHER_DRIVE_FOLDERS = [
    '01-RAW',
    '02-Selected',
    '03-Edited',
    '04-Delivery',
    '05-Contracts',
  ];

  app.post("/api/photographer/google-drive/setup-folders", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    try {
      const { google } = await import('googleapis');
      let oauthClient;
      try {
        // Bruk samme helper som google-calendar-project.ts via dynamic import
        const credsModule = await import('./google-calendar-project.js');
        // Vi har ikke en eksportert helper for å hente bare credentials.
        // Inline-versjon: bruk resolveRoleRoomGoogleConnection hvis tilgjengelig
        // Fallback: prøv direct pool-query for tokens
        const r = await pool.query(
          `SELECT access_token_encrypted, refresh_token_encrypted, expiry_date, oauth_app
             FROM role_room_google_connections
            WHERE user_id = $1 AND connection_state = 'connected'
              AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
            ORDER BY last_used_at DESC NULLS LAST LIMIT 1`,
          [userId],
        );
        if ((r.rowCount ?? 0) === 0) {
          return res.status(412).json({
            error: 'google_not_connected',
            message: 'Google Workspace må kobles til først for å opprette folder-struktur.',
          });
        }
        void credsModule; // tie-in for future helper

        // Bygg oauth-client på samme måte som google-calendar-project.ts
        const row = r.rows[0];
        const { getGoogleWorkspaceOauthConfig, normalizeGoogleWorkspaceOauthApp } =
          await import('./google-workspace-oauth.js');
        const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room');
        const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp as 'role_room' | 'creatorhub');
        if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
          return res.status(500).json({ error: 'oauth_config_missing' });
        }

        // Decrypt tokens (samme pattern som chat-gmail-poller)
        const cryptoMod = await import('crypto');
        const secret = process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
          || process.env.ROLE_ROOM_ENCRYPTION_KEY
          || process.env.SESSION_SECRET
          || process.env.JWT_SECRET
          || process.env.AUTH_SECRET;
        if (!secret) return res.status(500).json({ error: 'encryption_key_missing' });
        const key = cryptoMod.createHash('sha256').update(secret).digest();
        const decrypt = (val: string | null | undefined): string | null => {
          if (!val) return null;
          try {
            const buf = Buffer.from(val, 'base64');
            if (buf.length < 28) return null;
            const iv = buf.subarray(0, 12);
            const tag = buf.subarray(12, 28);
            const ct = buf.subarray(28);
            const dec = cryptoMod.createDecipheriv('aes-256-gcm', key, iv);
            dec.setAuthTag(tag);
            return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
          } catch { return null; }
        };

        const refreshToken = decrypt(row.refresh_token_encrypted);
        const accessToken = decrypt(row.access_token_encrypted);
        if (!refreshToken && !accessToken) {
          return res.status(412).json({ error: 'tokens_invalid' });
        }
        oauthClient = new google.auth.OAuth2(
          oauthConfig.clientId,
          oauthConfig.clientSecret,
          // google.auth.OAuth2 forventer string | undefined; oauth-config
          // returnerer null ved manglende env. Konvertér eksplisitt.
          oauthConfig.redirectUri ?? undefined,
        );
        const seed: any = {};
        if (refreshToken) seed.refresh_token = refreshToken;
        if (accessToken) seed.access_token = accessToken;
        if (row.expiry_date) {
          const ts = Date.parse(row.expiry_date);
          if (Number.isFinite(ts)) seed.expiry_date = ts;
        }
        oauthClient.setCredentials(seed);
        if (refreshToken) {
          // Slice 9X.80 — wrapper markerer needs_reauth ved invalid_grant
          const { refreshAccessTokenWithStateTracking } = await import('./google-oauth-shared.js');
          await refreshAccessTokenWithStateTracking(oauthClient, {
            pool,
            userId,
            context: 'drive_setup_refresh',
          }).catch(() => undefined);
        }
      } catch (credErr) {
        console.warn('[drive-setup] cred load failed:', credErr);
        return res.status(500).json({ error: 'cred_load_failed' });
      }

      const driveApi = google.drive({ version: 'v3', auth: oauthClient });

      // Sjekk om root-folder eksisterer (idempotent)
      const rootName = 'Creatorhubn Photographer';
      const existing = await driveApi.files.list({
        q: `name='${rootName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });
      let rootId: string;
      if ((existing.data.files ?? []).length > 0) {
        rootId = existing.data.files![0].id!;
      } else {
        const created = await driveApi.files.create({
          requestBody: {
            name: rootName,
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        rootId = created.data.id!;
      }

      // Opprett underfoldere (idempotent — sjekker hver først)
      const createdSubfolders: { name: string; id: string }[] = [];
      for (const folderName of PHOTOGRAPHER_DRIVE_FOLDERS) {
        const sub = await driveApi.files.list({
          q: `name='${folderName}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });
        if ((sub.data.files ?? []).length > 0) {
          createdSubfolders.push({ name: folderName, id: sub.data.files![0].id! });
        } else {
          const newSub = await driveApi.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [rootId],
            },
            fields: 'id',
          });
          createdSubfolders.push({ name: folderName, id: newSub.data.id! });
        }
      }

      res.json({
        rootFolderId: rootId,
        rootFolderUrl: `https://drive.google.com/drive/folders/${rootId}`,
        subfolders: createdSubfolders,
      });
    } catch (err: any) {
      console.error('[drive-setup] failed:', err);
      if (err?.code === 403 || err?.response?.status === 403) {
        return res.status(403).json({
          error: 'drive_scope_missing',
          message: 'Mangler Google Drive-tilgang. Koble til Google på nytt og godkjenn Drive-scope.',
        });
      }
      res.status(500).json({ error: 'setup_failed', message: String(err?.message ?? '').slice(0, 200) });
    }
  });
  app.get("/api/photographer/worklog/summary", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;

    // Defensiv: hvis project_time_tracking-tabellen ikke finnes eller
    // projects-skjemaet har drift, returner tom data istedet for 500.
    // Brukerens dashboard krasjer aldri på "ingen logger ennå".
    const empty = {
      totals: { weekHours: 0, monthHours: 0, totalHours: 0, avgPerDay: 0 },
      perProject: [],
      dailyLast14: [],
    };

    try {
      await ensurePhotographerProjectsSchemaShared(pool);

      // Bekreft at project_time_tracking finnes — ellers tom respons
      const tableCheck = await pool.query(
        `SELECT to_regclass('public.project_time_tracking') AS exists`,
      );
      if (!tableCheck.rows[0]?.exists) {
        return res.json(empty);
      }

      // Aggregert per prosjekt — denne uka + denne måneden + total
      const r = await pool.query(
        `WITH per_project AS (
          SELECT
            p.id AS project_id,
            p.title,
            p.project_type,
            p.status,
            p.event_date,
            COALESCE(p.service_price, 0)::numeric AS service_price,
            SUM(t.billable_hours) AS total_hours,
            SUM(t.billable_hours * t.rate) AS total_cost,
            SUM(CASE WHEN t.date_worked >= CURRENT_DATE - INTERVAL '7 days'
                THEN t.billable_hours ELSE 0 END) AS week_hours,
            SUM(CASE WHEN t.date_worked >= DATE_TRUNC('month', CURRENT_DATE)::date
                THEN t.billable_hours ELSE 0 END) AS month_hours
          FROM projects p
          JOIN project_time_tracking t ON t.project_id = p.id
          WHERE p.user_id = $1
          GROUP BY p.id, p.title, p.project_type, p.status, p.event_date, p.service_price
        )
        SELECT * FROM per_project
        WHERE total_hours > 0
        ORDER BY week_hours DESC, total_hours DESC
        LIMIT 50`,
        [photographerId],
      );

      // Total totals
      const totals = r.rows.reduce(
        (acc, row: Record<string, unknown>) => {
          acc.weekHours += Number(row.week_hours ?? 0);
          acc.monthHours += Number(row.month_hours ?? 0);
          acc.totalHours += Number(row.total_hours ?? 0);
          return acc;
        },
        { weekHours: 0, monthHours: 0, totalHours: 0 },
      );

      // Last 7 days breakdown (for sparkline)
      const dailyQ = await pool.query(
        `SELECT date_worked::text AS d, SUM(billable_hours)::numeric AS hours
           FROM project_time_tracking t
           JOIN projects p ON p.id = t.project_id
          WHERE p.user_id = $1
            AND t.date_worked >= CURRENT_DATE - INTERVAL '14 days'
          GROUP BY date_worked
          ORDER BY date_worked ASC`,
        [photographerId],
      );

      res.json({
        totals: {
          weekHours: totals.weekHours,
          monthHours: totals.monthHours,
          totalHours: totals.totalHours,
          avgPerDay: totals.weekHours / 7,
        },
        perProject: r.rows.map((row: Record<string, unknown>) => ({
          projectId: row.project_id,
          title: row.title ?? 'Uten tittel',
          projectType: row.project_type ?? null,
          status: row.status ?? 'active',
          eventDate: row.event_date ?? null,
          weekHours: Number(row.week_hours ?? 0),
          monthHours: Number(row.month_hours ?? 0),
          totalHours: Number(row.total_hours ?? 0),
          totalCost: Number(row.total_cost ?? 0),
          servicePrice: Number(row.service_price ?? 0),
        })),
        dailyLast14: dailyQ.rows.map((row: Record<string, unknown>) => ({
          date: row.d,
          hours: Number(row.hours ?? 0),
        })),
      });
    } catch (err) {
      // Logg, men returner 200 m/ tom-data — UI skal aldri vise 500-feil
      // for "ingen arbeidslogg ennå". Schema-drift håndteres gracefully.
      console.warn('[worklog-summary] degraded (returning empty):', (err as any)?.message || err);
      res.json(empty);
    }
  });

  // GET /api/photographer/profitability/summary — PnL-aggregering per type/klient.
  app.get("/api/photographer/profitability/summary", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    try {
      await ensurePhotographerProjectsSchemaShared(pool);
      const projectsQ = await pool.query(
        `SELECT
           p.id, p.title, p.project_type, p.event_date, p.status, p.client_id,
           COALESCE(p.service_price, 0)::numeric AS service_price,
           COALESCE(p.cost_overhead, 0)::numeric AS cost_overhead,
           COALESCE(p.vat_rate, 25)::numeric     AS vat_rate,
           COALESCE(t.tracked_hours, 0)::numeric AS tracked_hours,
           COALESCE(t.tracked_cost, 0)::numeric  AS tracked_cost,
           c.first_name, c.last_name, c.email
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         LEFT JOIN (
           SELECT project_id,
                  SUM(billable_hours) AS tracked_hours,
                  SUM(billable_hours * rate) AS tracked_cost
             FROM project_time_tracking
            GROUP BY project_id
         ) t ON t.project_id = p.id
         WHERE p.user_id = $1`,
        [photographerId],
      );

      const projects = projectsQ.rows.map((r: Record<string, unknown>) => {
        // MVA-skille — service_price antas å være INKL MVA (norsk B2C-konvensjon).
        // Netto = brutto / (1 + sats/100). VAT = brutto - netto.
        const revenueGross = Number(r.service_price);
        const vatRate = Number(r.vat_rate);
        const revenueNet = vatRate > 0 ? revenueGross / (1 + vatRate / 100) : revenueGross;
        const vatAmount = revenueGross - revenueNet;
        // Kostnad er ALLTID netto (timepris + faste utgifter eks MVA).
        const cost = Number(r.tracked_cost) + Number(r.cost_overhead);
        const profitNet = revenueNet - cost;
        const marginNet = revenueNet > 0 ? (profitNet / revenueNet) * 100 : null;
        const clientDisplay = [r.first_name, r.last_name].filter(Boolean).join(' ')
          || (r.email as string | null) || 'Uten klient';
        return {
          id: r.id,
          title: r.title ?? 'Uten tittel',
          projectType: (r.project_type as string) ?? 'ukategorisert',
          clientId: r.client_id ?? null,
          clientName: clientDisplay,
          eventDate: r.event_date ?? null,
          status: r.status ?? 'active',
          revenue: revenueGross,      // brutto — bakoverkompatibel
          revenueGross,
          revenueNet,
          vatRate,
          vatAmount,
          trackedHours: Number(r.tracked_hours),
          trackedCost: Number(r.tracked_cost),
          overhead: Number(r.cost_overhead),
          totalCost: cost,
          profit: profitNet,          // netto-fortjeneste
          marginPct: marginNet,       // basert på netto-omsetning
        };
      });

      const totals = projects.reduce(
        (acc, p) => {
          acc.revenueGross += p.revenueGross;
          acc.revenueNet += p.revenueNet;
          acc.vatAmount += p.vatAmount;
          acc.totalCost += p.totalCost;
          acc.profit += p.profit;
          acc.trackedHours += p.trackedHours;
          return acc;
        },
        { revenueGross: 0, revenueNet: 0, vatAmount: 0, totalCost: 0, profit: 0, trackedHours: 0 },
      );
      // Margin beregnes mot NETTO omsetning (riktig for AS — MVA er gjennomgangspost).
      const overallMargin = totals.revenueNet > 0 ? (totals.profit / totals.revenueNet) * 100 : null;
      // Bakoverkompatibel: `revenue` peker på brutto.
      (totals as any).revenue = totals.revenueGross;

      const byType = new Map<string, {
        projectType: string; projects: number;
        revenueGross: number; revenueNet: number; vatAmount: number;
        cost: number; profit: number; hours: number;
      }>();
      for (const p of projects) {
        const key = p.projectType;
        const cur = byType.get(key) ?? {
          projectType: key, projects: 0,
          revenueGross: 0, revenueNet: 0, vatAmount: 0,
          cost: 0, profit: 0, hours: 0,
        };
        cur.projects += 1;
        cur.revenueGross += p.revenueGross;
        cur.revenueNet += p.revenueNet;
        cur.vatAmount += p.vatAmount;
        cur.cost += p.totalCost;
        cur.profit += p.profit;
        cur.hours += p.trackedHours;
        byType.set(key, cur);
      }
      const serviceTypes = Array.from(byType.values())
        .map((t) => ({
          ...t,
          revenue: t.revenueGross,            // bakoverkompat
          marginPct: t.revenueNet > 0 ? (t.profit / t.revenueNet) * 100 : null,
          avgHourlyYield: t.hours > 0 ? t.profit / t.hours : null,
        }))
        .sort((a, b) => b.revenueGross - a.revenueGross);

      const topProjects = [...projects]
        .filter((p) => p.revenue > 0)
        .sort((a, b) => (b.marginPct ?? -Infinity) - (a.marginPct ?? -Infinity))
        .slice(0, 5);
      const bottomProjects = [...projects]
        .filter((p) => p.revenue > 0)
        .sort((a, b) => (a.marginPct ?? Infinity) - (b.marginPct ?? Infinity))
        .slice(0, 5);

      res.json({
        totals: { ...totals, marginPct: overallMargin, projectCount: projects.length },
        serviceTypes,
        topProjects,
        bottomProjects,
        projects,
      });
    } catch (err) {
      // Schema-feil eller manglende tabeller skal ikke krasje dashboard.
      // Returner tom struktur i stedet for 500.
      console.warn('[photographer-profitability] summary failed, returning empty:', err);
      res.json({
        totals: { revenueGross: 0, revenueNet: 0, vatAmount: 0, cost: 0, profitNet: 0, marginPct: null, projectCount: 0 },
        serviceTypes: [],
        topProjects: [],
        bottomProjects: [],
        projects: [],
        schemaWarning: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
