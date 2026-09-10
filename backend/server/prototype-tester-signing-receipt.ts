import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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

let cachedCreatorHubWordmarkPath: string | null = null;

function loadCreatorHubWordmarkPath(): string {
  if (cachedCreatorHubWordmarkPath) return cachedCreatorHubWordmarkPath;

  const fileName = "creatorhub-wordmark-light.png";
  const candidates = [
    path.resolve(process.cwd(), "../frontend/client/public", fileName),
    path.resolve(process.cwd(), "frontend/client/public", fileName),
    path.resolve(process.cwd(), "client/public", fileName),
  ];
  const assetPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!assetPath) {
    throw new Error("CreatorHub-wordmarken mangler fra deploypakken");
  }

  cachedCreatorHubWordmarkPath = assetPath;
  return cachedCreatorHubWordmarkPath;
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
    const L = 54;
    const R = PW - 54;
    const W = R - L;
    const FOOTER_Y = PH - 38;
    const BODY_BOTTOM = PH - 62;

    const COLOR = {
      navy: "#0B1426",
      ink: "#172033",
      text: "#364152",
      muted: "#667085",
      faint: "#98A2B3",
      line: "#D9E0EA",
      panel: "#F6F8FB",
      warm: "#FFF4E5",
      accent: "#FF9500",
      accentDark: "#C85E00",
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
    const creatorHubWordmarkPath = loadCreatorHubWordmarkPath();
    const signatureLabel = signatureMethodLabel(input.signatureMethod);
    const acceptedAtLabel = formatReceiptTimestamp(input.snapshot.acceptedAt);
    const verifiedAtLabel = input.emailVerifiedAt
      ? formatReceiptTimestamp(input.emailVerifiedAt)
      : "Ikke registrert (eldre aksept)";

    const drawBrandLockup = (
      x: number,
      y: number,
      options: { compact?: boolean } = {},
    ) => {
      const compact = options.compact === true;
      doc.image(creatorHubWordmarkPath, x, y, { width: compact ? 142 : 186 });
    };

    const drawCheckBadge = (
      x: number,
      y: number,
      options: { size?: number; background?: string } = {},
    ) => {
      const size = options.size || 18;
      const radius = size / 2;
      doc
        .circle(x + radius, y + radius, radius)
        .fill(options.background || COLOR.green);
      doc
        .moveTo(x + size * 0.27, y + size * 0.52)
        .lineTo(x + size * 0.43, y + size * 0.68)
        .lineTo(x + size * 0.76, y + size * 0.32)
        .lineWidth(Math.max(1.2, size * 0.08))
        .lineCap("round")
        .lineJoin("round")
        .strokeColor(COLOR.white)
        .stroke();
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
        .roundedRect(x, y, width, height, 8)
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
      doc.rect(0, 0, PW, 72).fill(COLOR.navy);
      doc.rect(0, 0, PW, 6).fill(COLOR.accent);
      drawBrandLockup(L, 15, { compact: true });
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(rightLabel.toUpperCase(), L, 21, {
          width: W,
          align: "right",
          lineBreak: false,
          characterSpacing: 0.65,
        });
      if (rightReference) {
        doc
          .fillColor("#98A2B3")
          .font("Helvetica")
          .fontSize(7)
          .text(rightReference, L, 37, {
            width: W,
            align: "right",
            lineBreak: false,
          });
      }
      doc
        .moveTo(L, 84)
        .lineTo(R, 84)
        .lineWidth(0.7)
        .strokeColor(COLOR.line)
        .stroke();
    };

    const drawSummaryPage = () => {
      paintPage(COLOR.white);
      doc.rect(0, 0, PW, 226).fill(COLOR.navy);
      doc.rect(0, 0, PW, 7).fill(COLOR.accent);
      drawBrandLockup(L, 25);
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text("SIGNERINGSBEVIS · PROTOTYPEPROGRAMMET", L, 38, {
          width: W,
          align: "right",
          lineBreak: false,
          characterSpacing: 0.8,
        });

      doc
        .fillColor(COLOR.white)
        .font("Helvetica-Bold")
        .fontSize(28)
        .text("Elektronisk signering bekreftet", L, 104, {
          width: W,
          lineBreak: false,
        });
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica")
        .fontSize(10.2)
        .text(
          "Fire dokumenter er akseptert og samlet i én kontrollerbar avtaleversjon.",
          L,
          148,
          { width: W, lineBreak: false },
        );
      drawPill(L, 178, "VERIFISERT AKSEPT", COLOR.greenSoft, COLOR.green);

      // The signer certificate deliberately overlaps the hero. This gives the
      // legal act visual priority and keeps identity, time and method together.
      doc
        .roundedRect(L, 203, W, 160, 11)
        .fillAndStroke(COLOR.white, COLOR.line);
      drawCheckBadge(L + 18, 221, { size: 22 });
      doc
        .fillColor(COLOR.green)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text("ELEKTRONISK SIGNERT AV", L + 50, 222, {
          width: 230,
          characterSpacing: 0.7,
          lineBreak: false,
        });
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(receiptText(input.snapshot.signerName, 200) || "—", L + 50, 240, {
          width: 230,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica")
        .fontSize(8.5)
        .text(
          receiptText(input.snapshot.signerEmail, 320) || "—",
          L + 50,
          263,
          {
            width: 230,
            lineBreak: false,
            ellipsis: true,
          },
        );

      const certificateDividerX = L + 286;
      doc
        .moveTo(certificateDividerX, 220)
        .lineTo(certificateDividerX, 282)
        .lineWidth(0.7)
        .strokeColor(COLOR.line)
        .stroke();
      drawMetadataValue(
        certificateDividerX + 18,
        221,
        W - 322,
        "Akseptert",
        acceptedAtLabel,
      );
      drawMetadataValue(
        certificateDividerX + 18,
        258,
        W - 322,
        "Metode",
        signatureLabel,
      );

      doc
        .moveTo(L + 18, 296)
        .lineTo(R - 18, 296)
        .lineWidth(0.7)
        .strokeColor(COLOR.line)
        .stroke();
      drawMetadataValue(
        L + 18,
        311,
        300,
        "Representert virksomhet",
        input.snapshot.representedCompany || "Ikke oppgitt",
      );
      drawMetadataValue(
        L + 338,
        311,
        W - 356,
        "Organisasjonsnummer",
        input.snapshot.representedCompanyOrganizationNumber
          ? formatOrganizationNumber(
              input.snapshot.representedCompanyOrganizationNumber,
            )
          : "Ikke oppgitt",
      );

      drawSectionLabel("Dokumentgrunnlag", L, 391);
      const tileGap = 10;
      const tileWidth = (W - tileGap) / 2;
      for (const [index, agreement] of documents.entries()) {
        const tileX = L + (index % 2) * (tileWidth + tileGap);
        const tileY = 418 + Math.floor(index / 2) * 65;
        doc
          .roundedRect(tileX, tileY, tileWidth, 55, 8)
          .fillAndStroke(COLOR.panel, COLOR.line);
        doc.circle(tileX + 22, tileY + 27.5, 12).fill(COLOR.navy);
        doc
          .fillColor(COLOR.white)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(String(index + 1), tileX + 15, tileY + 24, {
            width: 14,
            align: "center",
            lineBreak: false,
          });
        doc
          .fillColor(COLOR.ink)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(agreementLabel(agreement.key), tileX + 43, tileY + 13, {
            width: tileWidth - 56,
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .fillColor(
            agreement.bindingNature === "non_binding"
              ? COLOR.blue
              : COLOR.green,
          )
          .font("Helvetica-Bold")
          .fontSize(6.8)
          .text(
            `${bindingNatureLabel(agreement.bindingNature).toUpperCase()} · v${receiptText(agreement.version, 40)}`,
            tileX + 43,
            tileY + 32,
            { width: tileWidth - 56, lineBreak: false },
          );
      }

      drawSectionLabel("Integritet og sporbarhet", L, 562);
      const evidenceGap = 10;
      const evidenceWidth = (W - evidenceGap * 2) / 3;
      drawEvidenceCard(
        L,
        589,
        evidenceWidth,
        "E-post verifisert",
        verifiedAtLabel,
        Boolean(input.emailVerifiedAt),
      );
      drawEvidenceCard(
        L + evidenceWidth + evidenceGap,
        589,
        evidenceWidth,
        "Dokumentintegritet",
        `${documents.length}/4 dokumenter kontrollert`,
      );
      drawEvidenceCard(
        L + (evidenceWidth + evidenceGap) * 2,
        589,
        evidenceWidth,
        "Signeringsfullmakt",
        input.snapshot.confirmedSigningAuthority === true
          ? "Bekreftet av signatar"
          : "Ikke registrert",
        input.snapshot.confirmedSigningAuthority === true,
      );

      doc.roundedRect(L, 691, W, 73, 9).fillAndStroke(COLOR.warm, "#FEDF89");
      doc
        .fillColor(COLOR.accentDark)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text("KVITTERINGSREFERANSE", L + 16, 707, {
          width: 190,
          lineBreak: false,
          characterSpacing: 0.65,
        });
      doc
        .fillColor(COLOR.ink)
        .font("Courier-Bold")
        .fontSize(8.2)
        .text(receiptText(input.receiptId, 100), L + 16, 725, {
          width: 300,
          lineBreak: false,
        });
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica")
        .fontSize(7.6)
        .text(
          `Prototypeperioden er registrert til ${formatReceiptTimestamp(input.programEndsAt)}.`,
          L + 325,
          710,
          {
            width: W - 341,
            lineGap: 1.5,
          },
        );
    };

    const documentPageLabelPositions: Array<{ x: number; y: number }> = [];

    const drawControlPage = () => {
      doc.addPage();
      drawCompactHeader(
        "Kontrollside",
        `Ref. ${abbreviatedId(input.receiptId)}`,
      );
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(23)
        .text("Dokumentkontroll", L, 105, { width: W });
      doc
        .fillColor(COLOR.muted)
        .font("Helvetica")
        .fontSize(9.5)
        .text(
          "Identitet, dokumentversjoner og teknisk integritetsbevis samlet på én side.",
          L,
          140,
          {
            width: W,
          },
        );

      const partyGap = 12;
      const partyWidth = (W - partyGap) / 2;
      drawInfoCard(L, 174, partyWidth, 105, "Signatar", [
        { label: "Navn", value: input.snapshot.signerName },
        { label: "E-post", value: input.snapshot.signerEmail },
      ]);
      drawInfoCard(
        L + partyWidth + partyGap,
        174,
        partyWidth,
        105,
        "Virksomhet",
        [
          {
            label: "Juridisk navn",
            value: input.snapshot.representedCompany || "Ikke oppgitt",
          },
          {
            label: "Org.nr. og adresse",
            value:
              [
                input.snapshot.representedCompanyOrganizationNumber
                  ? formatOrganizationNumber(
                      input.snapshot.representedCompanyOrganizationNumber,
                    )
                  : null,
                input.snapshot.representedCompanyBusinessAddress,
              ]
                .filter(Boolean)
                .join(" · ") || "Ikke oppgitt",
          },
        ],
      );

      doc.roundedRect(L, 299, W, 108, 10).fillAndStroke(COLOR.navy, COLOR.navy);
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .text("INTEGRITETSKONTROLL · SHA-256", L + 17, 316, {
          width: W - 34,
          lineBreak: false,
          characterSpacing: 0.7,
        });
      doc
        .fillColor(COLOR.white)
        .font("Courier-Bold")
        .fontSize(8.7)
        .text(displayDigest(input.agreementDigest), L + 17, 338, {
          width: W - 34,
          lineGap: 4,
        });
      doc
        .fillColor("#D0D5DD")
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          "Fingeravtrykket gjelder den komplette lagrede avtaleversjonen: signatar, virksomhet, dokumenttekst og versjoner.",
          L + 17,
          382,
          {
            width: W - 190,
            lineBreak: false,
          },
        );
      drawPill(
        R - 17,
        375,
        "AVTALEVERSJON LÅST",
        COLOR.greenSoft,
        COLOR.green,
        {
          align: "right",
        },
      );

      drawSectionLabel("Dokumentregister", L, 431);
      let rowY = 457;
      for (const [index, agreement] of documents.entries()) {
        const rowHeight = 46;
        doc
          .roundedRect(L, rowY, W, rowHeight, 8)
          .fillAndStroke(
            index % 2 === 0 ? COLOR.panel : COLOR.white,
            COLOR.line,
          );
        doc.circle(L + 21, rowY + rowHeight / 2, 11).fill(COLOR.navy);
        doc
          .fillColor(COLOR.white)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(String(index + 1), L + 15, rowY + 19.5, {
            width: 12,
            align: "center",
            lineBreak: false,
          });
        doc
          .fillColor(COLOR.ink)
          .font("Helvetica-Bold")
          .fontSize(9.2)
          .text(agreementLabel(agreement.key), L + 43, rowY + 9, {
            width: 275,
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .fillColor(COLOR.muted)
          .font("Helvetica")
          .fontSize(7.2)
          .text(receiptText(agreement.title, 300), L + 43, rowY + 25, {
            width: 275,
            lineBreak: false,
            ellipsis: true,
          });
        drawPill(
          R - 61,
          rowY + 14,
          `v${receiptText(agreement.version, 40)} · ${bindingNatureLabel(agreement.bindingNature)}`,
          agreement.bindingNature === "non_binding"
            ? COLOR.blueSoft
            : COLOR.greenSoft,
          agreement.bindingNature === "non_binding" ? COLOR.blue : COLOR.green,
          { align: "right" },
        );
        doc
          .fillColor(COLOR.faint)
          .font("Helvetica-Bold")
          .fontSize(6.5)
          .text("SIDE", R - 50, rowY + 8, {
            width: 38,
            align: "right",
            characterSpacing: 0.45,
            lineBreak: false,
          });
        documentPageLabelPositions[index] = { x: R - 50, y: rowY + 23 };
        rowY += rowHeight + 6;
      }

      doc
        .roundedRect(L, 681, W, 72, 9)
        .fillAndStroke(COLOR.blueSoft, "#B2DDFF");
      doc
        .fillColor(COLOR.blue)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Dokumentert signaturnivå", L + 16, 696, {
          width: W - 32,
          lineBreak: false,
        });
      doc
        .fillColor(COLOR.text)
        .font("Helvetica")
        .fontSize(8.2)
        .text(
          "Enkel elektronisk signatur. Aksepten er dokumentert med e-postkode, skrevet navn, tidspunkt, fullmaktserklæring, dokumentversjoner og kontrollsum. Dette er ikke BankID eller en kvalifisert elektronisk signatur.",
          L + 16,
          714,
          { width: W - 32, lineGap: 2 },
        );
      doc
        .fillColor(COLOR.faint)
        .font("Helvetica")
        .fontSize(6.4)
        .text(`Invitasjons-ID ${receiptText(input.inviteId, 100)}`, L, 770, {
          width: W / 2 - 8,
          lineBreak: false,
          ellipsis: true,
        });
      doc.text(
        `Kvitterings-ID ${receiptText(input.receiptId, 100)}`,
        L + W / 2,
        770,
        {
          width: W / 2,
          align: "right",
          lineBreak: false,
          ellipsis: true,
        },
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
      pageWithinAgreement: number,
    ): number => {
      drawCompactHeader(
        `Avtale ${index + 1} av ${documents.length} · dokumentside ${pageWithinAgreement}`,
        `Ref. ${abbreviatedId(input.receiptId)}`,
      );
      if (continuation) {
        doc
          .fillColor(COLOR.ink)
          .font("Helvetica-Bold")
          .fontSize(12.5)
          .text(agreementLabel(agreement.key), L, 100, {
            width: W - 130,
            lineBreak: false,
            ellipsis: true,
          });
        drawPill(
          R,
          96,
          `v${receiptText(agreement.version, 40)}`,
          COLOR.panel,
          COLOR.text,
          { align: "right" },
        );
        doc
          .moveTo(L, 127)
          .lineTo(R, 127)
          .lineWidth(0.7)
          .strokeColor(COLOR.line)
          .stroke();
        doc
          .fillColor(COLOR.faint)
          .font("Helvetica")
          .fontSize(7.2)
          .text("FORTSETTELSE", L, 134, {
            width: W,
            characterSpacing: 0.65,
            lineBreak: false,
          });
        return 157;
      }

      doc.circle(L + 17, 113, 17).fill(COLOR.navy);
      doc
        .fillColor(COLOR.white)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(String(index + 1), L + 8, 108, {
          width: 18,
          align: "center",
          lineBreak: false,
        });
      doc
        .fillColor(COLOR.accentDark)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(agreementLabel(agreement.key).toUpperCase(), L + 45, 98, {
          width: W - 45,
          lineBreak: false,
          characterSpacing: 0.7,
        });
      const title = receiptText(agreement.title, 300);
      doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(20);
      const titleHeight = Math.min(
        doc.heightOfString(title, { width: W - 45, lineGap: 1 }),
        52,
      );
      doc.text(title, L + 45, 114, {
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
      doc.outline.addItem(`${index + 1}. ${agreementLabel(agreement.key)}`);
      let agreementPage = 1;
      let y = drawAgreementHeader(agreement, index, false, agreementPage);
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
        agreementPage += 1;
        y = drawAgreementHeader(agreement, index, true, agreementPage);
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
          doc.font("Helvetica").fontSize(9.7);
          const height =
            doc.heightOfString(bulletText, { width: W - 24, lineGap: 3 }) + 5;
          ensureSpace(height);
          doc.circle(L + 5, y + 6.5, 2.2).fill(COLOR.accent);
          doc
            .fillColor(COLOR.text)
            .font("Helvetica")
            .fontSize(9.7)
            .text(bulletText, L + 18, y, { width: W - 18, lineGap: 3 });
          y += height;
          continue;
        }

        if (isAgreementHeading(line)) {
          doc.font("Helvetica-Bold").fontSize(10.3);
          const textHeight = doc.heightOfString(line, {
            width: W - 28,
            lineGap: 1.5,
          });
          const height = textHeight + 17;
          // Keep a section heading with at least a few lines of its following
          // paragraph instead of leaving the heading orphaned above the footer.
          ensureSpace(height + 110);
          y += 5;
          doc.roundedRect(L, y, W, height, 6).fill(COLOR.warm);
          doc.roundedRect(L, y, 3, height, 1.5).fill(COLOR.accent);
          doc
            .fillColor(COLOR.ink)
            .font("Helvetica-Bold")
            .fontSize(10.3)
            .text(line, L + 15, y + 8, {
              width: W - 28,
              lineGap: 1.5,
            });
          y += height + 7;
          continue;
        }

        doc.font("Helvetica").fontSize(9.7);
        const height = doc.heightOfString(line, { width: W, lineGap: 3.1 }) + 5;
        ensureSpace(height);
        doc
          .fillColor(COLOR.text)
          .font("Helvetica")
          .fontSize(9.7)
          .text(line, L, y, { width: W, lineGap: 3.1, align: "left" });
        y += height;
      }

      const acceptanceHeight = 82;
      if (BODY_BOTTOM - y >= acceptanceHeight + 24) {
        const acceptanceY = Math.max(
          y + 28,
          BODY_BOTTOM - acceptanceHeight - 18,
        );
        doc
          .roundedRect(L, acceptanceY, W, acceptanceHeight, 8)
          .fillAndStroke(COLOR.greenSoft, COLOR.greenLine);
        drawCheckBadge(L + 16, acceptanceY + 17, { size: 20 });
        doc
          .fillColor(COLOR.green)
          .font("Helvetica-Bold")
          .fontSize(6.8)
          .text("INNGÅR I SIGNERT AVTALEGRUNNLAG", L + 48, acceptanceY + 17, {
            width: 250,
            characterSpacing: 0.55,
            lineBreak: false,
          });
        doc
          .fillColor(COLOR.ink)
          .font("Helvetica-Bold")
          .fontSize(9.2)
          .text(
            receiptText(input.snapshot.signerName, 200),
            L + 48,
            acceptanceY + 35,
            {
              width: 250,
              lineBreak: false,
              ellipsis: true,
            },
          );
        doc
          .fillColor(COLOR.muted)
          .font("Helvetica")
          .fontSize(7.4)
          .text(acceptedAtLabel, L + 48, acceptanceY + 53, {
            width: 250,
            lineBreak: false,
          });
        doc
          .fillColor(COLOR.muted)
          .font("Helvetica-Bold")
          .fontSize(6.6)
          .text("SHA-256", R - 156, acceptanceY + 19, {
            width: 140,
            align: "right",
            lineBreak: false,
            characterSpacing: 0.5,
          });
        doc
          .fillColor(COLOR.ink)
          .font("Courier-Bold")
          .fontSize(7.5)
          .text(
            `${receiptText(input.agreementDigest, 64).slice(0, 12)}…${receiptText(input.agreementDigest, 64).slice(-12)}`,
            R - 190,
            acceptanceY + 39,
            { width: 174, align: "right", lineBreak: false },
          );
      }
    };

    drawSummaryPage();
    doc.outline.addItem("Signeringsbevis");
    drawControlPage();
    doc.outline.addItem("Dokumentkontroll");
    const documentStartPages: number[] = [];
    for (const [index, agreement] of documents.entries()) {
      documentStartPages[index] = doc.bufferedPageRange().count + 1;
      drawAgreement(agreement, index);
    }

    doc.switchToPage(1);
    for (const [index, position] of documentPageLabelPositions.entries()) {
      doc
        .fillColor(COLOR.ink)
        .font("Helvetica-Bold")
        .fontSize(8.2)
        .text(
          String(documentStartPages[index] || "—"),
          position.x,
          position.y,
          {
            width: 38,
            align: "right",
            lineBreak: false,
          },
        );
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
