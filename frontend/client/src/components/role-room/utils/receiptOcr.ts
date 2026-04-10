export type ReceiptOcrConfidence = 'low' | 'medium' | 'high';
export type ReceiptOcrStatus = 'completed' | 'failed' | 'not_supported';

export interface ReceiptOcrSummary {
  status: ReceiptOcrStatus;
  text: string;
  merchant: string;
  amountValue?: number;
  amountLabel: string;
  date: string;
  currency: string;
  confidence: ReceiptOcrConfidence;
  source: 'processed' | 'original' | 'none';
  warnings: string[];
}

export interface ReceiptOcrProgress {
  status: string;
  progress: number;
}

const isImageReceipt = (file: File): boolean => (
  typeof file.type === 'string' && file.type.startsWith('image/')
);

const readImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Kunne ikke lese kvitteringsbildet.'));
  };
  image.src = objectUrl;
});

const buildCanvas = (image: HTMLImageElement, processed: boolean): HTMLCanvasElement => {
  const maxWidth = 2200;
  const scale = Math.max(1, Math.min(2.2, maxWidth / Math.max(image.width, 1)));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: processed });
  if (!context) {
    throw new Error('Kunne ikke opprette OCR-canvas.');
  }

  if (!processed) {
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  }

  context.filter = 'grayscale(1) contrast(1.45) brightness(1.08)';
  context.drawImage(image, 0, 0, width, height);
  context.filter = 'none';
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const normalized = luminance > 186 ? 255 : Math.max(0, Math.min(255, (luminance - 72) * 1.75));
    data[index] = normalized;
    data[index + 1] = normalized;
    data[index + 2] = normalized;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
};

const normalizeWhitespace = (value: string): string => (
  value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
);

const normalizeNumber = (candidate: string): number | undefined => {
  const compact = candidate.replace(/\s+/g, '').replace(/\.(?=\d{3}(?:[,.]|$))/g, '').replace(',', '.');
  const numeric = Number(compact);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const DATE_PATTERNS = [
  /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/,
  /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/,
];

const parseReceiptDate = (text: string): string => {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    if (match[1].length === 4) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const rawYear = match[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }
  return '';
};

const parseReceiptAmount = (text: string): { amountValue?: number; amountLabel: string } => {
  const lines = normalizeWhitespace(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const keywordPattern = /(total|totalt|sum|å betale|a betale|betalt|kort|visa|mastercard|saldo)/i;
  const amountPattern = /([0-9]{1,3}(?:[ .][0-9]{3})*(?:[,.][0-9]{2}))/g;

  const candidates: Array<{ value: number; raw: string; score: number }> = [];

  lines.forEach((line, lineIndex) => {
    const matches = [...line.matchAll(amountPattern)];
    if (matches.length === 0) {
      return;
    }

    const isKeywordLine = keywordPattern.test(line);
    for (const match of matches) {
      const raw = match[1] ?? '';
      const value = normalizeNumber(raw);
      if (value === undefined || value <= 0) {
        continue;
      }
      let score = 1;
      if (isKeywordLine) {
        score += 4;
      }
      if (lineIndex >= lines.length - 3) {
        score += 2;
      }
      if (/kr|nok/i.test(line)) {
        score += 1;
      }
      candidates.push({ value, raw, score });
    }
  });

  if (candidates.length === 0) {
    return { amountLabel: '' };
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.value - left.value;
  });

  const selected = candidates[0];
  return {
    amountValue: selected.value,
    amountLabel: `${selected.value.toFixed(2).replace('.', ',')} kr`,
  };
};

const RECEIPT_NOISE = [
  'kvittering',
  'receipt',
  'org.nr',
  'mva',
  'tlf',
  'telefon',
  'bankterminal',
  'kortkjop',
  'kortkjøp',
  'visa',
  'mastercard',
];

const parseMerchant = (text: string): string => {
  const lines = normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);

  for (const line of lines.slice(0, 6)) {
    const lowered = line.toLowerCase();
    if (RECEIPT_NOISE.some((needle) => lowered.includes(needle))) {
      continue;
    }
    if (/\d{2,}/.test(line) && line.length < 8) {
      continue;
    }
    return line;
  }

  return '';
};

