/**
 * OCR-adapter bak DocumentExtractor-porten.
 *
 *  - Bilder (mobilfangst): Tesseract (norsk + engelsk).
 *  - PDF-er: pdftotext (ekte tekstlag); faller tilbake til råtekst.
 *  - Annet: råtekst (som DeterministicTextExtractor).
 *
 * OCR-teksten går gjennom NØYAKTIG samme deterministiske parsing og validering
 * som annen tekst, og pipeline-laget kjører prompt-injection-kontroll på den
 * (rawText på ExtractedData). Krever `tesseract-ocr` (+ `tesseract-ocr-nor`)
 * og `poppler-utils` på verten; tilgjengelighet sjekkes ved oppstart og
 * rapporteres ærlig i integrasjonsstatusen.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ExtractedData } from '../documents/types.js';
import { parseDocumentText, type DocumentExtractor } from './extract.js';

const execFileAsync = promisify(execFile);

async function binaryAvailable(binary: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(binary, args, { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

export async function isOcrAvailable(): Promise<{ tesseract: boolean; pdftotext: boolean }> {
  const [tesseract, pdftotext] = await Promise.all([
    binaryAvailable('tesseract', ['--version']),
    binaryAvailable('pdftotext', ['-v']),
  ]);
  return { tesseract, pdftotext };
}

export class OcrExtractor implements DocumentExtractor {
  readonly name = 'ocr-tesseract';

  async extract(content: Buffer, filename: string, mimeType: string): Promise<ExtractedData> {
    let text: string;
    if (mimeType.startsWith('image/')) {
      text = await this.ocrImage(content);
    } else if (mimeType === 'application/pdf') {
      text = await this.pdfText(content);
    } else {
      text = content.toString('utf8');
    }
    const data = parseDocumentText(text, filename);
    // Rå tekst følger med slik at pipelinen kan kjøre injection-kontroll på
    // det OCR faktisk leste (bildebytes er ellers usynlige for kontrollen).
    data.rawText = text;
    return data;
  }

  private async ocrImage(content: Buffer): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'reknaren-ocr-'));
    try {
      const input = join(dir, 'input');
      await writeFile(input, content);
      // PSM 6: sammenhengende tekstblokk — passer kvitteringer/fakturaer.
      const { stdout } = await execFileAsync(
        'tesseract',
        [input, 'stdout', '-l', 'nor+eng', '--psm', '6'],
        { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      );
      return stdout;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async pdfText(content: Buffer): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'reknaren-pdf-'));
    try {
      const input = join(dir, 'input.pdf');
      await writeFile(input, content);
      const { stdout } = await execFileAsync('pdftotext', ['-layout', input, '-'], {
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      // Skannede PDF-er har tomt tekstlag; fall tilbake til råtekst
      // (som kan være tekstbærende pseudo-PDF i test/sandbox).
      return stdout.trim().length >= 20 ? stdout : content.toString('utf8');
    } catch {
      return content.toString('utf8');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
