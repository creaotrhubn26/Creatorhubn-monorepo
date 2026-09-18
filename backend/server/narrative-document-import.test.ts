import { describe, expect, it } from 'vitest';

import {
  DocumentImportError,
  diffAgainstProject,
  documentKindOf,
  eraFromText,
  htmlToDocumentText,
  parseSceneDocument,
  type ExistingScene,
} from './narrative-document-import.js';

// Utdrag i samme form som OPENING-HYBRID-v2 / OPENING-DIALOGUE-v2 (ikke hele manuset).
const HYBRID_MD = `# WHAT FOLLOWS US — spillåpning v2

Episode One — The Seeker · 13. september 2026.

## 3. Åpningen scene for scene

### P01 — Skoleveien · W01 · 1797, ettermiddag

**Før:** Bok hos Elise, løs skolisse, Oskar har filleballen. Marcus har en
avbarket pinne, Sage en tistel i skjørtet, Jamie en tegning.

**Handling:** Nora tar boken, gir den tilbake og knyter skolissen. Oskar
inviterer til leken.

**Kontroll:** Rolig bevegelse, se seg rundt, snakke, undersøke tegningen og
gå til den store roten.

**Etter/utløser:** Alle fire har nådd lekeplassen. Boken følger Elise.

**Lyd:** skoleveisamtale, sko, stoff og naturlig miljø. Ingen skrekkdrone.

### P02 — Ringen · W02 · samme ettermiddag

**Før:** Oskar kommer frem med ballen. En bar jordflekk er etablert.
**Handling:** Han tegner ringen med hælen, legger ballen i midten.
**Kontroll/utgang:** En av de fire sparker ballen.
**Etter:** Oskar når femti før han snur seg for å lete.
**Lyd:** spark ved fotkontakt, ballens faktiske landing.

### P04 — Nora på husken · U, bearbeidet fra Pilot v1

**Før:** Husken henger i det store treet.
**Handling:** Nora svinger.

## W01 — Skoleveien · 1797

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W01.01 | NORA | E | Must you read all the way home? |
| W01.02 | ELISE | E | You will not drop my book, will you? |
| W01.03 | OSKAR | T | The kicking game. By the big root. |

W01.03 er arbeidslokalisering av lekens navn.

## W02 — Ringen · 1797

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W02.01 | OSKAR | E | I must come back here when I see someone. |
| W02.02 | OSKAR | T | The name first. Then “at the circle”. |

## W09 — Bålstedet · 1817

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W09.01 | ELISE | E | Nothing is burning. |
`;

// Slik pdf-parse leverer teksten: ingen hasher, ingen fet skrift, ingen pipes.
const HYBRID_PDF_TEXT = `WHAT FOLLOWS US — spillåpning v2
P01 — Skoleveien · W01 · 1797, ettermiddag
Før: Bok hos Elise, løs skolisse.
Handling: Nora tar boken.
Lyd: skoleveisamtale.
P02 — Ringen · W02 · samme ettermiddag
Før: Oskar kommer frem med ballen.
W01 — Skoleveien · 1797
W01.01 NORA E Must you read all the way home?
W01.02 ELISE E You will not drop my book, will you?
`;

function existing(): ExistingScene[] {
  return [
    {
      id: 'nsc_p01', code: 'P01', workingId: 'P01', title: 'Skoleveien', subtitle: 'W01 · 1797, ettermiddag', era: '1797',
      beforeState: 'Bok hos Elise, løs skolisse, Oskar har filleballen. Marcus har en avbarket pinne, Sage en tistel i skjørtet, Jamie en tegning.',
      action: 'Nora tar boken, gir den tilbake og knyter skolissen. Oskar inviterer til leken.',
      control: 'Rolig bevegelse, se seg rundt, snakke, undersøke tegningen og gå til den store roten.',
      afterState: 'Alle fire har nådd lekeplassen. Boken følger Elise.',
      audio: 'skoleveisamtale, sko, stoff og naturlig miljø. Ingen skrekkdrone.',
      lines: [
        { id: 'nsl_1', cueId: 'W01.01', speakerLabel: 'NORA', textEn: 'Must you read all the way home?', sourceType: 'E' },
        { id: 'nsl_2', cueId: 'W01.02', speakerLabel: 'ELISE', textEn: 'You will not drop my book, will you?', sourceType: 'E' },
        { id: 'nsl_3', cueId: 'W01.03', speakerLabel: 'OSKAR', textEn: 'Ball by the root.', sourceType: 'T' },
        { id: 'nsl_4', cueId: 'W01.04', speakerLabel: 'MARCUS', textEn: 'You did not finish your turn last time.', sourceType: 'T' },
      ],
    },
    {
      id: 'nsc_p03', code: 'P03', workingId: 'P03', title: 'Alle blir fri', subtitle: 'W03 · lek som faktisk spilles', era: '1797',
      beforeState: 'x', action: 'y', control: '', afterState: '', audio: '', lines: [],
    },
    {
      id: 'nsc_p10', code: 'P10', workingId: 'P10', title: 'Det tomme bålstedet', subtitle: 'W09', era: '1817',
      beforeState: '', action: '', control: '', afterState: '', audio: '',
      lines: [{ id: 'nsl_9', cueId: 'W09.01', speakerLabel: 'ELISE', textEn: 'Nothing is burning.', sourceType: 'E' }],
    },
    {
      id: 'nsc_g01', code: 'G01', workingId: 'G01', title: 'Kultscene', subtitle: '', era: 'pre',
      beforeState: '', action: '', control: '', afterState: '', audio: '', lines: [],
    },
  ];
}

