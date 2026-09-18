import crypto from "node:crypto";
import { createRequire } from "node:module";
import type { Pool } from "pg";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const MAX_CHUNK_CHARACTERS = 1_800;
const CHUNK_OVERLAP_CHARACTERS = 220;
const MAX_EXTRACTED_CHARACTERS = 1_000_000;
const MAX_PDF_OCR_PAGES = 5;
const OCR_TIMEOUT_MS = 45_000;
const MAX_OFFICE_ARCHIVE_ENTRIES = 5_000;
const MAX_OFFICE_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const requireAdminContextModule = createRequire(import.meta.url);

export type ContextExtractionStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "unsupported"
  | "external";

export interface ExtractedContextSegment {
  content: string;
  sectionLabel: string | null;
  pageNumber: number | null;
  metadata?: Record<string, unknown>;
}

export interface ContextChunk extends ExtractedContextSegment {
  chunkIndex: number;
  contentHash: string;
}

export interface ContextCandidate {
  sourceType: "workspace_document" | "file" | "project_file";
  sourceDocumentId: string | null;
  sourceFileId: string | null;
  sourceProjectFileId: string | null;
  sourceTitle: string;
  originDocumentTitle: string;
  sectionLabel: string | null;
  pageNumber: number | null;
  chunkIndex: number;
  content: string;
}

export interface ContextSuggestion extends ContextCandidate {
  id: string;
  excerpt: string;
  suggestedText: string;
  matchedTerms: string[];
  relevance: number;
  reason: string;
}

export interface ContextQuery {
  documentTitle: string;
  documentType: string;
  sectionHeading: string | null;
  selectedText: string | null;
  nearbyText: string;
  currentDocumentContent: string;
}

interface ExtractionResult {
  method: string;
  segments: ExtractedContextSegment[];
  metadata: Record<string, unknown>;
}

export interface IndexedContextFileResult {
  status: ContextExtractionStatus;
  method: string | null;
  error: string | null;
  chunkCount: number;
  characterCount: number;
  metadata: Record<string, unknown>;
}

class UnsupportedContextFileError extends Error {}

function normalizedText(value: string): string {
  return value
    .split("\u0000")
    .join("")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v]+/gu, " ")
    .replace(/[ ]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);
}

function sectionHeading(line: string): string | null {
  const markdown = line.match(/^#{1,4}\s+(.+)$/u);
  if (markdown) return markdown[1].trim().slice(0, 255);
  const clean = line.trim().replace(/:$/u, "");
  if (
    clean.length >= 3 &&
    clean.length <= 90 &&
    !/[.!?]$/u.test(clean) &&
    (/^[A-ZÆØÅ][A-ZÆØÅ0-9 /&–—-]+$/u.test(clean) || /^\d+(?:\.\d+)*\s+\S/u.test(clean))
  ) {
    return clean.slice(0, 255);
  }
  return null;
}

function splitSegment(segment: ExtractedContextSegment): ExtractedContextSegment[] {
  const text = normalizedText(segment.content);
  if (!text) return [];
  if (text.length <= MAX_CHUNK_CHARACTERS) return [{ ...segment, content: text }];

  const chunks: ExtractedContextSegment[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + MAX_CHUNK_CHARACTERS);
    if (end < text.length) {
      const sentence = Math.max(
        text.lastIndexOf(". ", end),
        text.lastIndexOf("\n", end),
        text.lastIndexOf("; ", end),
      );
      if (sentence > start + 650) end = sentence + 1;
    }
    const content = text.slice(start, end).trim();
    if (content) chunks.push({ ...segment, content });
    if (end >= text.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARACTERS);
  }
  return chunks;
}

