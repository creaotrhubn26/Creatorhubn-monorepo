import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateEnv, formatValidationReport } from "../env-validator";

// Test-isolering: snapshot original env, restore etter hver test
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("Sprint B.1 — validateEnv", () => {
  it("rapporterer required-mangel når DATABASE_URL er undefined", () => {
    delete process.env.DATABASE_URL;
    const report = validateEnv();
    const dbReport = report.required.find((r) => r.name === "DATABASE_URL");
    expect(dbReport?.status).toBe("missing");
    expect(report.hasBlockingErrors).toBe(true);
  });

  it("rapporterer required-OK når DATABASE_URL er gyldig postgres-URL", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";
    const report = validateEnv();
    const dbReport = report.required.find((r) => r.name === "DATABASE_URL");
    expect(dbReport?.status).toBe("ok");
    expect(report.hasBlockingErrors).toBe(false);
  });

  it("rapporterer required-invalid når DATABASE_URL er feil format", () => {
    process.env.DATABASE_URL = "mysql://wrong-protocol";
    const report = validateEnv();
    const dbReport = report.required.find((r) => r.name === "DATABASE_URL");
    expect(dbReport?.status).toBe("invalid");
    expect(report.hasBlockingErrors).toBe(true);
  });

  it("tom-streng for DATABASE_URL behandles som mangler", () => {
    process.env.DATABASE_URL = "   ";
    const report = validateEnv();
    expect(report.required[0].status).toBe("missing");
  });

  it("rapporterer recommended-mangel for OPENAI_API_KEY uten å blokkere boot", () => {
    process.env.DATABASE_URL = "postgresql://x:y@z/db";
    delete process.env.OPENAI_API_KEY;
    const report = validateEnv();
    expect(report.hasBlockingErrors).toBe(false);
    expect(report.recommended.find((r) => r.name === "OPENAI_API_KEY")?.status).toBe("missing");
  });

  it("validerer OPENAI_API_KEY-format (må starte med sk-)", () => {
    process.env.DATABASE_URL = "postgresql://x:y@z/db";
    process.env.OPENAI_API_KEY = "wrong-prefix-12345";
    const report = validateEnv();
    expect(report.recommended.find((r) => r.name === "OPENAI_API_KEY")?.status).toBe("invalid");
  });

  it("optional-mangel rapporteres men påvirker ikke hasBlockingErrors", () => {
    process.env.DATABASE_URL = "postgresql://x:y@z/db";
    delete process.env.SENTRY_DSN;
    const report = validateEnv();
    expect(report.hasBlockingErrors).toBe(false);
    expect(report.optional.find((r) => r.name === "SENTRY_DSN")?.status).toBe("missing");
  });
});

describe("Sprint B.1 — formatValidationReport", () => {
  it("formatterer rapport som menneske-lesbart tekst", () => {
    process.env.DATABASE_URL = "postgresql://x:y@z/db";
    const formatted = formatValidationReport(validateEnv());
    expect(formatted).toContain("Environment-validering");
    expect(formatted).toContain("REQUIRED");
    expect(formatted).toContain("RECOMMENDED");
    expect(formatted).toContain("OPTIONAL");
    expect(formatted).toContain("DATABASE_URL");
  });

  it("inkluderer ✅ for OK-vars og 🔴 for missing required", () => {
    delete process.env.DATABASE_URL;
    const formatted = formatValidationReport(validateEnv());
    expect(formatted).toContain("🔴");
    expect(formatted).toContain("DATABASE_URL");
  });
});
