import type { EntityDefs } from '@x10/shared/data';
import { AppMarkerDef, PersonDef, type AppMarker, type Person } from '@x10/shared/identity';

export type RoomKind = 'chilled' | 'frozen' | 'controlled-ambient';
export type LotCategory = 'dairy' | 'meat' | 'chocolate' | 'bakery' | 'pharma' | 'produce';
export type LotStatus = 'ok' | 'watch' | 'quarantine' | 'released' | 'discarded';
export type ReadingSource = 'logger' | 'manual';
export type AssessmentDecision = 'release' | 'quarantine' | 'discard';

export const limits = {
  roomName: { min: 2, max: 40 },
  lotCode: { min: 2, max: 20 },
  product: { min: 2, max: 80 },
  reason: { min: 3, max: 400 },
} as const;

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  setpointC: number;
  minC: number;
  maxC: number;
}

export interface Lot {
  id: string;
  code: string;
  product: string;
  category: LotCategory;
  roomId: string;
  qty: number;
  receivedAt: string;
  bestBefore: string;
  shelfLifeDays: number;
  refTempC: number;
  q10: number;
  consumedPct: number;
  status: LotStatus;
}

export interface Reading {
  id: string;
  roomId: string;
  at: string;
  tempC: number;
  source: ReadingSource;
  recordedBy: string;
}

export interface Assessment {
  id: string;
  lotId: string;
  at: string;
  mktC: number;
  consumedPct: number;
  hoursAbove5: number;
  decision: AssessmentDecision;
  decidedBy: string;
  reason: string;
}

export type Schema = {
  Person: Person;
  AppMarker: AppMarker;
  Room: Room;
  Lot: Lot;
  Reading: Reading;
  Assessment: Assessment;
};

export const defs: EntityDefs<Schema> = {
  Person: PersonDef,
  AppMarker: AppMarkerDef,
  Room: {
    name: 'Room',
    fields: {
      id: 'uuid',
      name: 'text',
      kind: 'text',
      setpointC: 'decimal',
      minC: 'decimal',
      maxC: 'decimal',
    },
  },
  Lot: {
    name: 'Lot',
    fields: {
      id: 'uuid',
      code: 'text',
      product: 'text',
      category: 'text',
      roomId: 'uuid',
      qty: 'int',
      receivedAt: 'date',
      bestBefore: 'date',
      shelfLifeDays: 'int',
      refTempC: 'decimal',
      q10: 'decimal',
      consumedPct: 'decimal',
      status: 'text',
    },
  },
  Reading: {
    name: 'Reading',
    fields: {
      id: 'uuid',
      roomId: 'uuid',
      at: 'date',
      tempC: 'decimal',
      source: 'text',
      recordedBy: 'text',
    },
  },
  Assessment: {
    name: 'Assessment',
    fields: {
      id: 'uuid',
      lotId: 'uuid',
      at: 'date',
      mktC: 'decimal',
      consumedPct: 'decimal',
      hoursAbove5: 'decimal',
      decision: 'text',
      decidedBy: 'text',
      reason: 'text',
    },
  },
};
