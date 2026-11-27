import type { Lot, Reading, Room } from '../model';
import { CONFIG } from './config';

export interface TempSample {
  at: string; // ISO timestamp
  tempC: number;
}

/**
 * Rule 1: Time-weighted Mean Kinetic Temperature (MKT).
 * MKT = (ΔH/R) / -ln( Σ(w_i * exp(-ΔH/(R * T_i))) / Σw_i ) - 273.15
 * where T_i is in Kelvin and ΔH/R = 10 000 K.
 */
export function computeMKT(samples: readonly TempSample[]): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return Math.round(samples[0].tempC * 100) / 100;

  const sorted = samples.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const dHR = CONFIG.DELTA_H_OVER_R;

  let weightedExpSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < sorted.length; i++) {
    const tMs = Date.parse(sorted[i].at);
    let weight: number;
    if (i < sorted.length - 1) {
      weight = Math.max(1, Date.parse(sorted[i + 1].at) - tMs);
    } else {
      // Last sample carries the same interval weight as the previous interval
      weight = Math.max(1, tMs - Date.parse(sorted[i - 1].at));
    }
    const tempK = sorted[i].tempC + CONFIG.KELVIN_OFFSET;
    weightedExpSum += weight * Math.exp(-dHR / tempK);
    totalWeight += weight;
  }

  if (totalWeight <= 0 || weightedExpSum <= 0) return Math.round(sorted[0].tempC * 100) / 100;
  const meanExp = weightedExpSum / totalWeight;
  const mktK = dHR / -Math.log(meanExp);
  return Math.round((mktK - CONFIG.KELVIN_OFFSET) * 100) / 100;
}

/** Simple time-weighted arithmetic mean for comparison with MKT. */
export function computeArithmeticMean(samples: readonly TempSample[]): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return Math.round(samples[0].tempC * 100) / 100;
  const sorted = samples.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let sum = 0;
  let totalWeight = 0;
  for (let i = 0; i < sorted.length; i++) {
    const tMs = Date.parse(sorted[i].at);
    const weight = i < sorted.length - 1 ? Math.max(1, Date.parse(sorted[i + 1].at) - tMs) : Math.max(1, tMs - Date.parse(sorted[i - 1].at));
    sum += sorted[i].tempC * weight;
    totalWeight += weight;
  }
  return Math.round((sum / totalWeight) * 100) / 100;
}

/**
 * Rule 2: Consumed shelf-life percentage over a series of readings.
 * Each interval adds Δt_hours * Q10^((T - Tref) / 10) / shelfLifeHours * 100.
 */
export function computeConsumedPct(
  samples: readonly TempSample[],
  refTempC: number,
  q10: number,
  shelfLifeDays: number,
  baseConsumedPct = 0,
): number {
  const shelfLifeHours = Math.max(1, shelfLifeDays * 24);
  if (samples.length < 2) return Math.min(100, Math.max(0, Math.round(baseConsumedPct * 100) / 100));

  const sorted = samples.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let consumed = baseConsumedPct;

  for (let i = 0; i < sorted.length - 1; i++) {
    const dtHours = Math.max(0, (Date.parse(sorted[i + 1].at) - Date.parse(sorted[i].at)) / 3_600_000);
    const rate = Math.pow(q10, (sorted[i].tempC - refTempC) / 10);
    consumed += ((dtHours * rate) / shelfLifeHours) * 100;
  }

  return Math.min(100, Math.max(0, Math.round(consumed * 100) / 100));
}

export type ExcursionSeverity = 'minor' | 'major' | 'critical';

export interface Excursion {
  startAt: string;
  endAt: string;
  durationMin: number;
  peakTempC: number;
  direction: 'high' | 'low';
  severity: ExcursionSeverity;
}

/**
 * Rule 3a: Detect excursions where consecutive readings are outside [minC, maxC]
 * for strictly longer than GRACE_MIN (10 min). Brief door opens are ignored.
 */
