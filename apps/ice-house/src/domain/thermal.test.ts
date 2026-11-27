import { describe, expect, it } from 'vitest';

import type { Lot, Reading, Room } from '../model';
import {
  computeArithmeticMean,
  computeConsumedPct,
  computeHoursAbove,
  computeMKT,
  detectExcursions,
  evaluateLot,
  fefoOrder,
  hasFrozenThaw,
  type TempSample,
} from './thermal';

function makeSeries(startIso: string, stepMin: number, temps: number[]): TempSample[] {
  const start = Date.parse(startIso);
  return temps.map((tempC, i) => ({
    at: new Date(start + i * stepMin * 60_000).toISOString(),
    tempC,
  }));
}

describe('Ice House thermal & shelf-life rules', () => {
  it('Acceptance Criterion 1: MKT of a constant series equals that temperature, and with a spike exceeds arithmetic mean', () => {
    const constant = makeSeries('2026-12-01T00:00:00Z', 15, [4, 4, 4, 4, 4, 4]);
    expect(computeMKT(constant)).toBe(4);

    const spiked = makeSeries('2026-12-01T00:00:00Z', 15, [3, 3, 3, 18, 18, 3, 3, 3]);
    const mkt = computeMKT(spiked);
    const mean = computeArithmeticMean(spiked);
    expect(mkt).toBeGreaterThan(mean);
  });

  it('Rule 2: consumed shelf life accelerates by Q10 per +10°C above Tref', () => {
    // 24 hours at Tref (4°C) on a 10-day shelf life = 10% consumed
    const atRef = makeSeries('2026-12-01T00:00:00Z', 60, Array(25).fill(4));
    expect(computeConsumedPct(atRef, 4, 3.0, 10)).toBe(10);

    // 24 hours at Tref + 10°C (14°C) with Q10=3.0 = 30% consumed
    const hot = makeSeries('2026-12-01T00:00:00Z', 60, Array(25).fill(14));
    expect(computeConsumedPct(hot, 4, 3.0, 10)).toBe(30);
  });

  it('Acceptance Criterion 2: 6-minute excursion is ignored; 40-minute excursion is detected with severity', () => {
    // 6-minute door open (3 samples at 3-min intervals out of range)
    const doorOpen: TempSample[] = [
      { at: '2026-12-01T08:00:00Z', tempC: 3.0 },
      { at: '2026-12-01T08:02:00Z', tempC: 7.5 },
      { at: '2026-12-01T08:05:00Z', tempC: 7.2 },
      { at: '2026-12-01T08:08:00Z', tempC: 3.2 },
    ];
    expect(detectExcursions(doorOpen, 0, 5)).toHaveLength(0);

    // 40-minute excursion above 5°C
    const fortyMin: TempSample[] = [
      { at: '2026-12-01T08:00:00Z', tempC: 3.0 },
      { at: '2026-12-01T08:10:00Z', tempC: 7.8 },
      { at: '2026-12-01T08:30:00Z', tempC: 8.4 },
      { at: '2026-12-01T08:50:00Z', tempC: 3.4 },
    ];
    const found = detectExcursions(fortyMin, 0, 5);
    expect(found).toHaveLength(1);
    expect(found[0].durationMin).toBe(40);
    expect(found[0].severity).toBe('major');
  });

  it('Acceptance Criterion 3: chilled lot > 4h above 5°C is forced to discard; frozen lot thawed >= 30m above -12°C is forced to discard', () => {
    const chilledRoom: Room = { id: 'r1', name: 'Dairy', kind: 'chilled', setpointC: 3, minC: 1, maxC: 5 };
    const lot: Lot = {
      id: 'l1',
      code: 'LOT-01',
      product: 'Brie Wheel',
      category: 'dairy',
      roomId: 'r1',
      qty: 20,
      receivedAt: '2026-12-01T00:00:00Z',
      bestBefore: '2026-12-15T00:00:00Z',
      shelfLifeDays: 14,
      refTempC: 3,
      q10: 3.0,
      consumedPct: 10,
      status: 'quarantine',
    };
    // 5 hours at 7°C
    const readings: Reading[] = makeSeries('2026-12-01T00:00:00Z', 60, [7, 7, 7, 7, 7, 3]).map((s, i) => ({
      id: `rd-${i}`,
      roomId: 'r1',
      at: s.at,
      tempC: s.tempC,
      source: 'logger',
      recordedBy: 'demo-admin',
    }));

    expect(computeHoursAbove(readings, 5)).toBe(5);
    const ev = evaluateLot(lot, chilledRoom, readings, new Date('2026-12-02T00:00:00Z'));
    expect(ev.forcedDiscard).toBe(true);
    expect(ev.forcedDiscardReason).toContain('4h');

    // Frozen thaw check
    const thawed = makeSeries('2026-12-01T00:00:00Z', 15, [-18, -10, -9, -8, -18]);
    expect(hasFrozenThaw(thawed)).toBe(true);
  });

  it('Acceptance Criterion 5: FEFO order follows effective expiry with watch lots last', () => {
    const room: Room = { id: 'r1', name: 'Chilled', kind: 'chilled', setpointC: 3, minC: 1, maxC: 5 };
    const now = new Date('2026-12-05T00:00:00Z');
    const makeLot = (id: string, consumedPct: number, status: Lot['status']): Lot => ({
      id,
      code: id,
      product: id,
      category: 'dairy',
      roomId: 'r1',
      qty: 10,
      receivedAt: '2026-12-01T00:00:00Z',
      bestBefore: '2026-12-15T00:00:00Z',
      shelfLifeDays: 10,
      refTempC: 3,
      q10: 3.0,
      consumedPct,
      status,
    });

    const e1 = evaluateLot(makeLot('L-fresh', 20, 'ok'), room, [], now);
    const e2 = evaluateLot(makeLot('L-older', 60, 'ok'), room, [], now);
    const e3 = evaluateLot(makeLot('L-watch', 80, 'watch'), room, [], now);

    const ordered = fefoOrder([e1, e2, e3]);
    expect(ordered.map((e) => e.lot.code)).toEqual(['L-older', 'L-fresh', 'L-watch']);
  });
});