export function chunkContextText(
  text: string,
  input: { pageNumber?: number | null; sectionLabel?: string | null } = {},
): ContextChunk[] {
  const normalized = normalizedText(text);
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const sections: ExtractedContextSegment[] = [];
  let activeHeading = input.sectionLabel ?? null;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) {
      sections.push({
        content,
        sectionLabel: activeHeading,
        pageNumber: input.pageNumber ?? null,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = sectionHeading(line);
    if (heading && buffer.some((value) => value.trim())) {
      flush();
      activeHeading = heading;
      buffer.push(line);
    } else {
      if (heading) activeHeading = heading;
      buffer.push(line);
    }
  }
  flush();

  return sections
    .flatMap(splitSegment)
    .map((segment, index) => ({
      ...segment,
      chunkIndex: index,
      contentHash: crypto.createHash("sha256").update(segment.content).digest("hex"),
    }));
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} tok for lang tid`)), OCR_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function validateOfficeArchive(buffer: Buffer, label: string): Promise<void> {
  const AdmZip = requireAdminContextModule("adm-zip") as new (input: Buffer) => {
    getEntries: () => Array<{ header?: { size?: number }; entryName?: string }>;
  };
  const archive = new AdmZip(buffer);
  const entries = archive.getEntries();
  if (entries.length > MAX_OFFICE_ARCHIVE_ENTRIES) {
    throw new Error(`${label} inneholder for mange arkivelementer`);
  }
  const uncompressedBytes = entries.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.header?.size) || 0),
    0,
  );
  if (uncompressedBytes > MAX_OFFICE_UNCOMPRESSED_BYTES) {
    throw new Error(`${label} er for stor etter utpakking`);
  }
}

async function recognizeImage(buffer: Buffer, label: string): Promise<string> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const prepared = await sharp(buffer, { failOn: "none", limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: 1_800, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 0.7 })
    .png()
    .toBuffer();
  const tesseract = await import("tesseract.js") as unknown as {
    createWorker: (languages?: string, oem?: number, options?: Record<string, unknown>) => Promise<{
      recognize: (input: Buffer) => Promise<{ data?: { text?: string } }>;
      terminate: () => Promise<void>;
    }>;
    OEM?: { LSTM_ONLY?: number };
  };
  const worker = await withTimeout(
    tesseract.createWorker("nor+eng", tesseract.OEM?.LSTM_ONLY ?? 1, { logger: () => undefined }),
    `OCR-klargjøring for ${label}`,
  );
  try {
    const result = await withTimeout(worker.recognize(prepared), `OCR av ${label}`);
    return normalizedText(result.data?.text ?? "");
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

async function extractPdf(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
  const pdfParse = await import("pdf-parse") as unknown as {
    PDFParse: new (input: { data: Buffer }) => {
      getText: (options?: Record<string, unknown>) => Promise<{
        text?: string;
        total?: number;
        pages?: Array<{ text?: string; num?: number; pageNumber?: number }>;
      }>;
      getScreenshot: (options?: Record<string, unknown>) => Promise<{
        pages?: Array<{ data?: Uint8Array; pageNumber?: number }>;
        total?: number;
      }>;
      destroy: () => Promise<void>;
    };
  };
  const parser = new pdfParse.PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ pageJoiner: "\n\n" });
    const pages = result.pages ?? [];
    const embeddedSegments = pages
      .map((page, index) => ({
        content: normalizedText(page.text ?? ""),
        sectionLabel: null,
        pageNumber: page.pageNumber ?? page.num ?? index + 1,
      }))
      .filter((segment) => segment.content);
    const embeddedText = normalizedText(result.text ?? embeddedSegments.map((item) => item.content).join("\n\n"));
    if (embeddedText.length >= 80) {
      return {
        method: "pdf-parse",
        segments: embeddedSegments.length
          ? embeddedSegments
          : [{ content: embeddedText, sectionLabel: null, pageNumber: null }],
        metadata: { pageCount: (result.total ?? pages.length) || null, usedOcr: false },
      };
    }

    const screenshots = await parser.getScreenshot({
      first: MAX_PDF_OCR_PAGES,
      imageBuffer: true,
      imageDataUrl: false,
      desiredWidth: 1_800,
    });
    const ocrSegments: ExtractedContextSegment[] = [];
    for (const [index, page] of (screenshots.pages ?? []).entries()) {
      if (!page.data?.length) continue;
      const content = await recognizeImage(Buffer.from(page.data), `${fileName}, side ${index + 1}`);
      if (content) {
        ocrSegments.push({
          content,
          sectionLabel: null,
          pageNumber: page.pageNumber ?? index + 1,
          metadata: { ocr: true },
        });
      }
    }
    if (!ocrSegments.length) throw new Error("Fant ingen lesbar tekst i PDF-filen");
    return {
      method: "pdf-ocr",
      segments: ocrSegments,
      metadata: { pageCount: screenshots.total ?? null, pagesProcessed: ocrSegments.length, usedOcr: true },
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractFileContent(
  buffer: Buffer,
  mimeType: string | null,
  fileName: string,
): Promise<ExtractionResult> {
  const mime = mimeType ?? "";
  const lower = fileName.toLocaleLowerCase("nb-NO");
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    return extractPdf(buffer, fileName);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    await validateOfficeArchive(buffer, "DOCX-filen");
    const result = await mammoth.extractRawText({ buffer });
    const content = normalizedText(result.value);
    if (!content) throw new Error("Fant ingen lesbar tekst i DOCX-filen");
    return {
      method: "mammoth-docx",
      segments: [{ content, sectionLabel: null, pageNumber: null }],
      metadata: { warnings: result.messages.map((message) => message.message).slice(0, 10) },
    };
  }
  if (mime === "application/msword" || lower.endsWith(".doc")) {
    throw new UnsupportedContextFileError("Gamle .doc-filer må konverteres til DOCX eller PDF");
  }
  if (
    mime.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel" ||
    /\.(xlsx?|xlsm)$/u.test(lower)
  ) {
    if (/\.(xlsx|xlsm)$/u.test(lower) || mime.includes("openxmlformats")) {
      await validateOfficeArchive(buffer, "Regnearket");
    }
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const segments = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      return {
        content: normalizedText(XLSX.utils.sheet_to_csv(sheet, { blankrows: false })),
        sectionLabel: name.slice(0, 255),
        pageNumber: null,
        metadata: { sheet: name },
      };
    }).filter((segment) => segment.content);
    if (!segments.length) throw new Error("Regnearket inneholder ingen lesbar tekst");
    return { method: "xlsx", segments, metadata: { sheetCount: segments.length } };
  }
  if (mime.startsWith("text/") || /\.(txt|md|csv)$/u.test(lower)) {
    const content = normalizedText(buffer.toString("utf8"));
    if (!content) throw new Error("Tekstfilen er tom");
    return {
      method: "plain-text",
      segments: [{ content, sectionLabel: null, pageNumber: null }],
      metadata: {},
    };
  }
  if (mime === "image/png" || mime === "image/jpeg" || /\.(png|jpe?g)$/u.test(lower)) {
    const content = await recognizeImage(buffer, fileName);
    if (!content) throw new Error("OCR fant ingen lesbar tekst i bildet");
    return {
      method: "tesseract-ocr",
      segments: [{ content, sectionLabel: null, pageNumber: 1, metadata: { ocr: true } }],
      metadata: { usedOcr: true },
    };
  }
  throw new UnsupportedContextFileError("Filtypen kan lagres, men støttes ikke som tekstkilde");
}

export async function indexAdminDocumentFile(input: {
  pool: Pool;
  fileId: string;
  documentId: string;
  userId: string;
  fileName: string;
  mimeType: string | null;
  buffer: Buffer;
}): Promise<IndexedContextFileResult> {
  const { pool, fileId, documentId, userId, fileName, mimeType, buffer } = input;
  await pool.query(
    `UPDATE admin_document_files
        SET extraction_status = 'processing', extraction_error = NULL
      WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3`,
    [fileId, documentId, userId],
  );
  try {
    const extraction = await extractFileContent(buffer, mimeType, fileName);
    const chunks = extraction.segments.flatMap((segment) =>
      chunkContextText(segment.content, {
        pageNumber: segment.pageNumber,
        sectionLabel: segment.sectionLabel,
      }).map((chunk) => ({ ...chunk, metadata: segment.metadata ?? {} })),
    ).map((chunk, chunkIndex) => ({ ...chunk, chunkIndex }));
    if (!chunks.length) throw new Error("Fant ingen tekst som kunne indekseres");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM admin_document_context_chunks
          WHERE file_id::text = $1 AND user_id::text = $2`,
        [fileId, userId],
      );
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO admin_document_context_chunks
             (file_id, document_id, user_id, chunk_index, section_label,
              page_number, content, content_hash, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          [
            fileId,
            documentId,
            userId,
            chunk.chunkIndex,
            chunk.sectionLabel,
            chunk.pageNumber,
            chunk.content,
            chunk.contentHash,
            JSON.stringify(chunk.metadata ?? {}),
          ],
        );
      }
      const characterCount = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      const metadata = {
        ...extraction.metadata,
        chunkCount: chunks.length,
        characterCount,
      };
      await client.query(
        `UPDATE admin_document_files
            SET extraction_status = 'ready', extraction_method = $4,
                extraction_error = NULL, extraction_metadata = $5::jsonb,
                extracted_at = NOW()
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3`,
        [fileId, documentId, userId, extraction.method, JSON.stringify(metadata)],
      );
      await client.query("COMMIT");
      return {
        status: "ready",
        method: extraction.method,
        error: null,
        chunkCount: chunks.length,
        characterCount,
        metadata,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const unsupported = error instanceof UnsupportedContextFileError;
    const message = (error instanceof Error ? error.message : "Ukjent uttrekksfeil").slice(0, 500);
    await pool.query(
      `UPDATE admin_document_files
          SET extraction_status = $4, extraction_method = NULL,
              extraction_error = $5, extraction_metadata = '{}'::jsonb,
              extracted_at = NOW()
        WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3`,
      [fileId, documentId, userId, unsupported ? "unsupported" : "failed", message],
    );
    return {
      status: unsupported ? "unsupported" : "failed",
      method: null,
      error: message,
      chunkCount: 0,
      characterCount: 0,
      metadata: {},
    };
  }
}

