/**
 * contracts-upload-import-routes.ts
 *
 * Standalone modul for POST /api/contracts/upload-import.
 *
 * Endpoint: leser PDF eller DOCX, ekstraktert tekst-seksjoner basert på
 * norske kontrakt-stikkord (tjeneste/pris/frist/opphavsrett/ansvar/
 * oppsigelse). Returnerer matching paragraf-blokker som "extracted
 * sections" til klient-UI for review.
 *
 * 1 endpoint:
 *   - POST /api/contracts/upload-import (multer single-file)
 *
 * Auth: requireUserSession (lagt til ved ekstraksjon — endepunktet var
 * tidligere åpent).
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupContractsUploadImportRoutes } from "./contracts-upload-import-routes";
 *
 *   setupContractsUploadImportRoutes({ app, requireUserSession });
 */

import type express from "express";
import multer from "multer";
import mammoth from "mammoth";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const pdfParseModule: any = _require("pdf-parse");

export interface ContractsUploadImportRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
}

const contractFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Ugyldig filformat. Kun PDF og DOCX støttes."));
    }
  },
});

function extractSectionsFromText(text: string) {
  const sections: any[] = [];
  const sectionKeywords = [
    {
      keywords: ["tjeneste", "leveranse", "arbeid", "ytelse"],
      type: "responsibilities",
      title: "Tjenester og leveranser",
    },
    {
      keywords: ["pris", "betaling", "honorar", "kostnad", "faktura"],
      type: "pricing",
      title: "Priser og betaling",
    },
    {
      keywords: ["frist", "levering", "tidsplan", "dato", "tidspunkt"],
      type: "schedule",
      title: "Frister og tidsplan",
    },
    {
      keywords: [
        "opphavsrett",
        "rettighet",
        "eierskap",
        "copyright",
        "bruksrett",
      ],
      type: "terms",
      title: "Rettigheter og vilkår",
    },
    {
      keywords: ["ansvar", "erstatning", "garanti", "reklamasjon"],
      type: "terms",
      title: "Ansvar og garantier",
    },
    {
      keywords: ["oppsigelse", "heving", "kansellering", "avbestilling"],
      type: "terms",
      title: "Oppsigelse og heving",
    },
  ];

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 50);
  const usedParagraphs = new Set<number>();

  sectionKeywords.forEach((section) => {
    const matchingParagraphs: string[] = [];
    paragraphs.forEach((paragraph, index) => {
      if (usedParagraphs.has(index)) return;
      const lowerPara = paragraph.toLowerCase();
      const hasKeyword = section.keywords.some((keyword) =>
        lowerPara.includes(keyword),
      );
      if (hasKeyword) {
        matchingParagraphs.push(paragraph.trim());
        usedParagraphs.add(index);
      }
    });
    if (matchingParagraphs.length > 0) {
      sections.push({
        id: `extracted-${sections.length + 1}`,
        title: section.title,
        content: matchingParagraphs.join("\n\n"),
        type: section.type,
        required:
          section.type === "pricing" || section.type === "responsibilities",
      });
    }
  });

  if (sections.length === 0 && paragraphs.length > 0) {
    sections.push({
      id: "extracted-1",
      title: "Kontraktinnhold",
      content: paragraphs.slice(0, 3).join("\n\n"),
      type: "custom",
      required: false,
    });
  }

  return sections;
}

export function setupContractsUploadImportRoutes(
  deps: ContractsUploadImportRoutesDeps,
): void {
  const { app, requireUserSession } = deps;

  app.post(
    "/api/contracts/upload-import",
    contractFileUpload.single("contractFile"),
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Ingen fil ble lastet opp",
          });
        }

        const file = req.file;
        let extractedText = "";
        let totalPages = 0;

        if (file.mimetype === "application/pdf") {
          try {
            const pdfData = await pdfParseModule.default(file.buffer);
            extractedText = pdfData.text;
            totalPages = pdfData.numpages;
          } catch (error) {
            console.error("PDF parsing error:", error);
            return res.status(500).json({
              success: false,
              message: "Kunne ikke lese PDF-filen",
            });
          }
        } else if (
          file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          try {
            const result = await mammoth.extractRawText({
              buffer: file.buffer,
            });
            extractedText = result.value;
            totalPages = Math.ceil(extractedText.split(/\s+/).length / 500);
          } catch (error) {
            console.error("DOCX parsing error:", error);
            return res.status(500).json({
              success: false,
              message: "Kunne ikke lese DOCX-filen",
            });
          }
        } else if (file.mimetype === "application/msword") {
          return res.status(400).json({
            success: false,
            message:
              "Gamle .doc filer støttes ikke. Vennligst konverter til .docx eller .pdf",
          });
        }

        const sections = extractSectionsFromText(extractedText);

        console.log(
          `📄 Contract imported: ${sections.length} sections from ${totalPages} pages`,
        );

        res.json({
          success: true,
          extractedSections: sections,
          originalText: extractedText.substring(0, 2000),
          totalPages: totalPages,
          message: "Contract imported successfully",
        });
      } catch (error: any) {
        console.error("Import error:", error);
        res.status(500).json({
          success: false,
          message: error.message || "Feil ved import av kontrakt",
        });
      }
    },
  );
}
