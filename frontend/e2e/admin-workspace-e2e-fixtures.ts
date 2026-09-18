import type { APIRequestContext, Page } from "@playwright/test";
import { buildOppstartApplicationDocument } from "../../backend/server/admin-workspace-funding-opportunities-routes";
import {
  ADMIN_WORKSPACE_API_BASE as BACKEND,
  AUTH_TOKEN,
} from "./admin-workspace-e2e-support";

const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
const OPEN_FIELD = "[MÅ FYLLES UT]";

function replaceSectionOpenFields(
  content: string,
  sectionNumber: number,
  fieldsToKeep: number,
): string {
  const startMarker = `## ${sectionNumber}.`;
  const start = content.indexOf(startMarker);
  if (start < 0) throw new Error(`E2E-søknaden mangler ${startMarker}`);
  const next = content.indexOf(`\n## ${sectionNumber + 1}.`, start);
  const end = next < 0 ? content.length : next;
  let fieldIndex = 0;
  const body = content.slice(start, end).replaceAll(OPEN_FIELD, () => {
    fieldIndex += 1;
    return fieldIndex <= fieldsToKeep
      ? OPEN_FIELD
      : `Dokumentert E2E-underlag ${sectionNumber}.${fieldIndex}`;
  });
  return content.slice(0, start) + body + content.slice(end);
}

function buildVerifiedOppstartE2eDocument(): string {
  let content = buildOppstartApplicationDocument("leadgrid", "2026-09-18");
  const gateStart = content.indexOf("## 0. Kvalifiseringssjekk");
  const sectionOneStart = content.indexOf(
    "## 1. Ideen — problem og kundeinnsikt",
  );
  if (gateStart < 0 || sectionOneStart < 0) {
    throw new Error(
      "E2E-søknadsmalen mangler kvalifisering eller søknadsdeler",
    );
  }
  const qualification = `## 0. Kvalifiseringssjekk

- [x] Creatorhub er etablert som aksjeselskap.
- [x] Selskapet er innenfor ordningens alderskrav.
- [x] Dette er en reell nyetablering.
- [x] Selskapet har ingen betalingsanmerkninger.
- [x] Leadgrid er vesentlig bedre for den valgte kundegruppen.
- [x] Teamet har relevant kompetanse og kapasitet.
- [ ] Kundesamtalene skal dokumenteres i markedsavklaringsprosjektet.
- [ ] Eksterne kostnadstilbud skal innhentes etter eventuelt tilsagn.

`;
  content =
    content.slice(0, gateStart) +
    qualification +
    content.slice(sectionOneStart);

  // Four complete sections and six explicit open fields across the remaining
  // five sections mirror the current, reviewable Leadgrid application state.
  for (const section of [1, 2, 3, 4]) {
    content = replaceSectionOpenFields(content, section, 0);
  }
  for (const [section, fieldsToKeep] of [
    [5, 1],
    [6, 2],
    [7, 1],
    [8, 1],
    [9, 1],
  ] as const) {
    content = replaceSectionOpenFields(content, section, fieldsToKeep);
  }
  return content;
}

export interface OppstartApplicationFixture {
  projectId: string;
  documentId: string;
  fundingAppId: string;
}

