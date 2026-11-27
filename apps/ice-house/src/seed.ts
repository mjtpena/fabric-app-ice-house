import type { DataStore } from '@x10/shared/data';
import type { SeedContext } from '@x10/shared/runtime';

import { CONFIG } from './domain/config';
import { evaluateLot } from './domain/thermal';
import type { Lot, LotCategory, Reading, Room, Schema } from './model';

function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Deterministic seed:
 * - 5 rooms (Chilled Dairy, Chilled Meat & Deli, Cold Pharma Vault, Deep Freeze, Chocolate Cellar)
 * - 48 lots across the 5 rooms
 * - 7 days of readings (hourly + 15-min around daily door-open blips & the compressor trip 3 days ago)
 * - Compressor trip 3 days ago in Chilled Dairy (2.5h up to 9°C) touching 11 lots
 * - 4 lots awaiting QA, 3 FEFO conflicts, 1 frozen lot thawed
 */
export async function seed(store: DataStore<Schema>, ctx: SeedContext): Promise<void> {
  const [admin] = ctx.people;
  const rng = makePrng(3052026);
  const nowMs = ctx.now.getTime();

  const roomRepo = store.repo('Room');
  const lotRepo = store.repo('Lot');
  const readingRepo = store.repo('Reading');
  const assessRepo = store.repo('Assessment');

  const roomSpecs: Omit<Room, 'id'>[] = [
    { name: 'North Dairy Vault', kind: 'chilled', setpointC: 3.0, minC: 1.0, maxC: 5.0 },
    { name: 'Charcuterie & Ham Room', kind: 'chilled', setpointC: 2.0, minC: 0.0, maxC: 4.0 },
    { name: 'Vaccine Cold Room', kind: 'chilled', setpointC: 4.0, minC: 2.0, maxC: 8.0 },
    { name: 'Deep Freeze Chamber', kind: 'frozen', setpointC: -18.0, minC: -22.0, maxC: -15.0 },
    { name: 'Chocolate Cellar', kind: 'controlled-ambient', setpointC: 15.0, minC: 12.0, maxC: 18.0 },
  ];

  const rooms: Room[] = [];
  for (const rs of roomSpecs) {
    rooms.push(await roomRepo.create(rs));
  }

  // Generate 7 days of readings per room (every 2 hours baseline + dense 15-min around compressor trip & door blips)
  const readingsByRoom = new Map<string, Reading[]>();
  const sevenDaysMs = 7 * 24 * 3_600_000;
  const tripStartMs = nowMs - 3 * 24 * 3_600_000; // 3 days ago

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const list: Reading[] = [];

    for (let h = 0; h <= 7 * 24; h += 2) {
      const tMs = nowMs - sevenDaysMs + h * 3_600_000;
      const jitter = (rng() - 0.5) * 0.7;
      let tempC = room.setpointC + jitter;

      // Room 1 (Charcuterie) had an extended 5h warm spell 2 days ago to trigger forced discard on chilled TCS lots
      if (ri === 1 && tMs >= nowMs - 2 * 24 * 3_600_000 && tMs <= nowMs - 2 * 24 * 3_600_000 + 5 * 3_600_000) {
        tempC = 7.4;
      }

      // Room 3 (Deep Freeze) had a 45-min thaw event 1 day ago above -12°C
      if (ri === 3 && tMs >= nowMs - 24 * 3_600_000 && tMs <= nowMs - 24 * 3_600_000 + 3_600_000) {
        tempC = -9.5;
      }

      const r = await readingRepo.create({
        roomId: room.id,
        at: new Date(tMs).toISOString(),
        tempC: Math.round(tempC * 10) / 10,
        source: 'logger',
        recordedBy: admin.sub,
      });
      list.push(r);
    }

    // Add 15-min dense samples around the compressor trip in Room 0
    if (ri === 0) {
      for (let m = 15; m <= 150; m += 15) {
        const peak = 5.8 + Math.sin((m / 150) * Math.PI) * 3.2; // peaks at 9.0°C
        const r = await readingRepo.create({
          roomId: room.id,
          at: new Date(tripStartMs + m * 60_000).toISOString(),
          tempC: Math.round(peak * 10) / 10,
          source: 'logger',
          recordedBy: admin.sub,
        });
        list.push(r);
      }
    }

    // Add a brief 6-min door-open blip (ignored by GRACE_MIN=10) with return-to-setpoint 6 min later
    const blipMs = nowMs - 4 * 3_600_000;
    const blipR = await readingRepo.create({
      roomId: room.id,
      at: new Date(blipMs).toISOString(),
      tempC: Math.round((room.maxC + 2.2) * 10) / 10,
      source: 'logger',
      recordedBy: admin.sub,
    });
    const blipEndR = await readingRepo.create({
      roomId: room.id,
      at: new Date(blipMs + 6 * 60_000).toISOString(),
      tempC: room.setpointC,
      source: 'logger',
      recordedBy: admin.sub,
    });
    list.push(blipR, blipEndR);

    readingsByRoom.set(room.id, list);
  }

  // 48 lots across 5 rooms
  const catalog: { roomIdx: number; category: LotCategory; products: string[]; shelfDays: number; refC: number }[] = [
    {
      roomIdx: 0,
      category: 'dairy',
      products: ['Aged Brie Wheel', 'Alpine Gruyere', 'Cultured Butter', 'Stilton Wedge', 'Fresh Mascarpone', 'Clotted Cream'],
      shelfDays: 14,
      refC: 3.0,
    },
    {
      roomIdx: 1,
      category: 'meat',
      products: ['Smoked Gammon', 'Cured Prosciutto', 'Duck Rillettes', 'Herb Salami', 'Roast Turkey Breast'],
      shelfDays: 12,
      refC: 2.0,
    },
    {
      roomIdx: 2,
      category: 'pharma',
      products: ['Seasonal Flu Vial', 'Pediatric DTaP', 'Insulin Pen Pack', 'Biologic Cold Kit'],
      shelfDays: 30,
      refC: 4.0,
    },
    {
      roomIdx: 3,
      category: 'bakery',
      products: ['Puff Pastry Block', 'Brioche Dough', 'Yule Log Base', 'Tartlet Shells', 'Gelato Tub'],
      shelfDays: 45,
      refC: -18.0,
    },
    {
      roomIdx: 4,
      category: 'chocolate',
      products: ['Single-Origin Truffle', 'Praline Gift Box', 'Dark Couverture', 'Marzipan Stollen'],
      shelfDays: 28,
      refC: 15.0,
    },
  ];

  const createdLots: Lot[] = [];
  let seq = 1;
  // Distribute 48 lots: 11 in Room 0 (touched by compressor trip), 10 in Room 1, 9 in Room 2, 9 in Room 3, 9 in Room 4
  const counts = [11, 10, 9, 9, 9];

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const cat = catalog[ri];
    for (let j = 0; j < counts[ri]; j++) {
      const code = `IH-${String(seq).padStart(3, '0')}`;
      const product = `${cat.products[j % cat.products.length]} #${j + 1}`;
      const ageDays = 2 + Math.floor(rng() * 5);
      const receivedAt = new Date(nowMs - ageDays * 24 * 3_600_000).toISOString();
      const bestBefore = new Date(nowMs + (cat.shelfDays - ageDays) * 24 * 3_600_000).toISOString();
      const baseConsumed = Math.min(82, Math.round((ageDays / cat.shelfDays) * 100));

      let status: Lot['status'] = 'ok';
      let consumedPct = baseConsumed;

      // 4 lots awaiting QA (quarantine / watch) in Room 0 & Room 1
      if (ri === 0 && j < 3) {
        status = 'quarantine';
        consumedPct = 74 + j * 4;
      } else if (ri === 1 && j === 0) {
        // Chilled TCS lot exposed > 4h above 5°C -> forced discard
        status = 'quarantine';
        consumedPct = 88;
      } else if (ri === 3 && j === 0) {
        // Frozen lot thawed
        status = 'quarantine';
        consumedPct = 65;
      } else if (ri === 0 && j === 3) {
        status = 'watch';
        consumedPct = 72;
      }

      const lot = await lotRepo.create({
        code,
        product,
        category: cat.category,
        roomId: room.id,
        qty: 12 + Math.floor(rng() * 36),
        receivedAt,
        bestBefore,
        shelfLifeDays: cat.shelfDays,
        refTempC: cat.refC,
        q10: CONFIG.Q10_BY_CATEGORY[cat.category],
        consumedPct,
        status,
      });
      createdLots.push(lot);
      seq += 1;
    }
  }

  // Record one historical QA discard assessment for Melt ledger
  const sampleDiscard = createdLots[createdLots.length - 1];
  const sampleRoom = rooms.find((r) => r.id === sampleDiscard.roomId) ?? null;
  const ev = evaluateLot(sampleDiscard, sampleRoom, readingsByRoom.get(sampleDiscard.roomId) ?? [], ctx.now);
  await lotRepo.update(sampleDiscard.id, { status: 'discarded', consumedPct: 100 });
  await assessRepo.create({
    lotId: sampleDiscard.id,
    at: new Date(nowMs - 12 * 3_600_000).toISOString(),
    mktC: ev.mktC,
    consumedPct: 100,
    hoursAbove5: ev.hoursAbove5,
    decision: 'discard',
    decidedBy: admin.sub,
    reason: 'End-of-life lot reached 100% consumed shelf life during peak holding.',
  });
}
