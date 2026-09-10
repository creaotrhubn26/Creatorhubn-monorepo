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
  representedCompanyOrganizationNumber?: unknown;
  representedCompanyBusinessAddress?: unknown;
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

function formatOrganizationNumber(value: unknown): string {
  const digits = receiptText(value, 40).replace(/\D/g, "");
  return /^\d{9}$/.test(digits)
    ? digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : receiptText(value, 80) || "Ikke oppgitt";
}

function signatureMethodLabel(value: string | null): string {
  switch (value) {
    case "email_otp_typed_name":
      return "E-postkode + skrevet navn";
    case "typed_name_legacy":
      return "Skrevet navn (eldre elektronisk aksept)";
    default:
      return value ? receiptText(value, 120) : "Elektronisk aksept";
  }
}

function agreementLabel(key: unknown): string {
  switch (key) {
    case "program_terms":
      return "Programvilkår";
    case "nda":
      return "Konfidensialitetsavtale (NDA)";
    case "dpa":
      return "Databehandleravtale";
    case "letter_of_intent":
      return "Intensjonsavtale";
    default:
      return "Avtaledokument";
  }
}

function bindingNatureLabel(value: unknown): string {
  return value === "non_binding" ? "Ikke-bindende" : "Bindende";
}

function abbreviatedId(value: unknown): string {
  const id = receiptText(value, 100);
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

function displayDigest(value: unknown): string {
  return (
    receiptText(value, 64)
      .match(/.{1,16}/g)
      ?.join("  ") || "Ikke registrert"
  );
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
    ? (candidate.documents as ReceiptDocument[])
    : [];
  const agreementKeys = new Set([
    "program_terms",
    "nda",
    "dpa",
    "letter_of_intent",
  ]);
  const actualKeys = new Set(
    documents.map((document) => String(document?.key || "")),
  );
  const completeSnapshot =
    documents.length === agreementKeys.size &&
    actualKeys.size === agreementKeys.size &&
    [...agreementKeys].every((key) => actualKeys.has(key)) &&
    documents.every(
      (document) =>
        typeof document?.title === "string" &&
        document.title.trim().length > 0 &&
        typeof document?.version === "string" &&
        document.version.trim().length > 0 &&
        typeof document?.content === "string" &&
        document.content.trim().length > 0,
    ) &&
    typeof candidate.signerName === "string" &&
    candidate.signerName.trim().length >= 2 &&
    typeof candidate.signerEmail === "string" &&
    candidate.signerEmail.includes("@") &&
    candidate.confirmedSigningAuthority === true &&
    !Number.isNaN(new Date(String(candidate.acceptedAt || "")).getTime());
  if (!completeSnapshot) return false;
  const expected = String(expectedDigest ?? "")
    .trim()
    .toLowerCase();
  return (
    /^[a-f0-9]{64}$/.test(expected) &&
    prototypeTesterAgreementDigest(snapshot) === expected
  );
}

export function buildPrototypeTesterSigningReceiptPdf(
  input: PrototypeTesterSigningReceiptInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      info: {
        Title: "CreatorHub signeringskvittering",
        Author: "CreatorHub Norge",
        Creator: "CreatorHub avtale- og signeringssystem",
        Producer: "CreatorHub Norge",
        Subject: `Prototype-testeravtaler ${receiptText(input.receiptId, 80)}`,
        Keywords:
          "CreatorHub, signeringskvittering, elektronisk signatur, prototype-tester",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const L = 52;
    const R = PW - 52;
    const W = R - L;
    const FOOTER_Y = PH - 38;
    const BODY_BOTTOM = PH - 62;

    const COLOR = {
      navy: "#101828",
      ink: "#182230",
      text: "#344054",
      muted: "#667085",
      faint: "#98A2B3",
      line: "#E4E7EC",
      panel: "#F8FAFC",
      warm: "#FFF7ED",
      accent: "#F79009",
      accentDark: "#B54708",
      green: "#067647",
      greenSoft: "#ECFDF3",
      greenLine: "#ABEFC6",
      blue: "#175CD3",
      blueSoft: "#EFF8FF",
      white: "#FFFFFF",
    } as const;

    const documents = Array.isArray(input.snapshot.documents)
      ? (input.snapshot.documents as ReceiptDocument[])
      : [];
    const signatureLabel = signatureMethodLabel(input.signatureMethod);
    const acceptedAtLabel = formatReceiptTimestamp(input.snapshot.acceptedAt);
    const verifiedAtLabel = input.emailVerifiedAt
      ? formatReceiptTimestamp(input.emailVerifiedAt)
      : "Ikke registrert (eldre aksept)";

    const drawCreatorHubMark = (
      x: number,
      y: number,
      size: number,
      color = COLOR.accent,
    ) => {
      doc.save();
      doc.translate(x, y).scale(size / 128);
      doc.lineWidth(12).lineCap("round").lineJoin("round").strokeColor(color);
      doc
        .path(
          "M77 24C60.6 18.1 41.6 21.7 28.8 34.6C11.7 51.6 11.7 79.4 28.8 96.4C41.6 109.3 60.6 112.9 77 107",
        )
        .stroke();
      doc.path("M79 35V93").stroke();
      doc.path("M103 35V93").stroke();
      doc.path("M79 64H103").stroke();
      doc.restore();
    };

    const drawBrandLockup = (
      x: number,
      y: number,
      options: { inverse?: boolean; compact?: boolean } = {},
    ) => {
      const inverse = options.inverse === true;
      const compact = options.compact === true;
      const markSize = compact ? 28 : 38;
      drawCreatorHubMark(x, y, markSize);
      const wordmarkX = x + markSize + (compact ? 10 : 13);
      doc
        .fillColor(inverse ? COLOR.white : COLOR.navy)
        .font("Helvetica-Bold")
        .fontSize(compact ? 10.5 : 13)
        .text("CREATORHUB · NORGE", wordmarkX, y + (compact ? 4 : 6), {
          lineBreak: false,
        });
      doc
        .fillColor(inverse ? "#D0D5DD" : COLOR.muted)
        .font("Helvetica")
        .fontSize(compact ? 6.2 : 7.2)
        .text(
          "PROFESJONELL KREATIV PLATTFORM",
          wordmarkX,
          y + (compact ? 17 : 24),
          {
            lineBreak: false,
            characterSpacing: compact ? 0.7 : 1,
          },
        );
    };

    const drawPill = (
      x: number,
      y: number,
      label: string,
      background: string,
      foreground: string,
      options: { align?: "left" | "right"; minWidth?: number } = {},
    ): number => {
      doc.font("Helvetica-Bold").fontSize(7.6);
      const width = Math.max(
        options.minWidth || 0,
        doc.widthOfString(label) + 20,
      );
      const left = options.align === "right" ? x - width : x;
      doc.roundedRect(left, y, width, 19, 9.5).fill(background);
      doc.fillColor(foreground).text(label, left + 10, y + 5.2, {
        width: width - 20,
        align: "center",
        lineBreak: false,
      });
      return width;
    };

    const drawSectionLabel = (
      label: string,
      x: number,
      y: number,
      width = W,
    ) => {
      doc.roundedRect(x, y + 1, 3, 15, 1.5).fill(COLOR.accent);
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(label, x + 12, y, { width: width - 12, lineBreak: false });
    };

    const drawMetadataValue = (
      x: number,
      y: number,
      width: number,
      label: string,
      value: unknown,
    ) => {
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .text(label.toUpperCase(), x, y, {
          width,
          lineBreak: false,
          characterSpacing: 0.7,
        });
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(receiptText(value, 500) || "—", x, y + 13, {
          width,
          ellipsis: true,
        });
    };

    const drawInfoCard = (
      x: number,
      y: number,
      width: number,
      height: number,
      title: string,
      rows: Array<{ label: string; value: unknown }>,
    ) => {
      doc
        .roundedRect(x, y, width, height, 9)
        .fillAndStroke(COLOR.panel, COLOR.line);
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(title, x + 15, y + 15, { width: width - 30, lineBreak: false });
      let cursorY = y + 38;
      for (const row of rows) {
        doc
          .fillColor(COLOR.muted)
          .font("Helvetica-Bold")
          .fontSize(6.6)
          .text(row.label.toUpperCase(), x + 15, cursorY, {
            width: width - 30,
            lineBreak: false,
            characterSpacing: 0.55,
          });
        doc.fillColor(COLOR.text).font("Helvetica").fontSize(8.7);
        const value = receiptText(row.value, 500) || "—";
        const valueY = cursorY + 10;
        const valueHeight = Math.min(
          doc.heightOfString(value, { width: width - 30, lineGap: 1 }),
          30,
        );
        doc.text(value, x + 15, valueY, {
          width: width - 30,
          height: valueHeight,
          lineGap: 1,
          ellipsis: true,
        });
        cursorY = valueY + valueHeight + 8;
      }
    };

    const drawEvidenceCard = (
      x: number,
      y: number,
      width: number,
      label: string,
      value: string,
      verified = true,
    ) => {
      doc
        .roundedRect(x, y, width, 82, 8)
        .fillAndStroke(
          verified ? COLOR.greenSoft : COLOR.panel,
          verified ? COLOR.greenLine : COLOR.line,
        );
      doc.circle(x + 17, y + 19, 8).fill(verified ? COLOR.green : COLOR.faint);
      if (verified) {
        doc
          .moveTo(x + 13.5, y + 19)
          .lineTo(x + 16, y + 21.5)
          .lineTo(x + 20.8, y + 16.4)
          .lineWidth(1.35)
          .lineCap("round")
          .lineJoin("round")
          .strokeColor(COLOR.white)
          .stroke();
      } else {
        doc
          .moveTo(x + 13.5, y + 19)
          .lineTo(x + 20.5, y + 19)
          .lineWidth(1.2)
          .lineCap("round")
          .strokeColor(COLOR.white)
          .stroke();
      }
      doc
        .fillColor(verified ? COLOR.green : COLOR.muted)
        .font("Helvetica-Bold")
        .fontSize(6.6)
        .text(label.toUpperCase(), x + 31, y + 15, {
          width: width - 43,
          lineBreak: false,
          characterSpacing: 0.55,
        });
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .text(value, x + 13, y + 38, {
          width: width - 26,
          height: 34,
          lineGap: 1.5,
          ellipsis: true,
        });
    };

    const paintPage = (color = COLOR.white) => {
      doc.rect(0, 0, PW, PH).fill(color);
    };

    const drawCompactHeader = (rightLabel: string, rightReference?: string) => {
      paintPage();
      doc.rect(0, 0, PW, 6).fill(COLOR.accent);
      drawBrandLockup(L, 25, { compact: true });
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(rightLabel.toUpperCase(), L, 28, {
          width: W,
          align: "right",
          lineBreak: false,
          characterSpacing: 0.65,
        });
      if (rightReference) {
        doc
          .fillColor(COLOR.faint)
          .font("Helvetica")
          .fontSize(7)
          .text(rightReference, L, 43, {
            width: W,
            align: "right",
            lineBreak: false,
          });
      }
      doc
        .moveTo(L, 74)
        .lineTo(R, 74)
        .lineWidth(0.7)
        .strokeColor(COLOR.line)
        .stroke();
    };

    const drawSummaryPage = () => {
      paintPage(COLOR.white);
      doc.rect(0, 0, PW, 208).fill(COLOR.navy);
      doc.rect(0, 0, PW, 7).fill(COLOR.accent);
      drawBrandLockup(L, 31, { inverse: true });
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text("SIGNERINGSKVITTERING", L, 38, {
          width: W,
          align: "right",
          lineBreak: false,
          characterSpacing: 0.8,
        });

      doc
        .fillColor(COLOR.white)
        .font("Helvetica-Bold")
        .fontSize(23)
        .text("Kvittering for elektronisk signering", L, 101, {
          width: W,
          lineBreak: false,
        });
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica")
        .fontSize(10)
        .text(
          "Prototype-testerprogrammet · dokumentert aksept av komplett avtalegrunnlag",
          L,
          140,
          { width: W, lineBreak: false },
        );
      drawPill(L, 172, "AKSEPT BEKREFTET", COLOR.greenSoft, COLOR.green);

      drawMetadataValue(L, 230, 235, "Kvitterings-ID", input.receiptId);
      drawMetadataValue(L + 255, 230, W - 255, "Akseptert", acceptedAtLabel);
      doc
        .moveTo(L, 274)
        .lineTo(R, 274)
        .lineWidth(0.7)
        .strokeColor(COLOR.line)
        .stroke();

      drawSectionLabel("Partene", L, 292);
      const cardGap = 14;
      const cardWidth = (W - cardGap) / 2;
      drawInfoCard(L, 318, cardWidth, 132, "Signatar", [
        { label: "Navn", value: input.snapshot.signerName },
        { label: "E-post", value: input.snapshot.signerEmail },
      ]);
      drawInfoCard(
        L + cardWidth + cardGap,
        318,
        cardWidth,
        132,
        "Representert virksomhet",
        [
          {
            label: "Juridisk navn",
            value: input.snapshot.representedCompany || "Ikke oppgitt",
          },
          {
            label: "Organisasjonsnummer",
            value: input.snapshot.representedCompanyOrganizationNumber
              ? formatOrganizationNumber(
                  input.snapshot.representedCompanyOrganizationNumber,
                )
              : "Ikke oppgitt",
          },
          {
            label: "Forretningsadresse",
            value:
              input.snapshot.representedCompanyBusinessAddress ||
              "Ikke oppgitt",
          },
        ],
      );

      drawSectionLabel("Dokumentert beviskjede", L, 475);
      const evidenceGap = 10;
      const evidenceWidth = (W - evidenceGap * 2) / 3;
      drawEvidenceCard(
        L,
        501,
        evidenceWidth,
        "E-post verifisert",
        verifiedAtLabel,
        Boolean(input.emailVerifiedAt),
      );
      drawEvidenceCard(
        L + evidenceWidth + evidenceGap,
        501,
        evidenceWidth,
        "Signeringsmetode",
        signatureLabel,
      );
      drawEvidenceCard(
        L + (evidenceWidth + evidenceGap) * 2,
        501,
        evidenceWidth,
        "Signeringsfullmakt",
        input.snapshot.confirmedSigningAuthority === true
          ? "Bekreftet av signatar"
          : "Ikke registrert",
        input.snapshot.confirmedSigningAuthority === true,
      );

      doc.roundedRect(L, 613, W, 104, 9).fillAndStroke(COLOR.warm, "#FEDF89");
      doc
        .fillColor(COLOR.accentDark)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(
          `${documents.length}/4 avtaledokumenter kontrollert`,
          L + 16,
          630,
          {
            width: W - 32,
            lineBreak: false,
          },
        );
      doc
        .fillColor(COLOR.text)
        .font("Helvetica")
        .fontSize(8.8)
        .text(
          "Kvitteringen gjengir den uforanderlige avtalesnapshoten som ble lagret ved aksept. Kontrollsummen på neste side kan brukes til å påvise senere endringer i dokumentsettet.",
          L + 16,
          649,
          { width: W - 32, lineGap: 2 },
        );
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica")
        .fontSize(7.8)
        .text(
          `Prototypeperioden er registrert til ${formatReceiptTimestamp(input.programEndsAt)}.`,
          L + 16,
          692,
          {
            width: W - 32,
            lineBreak: false,
          },
        );
    };

    const drawControlPage = () => {
      doc.addPage();
      drawCompactHeader(
        "Kontroll- og dokumentdetaljer",
        `Ref. ${abbreviatedId(input.receiptId)}`,
      );
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("Kontroll- og dokumentdetaljer", L, 105, { width: W });
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica")
        .fontSize(9.5)
        .text(
          "Teknisk integritetsbevis og oversikt over dokumentene som inngår i aksepten.",
          L,
          139,
          {
            width: W,
          },
        );

      doc.roundedRect(L, 177, W, 118, 10).fillAndStroke(COLOR.navy, COLOR.navy);
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .text("INTEGRITETSKONTROLL · SHA-256", L + 17, 194, {
          width: W - 34,
          lineBreak: false,
          characterSpacing: 0.7,
        });
      doc
        .fillColor(COLOR.white)
        .font("Courier-Bold")
        .fontSize(8.5)
        .text(displayDigest(input.agreementDigest), L + 17, 216, {
          width: W - 34,
          lineGap: 5,
        });
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          "Kontrollsummen gjelder hele den lagrede avtalesnapshoten, inkludert dokumenttekst og signataropplysninger.",
          L + 17,
          269,
          {
            width: W - 34,
            lineBreak: false,
          },
        );

      drawSectionLabel("Dokumentsett", L, 326);
      let rowY = 352;
      for (const [index, agreement] of documents.entries()) {
        const rowHeight = 55;
        doc
          .roundedRect(L, rowY, W, rowHeight, 8)
          .fillAndStroke(
            index % 2 === 0 ? COLOR.panel : COLOR.white,
            COLOR.line,
          );
        doc.circle(L + 23, rowY + rowHeight / 2, 13).fill(COLOR.navy);
        doc
          .fillColor(COLOR.white)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(String(index + 1), L + 16, rowY + 22, {
            width: 14,
            align: "center",
            lineBreak: false,
          });
        doc
          .fillColor(COLOR.ink)
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .text(agreementLabel(agreement.key), L + 47, rowY + 12, {
            width: 295,
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .fillColor(COLOR.muted)
          .font("Helvetica")
          .fontSize(7.7)
          .text(receiptText(agreement.title, 300), L + 47, rowY + 29, {
            width: 295,
            lineBreak: false,
            ellipsis: true,
          });
        drawPill(
          R - 12,
          rowY + 18,
          `v${receiptText(agreement.version, 40)} · ${bindingNatureLabel(agreement.bindingNature)}`,
          agreement.bindingNature === "non_binding"
            ? COLOR.blueSoft
            : COLOR.greenSoft,
          agreement.bindingNature === "non_binding" ? COLOR.blue : COLOR.green,
          { align: "right" },
        );
        rowY += rowHeight + 7;
      }

      doc
        .roundedRect(L, 617, W, 86, 9)
        .fillAndStroke(COLOR.blueSoft, "#B2DDFF");
      doc
        .fillColor(COLOR.blue)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text("Signaturnivå", L + 16, 633, { width: W - 32, lineBreak: false });
      doc
        .fillColor(COLOR.text)
        .font("Helvetica")
        .fontSize(8.5)
        .text(
          "Enkel elektronisk signatur. Aksepten er dokumentert med e-postkode, skrevet navn, tidspunkt, fullmaktserklæring, dokumentversjoner og kontrollsum. Dette er ikke BankID eller en kvalifisert elektronisk signatur.",
          L + 16,
          651,
          { width: W - 32, lineGap: 2 },
        );

      doc
        .moveTo(L, 731)
        .lineTo(R, 731)
        .lineWidth(0.7)
        .strokeColor(COLOR.line)
        .stroke();
      drawMetadataValue(L, 743, 235, "Invitasjons-ID", input.inviteId);
      drawMetadataValue(
        L + 255,
        743,
        W - 255,
        "Kvitterings-ID",
        input.receiptId,
      );
    };

    const isAgreementHeading = (line: string): boolean => {
      if (/^\d+\.\s+\S/.test(line)) return true;
      if (/^VEDLEGG\s+[A-ZÆØÅ0-9]+\s*[—-]/.test(line)) return true;
      if (
        [
          "PARTER",
          "MELLOM:",
          "PARTER OG ROLLER",
          "PARTER, KONTAKT OG ROLLER",
        ].includes(line.toUpperCase())
      ) {
        return true;
      }
      return (
        line.length <= 110 &&
        /[A-ZÆØÅ]/.test(line) &&
        !/[a-zæøå]/.test(line) &&
        !line.startsWith("•")
      );
    };

    const drawAgreementHeader = (
      agreement: ReceiptDocument,
      index: number,
      continuation: boolean,
    ): number => {
      drawCompactHeader(
        `Avtale ${index + 1} av ${documents.length}${continuation ? " · fortsettelse" : ""}`,
        `Ref. ${abbreviatedId(input.receiptId)}`,
      );
      if (continuation) {
        doc
          .fillColor(COLOR.ink)
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(agreementLabel(agreement.key), L, 96, {
            width: W - 130,
            lineBreak: false,
            ellipsis: true,
          });
        drawPill(
          R,
          93,
          `v${receiptText(agreement.version, 40)}`,
          COLOR.panel,
          COLOR.text,
          { align: "right" },
        );
        doc
          .moveTo(L, 122)
          .lineTo(R, 122)
          .lineWidth(0.7)
          .strokeColor(COLOR.line)
          .stroke();
        return 143;
      }

      doc.circle(L + 17, 112, 17).fill(COLOR.navy);
      doc
        .fillColor(COLOR.white)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(String(index + 1), L + 8, 107, {
          width: 18,
          align: "center",
          lineBreak: false,
        });
      doc
        .fillColor(COLOR.accentDark)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(agreementLabel(agreement.key).toUpperCase(), L + 45, 97, {
          width: W - 45,
          lineBreak: false,
          characterSpacing: 0.7,
        });
      const title = receiptText(agreement.title, 300);
      doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(19);
      const titleHeight = Math.min(
        doc.heightOfString(title, { width: W - 45, lineGap: 1 }),
        52,
      );
      doc.text(title, L + 45, 113, {
        width: W - 45,
        height: titleHeight,
        lineGap: 1,
        ellipsis: true,
      });
      const metaY = 121 + titleHeight;
      drawPill(
        L + 45,
        metaY,
        `VERSJON ${receiptText(agreement.version, 40)}`,
        COLOR.warm,
        COLOR.accentDark,
      );
      drawPill(
        L + 142,
        metaY,
        bindingNatureLabel(agreement.bindingNature).toUpperCase(),
        agreement.bindingNature === "non_binding"
          ? COLOR.blueSoft
          : COLOR.greenSoft,
        agreement.bindingNature === "non_binding" ? COLOR.blue : COLOR.green,
      );
      const ruleY = metaY + 35;
      doc
        .moveTo(L, ruleY)
        .lineTo(R, ruleY)
        .lineWidth(0.9)
        .strokeColor(COLOR.line)
        .stroke();
      return ruleY + 22;
    };

    const drawAgreement = (agreement: ReceiptDocument, index: number) => {
      doc.addPage();
      let y = drawAgreementHeader(agreement, index, false);
      const rawLines = receiptText(agreement.content, 500_000)
        .replace(/\r/g, "")
        .split("\n");
      const firstLine = rawLines[0]?.trim() || "";
      const duplicateDocumentHeading =
        isAgreementHeading(firstLine) ||
        /\(v\d+(?:\.\d+)*\)\s*$/i.test(firstLine);
      const lines = duplicateDocumentHeading ? rawLines.slice(1) : rawLines;

      const newContinuationPage = () => {
        doc.addPage();
        y = drawAgreementHeader(agreement, index, true);
      };

      const ensureSpace = (requiredHeight: number) => {
        if (y + requiredHeight > BODY_BOTTOM) newContinuationPage();
      };

      for (const sourceLine of lines) {
        const line = sourceLine.trim();
        if (!line) {
          y += 3;
          continue;
        }

        if (line.startsWith("•")) {
          const bulletText = line.replace(/^•\s*/, "");
          doc.font("Helvetica").fontSize(9.2);
          const height =
            doc.heightOfString(bulletText, { width: W - 24, lineGap: 2 }) + 3;
          ensureSpace(height);
          doc.circle(L + 5, y + 6, 2.2).fill(COLOR.accent);
          doc
            .fillColor(COLOR.text)
            .font("Helvetica")
            .fontSize(9.2)
            .text(bulletText, L + 18, y, { width: W - 18, lineGap: 2 });
          y += height;
          continue;
        }

        if (isAgreementHeading(line)) {
          doc.font("Helvetica-Bold").fontSize(10.5);
          const height =
            doc.heightOfString(line, { width: W - 16, lineGap: 1 }) + 12;
          // Keep a section heading with at least a few lines of its following
          // paragraph instead of leaving the heading orphaned above the footer.
          ensureSpace(height + 45);
          y += 4;
          doc
            .roundedRect(L, y + 1, 3, Math.max(13, height - 10), 1.5)
            .fill(COLOR.accent);
          doc
            .fillColor(COLOR.ink)
            .font("Helvetica-Bold")
            .fontSize(10.5)
            .text(line, L + 13, y, { width: W - 13, lineGap: 1 });
          y += height - 7;
          continue;
        }

        doc.font("Helvetica").fontSize(9.2);
        const height = doc.heightOfString(line, { width: W, lineGap: 2.6 }) + 3;
        ensureSpace(height);
        doc
          .fillColor(COLOR.text)
          .font("Helvetica")
          .fontSize(9.2)
          .text(line, L, y, { width: W, lineGap: 2.6, align: "left" });
        y += height;
      }
    };

    drawSummaryPage();
    drawControlPage();
    for (const [index, agreement] of documents.entries()) {
      drawAgreement(agreement, index);
    }

    const range = doc.bufferedPageRange();
    for (
      let pageIndex = range.start;
      pageIndex < range.start + range.count;
      pageIndex += 1
    ) {
      doc.switchToPage(pageIndex);
      doc
        .moveTo(L, FOOTER_Y - 10)
        .lineTo(R, FOOTER_Y - 10)
        .lineWidth(0.6)
        .strokeColor(COLOR.line)
        .stroke();
      doc
        .fillColor(COLOR.faint)
        .font("Helvetica")
        .fontSize(6.8)
        .text(
          `CreatorHub Norge · Kvittering ${abbreviatedId(input.receiptId)}`,
          L,
          FOOTER_Y,
          { width: W - 80, lineBreak: false },
        );
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .text(`SIDE ${pageIndex + 1} / ${range.count}`, R - 80, FOOTER_Y, {
          width: 80,
          align: "right",
          lineBreak: false,
        });
    }

    doc.end();
  });
}
