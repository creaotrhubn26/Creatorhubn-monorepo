import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { canonicalJsonStringify } from "../../frontend/shared/prototype-tester-agreements.ts";

type ReceiptDocument = {
  key?: unknown;
  title?: unknown;
  version?: unknown;
  content?: unknown;
  bindingNature?: unknown;
};

type ReceiptSnapshot = {
  schemaVersion?: unknown;
  acceptedAt?: unknown;
  signerName?: unknown;
  signerEmail?: unknown;
  representedCompany?: unknown;
  confirmedSigningAuthority?: unknown;
  signatureMethod?: unknown;
  emailVerifiedAt?: unknown;
  documents?: unknown;
};

export interface PrototypeTesterSigningReceiptInput {
  receiptId: string;
  inviteId: string;
  snapshot: ReceiptSnapshot;
  agreementDigest: string;
  signatureMethod: string | null;
  emailVerifiedAt: Date | string | null;
  programEndsAt: Date | string | null;
}

function receiptText(value: unknown, maxLength = 20_000): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, maxLength);
}

function formatReceiptTimestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Ikke registrert";
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Europe/Oslo",
  }).format(date);
}

function signatureMethodLabel(value: string | null): string {
  switch (value) {
    case "email_otp_typed_name":
      return "E-postkode og skrevet navn";
    case "typed_name_legacy":
      return "Skrevet navn (eldre elektronisk aksept)";
    default:
      return value ? receiptText(value, 120) : "Elektronisk aksept";
  }
}

export function prototypeTesterAgreementDigest(snapshot: unknown): string {
  return crypto
    .createHash("sha256")
    .update(canonicalJsonStringify(snapshot), "utf8")
    .digest("hex");
}

export function isPrototypeTesterReceiptSnapshotValid(
  snapshot: unknown,
  expectedDigest: unknown,
): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const candidate = snapshot as ReceiptSnapshot;
  const documents = Array.isArray(candidate.documents)
    ? candidate.documents as ReceiptDocument[]
    : [];
  const agreementKeys = new Set(["program_terms", "nda", "dpa", "letter_of_intent"]);
  const actualKeys = new Set(documents.map((document) => String(document?.key || "")));
  const completeSnapshot =
    documents.length === agreementKeys.size &&
    actualKeys.size === agreementKeys.size &&
    [...agreementKeys].every((key) => actualKeys.has(key)) &&
    documents.every((document) =>
      typeof document?.title === "string" && document.title.trim().length > 0 &&
      typeof document?.version === "string" && document.version.trim().length > 0 &&
      typeof document?.content === "string" && document.content.trim().length > 0
    ) &&
    typeof candidate.signerName === "string" && candidate.signerName.trim().length >= 2 &&
    typeof candidate.signerEmail === "string" && candidate.signerEmail.includes("@") &&
    candidate.confirmedSigningAuthority === true &&
    !Number.isNaN(new Date(String(candidate.acceptedAt || "")).getTime());
  if (!completeSnapshot) return false;
  const expected = String(expectedDigest ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(expected)
    && prototypeTesterAgreementDigest(snapshot) === expected;
}

export function buildPrototypeTesterSigningReceiptPdf(
  input: PrototypeTesterSigningReceiptInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      bufferPages: true,
      info: {
        Title: "CreatorHub signeringskvittering",
        Author: "CreatorHub Norge",
        Subject: `Prototype-testeravtaler ${receiptText(input.receiptId, 80)}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 108;
    const accent = "#ff8c00";
    const ink = "#17120d";
    const muted = "#665e55";
    const line = "#e4ddd4";

    const addHeader = (label: string) => {
      doc.rect(0, 0, pageWidth, 7).fill(accent);
      doc
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(15)
        .text("CreatorHub Norge", 54, 30, { width: contentWidth });
      doc
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8.5)
        .text(label.toUpperCase(), 54, 34, {
          width: contentWidth,
          align: "right",
        });
      doc.moveTo(54, 58).lineTo(pageWidth - 54, 58).strokeColor(line).stroke();
      doc.y = 78;
    };

    const metadataRow = (label: string, value: unknown) => {
      const y = doc.y;
      doc.fillColor(muted).font("Helvetica").fontSize(9).text(label, 54, y, {
        width: 150,
      });
      doc
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(receiptText(value, 500) || "—", 205, y, {
          width: pageWidth - 259,
        });
      doc.y = Math.max(doc.y, y + 14) + 5;
    };

    addHeader("Signeringskvittering");
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(25)
      .text("Kvittering for elektronisk signering");
    doc
      .moveDown(0.45)
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(10.5)
      .text(
        "Dokumentet bekrefter hvilken avtaletekst som ble akseptert, av hvem og med hvilken integritetskontroll.",
        { lineGap: 2 },
      );
    doc.moveDown(1.1);

    metadataRow("Kvitterings-ID", input.receiptId);
    metadataRow("Invitasjons-ID", input.inviteId);
    metadataRow("Signatar", input.snapshot.signerName);
    metadataRow("E-post", input.snapshot.signerEmail);
    metadataRow("Virksomhet", input.snapshot.representedCompany || "Ikke oppgitt");
    metadataRow("Signert", formatReceiptTimestamp(input.snapshot.acceptedAt));
    metadataRow(
      "E-post verifisert",
      input.emailVerifiedAt
        ? formatReceiptTimestamp(input.emailVerifiedAt)
        : "Ikke registrert (eldre aksept)",
    );
    metadataRow("Signeringsmetode", signatureMethodLabel(input.signatureMethod));
    metadataRow(
      "Signeringsfullmakt",
      input.snapshot.confirmedSigningAuthority === true ? "Bekreftet" : "Ikke registrert",
    );
    metadataRow("Testperiode til", formatReceiptTimestamp(input.programEndsAt));

    doc.moveDown(0.5);
    doc
      .roundedRect(54, doc.y, contentWidth, 82, 8)
      .fillAndStroke("#fff7ec", "#f3c58e");
    const digestY = doc.y + 14;
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Integritetskontroll (SHA-256)", 68, digestY, {
        width: contentWidth - 28,
      });
    doc
      .fillColor(muted)
      .font("Courier")
      .fontSize(8)
      .text(receiptText(input.agreementDigest, 64), 68, digestY + 20, {
        width: contentWidth - 28,
        lineGap: 2,
      });
    doc.y = digestY + 84;

    const documents = Array.isArray(input.snapshot.documents)
      ? (input.snapshot.documents as ReceiptDocument[])
      : [];
    for (const [index, agreement] of documents.entries()) {
      doc.addPage();
      addHeader(`Avtaledokument ${index + 1} av ${documents.length}`);
      doc
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(19)
        .text(receiptText(agreement.title, 300));
      doc
        .moveDown(0.25)
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(9)
        .text(
          `Versjon ${receiptText(agreement.version, 40)} · ${
            agreement.bindingNature === "non_binding" ? "Ikke-bindende" : "Bindende"
          }`,
        );
      doc.moveDown(1);
      doc
        .fillColor(ink)
        .font("Helvetica")
        .fontSize(9.5)
        .text(receiptText(agreement.content, 500_000), {
          width: contentWidth,
          lineGap: 3,
          align: "left",
        });
    }

    const range = doc.bufferedPageRange();
    for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      doc
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          `CreatorHub Norge · ${receiptText(input.receiptId, 80)} · Side ${pageIndex + 1}/${range.count}`,
          54,
          doc.page.height - 36,
          { width: contentWidth, align: "center", lineBreak: false },
        );
    }

    doc.end();
  });
}