describe('parseSceneDocument', () => {
  it('leser scener med Før/Handling/Kontroll/Etter/Lyd, cue-blokker og epoke fra Markdown', () => {
    const doc = parseSceneDocument(HYBRID_MD);
    expect(doc.title).toBe('WHAT FOLLOWS US — spillåpning v2');
    expect(doc.scenes.map((s) => s.workingId)).toEqual(['P01', 'P02', 'P04']);
    const p01 = doc.scenes[0];
    expect(p01.title).toBe('Skoleveien');
    expect(p01.subtitle).toBe('W01 · 1797, ettermiddag');
    expect(p01.era).toBe('1797');
    expect(p01.cueBlocks).toEqual(['W01']);
    expect(p01.fields.beforeState).toContain('Jamie en tegning.');
    expect(p01.fields.action).toBe('Nora tar boken, gir den tilbake og knyter skolissen. Oskar inviterer til leken.');
    expect(p01.fields.control).toContain('den store roten');
    expect(p01.fields.afterState).toBe('Alle fire har nådd lekeplassen. Boken følger Elise.');
    expect(p01.fields.audio).toContain('Ingen skrekkdrone');
    // Feltene på én linje hver (P02), «Kontroll/utgang» og «Etter» uten utløser.
    const p02 = doc.scenes[1];
    expect(p02.fields.control).toBe('En av de fire sparker ballen.');
    expect(p02.fields.afterState).toBe('Oskar når femti før han snur seg for å lete.');
    expect(p02.era).toBe('other'); // «samme ettermiddag» uten årstall
    // P04 har U-kilde uten nummer → ingen cue-blokk, epoke ukjent.
    expect(doc.scenes[2].cueBlocks).toEqual([]);
  });

  it('kobler replikkblokker til scener og varsler om blokker uten scene', () => {
    const doc = parseSceneDocument(HYBRID_MD);
    expect(doc.scenes[0].lines.map((l) => l.cueId)).toEqual(['W01.01', 'W01.02', 'W01.03']);
    expect(doc.scenes[0].lines[2]).toMatchObject({ speakerLabel: 'OSKAR', sourceType: 'T', textEn: 'The kicking game. By the big root.' });
    expect(doc.scenes[1].lines).toHaveLength(2);
    expect(doc.dialogueBlocks.W09).toHaveLength(1);
    expect(doc.stats).toEqual({ scenes: 3, lines: 6, unassignedBlocks: 1 });
    expect(doc.warnings.some((w) => w.includes('W09'))).toBe(true);
  });

  it('tåler PDF-tekst uten hasher, fet skrift og pipes', () => {
    const doc = parseSceneDocument(HYBRID_PDF_TEXT);
    expect(doc.scenes.map((s) => s.workingId)).toEqual(['P01', 'P02']);
    expect(doc.scenes[0].fields.beforeState).toBe('Bok hos Elise, løs skolisse.');
    expect(doc.scenes[0].fields.audio).toBe('skoleveisamtale.');
    expect(doc.scenes[0].lines.map((l) => l.textEn)).toEqual(['Must you read all the way home?', 'You will not drop my book, will you?']);
    expect(doc.scenes[1].fields.beforeState).toBe('Oskar kommer frem med ballen.');
  });

  it('normaliserer mammoth-HTML til samme tekstform', () => {
    const html = '<h3>P01 — Skoleveien · W01 · 1797</h3><p><strong>Før:</strong> Bok hos Elise &amp; Nora.</p><p><strong>Lyd:</strong> stille</p>'
      + '<h2>W01 — Skoleveien</h2><table><tr><th>ID</th><th>Taler</th><th>Type</th><th>Tekst</th></tr><tr><td>W01.01</td><td>NORA</td><td>E</td><td>Must you read?</td></tr></table>';
    const text = htmlToDocumentText(html);
    expect(text).toContain('### P01 — Skoleveien · W01 · 1797');
    expect(text).toContain('**Før:** Bok hos Elise & Nora.');
    expect(text).toContain('| W01.01 | NORA | E | Must you read? |');
    const doc = parseSceneDocument(text);
    expect(doc.scenes[0].fields.beforeState).toBe('Bok hos Elise & Nora.');
    expect(doc.scenes[0].lines[0].textEn).toBe('Must you read?');
  });

  it('kaster nothing_recognized når verken scener eller replikker finnes', () => {
    expect(() => parseSceneDocument('Bare litt prosa uten struktur.\n\nOg litt til.')).toThrowError(DocumentImportError);
  });

  it('gjenkjenner filtype og epoke', () => {
    expect(documentKindOf('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x.docx')).toBe('docx');
    expect(documentKindOf('application/octet-stream', 'manus.pdf')).toBe('pdf');
    expect(documentKindOf('text/markdown', 'OPENING.md')).toBe('md');
    expect(documentKindOf('image/png', 'a.png')).toBeNull();
    expect(eraFromText('W06 · 1817, tjue år senere')).toBe('1817');
    expect(eraFromText('kultfilm, før 1797')).toBe('pre');
  });
});

