/**
 * Mobile brief step definitions (backlog item 102).
 *
 * The five mobile steps map the flat ProducerClientIntake shape into a
 * phone-friendly wizard: mål → målgruppe → leveranser → referanser →
 * oppsummering. Field grouping intentionally diverges from the desktop's
 * 6-step wizard (ProducerMediaPanel) since mobile has less screen real
 * estate.
 *
 * Required fields are used for:
 *   - the progress indicator (item 103)
 *   - "jump to missing field" chips in the summary step (item 115)
 *   - the summary's completion gate before submission.
 */

import type { ProducerClientIntake } from '../../models/casting';

export type BriefStepKey =
  | 'goal'
  | 'audience'
  | 'deliverables'
  | 'references'
  | 'summary';

export interface BriefFieldDescriptor {
  field: keyof ProducerClientIntake;
  label: string;
  helperText?: string;
  required?: boolean;
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
}

export interface BriefStepDescriptor {
  key: BriefStepKey;
  label: string;
  description: string;
  /** Field descriptors to render as TextFields inside the step body. */
  fields: BriefFieldDescriptor[];
}

export const BRIEF_STEPS: BriefStepDescriptor[] = [
  {
    key: 'goal',
    label: 'Mål',
    description: 'Hva skal prosjektet oppnå, og hvilket hovedbudskap må komme frem?',
    fields: [
      {
        field: 'projectGoal',
        label: 'Prosjektmål',
        helperText: 'Én-to setninger som beskriver hva vi skal levere og hvorfor.',
        required: true,
        multiline: true,
        minRows: 3,
      },
      {
        field: 'keyMessage',
        label: 'Hovedbudskap',
        helperText: 'Den ene tingen seeren skal sitte igjen med.',
        multiline: true,
        minRows: 2,
      },
    ],
  },
  {
    key: 'audience',
    label: 'Målgruppe',
    description: 'Hvem snakker vi til?',
    fields: [
      {
        field: 'targetAudience',
        label: 'Målgruppe',
        helperText: 'Alder, interesser, plattform og tone.',
        required: true,
        multiline: true,
        minRows: 3,
      },
    ],
  },
  {
    key: 'deliverables',
    label: 'Leveranser',
    description: 'Hva skal leveres, og når?',
    fields: [
      {
        field: 'deliverables',
        label: 'Leveranser',
        helperText: 'F.eks. hovedfilm 30 s, kortversjoner, stillbilder.',
        required: true,
        multiline: true,
        minRows: 3,
      },
      {
        field: 'timingConstraints',
        label: 'Tidsrammer',
        helperText: 'Frister, kampanjestart, publiseringsvindu.',
        multiline: true,
        minRows: 2,
      },
    ],
  },
  {
    key: 'references',
    label: 'Referanser',
    description: 'Lenker, merkevareregler og tone-of-voice.',
    fields: [
      {
        field: 'referenceLinks',
        label: 'Referanselenker',
        helperText: 'Én lenke per linje (YouTube, Vimeo, Drive, ...).',
        multiline: true,
        minRows: 3,
        placeholder: 'https://...',
      },
      {
        field: 'brandNotes',
        label: 'Merkevarenotater',
        helperText: 'Logo, farger, tone, hva vi ikke kan si/vise.',
        multiline: true,
        minRows: 3,
      },
    ],
  },
  {
    key: 'summary',
    label: 'Oppsummering',
    description: 'Se gjennom briefen før den sendes til produsent.',
    fields: [],
  },
];

export function getMissingFields(intake: ProducerClientIntake | null): BriefFieldDescriptor[] {
  const missing: BriefFieldDescriptor[] = [];
  if (!intake) return missing;
  for (const step of BRIEF_STEPS) {
    for (const descriptor of step.fields) {
      if (!descriptor.required) continue;
      const value = intake[descriptor.field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        missing.push(descriptor);
      }
    }
  }
  return missing;
}

export function stepFor(field: keyof ProducerClientIntake): BriefStepKey | null {
  for (const step of BRIEF_STEPS) {
    if (step.fields.some((f) => f.field === field)) return step.key;
  }
  return null;
}

export function stepCompletion(
  step: BriefStepDescriptor,
  intake: ProducerClientIntake | null,
): { complete: boolean; filled: number; required: number } {
  let filled = 0;
  let required = 0;
  for (const descriptor of step.fields) {
    if (!descriptor.required) continue;
    required += 1;
    const value = intake?.[descriptor.field];
    if (typeof value === 'string' && value.trim().length > 0) filled += 1;
  }
  return { complete: required === 0 || filled === required, filled, required };
}
