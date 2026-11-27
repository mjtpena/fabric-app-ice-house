import { PermissionError, RuleError, type DataStore } from '@x10/shared/data';
import type { Person } from '@x10/shared/identity';

import type { Assessment, AssessmentDecision, Lot, Reading, ReadingSource, Room, Schema } from '../model';
import { evaluateLot } from './thermal';

export interface IceHouseData {
  rooms: Room[];
  lots: Lot[];
  readings: Reading[];
  assessments: Assessment[];
}

export async function loadIceHouse(store: DataStore<Schema>): Promise<IceHouseData> {
  const [rooms, lots, readings, assessments] = await Promise.all([
    store.repo('Room').list(),
    store.repo('Lot').list(),
    store.repo('Reading').list(),
    store.repo('Assessment').list(),
  ]);
  return { rooms, lots, readings, assessments };
}

export async function recordReading(
  store: DataStore<Schema>,
  me: Person,
  roomId: string,
  tempC: number,
  source: ReadingSource = 'manual',
  at = new Date().toISOString(),
): Promise<Reading> {
  if (Number.isNaN(tempC) || tempC < -40 || tempC > 45) {
    throw new RuleError('Temperature must be between -40 °C and 45 °C.');
  }
  return store.repo('Reading').create({
    roomId,
    at,
    tempC: Math.round(tempC * 10) / 10,
    source,
    recordedBy: me.sub,
  });
}

export async function decideLotQa(
  store: DataStore<Schema>,
  me: Person,
  lotId: string,
  decision: AssessmentDecision,
  reason: string,
  now = new Date(),
): Promise<Assessment> {
  if (!me.isAdmin) {
    throw new PermissionError('Only a QA lead (admin) can release, quarantine, or discard a lot.');
  }
  if (reason.trim().length < 3) {
    throw new RuleError('Provide a short reason (at least 3 characters) for the QA record.');
  }

  const data = await loadIceHouse(store);
  const lot = data.lots.find((l) => l.id === lotId);
  if (!lot) throw new RuleError('Lot not found.');
  const room = data.rooms.find((r) => r.id === lot.roomId) ?? null;
  const roomReadings = data.readings.filter((r) => r.roomId === lot.roomId);
  const ev = evaluateLot(lot, room, roomReadings, now);

  if (decision === 'release' && ev.forcedDiscard) {
    throw new RuleError(`Cannot release ${lot.code}: ${ev.forcedDiscardReason}. Discard is mandatory.`);
  }

  const nextStatus = decision === 'release' ? 'released' : decision === 'quarantine' ? 'quarantine' : 'discarded';
  await store.repo('Lot').update(lot.id, {
    status: nextStatus,
    consumedPct: ev.consumedPct,
  });

  return store.repo('Assessment').create({
    lotId: lot.id,
    at: now.toISOString(),
    mktC: ev.mktC,
    consumedPct: ev.consumedPct,
    hoursAbove5: ev.hoursAbove5,
    decision,
    decidedBy: me.sub,
    reason: reason.trim(),
  });
}

export async function pickFromLot(
  store: DataStore<Schema>,
  lotId: string,
  pickQty: number,
): Promise<Lot> {
  const lots = await store.repo('Lot').list();
  const lot = lots.find((l) => l.id === lotId);
  if (!lot) throw new RuleError('Lot not found.');
  if (lot.status === 'quarantine' || lot.status === 'discarded') {
    throw new RuleError(`Lot ${lot.code} is ${lot.status} and cannot be picked.`);
  }
  if (pickQty <= 0 || pickQty > lot.qty) {
    throw new RuleError(`Pick quantity must be between 1 and ${lot.qty}.`);
  }
  return store.repo('Lot').update(lot.id, { qty: lot.qty - pickQty });
}
