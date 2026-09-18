import assert from "node:assert/strict";
import test from "node:test";
import {
  CV_GAP_QUESTIONS,
  extractCvClaims,
  renderCvMarkdown,
} from "./admin-workspace-cv-service";

test("extractCvClaims groups uploaded CV facts and preserves provenance", () => {
  const claims = extractCvClaims(
    `# Profil\n\nDaniel Qazi\nOperativ gründer med erfaring fra salg og IT.\n\n# Erfaring\n\nLeadgrid\nUtviklet kode og design.\n\nUkjent sluttdato – må bekreftes.\n\n# Kompetanse\n\nSalg og innholdsproduksjon`,
    "https://www.linkedin.com/in/daniel-qazi-67a64760/",
  );

  assert.ok(claims.length >= 4);
  assert.equal(claims.find((claim) => claim.label === "Leadgrid")?.category, "experience");
  assert.equal(
    claims.find((claim) => claim.evidenceText.includes("må bekreftes"))?.verificationStatus,
    "needs_confirmation",
  );
  assert.ok(claims.every((claim) => claim.sourceUrl?.includes("linkedin.com/in/")));
});

test("extractCvClaims ignores source wrapper boilerplate", () => {
  const claims = extractCvClaims(
    `Kildetype: LinkedIn-profil\n\nProfil: https://www.linkedin.com/in/person/\n\n# Erfaring\n\nDaglig leder`,
    null,
  );

  assert.deepEqual(claims.map((claim) => claim.label), ["Daglig leder"]);
});

test("extractCvClaims turns long source paragraphs into readable titles and categories", () => {
  const claims = extractCvClaims(
    `# Offentlig grunnlag\n\nNoroff, høyere fagskolegrad, oppført 2026–2027. Profilen beskriver dataanalyse, SQL og databaser, Python, dashboards og datadrevet beslutningsstøtte som del av utdanningen.\n\nContent Marketing, HubSpot Academy, utstedt mars 2023, oppført utløpt april 2025.`,
    null,
  );

  assert.equal(claims[0].category, "education");
  assert.equal(claims[0].label, "Noroff, høyere fagskolegrad, oppført 2026–2027.");
  assert.match(claims[0].description || "", /dataanalyse/u);
  assert.equal(claims[1].category, "certification");
});

test("renderCvMarkdown excludes rejected claims and exposes open gaps", () => {
  const content = renderCvMarkdown(
    {
      person_name: "Daniel Qazi",
      headline: "Gründer og produktutvikler",
      professional_summary: "Operativ i Leadgrid.",
      source_url: "https://www.linkedin.com/in/daniel-qazi-67a64760/",
      source_checked_at: "2026-08-29T12:00:00.000Z",
    },
    [
      {
        category: "experience",
        label: "Leadgrid",
        description: "Kode og design.",
        verification_status: "user_confirmed",
      },
      {
        category: "award",
        label: "Skal ikke med",
        verification_status: "rejected",
      },
    ],
    [
      { question: "Når startet arbeidet?", answer: null, status: "open" },
      { question: "Arbeidsomfang?", answer: "100 %", status: "answered" },
    ],
  );

  assert.match(content, /Leadgrid/);
  assert.match(content, /Bekreftet/);
  assert.doesNotMatch(content, /Skal ikke med/);
  assert.match(content, /\[ \] Når startet arbeidet\?/);
  assert.match(content, /100 %/);
  assert.equal(CV_GAP_QUESTIONS.filter((question) => question.required).length, 4);
});