const confidenceFromFields = (text: string, merchant: string, date: string, amountValue?: number): ReceiptOcrConfidence => {
  const score = [
    text.length > 60,
    merchant.length > 2,
    Boolean(date),
    typeof amountValue === 'number' && amountValue > 0,
  ].filter(Boolean).length;

  if (score >= 4) {
    return 'high';
  }
  if (score >= 2) {
    return 'medium';
  }
  return 'low';
};

const summarizeReceiptText = (text: string): ReceiptOcrSummary => {
  const normalizedText = normalizeWhitespace(text);
  const merchant = parseMerchant(normalizedText);
  const date = parseReceiptDate(normalizedText);
  const { amountValue, amountLabel } = parseReceiptAmount(normalizedText);
  const confidence = confidenceFromFields(normalizedText, merchant, date, amountValue);
  const warnings: string[] = [];

  if (!merchant) {
    warnings.push('Fant ikke tydelig leverandørnavn.');
  }
  if (!date) {
    warnings.push('Fant ikke tydelig dato.');
  }
  if (typeof amountValue !== 'number') {
    warnings.push('Fant ikke tydelig totalbeløp.');
  }

  return {
    status: normalizedText.length > 0 ? 'completed' : 'failed',
    text: normalizedText,
    merchant,
    amountValue,
    amountLabel,
    date,
    currency: 'NOK',
    confidence,
    source: 'none',
    warnings,
  };
};

const chooseBestResult = (processed: ReceiptOcrSummary, original: ReceiptOcrSummary): ReceiptOcrSummary => {
  const score = (result: ReceiptOcrSummary): number => {
    let nextScore = result.text.length;
    if (result.merchant) {
      nextScore += 120;
    }
    if (result.date) {
      nextScore += 80;
    }
    if (typeof result.amountValue === 'number') {
      nextScore += 180;
    }
    if (result.confidence === 'high') {
      nextScore += 120;
    } else if (result.confidence === 'medium') {
      nextScore += 60;
    }
    return nextScore;
  };

  return score(processed) >= score(original) ? processed : original;
};

export const runReceiptOcr = async (
  file: File,
  options?: { onProgress?: (progress: ReceiptOcrProgress) => void },
): Promise<ReceiptOcrSummary> => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !isImageReceipt(file)) {
    return {
      status: 'not_supported',
      text: '',
      merchant: '',
      amountLabel: '',
      date: '',
      currency: 'NOK',
      confidence: 'low',
      source: 'none',
      warnings: ['OCR støttes foreløpig for bildekvitteringer fra mobil og desktop.'],
    };
  }

  const Tesseract = await import('tesseract.js');
  const image = await readImage(file);
  const processedCanvas = buildCanvas(image, true);
  const originalCanvas = buildCanvas(image, false);

  const recognize = async (source: 'processed' | 'original', canvas: HTMLCanvasElement): Promise<ReceiptOcrSummary> => {
    options?.onProgress?.({ status: source === 'processed' ? 'Forbedrer kvittering' : 'Kjører ekstra kontroll', progress: 0.05 });

    const { data } = await Tesseract.recognize(canvas, 'eng+nor', {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          options?.onProgress?.({
            status: source === 'processed' ? 'Leser kvittering' : 'Kvalitetssikrer OCR',
            progress: Math.max(0, Math.min(1, Number(message.progress ?? 0))),
          });
        }
      },
    });

    return {
      ...summarizeReceiptText(data.text ?? ''),
      source,
    };
  };

  try {
    const processed = await recognize('processed', processedCanvas);
    const needsSecondPass = processed.confidence !== 'high' || typeof processed.amountValue !== 'number';
    if (!needsSecondPass) {
      return processed;
    }

    const original = await recognize('original', originalCanvas);
    return chooseBestResult(processed, original);
  } catch (error) {
    console.error('[RoleRoom][ReceiptOCR] Failed to analyze receipt', error);
    return {
      status: 'failed',
      text: '',
      merchant: '',
      amountLabel: '',
      date: '',
      currency: 'NOK',
      confidence: 'low',
      source: 'none',
      warnings: ['OCR kunne ikke lese denne kvitteringen. Filen kan fortsatt lagres manuelt.'],
    };
  }
};
