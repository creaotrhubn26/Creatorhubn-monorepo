/**
 * Merket skal finnes på ALLE flatene.
 *
 * Bakgrunnen: Produksjon og Admin Room hadde ingen logo i det hele tatt, mens
 * Talents og Utdanning hadde hver sin egen. Feilen var ikke at noen hadde
 * fjernet den — den var aldri lagt inn, og ingenting sa fra. Denne testen
 * sier fra: den holder merket i den delte headeren og i Admin Room-shellen,
 * og den holder de fire flatenavnene som faktisk finnes.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleRoomMark } from './RoleRoomMark';

describe('RoleRoomMark', () => {
  it('rendrer merket med tilgjengelig navn', () => {
    render(<RoleRoomMark />);
    expect(screen.getByRole('img', { name: 'The Role Room' })).toBeTruthy();
    expect(screen.getByText('THE ROLE ROOM')).toBeTruthy();
  });

  it('viser taglinen når ingen flate er oppgitt', () => {
    render(<RoleRoomMark />);
    expect(screen.getByText('Casting. Roles. Together.')).toBeTruthy();
  });

  it('bytter taglinen for flatenavnet — to linjer ville konkurrert', () => {
    render(<RoleRoomMark surface="Admin Room" />);
    expect(screen.getByText('Admin Room')).toBeTruthy();
    expect(screen.queryByText('Casting. Roles. Together.')).toBeNull();
  });

  it('kan rendres uten tagline i en stram header', () => {
    render(<RoleRoomMark markSize={26} showTagline={false} />);
    expect(screen.getByText('THE ROLE ROOM')).toBeTruthy();
    expect(screen.queryByText('Casting. Roles. Together.')).toBeNull();
  });
});

describe('flatene bruker merket', () => {
  // Kilde-sjekk, ikke render: RoleRoomUXLayer trekker inn kommandopalett,
  // omvisning og nettverkskall, og å rendre hele treet i en enhetstest tar
  // over fem sekunder uten å si mer om merket enn dette gjør.
  const les = (rel: string) =>
    readFileSync(path.join(__dirname, rel), 'utf8');

  it('den delte headeren (Produksjon) rendrer merket', () => {
    const src = les('RoleRoomUXLayer.tsx');
    expect(src).toContain("from './RoleRoomMark'");
    expect(src).toMatch(/<RoleRoomMark[^>]*\/>/);
  });

  it('Admin Room-shellen rendrer merket med flatenavnet', () => {
    const src = les('../components/admin/SuperAdminAdminRoomShell.tsx');
    expect(src).toContain('RoleRoomMark');
    expect(src).toContain('surface="Admin Room"');
  });

  it('Utdanning rendrer merket med flatenavnet', () => {
    const src = les('../education/EducationWorkspace.tsx');
    expect(src).toContain('RoleRoomMark');
    expect(src).toContain('surface="Utdanning"');
  });

  it('Talents har sitt eget lockup med TALENTS under', () => {
    // Talents skal IKKE bruke fellesmerket: flaten har et eget ordmerke.
    // Testen står her for å gjøre unntaket synlig, ikke tilfeldig.
    const src = les('../talents-app/TalentsAppShell.tsx');
    expect(src).toContain('TalentsLogo');
  });
});
