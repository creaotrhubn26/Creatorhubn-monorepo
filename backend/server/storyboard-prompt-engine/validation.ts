import type {
  GeneratedAssetValidation,
  PromptValidationIssue,
  PromptValidationReport,
} from './types.js';

export function validateCompiledPrompt(input: {
  compiledPrompt: string;
  maxCharacters: number;
  hasShotAction: boolean;
  hasCamera: boolean;
  hasCharacters: boolean;
}): PromptValidationReport {
  const issues: PromptValidationIssue[] = [];
  if (!input.hasShotAction) {
    issues.push({ code: 'missing_shot_action', severity: 'error', message: 'Shotet mangler handling eller brukerintensjon.', module: 'shot' });
  }
  if (!input.hasCamera) {
    issues.push({ code: 'missing_camera', severity: 'warning', message: 'Ingen normalisert shotstørrelse, vinkel, linse eller bevegelse er satt.', module: 'camera' });
  }
  if (!input.hasCharacters) {
    issues.push({ code: 'no_characters', severity: 'warning', message: 'Scenen har ingen eksplisitte karakterconstraints.', module: 'character' });
  }
  if (input.compiledPrompt.length > input.maxCharacters) {
    issues.push({ code: 'prompt_too_long', severity: 'error', message: 'Kompilert prompt overskrider modelladapterens grense.', module: 'model-rules' });
  }
  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
    compiledCharacters: input.compiledPrompt.length,
    maxCharacters: input.maxCharacters,
  };
}

export function validateGeneratedImageBase64(base64: string): GeneratedAssetValidation {
  const issues: PromptValidationIssue[] = [];
  const clean = String(base64 || '').replace(/\s/g, '');
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    issues.push({ code: 'invalid_image_payload', severity: 'error', message: 'Leverandøren returnerte ikke gyldig base64.' });
  }
  const bytes = Math.floor(clean.length * 0.75);
  if (bytes < 1_024) {
    issues.push({ code: 'image_too_small', severity: 'error', message: 'Det genererte bildet er uventet lite.' });
  }
  if (bytes > 25 * 1024 * 1024) {
    issues.push({ code: 'image_too_large', severity: 'error', message: 'Det genererte bildet overskrider 25 MB-grensen.' });
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues, mediaType: 'image', bytes };
}
