/**
 * nextrole-linkedin-import.ts
 *
 * Parser LinkedIn-data-eksport-ZIP og mapper til NextRole-CV-skjema.
 *
 * Brukerflyt:
 *   1. Bruker går til linkedin.com/mypreferences/d/download-my-data
 *   2. Bestiller "Want something in particular?" → CV-relevante filer
 *      ELLER "The works" (full eksport)
 *   3. Får e-post med ZIP-fil 24t senere
 *   4. Laster ZIP-en opp til NextRole
 *   5. Vi parser, viser preview, brukeren bekrefter
 *
 * Hvilke CSV-filer parseres:
 *   • Profile.csv         → personalInfo (name, headline, summary, location)
 *   • Positions.csv       → experiences (jobTitle, company, dates, description)
 *   • Education.csv       → education (school, degree, field)
 *   • Skills.csv          → skills (name, proficiency)
 *   • Languages.csv       → languages
 *   • Certifications.csv  → certifications
 *
 * LinkedIn endrer CSV-skjemaet av og til — vi prøver multiple header-
 * navn-varianter for robusthet.
 */

import AdmZip from "adm-zip";

// ── CSV-parser (minimal, ingen avhengighet) ────────────────────────
//
// LinkedIn CSV-er bruker standard format med UTF-8, "-quoting og
// komma-separator. Filene har ofte BOM (﻿) i starten.

