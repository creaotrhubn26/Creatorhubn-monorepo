import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { google } from "googleapis";

const GOOGLE_PEOPLE_READ_SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts",
] as const;
const GOOGLE_PEOPLE_WRITE_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
] as const;

export interface GooglePeopleRoutesDeps {
  app: express.Application;
  pool: Pool;
  resolveRoleRoomGoogleConnection: (
    pool: Pool,
    userId: string | null,
    options: { preferredOauthApps: string[] },
  ) => Promise<any>;
  derivePreferredGoogleWorkspaceOauthApps: (
    req: express.Request,
  ) => string[];
}

export function setupGooglePeopleRoutes(
  deps: GooglePeopleRoutesDeps,
): void {
  const {
    app,
    pool,
    resolveRoleRoomGoogleConnection,
    derivePreferredGoogleWorkspaceOauthApps,
  } = deps;

  function readWorkspaceIdentity(
    req: express.Request,
    payload?: Record<string, unknown>,
  ) {
    const readHeaderValue = (headerName: string) => {
      const raw = req.headers[headerName.toLowerCase()];
      const value = Array.isArray(raw) ? raw[0] : raw;
      return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null;
    };

    const readPayloadString = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null;

    return {
      userId:
        readHeaderValue("x-role-room-user-id") ||
        readHeaderValue("x-user-id") ||
        readPayloadString(req.query.userId) ||
        readPayloadString(payload?.userId) ||
        null,
    };
  }

  function hasAnyStoredGoogleScope(
    storedScopes: string[] | null | undefined,
    acceptableScopes: readonly string[],
  ) {
    const normalizedScopes = new Set(
      (storedScopes || []).map((scope) => scope.toLowerCase()),
    );
    return acceptableScopes.some((scope) =>
      normalizedScopes.has(scope.toLowerCase()),
    );
  }

  function mapGooglePeopleContact(person: Record<string, unknown>) {
    const names = Array.isArray(person.names)
      ? (person.names as Array<Record<string, unknown>>)
      : [];
    const emails = Array.isArray(person.emailAddresses)
      ? (person.emailAddresses as Array<Record<string, unknown>>)
      : [];
    const phones = Array.isArray(person.phoneNumbers)
      ? (person.phoneNumbers as Array<Record<string, unknown>>)
      : [];
    const organizations = Array.isArray(person.organizations)
      ? (person.organizations as Array<Record<string, unknown>>)
      : [];
    const photos = Array.isArray(person.photos)
      ? (person.photos as Array<Record<string, unknown>>)
      : [];
    const metadata =
      person.metadata && typeof person.metadata === "object"
        ? (person.metadata as Record<string, unknown>)
        : null;
    const sources = Array.isArray(metadata?.sources)
      ? (metadata.sources as Array<Record<string, unknown>>)
      : [];

    const displayName =
      typeof names[0]?.displayName === "string" ? names[0].displayName : "";
    const email = typeof emails[0]?.value === "string" ? emails[0].value : "";
    const phone = typeof phones[0]?.value === "string" ? phones[0].value : "";
    const company =
      typeof organizations[0]?.name === "string"
        ? organizations[0].name
        : "";
    const photoUrl =
      typeof photos[0]?.url === "string" ? photos[0].url : null;
    const etag =
      typeof sources[0]?.etag === "string" ? sources[0].etag : null;
    const resourceName =
      typeof person.resourceName === "string"
        ? person.resourceName
        : crypto.randomUUID();

    return {
      id: resourceName,
      resourceName,
      etag,
      name: displayName,
      email,
      phone,
      company,
      photoUrl,
      source: "google-workspace",
    };
  }

  async function buildGooglePeopleClient(
    req: express.Request,
    payload?: Record<string, unknown>,
  ) {
    const identity = readWorkspaceIdentity(req, payload);
    return resolveRoleRoomGoogleConnection(pool, identity.userId, {
      preferredOauthApps: derivePreferredGoogleWorkspaceOauthApps(req),
    });
  }

  async function mirrorGoogleContactToCrm(payload: {
    name: string;
    email: string;
    phone: string;
    company: string;
    notes?: string | null;
  }) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM crm_customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [normalizedEmail],
    );

    if (existing.rows[0]?.id) {
      await pool.query(
        `UPDATE crm_customers
            SET name = COALESCE(NULLIF($1, ''), name),
                phone = COALESCE(NULLIF($2, ''), phone),
                company = COALESCE(NULLIF($3, ''), company),
                notes = COALESCE(NULLIF($4, ''), notes),
                updated_at = NOW()
          WHERE id = $5`,
        [
          payload.name,
          payload.phone,
          payload.company,
          payload.notes || "",
          existing.rows[0].id,
        ],
      );
      return existing.rows[0].id;
    }

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO crm_customers (id, name, email, phone, company, status, source, notes, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'lead', 'google-workspace', $5, NOW(), NOW())
       RETURNING id`,
      [
        payload.name || payload.email,
        normalizedEmail,
        payload.phone,
        payload.company,
        payload.notes || "Synkronisert fra Google Kontakter",
      ],
    );
    return inserted.rows[0]?.id ?? null;
  }

  function collectShowcaseContacts(payload: Record<string, unknown>) {
    const contacts = new Map<
      string,
      {
        name: string;
        email: string;
        phone: string;
        company: string;
        notes: string;
      }
    >();
    const pushContact = (candidate: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      notes?: string | null;
    }) => {
      const email =
        typeof candidate.email === "string"
          ? candidate.email.trim().toLowerCase()
          : "";
      if (!email) {
        return;
      }
      contacts.set(email, {
        name:
          typeof candidate.name === "string" &&
          candidate.name.trim().length > 0
            ? candidate.name.trim()
            : email,
        email,
        phone:
          typeof candidate.phone === "string" ? candidate.phone.trim() : "",
        company:
          typeof candidate.company === "string"
            ? candidate.company.trim()
            : "",
        notes:
          typeof candidate.notes === "string" ? candidate.notes.trim() : "",
      });
    };

    pushContact({
      name: typeof payload.clientName === "string" ? payload.clientName : null,
      email:
        typeof payload.clientEmail === "string" ? payload.clientEmail : null,
      phone:
        typeof payload.clientPhone === "string" ? payload.clientPhone : null,
      company:
        typeof payload.projectName === "string" ? payload.projectName : null,
      notes: "Kunde fra showcase-synk",
    });

    const items = Array.isArray(payload.items)
      ? (payload.items as Array<Record<string, unknown>>)
      : [];
    items.forEach((item) => {
      pushContact({
        name:
          typeof item.name === "string"
            ? item.name
            : typeof item.title === "string"
              ? item.title
              : null,
        email:
          typeof item.email === "string"
            ? item.email
            : typeof item.clientEmail === "string"
              ? item.clientEmail
              : typeof item.contactEmail === "string"
                ? item.contactEmail
                : null,
        phone:
          typeof item.phone === "string"
            ? item.phone
            : typeof item.clientPhone === "string"
              ? item.clientPhone
              : null,
        company:
          typeof item.company === "string"
            ? item.company
            : typeof item.clientName === "string"
              ? item.clientName
              : null,
        notes: "Synkronisert fra Universal Showcase",
      });

      const nestedCollections = [
        "collaborators",
        "contacts",
        "teamMembers",
        "vendors",
        "clients",
      ];
      nestedCollections.forEach((key) => {
        const nested = Array.isArray(item[key])
          ? (item[key] as Array<Record<string, unknown>>)
          : [];
        nested.forEach((entry) => {
          pushContact({
            name: typeof entry.name === "string" ? entry.name : null,
            email: typeof entry.email === "string" ? entry.email : null,
            phone: typeof entry.phone === "string" ? entry.phone : null,
            company:
              typeof entry.company === "string" ? entry.company : null,
            notes: `Synkronisert fra showcase (${key})`,
          });
        });
      });
    });

    return Array.from(contacts.values());
  }

  app.get("/api/google/people/search-contacts", async (req, res) => {
    try {
      const query =
        typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!query) {
        return res.json([]);
      }

      const googleClient = await buildGooglePeopleClient(req);
      if (
        !hasAnyStoredGoogleScope(
          googleClient.connection.storedScopes,
          GOOGLE_PEOPLE_READ_SCOPES,
        )
      ) {
        return res.status(409).json({
          error:
            "Google Workspace er koblet til, men mangler Google Kontakter-tilgang. Koble Google Workspace på nytt for å søke i kontakter.",
        });
      }

      const peopleApi = google.people({
        version: "v1",
        auth: googleClient.oauthClient,
      });
      const result = await peopleApi.people.searchContacts({
        query,
        pageSize: 20,
        readMask:
          "names,emailAddresses,phoneNumbers,organizations,photos,metadata",
      });

      const contacts = (result.data.results ?? [])
        .map((entry) => {
          const person = entry.person;
          return person
            ? mapGooglePeopleContact(person as Record<string, unknown>)
            : null;
        })
        .filter(
          (entry): entry is ReturnType<typeof mapGooglePeopleContact> =>
            Boolean(entry),
        );

      return res.json(contacts);
    } catch (error) {
      console.error("Google contact search error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to search contacts",
      });
    }
  });

  app.post("/api/google/people/create-contact", async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const googleClient = await buildGooglePeopleClient(req, payload);
      if (
        !hasAnyStoredGoogleScope(
          googleClient.connection.storedScopes,
          GOOGLE_PEOPLE_WRITE_SCOPES,
        )
      ) {
        return res.status(409).json({
          error:
            "Google Workspace er koblet til, men mangler skrivetilgang til Google Kontakter. Koble Google Workspace på nytt for å opprette kontakter.",
        });
      }

      const firstName =
        typeof payload.firstName === "string"
          ? payload.firstName.trim()
          : "";
      const lastName =
        typeof payload.lastName === "string"
          ? payload.lastName.trim()
          : "";
      const displayName =
        typeof payload.name === "string" && payload.name.trim().length > 0
          ? payload.name.trim()
          : [firstName, lastName].filter(Boolean).join(" ").trim();
      const email =
        typeof payload.email === "string"
          ? payload.email.trim().toLowerCase()
          : "";
      const phone =
        typeof payload.phone === "string" ? payload.phone.trim() : "";
      const company =
        typeof payload.companyName === "string"
          ? payload.companyName.trim()
          : typeof payload.company === "string"
            ? payload.company.trim()
            : "";
      const notes =
        typeof payload.notes === "string" ? payload.notes.trim() : "";

      if (!displayName && !email) {
        return res.status(400).json({
          error: "Navn eller e-post er påkrevd for å opprette kontakt.",
        });
      }

      const peopleApi = google.people({
        version: "v1",
        auth: googleClient.oauthClient,
      });
      const created = await peopleApi.people.createContact({
        requestBody: {
          names: [
            {
              givenName: firstName || displayName || email,
              familyName: lastName || undefined,
              displayName: displayName || undefined,
            },
          ],
          emailAddresses: email ? [{ value: email }] : undefined,
          phoneNumbers: phone ? [{ value: phone }] : undefined,
          organizations: company ? [{ name: company }] : undefined,
          biographies: notes ? [{ value: notes }] : undefined,
        },
      });

      const mapped = mapGooglePeopleContact(
        (created.data || {}) as Record<string, unknown>,
      );
      const crmCustomerId = await mirrorGoogleContactToCrm({
        name: mapped.name,
        email: mapped.email,
        phone: mapped.phone,
        company: mapped.company,
        notes,
      });

      return res.status(201).json({
        success: true,
        contactId: mapped.resourceName,
        id: mapped.resourceName,
        contact: mapped,
        crmCustomerId,
      });
    } catch (error) {
      console.error("Create Google contact error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create contact",
      });
    }
  });

  app.put(
    "/api/google/people/update-contact/:contactId",
    async (req, res) => {
      try {
        const { contactId } = req.params;
        const payload = (req.body || {}) as Record<string, unknown>;
        const googleClient = await buildGooglePeopleClient(req, payload);
        if (
          !hasAnyStoredGoogleScope(
            googleClient.connection.storedScopes,
            GOOGLE_PEOPLE_WRITE_SCOPES,
          )
        ) {
          return res.status(409).json({
            error:
              "Google Workspace er koblet til, men mangler skrivetilgang til Google Kontakter. Koble Google Workspace på nytt for å oppdatere kontakter.",
          });
        }

        const peopleApi = google.people({
          version: "v1",
          auth: googleClient.oauthClient,
        });
        const existing = await peopleApi.people.get({
          resourceName: contactId,
          personFields:
            "names,emailAddresses,phoneNumbers,organizations,biographies,metadata,photos",
        });
        const current = (existing.data || {}) as Record<string, unknown>;
        const metadata =
          current.metadata && typeof current.metadata === "object"
            ? (current.metadata as Record<string, unknown>)
            : null;
        const sources = Array.isArray(metadata?.sources)
          ? (metadata.sources as Array<Record<string, unknown>>)
          : [];
        const etag =
          typeof sources[0]?.etag === "string"
            ? sources[0].etag
            : undefined;

        const firstName =
          typeof payload.firstName === "string"
            ? payload.firstName.trim()
            : "";
        const lastName =
          typeof payload.lastName === "string"
            ? payload.lastName.trim()
            : "";
        const displayName =
          typeof payload.name === "string" && payload.name.trim().length > 0
            ? payload.name.trim()
            : [firstName, lastName].filter(Boolean).join(" ").trim();
        const email =
          typeof payload.email === "string"
            ? payload.email.trim().toLowerCase()
            : "";
        const phone =
          typeof payload.phone === "string" ? payload.phone.trim() : "";
        const company =
          typeof payload.companyName === "string"
            ? payload.companyName.trim()
            : typeof payload.company === "string"
              ? payload.company.trim()
              : "";
        const notes =
          typeof payload.notes === "string" ? payload.notes.trim() : "";

        const updated = await peopleApi.people.updateContact({
          resourceName: contactId,
          updatePersonFields:
            "names,emailAddresses,phoneNumbers,organizations,biographies",
          requestBody: {
            etag,
            names: [
              {
                givenName: firstName || displayName || email,
                familyName: lastName || undefined,
                displayName: displayName || undefined,
              },
            ],
            emailAddresses: email ? [{ value: email }] : undefined,
            phoneNumbers: phone ? [{ value: phone }] : undefined,
            organizations: company ? [{ name: company }] : undefined,
            biographies: notes ? [{ value: notes }] : undefined,
          },
        });

        const mapped = mapGooglePeopleContact(
          (updated.data || {}) as Record<string, unknown>,
        );
        const crmCustomerId = await mirrorGoogleContactToCrm({
          name: mapped.name,
          email: mapped.email,
          phone: mapped.phone,
          company: mapped.company,
          notes,
        });

        return res.json({
          success: true,
          contactId,
          id: mapped.resourceName,
          contact: mapped,
          crmCustomerId,
        });
      } catch (error) {
        console.error("Update Google contact error:", error);
        return res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to update contact",
        });
      }
    },
  );

  app.post(
    "/api/google/people/set-contact-photo/:contactId",
    async (req, res) => {
      try {
        const { contactId } = req.params;
        const payload = (req.body || {}) as Record<string, unknown>;
        const photoUrl =
          typeof payload.photoUrl === "string"
            ? payload.photoUrl.trim()
            : "";
        if (!photoUrl) {
          return res.status(400).json({ error: "photoUrl er påkrevd." });
        }

        const googleClient = await buildGooglePeopleClient(req, payload);
        if (
          !hasAnyStoredGoogleScope(
            googleClient.connection.storedScopes,
            GOOGLE_PEOPLE_WRITE_SCOPES,
          )
        ) {
          return res.status(409).json({
            error:
              "Google Workspace er koblet til, men mangler skrivetilgang til Google Kontakter. Koble Google Workspace på nytt for å oppdatere kontaktbilder.",
          });
        }

        const photoResponse = await fetch(photoUrl);
        if (!photoResponse.ok) {
          return res
            .status(400)
            .json({ error: "Kunne ikke hente kontaktbildet fra angitt URL." });
        }

        const imageBuffer = Buffer.from(await photoResponse.arrayBuffer());
        const peopleApi = google.people({
          version: "v1",
          auth: googleClient.oauthClient,
        });
        await peopleApi.people.updateContactPhoto({
          resourceName: contactId,
          requestBody: {
            photoBytes: imageBuffer.toString("base64"),
          },
        });

        return res.json({ success: true, contactId, photoUrl });
      } catch (error) {
        console.error("Set Google contact photo error:", error);
        return res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to set contact photo",
        });
      }
    },
  );

  app.post(
    "/api/google/people/sync-contacts-to-showcase",
    async (req, res) => {
      try {
        const payload = (req.body || {}) as Record<string, unknown>;
        const googleClient = await buildGooglePeopleClient(req, payload);
        const hasReadScope = hasAnyStoredGoogleScope(
          googleClient.connection.storedScopes,
          GOOGLE_PEOPLE_READ_SCOPES,
        );
        const hasWriteScope = hasAnyStoredGoogleScope(
          googleClient.connection.storedScopes,
          GOOGLE_PEOPLE_WRITE_SCOPES,
        );
        if (!hasReadScope) {
          return res.status(409).json({
            error:
              "Google Workspace er koblet til, men mangler Google Kontakter-tilgang. Koble Google Workspace på nytt for å synkronisere showcase-kontakter.",
          });
        }

        const peopleApi = google.people({
          version: "v1",
          auth: googleClient.oauthClient,
        });
        const existingConnections = await peopleApi.people.connections.list({
          resourceName: "people/me",
          personFields:
            "names,emailAddresses,phoneNumbers,organizations,photos,metadata",
          pageSize: 200,
        });
        const existingContacts = (
          existingConnections.data.connections ?? []
        ).map((person) =>
          mapGooglePeopleContact(person as Record<string, unknown>),
        );
        const existingByEmail = new Map(
          existingContacts
            .filter((contact) => contact.email)
            .map((contact) => [contact.email.toLowerCase(), contact]),
        );

        const showcaseContacts = collectShowcaseContacts(payload);
        const exportedContacts: Array<
          ReturnType<typeof mapGooglePeopleContact>
        > = [];

        if (hasWriteScope) {
          for (const contact of showcaseContacts) {
            if (existingByEmail.has(contact.email.toLowerCase())) {
              continue;
            }

            const [firstName, ...rest] = contact.name.split(" ");
            const created = await peopleApi.people.createContact({
              requestBody: {
                names: [
                  {
                    givenName: firstName || contact.email,
                    familyName: rest.join(" ") || undefined,
                    displayName: contact.name,
                  },
                ],
                emailAddresses: [{ value: contact.email }],
                phoneNumbers: contact.phone
                  ? [{ value: contact.phone }]
                  : undefined,
                organizations: contact.company
                  ? [{ name: contact.company }]
                  : undefined,
                biographies: contact.notes
                  ? [{ value: contact.notes }]
                  : undefined,
              },
            });
            const mapped = mapGooglePeopleContact(
              (created.data || {}) as Record<string, unknown>,
            );
            exportedContacts.push(mapped);
            existingByEmail.set(mapped.email.toLowerCase(), mapped);
            await mirrorGoogleContactToCrm({
              name: mapped.name,
              email: mapped.email,
              phone: mapped.phone,
              company: mapped.company,
              notes: contact.notes,
            });
          }
        }

        const contacts = Array.from(existingByEmail.values())
          .sort((left, right) =>
            left.name.localeCompare(right.name, "nb-NO"),
          )
          .slice(0, 250);

        return res.json({
          success: true,
          contacts,
          importedCount: contacts.length,
          exportedCount: exportedContacts.length,
          showcaseContacts: showcaseContacts.length,
          workspaceEmail: googleClient.connection.googleEmail,
          canExport: hasWriteScope,
        });
      } catch (error) {
        console.error("Showcase Google contacts sync error:", error);
        return res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to sync showcase contacts",
        });
      }
    },
  );
}