export function detectExcursions(
  samples: readonly TempSample[],
  minC: number,
  maxC: number,
  graceMin: number = CONFIG.GRACE_MIN,
): Excursion[] {
  if (samples.length < 2) return [];
  const sorted = samples.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const excursions: Excursion[] = [];

  let runStartIdx = -1;
  let peakTemp = 0;
  let dir: 'high' | 'low' = 'high';

  const flush = (endIdx: number) => {
    if (runStartIdx < 0) return;
    const startMs = Date.parse(sorted[runStartIdx].at);
    const endMs = Date.parse(sorted[endIdx].at);
    const durationMin = Math.round((endMs - startMs) / 60_000);
    if (durationMin > graceMin) {
      const overshoot = dir === 'high' ? peakTemp - maxC : minC - peakTemp;
      let severity: ExcursionSeverity = 'minor';
      if (durationMin >= 120 || overshoot >= 4) severity = 'critical';
      else if (durationMin >= 30 || overshoot >= 2) severity = 'major';
      excursions.push({
        startAt: sorted[runStartIdx].at,
        endAt: sorted[endIdx].at,
        durationMin,
        peakTempC: Math.round(peakTemp * 10) / 10,
        direction: dir,
        severity,
      });
    }
    runStartIdx = -1;
  };

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i].tempC;
    const outHigh = t > maxC;
    const outLow = t < minC;
    if (outHigh || outLow) {
      const curDir: 'high' | 'low' = outHigh ? 'high' : 'low';
      if (runStartIdx < 0) {
        runStartIdx = i;
        peakTemp = t;
        dir = curDir;
      } else if (curDir !== dir) {
        flush(i);
        runStartIdx = i;
        peakTemp = t;
        dir = curDir;
      } else {
        if (dir === 'high' && t > peakTemp) peakTemp = t;
        if (dir === 'low' && t < peakTemp) peakTemp = t;
      }
    } else if (runStartIdx >= 0) {
      flush(i);
    }
  }
  if (runStartIdx >= 0) flush(sorted.length - 1);

  return excursions;
}

/**
 * Rule 3b: Cumulative hours above a threshold temperature (e.g. 5 °C for chilled TCS).
 */
export function computeHoursAbove(samples: readonly TempSample[], thresholdC: number): number {
  if (samples.length < 2) return 0;
  const sorted = samples.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let hours = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].tempC > thresholdC) {
      hours += Math.max(0, (Date.parse(sorted[i + 1].at) - Date.parse(sorted[i].at)) / 3_600_000);
    }
  }
  return Math.round(hours * 100) / 100;
}

/**
 * Rule 3c: Check if a frozen lot thawed (above -12 °C for >= 30 consecutive minutes).
 */
export function hasFrozenThaw(samples: readonly TempSample[]): boolean {
  const ex = detectExcursions(samples, -999, CONFIG.FROZEN_THAW_C, CONFIG.FROZEN_THAW_MIN - 1);
  return ex.some((e) => e.direction === 'high' && e.durationMin >= CONFIG.FROZEN_THAW_MIN);
}

export interface LotEvaluation {
  lot: Lot;
  room: Room | null;
  mktC: number;
  consumedPct: number;
  remainingPct: number;
  hoursAbove5: number;
  frozenThawed: boolean;
  forcedDiscard: boolean;
  forcedDiscardReason: string | null;
  needsQa: boolean;
  effectiveExpiry: string; // ISO
  daysToEffectiveExpiry: number;
  excursionCount: number;
  fefoConflict: boolean;
}

/**
 * Rules 1–5 combined evaluation for a single lot against its room's readings.
 */