function parseCsv(text: string): Record<string, string>[] {
  // Fjern BOM hvis tilstede
  const clean = text.replace(/^﻿/, "");
  const lines = splitCsvLines(clean);
  if (lines.length === 0) return [];
  const headers = parseCsvRow(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = parseCsvRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

/** Splitter CSV-tekst i linjer, respekterer "-quoting (linjeskift inni quotes). */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuote = !inQuote;
      buf += ch;
    } else if (ch === "\n" && !inQuote) {
      lines.push(buf);
      buf = "";
    } else if (ch === "\r" && !inQuote) {
      // Hopp over — vi får \n etter
    } else {
      buf += ch;
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

/** Parser én CSV-rad. */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      cells.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  cells.push(buf);
  return cells;
}

// ── Mappings ────────────────────────────────────────────────────────

/** Hent verdi fra rad ved å prøve flere mulige header-navn (LinkedIn endrer disse). */
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

/** Konverter LinkedIn-dato (f.eks. "Jan 2020", "2020-01-01") til ISO. */
function parseDate(s: string): string | null {
  if (!s || !s.trim()) return null;
  // ISO eller delvis ISO
  const isoMatch = s.match(/^(\d{4})(-(\d{2}))?(-(\d{2}))?/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[3] ?? "01";
    const d = isoMatch[5] ?? "01";
    return `${y}-${m}-${d}`;
  }
  // "Jan 2020" / "January 2020"
  const monthMap: Record<string, string> = {
    jan: "01", january: "01", januar: "01",
    feb: "02", february: "02", februar: "02",
    mar: "03", march: "03", mars: "03",
    apr: "04", april: "04",
    may: "05", mai: "05",
    jun: "06", june: "06", juni: "06",
    jul: "07", july: "07", juli: "07",
    aug: "08", august: "08",
    sep: "09", september: "09",
    oct: "10", october: "10", okt: "10", oktober: "10",
    nov: "11", november: "11",
    dec: "12", december: "12", des: "12", desember: "12",
  };
  const monthYear = s.match(/^([A-Za-zÅÆØåæø]+)\s+(\d{4})/);
  if (monthYear) {
    const m = monthMap[monthYear[1].toLowerCase()] ?? "01";
    return `${monthYear[2]}-${m}-01`;
  }
  return null;
}

// ── Hovedmapper ─────────────────────────────────────────────────────

export interface LinkedInImportResult {
  personalInfo?: {
    fullName?: string;
    headline?: string;
    summary?: string;
    location?: string;
    linkedin?: string;
  };
  experiences: Array<{
    jobTitle: string;
    company: string;
    location?: string;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent: boolean;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  skills: Array<{ name: string }>;
  languages: Array<{ name: string; levelLabel?: string }>;
  certifications: Array<{
    name: string;
    issuer?: string;
    issueDate?: string | null;
  }>;
  filesProcessed: string[];
  filesSkipped: string[];
}

/**
 * Parser LinkedIn ZIP-buffer og returnerer strukturert CV-data.
 * Tolererer manglende filer — returnerer det vi finner.
 */
export function parseLinkedInExport(buffer: Buffer): LinkedInImportResult {
  const result: LinkedInImportResult = {
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    filesProcessed: [],
    filesSkipped: [],
  };
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.split("/").pop() ?? "";
    const lower = name.toLowerCase();
    if (!lower.endsWith(".csv")) {
      result.filesSkipped.push(name);
      continue;
    }
    const text = entry.getData().toString("utf8");
    const rows = parseCsv(text);
    if (rows.length === 0) {
      result.filesSkipped.push(name);
      continue;
    }

    // ── Profile ────────────────────────────────────────────────────
    if (lower === "profile.csv" && rows[0]) {
      const r = rows[0];
      const firstName = pick(r, "First Name", "Firstname", "Given Name");
      const lastName = pick(r, "Last Name", "Lastname", "Family Name", "Surname");
      result.personalInfo = {
        fullName: [firstName, lastName].filter(Boolean).join(" ") || undefined,
        headline: pick(r, "Headline") || undefined,
        summary: pick(r, "Summary", "About") || undefined,
        location: pick(r, "Geo Location", "Location", "City") || undefined,
        linkedin: pick(r, "Public Profile URL", "Vanity Name", "Profile URL") || undefined,
      };
      result.filesProcessed.push(name);
      continue;
    }

    // ── Positions / Experience ─────────────────────────────────────
    if (lower === "positions.csv" || lower === "experience.csv") {
      for (const r of rows) {
        const jobTitle = pick(r, "Title", "Position Title", "Job Title");
        const company = pick(r, "Company Name", "Company", "Organization");
        if (!jobTitle || !company) continue;
        const startedOn = pick(r, "Started On", "Start Date", "From");
        const finishedOn = pick(r, "Finished On", "End Date", "To");
        const description = pick(r, "Description");
        const isCurrent = !finishedOn || /present|current|nå|dags dato/i.test(finishedOn);
        result.experiences.push({
          jobTitle,
          company,
          location: pick(r, "Location") || undefined,
          startDate: parseDate(startedOn),
          endDate: isCurrent ? null : parseDate(finishedOn),
          isCurrent,
          description: description || undefined,
        });
      }
      result.filesProcessed.push(name);
      continue;
    }

    // ── Education ──────────────────────────────────────────────────
    if (lower === "education.csv") {
      for (const r of rows) {
        const institution = pick(r, "School Name", "Institution");
        if (!institution) continue;
        result.education.push({
          institution,
          degree: pick(r, "Degree Name", "Degree") || undefined,
          fieldOfStudy: pick(r, "Field Of Study", "Field of Study", "Major") || undefined,
          startDate: parseDate(pick(r, "Start Date", "From")),
          endDate: parseDate(pick(r, "End Date", "To", "Finished On")),
        });
      }
      result.filesProcessed.push(name);
      continue;
    }

    // ── Skills ─────────────────────────────────────────────────────
    if (lower === "skills.csv") {
      for (const r of rows) {
        const skillName = pick(r, "Name", "Skill", "Skill Name");
        if (!skillName) continue;
        result.skills.push({ name: skillName });
      }
      result.filesProcessed.push(name);
      continue;
    }

    // ── Languages ──────────────────────────────────────────────────
    if (lower === "languages.csv") {
      for (const r of rows) {
        const langName = pick(r, "Name", "Language");
        if (!langName) continue;
        const prof = pick(r, "Proficiency", "Level");
        // Map LinkedIn proficiency til våre norske labels
        let label: string | undefined;
        if (/native|morsmål/i.test(prof)) label = "Morsmål";
        else if (/full.*professional|fluent|flytende/i.test(prof)) label = "Flytende";
        else if (/professional|limited.*professional/i.test(prof)) label = "God";
        else if (/elementary|grunnleggende/i.test(prof)) label = "Grunnleggende";
        result.languages.push({ name: langName, levelLabel: label });
      }
      result.filesProcessed.push(name);
      continue;
    }

    // ── Certifications ─────────────────────────────────────────────
    if (lower === "certifications.csv") {
      for (const r of rows) {
        const certName = pick(r, "Name", "Certification Name");
        if (!certName) continue;
        result.certifications.push({
          name: certName,
          issuer: pick(r, "Authority", "Issuer", "Issuing Authority") || undefined,
          issueDate: parseDate(pick(r, "Started On", "Issue Date", "Issued On")),
        });
      }
      result.filesProcessed.push(name);
      continue;
    }

    // Ukjent CSV — hopp over uten å feile
    result.filesSkipped.push(name);
  }

  return result;
}
