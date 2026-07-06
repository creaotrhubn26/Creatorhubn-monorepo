// ResumeThumbPage — skjult, offentlig rute som rendrer den EKTE React-CV-mal-komponenten
// med eksempel-data, ren (uten app-chrome), for THUMBNAIL-generering.
//
// En headless browser (backend/scripts/gen-resume-thumbnails) navigerer til
//   /_thumb/resume/:id?scheme=<fargeskjema>
// og skjermdumper elementet [data-resume-thumb] → previewImage-PNG for galleriet.
//
// TRYGT: dette er KUN et illustrasjons-bilde til galleriet — ikke den ekte CV-en brukeren
// redigerer/eksporterer (den forblir ekte DOM/tekst, ATS-trygg). WYSIWYG: bildet rendres
// fra samme komponent som produserer den ekte CV-en → null drift.

import type { ComponentType } from 'react';
import { RESUME_TEMPLATES } from '@/components/resume/templates/ResumeTemplates';
import { SAMPLE_RESUME } from '@/components/resume/templates/sampleResume';

export default function ResumeThumbPage({ id, scheme }: { id: string; scheme?: string | null }) {
  const reg = (RESUME_TEMPLATES as Record<string, { component: ComponentType<{ resume: unknown; preview?: boolean }> }>)[id];
  const Component = reg?.component;

  if (!Component) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif' }} data-resume-thumb-missing>Ukjent mal: {id}</div>;
  }

  const resume = { ...SAMPLE_RESUME, templateId: id, ...(scheme ? { colorScheme: scheme } : {}) };

  // Fast A4-bredde (794px @ 96dpi) på hvit bakgrunn. Skriptet beskjærer til dette
  // elementet, så app-bannere/modaler over ruten påvirker ikke thumbnailen.
  return (
    <div
      data-resume-thumb
      data-thumb-ready
      style={{ width: 794, margin: '0 auto', background: '#ffffff', overflow: 'hidden' }}
    >
      <Component resume={resume} preview />
    </div>
  );
}