export async function indexAdminWorkspaceProjectFile(input: {
  pool: Pool;
  fileId: string;
  projectId: string;
  userId: string;
  fileName: string;
  mimeType: string | null;
  buffer: Buffer;
}): Promise<IndexedContextFileResult> {
  const { pool, fileId, projectId, userId, fileName, mimeType, buffer } = input;
  await pool.query(
    `UPDATE admin_workspace_project_files
        SET extraction_status = 'processing', extraction_error = NULL,
            updated_at = NOW()
      WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3`,
    [fileId, projectId, userId],
  );
  try {
    const extraction = await extractFileContent(buffer, mimeType, fileName);
    const chunks = extraction.segments.flatMap((segment) =>
      chunkContextText(segment.content, {
        pageNumber: segment.pageNumber,
        sectionLabel: segment.sectionLabel,
      }).map((chunk) => ({ ...chunk, metadata: segment.metadata ?? {} })),
    ).map((chunk, chunkIndex) => ({ ...chunk, chunkIndex }));
    if (!chunks.length) throw new Error("Fant ingen tekst som kunne indekseres");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM admin_workspace_project_file_chunks
          WHERE project_file_id::text = $1 AND user_id::text = $2`,
        [fileId, userId],
      );
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO admin_workspace_project_file_chunks
             (project_file_id, project_id, user_id, chunk_index, section_label,
              page_number, content, content_hash, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          [
            fileId,
            projectId,
            userId,
            chunk.chunkIndex,
            chunk.sectionLabel,
            chunk.pageNumber,
            chunk.content,
            chunk.contentHash,
            JSON.stringify(chunk.metadata ?? {}),
          ],
        );
      }
      const characterCount = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      const metadata = {
        ...extraction.metadata,
        chunkCount: chunks.length,
        characterCount,
      };
      await client.query(
        `UPDATE admin_workspace_project_files
            SET extraction_status = 'ready', extraction_method = $4,
                extraction_error = NULL, extraction_metadata = $5::jsonb,
                extracted_at = NOW(), updated_at = NOW()
          WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3`,
        [fileId, projectId, userId, extraction.method, JSON.stringify(metadata)],
      );
      await client.query("COMMIT");
      return {
        status: "ready",
        method: extraction.method,
        error: null,
        chunkCount: chunks.length,
        characterCount,
        metadata,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const unsupported = error instanceof UnsupportedContextFileError;
    const message = (error instanceof Error ? error.message : "Ukjent uttrekksfeil").slice(0, 500);
    await pool.query(
      `UPDATE admin_workspace_project_files
          SET extraction_status = $4, extraction_method = NULL,
              extraction_error = $5, extraction_metadata = '{}'::jsonb,
              extracted_at = NOW(), updated_at = NOW()
        WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3`,
      [fileId, projectId, userId, unsupported ? "unsupported" : "failed", message],
    );
    return {
      status: unsupported ? "unsupported" : "failed",
      method: null,
      error: message,
      chunkCount: 0,
      characterCount: 0,
      metadata: {},
    };
  }
}

const STOP_WORDS = new Set([
  "alle", "andre", "at", "av", "bare", "ble", "blir", "den", "denne", "det", "dette",
  "du", "eller", "en", "er", "et", "for", "fra", "har", "her", "hva", "hvor", "hvordan",
  "i", "ikke", "kan", "med", "mot", "og", "om", "på", "skal", "som", "til", "ved", "vi",
  "vil", "beskriv", "gjennomfore", "prosjekt", "prosjektet", "the", "and", "for", "from",
  "that", "this", "with", "your", "you", "our",
]);

const INTENT_EXPANSIONS: Array<{ test: RegExp; terms: string[] }> = [
  { test: /team|kompetanse|gjennomføring|erfaring|grunnlegger|founder/iu, terms: ["erfaring", "kompetanse", "rolle", "bakgrunn", "utdanning", "salg", "markedsføring", "teknologi", "it", "ledelse"] },
  { test: /marked|kunde|behov|betalingsvilje|pilot/iu, terms: ["kunde", "marked", "behov", "intervju", "pilot", "betaling", "problem", "målgruppe", "etterspørsel"] },
  { test: /konkurrent|alternativ|fortrinn|innovasjon|løsning/iu, terms: ["konkurrent", "alternativ", "forskjell", "innovasjon", "teknologi", "løsning", "produkt", "fordel"] },
  { test: /økonomi|budsjett|kostnad|finans|kapital/iu, terms: ["budsjett", "kostnad", "finansiering", "egenkapital", "investor", "kapital", "pris", "inntekt"] },
  { test: /eier|selskap|organisasjon/iu, terms: ["eier", "eierandel", "aksje", "selskap", "organisasjonsnummer", "styre"] },
  { test: /plan|milepæl|aktivitet|fremdrift|risiko/iu, terms: ["milepæl", "aktivitet", "frist", "ansvar", "risiko", "leveranse", "tidslinje", "prosjekt"] },
];

function tokens(value: string): string[] {
  return value
    .toLocaleLowerCase("nb-NO")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .match(/[a-z0-9æøå]{2,}/gu)
    ?.filter((token) => !STOP_WORDS.has(token)) ?? [];
}

function matchingQueryTerms(queryTokens: string[], candidateTokens: Set<string>): string[] {
  const candidateList = [...candidateTokens];
  return queryTokens.filter((queryToken) => {
    if (candidateTokens.has(queryToken)) return true;
    if (queryToken.length < 5) return false;
    return candidateList.some((candidateToken) =>
      candidateToken.length >= 5 &&
      (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)),
    );
  });
}

function excerptAroundMatches(content: string, matchedTerms: string[]): string {
  const clean = normalizedText(content);
  if (clean.length <= 900) return clean;
  const lower = clean.toLocaleLowerCase("nb-NO");
  const positions = matchedTerms.map((term) => lower.indexOf(term)).filter((position) => position >= 0);
  const matchPosition = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, matchPosition - 260);
  let end = Math.min(clean.length, start + 900);
  if (start > 0) {
    const boundary = Math.max(clean.lastIndexOf(". ", start), clean.lastIndexOf("\n", start));
    if (boundary >= 0) start = boundary + 1;
  }
  if (end < clean.length) {
    const boundary = clean.indexOf(". ", end - 100);
    if (boundary > 0 && boundary < end + 160) end = boundary + 1;
  }
  return `${start > 0 ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`;
}

export function rankContextCandidates(
  candidates: ContextCandidate[],
  query: ContextQuery,
  limit = 8,
): ContextSuggestion[] {
  const primaryQueryText = [
    query.sectionHeading ?? "",
    query.selectedText ?? "",
  ].join(" ");
  const localQueryText = [primaryQueryText, query.nearbyText].join(" ");
  const fallbackQueryText = localQueryText.trim()
    ? localQueryText
    : `${query.documentTitle} ${query.documentType}`;
  const primaryTokenSet = new Set(tokens(primaryQueryText.trim() || fallbackQueryText));
  const nearbyTokenSet = new Set(tokens(query.nearbyText));
  for (const intent of INTENT_EXPANSIONS) {
    if (intent.test.test(primaryQueryText.trim() || fallbackQueryText)) {
      intent.terms.forEach((term) => primaryTokenSet.add(term));
    } else if (intent.test.test(query.nearbyText)) {
      intent.terms.forEach((term) => nearbyTokenSet.add(term));
    }
  }
  const primaryTokens = [...primaryTokenSet].slice(0, 50);
  const nearbyTokens = [...nearbyTokenSet]
    .filter((token) => !primaryTokenSet.has(token))
    .slice(0, 70);
  const currentNormalized = normalizedText(query.currentDocumentContent)
    .toLocaleLowerCase("nb-NO")
    .replace(/\s+/gu, " ");

  return candidates
    .map((candidate) => {
      const searchable = `${candidate.sourceTitle} ${candidate.sectionLabel ?? ""} ${candidate.content}`;
      const candidateTokens = new Set(tokens(searchable));
      const primaryMatchedTerms = matchingQueryTerms(primaryTokens, candidateTokens);
      const nearbyMatchedTerms = matchingQueryTerms(nearbyTokens, candidateTokens)
        .filter((term) => !primaryMatchedTerms.includes(term));
      const matchedTerms = [...primaryMatchedTerms, ...nearbyMatchedTerms];
      const headingTokens = new Set(tokens(candidate.sectionLabel ?? ""));
      const headingMatches = matchedTerms.filter((token) => headingTokens.has(token)).length;
      const exactSectionBoost = query.sectionHeading && candidate.sectionLabel
        ? tokens(query.sectionHeading).filter((token) => tokens(candidate.sectionLabel ?? "").includes(token)).length
        : 0;
      const denominator = Math.max(5, Math.sqrt(candidateTokens.size));
      const primaryDensity = primaryMatchedTerms.length * 2 / denominator;
      const nearbyDensity = nearbyMatchedTerms.length * (primaryMatchedTerms.length ? 0.35 : 0.5) / denominator;
      const sectionPenalty = query.sectionHeading && primaryMatchedTerms.length === 0 ? 0.55 : 1;
      const rawScore = (
        primaryDensity + nearbyDensity + headingMatches * 0.16 + exactSectionBoost * 0.12
      ) * sectionPenalty;
      const excerpt = excerptAroundMatches(candidate.content, matchedTerms);
      const excerptFingerprint = normalizedText(excerpt.replace(/^…|…$/gu, ""))
        .toLocaleLowerCase("nb-NO")
        .replace(/\s+/gu, " ")
        .slice(0, 180);
      const alreadyPresent = excerptFingerprint.length >= 90 && currentNormalized.includes(excerptFingerprint);
      return { candidate, matchedTerms, rawScore, excerpt, alreadyPresent };
    })
    .filter((item) => item.rawScore >= 0.12 && !item.alreadyPresent)
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, Math.max(1, Math.min(limit, 12)))
    .map(({ candidate, matchedTerms, rawScore, excerpt }) => {
      const reasonTerms = matchedTerms.slice(0, 4);
      const id = crypto.createHash("sha256").update([
        candidate.sourceType,
        candidate.sourceDocumentId ?? "",
        candidate.sourceFileId ?? "",
        candidate.sourceProjectFileId ?? "",
        String(candidate.chunkIndex),
        excerpt,
      ].join(":"), "utf8").digest("hex").slice(0, 32);
      return {
        ...candidate,
        id,
        excerpt,
        suggestedText: excerpt.replace(/^…|…$/gu, "").trim(),
        matchedTerms: reasonTerms,
        relevance: Math.round(Math.min(0.99, 0.42 + rawScore / 2.4) * 100) / 100,
        reason: reasonTerms.length
          ? `Kilden omtaler ${reasonTerms.join(", ")}, som er relevant her.`
          : "Kilden samsvarer med teksten og seksjonen du arbeider i.",
      };
    });
}
