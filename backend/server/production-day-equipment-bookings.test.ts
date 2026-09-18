import { describe, expect, it, vi } from 'vitest';
import { syncProductionDayEquipmentBookings } from './production-day-equipment-bookings.js';

const KAMERA = 'ed06d901-368b-486c-aa71-4416e4e7ae9f';
const OPTIKK = 'a8ac82ea-e602-43de-b849-f85a4e543078';

const poolWith = (updateRowCount = 0) => ({
  query: vi.fn(async (text: string) => ({
    rows: [],
    rowCount: text.startsWith('UPDATE') ? updateRowCount : 1,
  })),
});

const INPUT = {
  projectId: 'troll',
  dayId: 'dag-6',
  date: '2026-01-27',
  equipmentIds: [KAMERA],
  bookedBy: 'daniel@example.test',
};

describe('syncProductionDayEquipmentBookings', () => {
  it('oppretter en booking for dagen når enheten er ny på den', async () => {
    const pool = poolWith(0);

    const result = await syncProductionDayEquipmentBookings(pool, INPUT);

    expect(result.booked).toBe(1);
    const insert = (pool.query.mock.calls as unknown[][])
      .find(([text]) => String(text).startsWith('INSERT'));
    expect(insert).toBeDefined();
    expect(String(insert![0])).toContain('equipment_bookings');
  });

  it('oppdaterer i stedet for å duplisere når bookingen finnes', async () => {
    // Samme dag lagres mange ganger. Uten dette ville hver lagring lagt på
    // en ny rad for samme kamera.
    const pool = poolWith(1);

    await syncProductionDayEquipmentBookings(pool, INPUT);

    const inserts = (pool.query.mock.calls as unknown[][])
      .filter(([text]) => String(text).startsWith('INSERT'));
    expect(inserts).toHaveLength(0);
  });

  it('avbestiller, men sletter ikke, utstyr som er tatt av dagen', async () => {
    const pool = poolWith(1);

    const result = await syncProductionDayEquipmentBookings(pool, {
      ...INPUT,
      equipmentIds: [OPTIKK],
    });

    const cancel = (pool.query.mock.calls as unknown[][])
      .find(([text]) => String(text).includes("status = 'cancelled'")) as [string, unknown[]];
    expect(cancel).toBeDefined();
    // Hvem som booket hva og når er produksjonshistorikk.
    expect(String(cancel[0])).not.toContain('DELETE');
    expect(cancel[1][2]).toEqual([OPTIKK]);
    expect(result.cancelled).toBe(1);
  });

  it('booker ingenting uten en gyldig dato, men rydder det som lå der', async () => {
    const pool = poolWith(1);

    const result = await syncProductionDayEquipmentBookings(pool, { ...INPUT, date: null });

    expect(result.booked).toBe(0);
    expect((pool.query.mock.calls as unknown[][]).some(([text]) => String(text).startsWith('INSERT')))
      .toBe(false);
    expect(result.cancelled).toBe(1);
  });

  it('hopper over id-er som ikke er uuid, framfor å la innsettingen kaste', async () => {
    // Eldre dager kan bære fritekst i utstyrslisten; kolonnen krever uuid.
    const pool = poolWith(0);

    const result = await syncProductionDayEquipmentBookings(pool, {
      ...INPUT,
      equipmentIds: ['ARRI Alexa', KAMERA],
    });

    expect(result.booked).toBe(1);
  });

  it('teller hver enhet én gang selv om dagen lister den to ganger', async () => {
    const pool = poolWith(0);

    const result = await syncProductionDayEquipmentBookings(pool, {
      ...INPUT,
      equipmentIds: [KAMERA, KAMERA],
    });

    expect(result.booked).toBe(1);
  });
});
