// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ROLE_ROOM_SURFACE_CONTRACT,
  SURFACE_SHELLS,
  TRANSPARENT_SURFACE_WRAPPERS,
} from './surfaceContract';

const read = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const castingMain = read('../casting-main.tsx');

/**
 * Grenene i `casting-main.tsx` er en kjede av ternærer, der hver gren åpner
 * med `? (` eller `: (` og deretter komponenten den rendrer. Vi leser den
 * kjeden framfor å vedlikeholde en håndskrevet liste, slik at en ny flate
 * dukker opp her av seg selv.
 */
function readRenderedSurfaces(source: string): string[] {
  const start = source.indexOf('{!authResolved');
  // Siste, ikke første: den første lukker Talents-grenen, og kjeden
  // fortsetter med produksjonsflaten etter den.
  const end = source.lastIndexOf('</ToastProvider>');
  expect(start, 'fant ikke starten på flatekjeden i casting-main.tsx').toBeGreaterThan(-1);
  expect(end, 'fant ikke slutten på flatekjeden i casting-main.tsx').toBeGreaterThan(start);

  const chain = source
    .slice(start, end)
    // Fjern innpakninger som bare gir kontekst, så neste komponent i grenen
    // er den som faktisk er flaten.
    .replace(new RegExp(`<(${TRANSPARENT_SURFACE_WRAPPERS.join('|')})\\b[^>]*>`, 'g'), '');

  // Mellom `? (` og komponenten kan det stå kommentarer, både `//` og
  // `{/* */}`. De hoppes over, ellers forsvinner grenen de forklarer.
  const comments = String.raw`(?:\s|//[^\n]*\n|\{\s*/\*[\s\S]*?\*/\s*\}|/\*[\s\S]*?\*/)*`;
  const branch = new RegExp(String.raw`[?:]\s*\(` + comments + String.raw`<([A-Z][A-Za-z0-9_]*)`, 'g');
  const found = new Set<string>();
  for (const match of chain.matchAll(branch)) {
    found.add(match[1]);
  }
  // Ventetilstanden mens auth løses er ikke en flate, men en <Box>.
  found.delete('Box');
  return [...found].sort();
}

describe('flatekontrakten', () => {
  it('dekker hver gren casting-main faktisk kan rendre', () => {
    // Feiler denne etter at du la til en flate: legg den i kontrakten og ta
    // stilling til om brukeren kan bli stående der. Det er hele poenget.
    expect(readRenderedSurfaces(castingMain)).toEqual(
      ROLE_ROOM_SURFACE_CONTRACT.map((surface) => surface.component).sort(),
    );
  });

  it('gir hver arbeidsflate en vei ut, enten egen eller fra et skall', () => {
    const shells = new Set(SURFACE_SHELLS);
    for (const surface of ROLE_ROOM_SURFACE_CONTRACT) {
      if (surface.kind !== 'workspace') continue;
      if (surface.escapeHatch === 'own') continue;
      // En arbeidsflate uten vei ut er den feilen dette er skrevet for; en
      // som peker på et skall som ikke finnes er samme feil, bare senere.
      expect(surface.escapeHatch, `${surface.component} mangler vei ut`).not.toBe('none');
      expect(shells, `${surface.component} arver fra et ukjent skall`)
        .toContain((surface.escapeHatch as { from: string }).from);
    }
  });

  it('monterer flatevelgeren i hvert skall, ikke bare det ene', () => {
    // PR #2375: velgeren lå bare i RoleRoomUXLayer, og Talents-appen — det
    // eneste stedet en bruker faktisk satt fast — hadde den ikke.
    expect(SURFACE_SHELLS).toEqual(['TalentsApp', 'RoleRoomUXLayer']);
    expect(read('./RoleRoomUXLayer.tsx')).toContain('<SurfaceSwitcher />');
    expect(read('../talents-app/TalentsAppShell.tsx')).toContain('<SurfaceSwitcher />');
  });
});