export function evaluateLot(
  lot: Lot,
  room: Room | null,
  roomReadings: readonly Reading[],
  now: Date,
): LotEvaluation {
  const relevant = roomReadings.filter((r) => Date.parse(r.at) >= Date.parse(lot.receivedAt));
  const samples: TempSample[] = relevant.map((r) => ({ at: r.at, tempC: r.tempC }));

  const mktC = samples.length > 0 ? computeMKT(samples) : (room?.setpointC ?? lot.refTempC);
  const meanTemp = samples.length > 0 ? computeArithmeticMean(samples) : (room?.setpointC ?? lot.refTempC);
  const consumedPct = Math.max(
    lot.consumedPct,
    computeConsumedPct(samples, lot.refTempC, lot.q10, lot.shelfLifeDays, 0),
  );
  const remainingPct = Math.max(0, Math.round((100 - consumedPct) * 10) / 10);
  const hoursAbove5 = computeHoursAbove(samples, CONFIG.TCS_TEMP_C);
  const frozenThawed = room?.kind === 'frozen' && hasFrozenThaw(samples);
  const excursions = room ? detectExcursions(samples, room.minC, room.maxC) : [];

  let forcedDiscardReason: string | null = null;
  if (consumedPct >= CONFIG.FORCED_DISCARD_PCT) {
    forcedDiscardReason = '100% shelf life consumed';
  } else if (room?.kind === 'chilled' && hoursAbove5 > CONFIG.MAX_HOURS_ABOVE_5) {
    forcedDiscardReason = `Chilled TCS exceeded ${CONFIG.MAX_HOURS_ABOVE_5}h above ${CONFIG.TCS_TEMP_C}°C (${hoursAbove5.toFixed(1)}h)`;
  } else if (frozenThawed) {
    forcedDiscardReason = `Frozen lot thawed above ${CONFIG.FROZEN_THAW_C}°C for ≥${CONFIG.FROZEN_THAW_MIN} min`;
  }

  const forcedDiscard = forcedDiscardReason !== null;
  const needsQa = !forcedDiscard && (consumedPct >= CONFIG.QA_REVIEW_PCT || lot.status === 'quarantine' || lot.status === 'watch');

  // Rule 4: Effective expiry = now + remaining life at lot's mean temperature
  const rateAtMean = Math.pow(lot.q10, (meanTemp - lot.refTempC) / 10);
  const remainingRefHours = (remainingPct / 100) * lot.shelfLifeDays * 24;
  const remainingHoursAtMean = rateAtMean > 0 ? remainingRefHours / rateAtMean : 0;
  const effectiveExpiryMs = now.getTime() + remainingHoursAtMean * 3_600_000;
  const effectiveExpiry = new Date(effectiveExpiryMs).toISOString();
  const daysToEffectiveExpiry = Math.round((remainingHoursAtMean / 24) * 10) / 10;

  // FEFO conflict: effective expiry is earlier than printed best-before by > 1 day
  const fefoConflict = Date.parse(lot.bestBefore) - effectiveExpiryMs > 86_400_000;

  return {
    lot,
    room,
    mktC,
    consumedPct: Math.round(consumedPct * 10) / 10,
    remainingPct,
    hoursAbove5,
    frozenThawed,
    forcedDiscard,
    forcedDiscardReason,
    needsQa,
    effectiveExpiry,
    daysToEffectiveExpiry,
    excursionCount: excursions.length,
    fefoConflict,
  };
}

/**
 * Rule 4: FEFO pick order — earliest effective expiry first, with `watch` lots
 * placed last unless QA has released them. Excludes discarded and quarantined lots.
 */
export function fefoOrder(evaluations: readonly LotEvaluation[]): LotEvaluation[] {
  return evaluations
    .filter((e) => e.lot.status !== 'discarded' && e.lot.status !== 'quarantine' && !e.forcedDiscard && e.lot.qty > 0)
    .slice()
    .sort((a, b) => {
      const aWatch = a.lot.status === 'watch' ? 1 : 0;
      const bWatch = b.lot.status === 'watch' ? 1 : 0;
      if (aWatch !== bWatch) return aWatch - bWatch;
      return Date.parse(a.effectiveExpiry) - Date.parse(b.effectiveExpiry);
    });
}
