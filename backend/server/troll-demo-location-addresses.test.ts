import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const seedSource = readFileSync(
  new URL('./troll-demo-seed-service.ts', import.meta.url),
  'utf8',
);
const migrationSource = readFileSync(
  new URL('../migrations/0606_troll_demo_verified_location_addresses.sql', import.meta.url),
  'utf8',
);

const verifiedPublicAddresses = [
  'Hjerkinnhusvegen 33, 2661 Hjerkinn',
  'Håbakken 1, 6887 Lærdal',
  'Einar Gerhardsens plass 2, 0179 Oslo',
  'Vollanveien 221, 2512 Kvikne',
  'Synnfjellvegen 1879, 2880 Nord-Torpa',
] as const;

describe('TROLL demo location address repair', () => {
  it('keeps future seeds and the production backfill on the same exact addresses', () => {
    for (const address of verifiedPublicAddresses) {
      expect(seedSource).toContain(address);
      expect(migrationSource).toContain(address);
      expect(address).toMatch(/\d+.*,\s\d{4}\s\S+/);
    }
  });

  it('repairs both normalized rows and the rich compat project without crossing tenant scope', () => {
    expect(migrationSource).toContain('UPDATE casting_locations');
    expect(migrationSource).toContain('UPDATE legacy_compat_store');
    expect(migrationSource).toContain("'casting:project:troll-1780071501773'");
    expect(migrationSource).toContain("'casting:project:troll-project-2026'");
    expect(migrationSource).not.toMatch(/casting:project:%/);
  });

  it('does not seed ambiguous municipality-only addresses anymore', () => {
    expect(seedSource).not.toContain('address: "Dovre, Innlandet"');
    expect(seedSource).not.toContain('address: "Lærdal, Vestland"');
    expect(seedSource).not.toContain('address: "Tynset, Innlandet"');
    expect(seedSource).not.toContain('address: "Synnfjell, Oppland"');
  });
});