describe('diffAgainstProject', () => {
  it('skiller uendret, endret, ny og manglende — og foreslår aldri sletting', () => {
    const doc = parseSceneDocument(HYBRID_MD);
    const diff = diffAgainstProject(doc, existing());
    // P01 finnes: feltene er like, men W01.03 har ny tekst og W01.04 mangler i dokumentet.
    const p01 = diff.update.find((u) => u.code === 'P01')!;
    expect(p01.changes).toEqual({});
    expect(p01.lines.update).toEqual([{ lineId: 'nsl_3', cueId: 'W01.03', changes: { textEn: { from: 'Ball by the root.', to: 'The kicking game. By the big root.' } } }]);
    expect(p01.lines.unchanged).toBe(2);
    expect(diff.missingInDoc.lines).toEqual([{ sceneId: 'nsc_p01', code: 'P01', lineId: 'nsl_4', cueId: 'W01.04' }]);
    // P02 og P04 er nye; koden = arbeids-ID.
    expect(diff.create.map((c) => c.code)).toEqual(['P02', 'P04']);
    expect(diff.create[0].scene.lines).toHaveLength(2);
    // W09-blokken uten dokument-scene kobles til P10 via undertittelen «W09» → uendret.
    expect(diff.unchanged).toEqual([{ sceneId: 'nsc_p10', code: 'P10' }]);
    // P03 er i prosjektet, men ikke i dokumentet (samme P-familie) → foreslås; G01 (annen familie) ikke.
    expect(diff.missingInDoc.scenes).toEqual([{ sceneId: 'nsc_p03', code: 'P03' }]);
    expect(diff.stats).toMatchObject({ create: 2, update: 1, unchanged: 1, linesCreate: 2, linesUpdate: 1, missingScenes: 1, missingLines: 1 });
  });

  it('oppdaterer scenefelt når dokumentet sier noe annet, men lar tomme dokumentfelt være', () => {
    const doc = parseSceneDocument(HYBRID_MD.replace('**Lyd:** skoleveisamtale, sko, stoff og naturlig miljø. Ingen skrekkdrone.', '**Lyd:** skoleveisamtale og kråker.'));
    const diff = diffAgainstProject(doc, existing());
    const p01 = diff.update.find((u) => u.code === 'P01')!;
    expect(p01.changes.audio).toEqual({ from: 'skoleveisamtale, sko, stoff og naturlig miljø. Ingen skrekkdrone.', to: 'skoleveisamtale og kråker.' });
    expect(p01.changes.control).toBeUndefined();
  });

  it('rent dialog-dokument kobles til scener via eksisterende cue-blokker', () => {
    const dialogueOnly = `# Åpning v2 — engelsk replikkgrunnlag

## W01 — Skoleveien · 1797

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W01.01 | NORA | E | Must you read all the way home? |
| W01.05 | OSKAR | T | I can take a turn now. |
`;
    const diff = diffAgainstProject(parseSceneDocument(dialogueOnly), existing());
    expect(diff.create).toEqual([]);
    const p01 = diff.update.find((u) => u.code === 'P01')!;
    expect(p01.lines.create.map((l) => l.cueId)).toEqual(['W01.05']);
    // W01.02–W01.04 finnes i prosjektet, ikke i dokumentet → «mangler» (dokumentet dekker W01).
    expect(diff.missingInDoc.lines.map((l) => l.cueId).sort()).toEqual(['W01.02', 'W01.03', 'W01.04']);
    // Ingen scener foreslås som manglende når dokumentet ikke har scener.
    expect(diff.missingInDoc.scenes).toEqual([]);
  });
});