async function requireCreatedId(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
  label: string,
): Promise<string> {
  if (response.status() !== 201) {
    throw new Error(
      `${label} feilet med HTTP ${response.status()}: ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { item?: { id?: string } };
  if (!body.item?.id) throw new Error(`${label} returnerte ingen id`);
  return body.item.id;
}

export async function createOppstartApplicationFixture(
  request: APIRequestContext,
): Promise<OppstartApplicationFixture> {
  let projectId: string | null = null;
  let documentId: string | null = null;
  try {
    const stamp = Date.now();
    projectId = await requireCreatedId(
      await request.post(`${BACKEND}/workspace/projects`, {
        headers,
        data: {
          title: `E2E Oppstartstilskudd-plan ${stamp}`,
          summary: "Isolert Playwright-fixture for søknadsarbeidsflaten.",
          productKey: "leadgrid",
          category: "funding",
          status: "active",
        },
      }),
      "Opprettelse av E2E-prosjekt",
    );
    documentId = await requireCreatedId(
      await request.post(`${BACKEND}/workspace/documents`, {
        headers,
        data: {
          title: "Oppstartstilskudd 1 — Leadgrid markedsavklaring",
          summary: "Isolert søknadsutkast for Playwright.",
          productKey: "leadgrid",
          documentType: "funding_application",
          dueDate: "2026-09-18",
          tags: ["innovasjon-norge", "oppstartstilskudd-1", "e2e"],
          content: buildVerifiedOppstartE2eDocument(),
        },
      }),
      "Opprettelse av E2E-søknadsdokument",
    );

    for (const [fileName, externalUrl] of [
      [
        "leadgrid-oppstartstilskudd-1-report-source.md",
        "https://example.com/e2e/leadgrid-report-source",
      ],
      [
        "Innovasjon Norge — Veiledning til Oppstartstilskudd 1",
        "https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1",
      ],
      ["E2E — Team og CV-underlag", "https://example.com/e2e/team-cv-source"],
    ] as const) {
      const attachmentResponse = await request.post(
        `${BACKEND}/workspace/documents/${documentId}/files/external`,
        { headers, data: { fileName, externalUrl, sourceKind: "external" } },
      );
      if (attachmentResponse.status() !== 201) {
        throw new Error(
          `Opprettelse av E2E-vedlegg feilet med HTTP ${attachmentResponse.status()}: ${await attachmentResponse.text()}`,
        );
      }
    }

    return {
      projectId,
      documentId,
      // FundingDeadlineRadar only needs a stable string for this non-navigated
      // plan field; reusing the fixture project UUID avoids a phantom DB row.
      fundingAppId: projectId,
    };
  } catch (error) {
    if (documentId) {
      await request.delete(`${BACKEND}/workspace/documents/${documentId}`, {
        headers,
      });
    }
    if (projectId) {
      await request.delete(`${BACKEND}/workspace/projects/${projectId}`, {
        headers,
      });
    }
    throw error;
  }
}

export async function cleanupOppstartApplicationFixture(
  request: APIRequestContext,
  fixture: OppstartApplicationFixture | null,
): Promise<void> {
  if (!fixture) return;
  const documentResponse = await request.delete(
    `${BACKEND}/workspace/documents/${fixture.documentId}`,
    { headers },
  );
  if (!documentResponse.ok() && documentResponse.status() !== 404) {
    throw new Error(
      `Opprydding av E2E-dokument feilet med HTTP ${documentResponse.status()}`,
    );
  }
  const projectResponse = await request.delete(
    `${BACKEND}/workspace/projects/${fixture.projectId}`,
    { headers },
  );
  if (!projectResponse.ok() && projectResponse.status() !== 404) {
    throw new Error(
      `Opprydding av E2E-prosjekt feilet med HTTP ${projectResponse.status()}`,
    );
  }
}

export async function installOppstartPlanResponseOverride(
  page: Page,
  fixture: OppstartApplicationFixture,
): Promise<void> {
  await page.route(
    "**/api/admin-room/workspace/funding-opportunities**",
    async (route) => {
      const response = await route.fetch();
      const contentType = response.headers()["content-type"] ?? "";
      if (!response.ok() || !contentType.includes("application/json")) {
        await route.fulfill({ response });
        return;
      }
      const body = (await response.json()) as {
        items?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(body.items)) {
        body.items = body.items.map((item) => {
          if (item.catalog_key !== "innovation-norway-startup-grant-1")
            return item;
          const metadata =
            item.metadata &&
            typeof item.metadata === "object" &&
            !Array.isArray(item.metadata)
              ? (item.metadata as Record<string, unknown>)
              : {};
          return {
            ...item,
            metadata: {
              ...metadata,
              applicationPlan: {
                ...fixture,
                taskIds: [],
                targetDate: "2026-09-18",
                createdAt: new Date().toISOString(),
              },
            },
          };
        });
      }
      await route.fulfill({ response, json: body });
    },
  );
}
