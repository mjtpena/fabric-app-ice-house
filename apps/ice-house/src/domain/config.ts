import type { LotCategory } from '../model';

/**
 * Cold-chain & shelf-life constants for Ice House.
 * Q10 values are illustrative defaults per food/pharma category (labelled so on About page).
 */
export const CONFIG = {
  /** Pharmacopoeial activation energy divided by gas constant: ΔH / R = 10 000 K (ΔH = 83.144 kJ/mol). */
  DELTA_H_OVER_R: 10000,
  /** Kelvin offset from Celsius. */
  KELVIN_OFFSET: 273.15,
  /** Consecutive out-of-range minutes required before an excursion is logged (ignores brief door opens). */
  GRACE_MIN: 10,
  /** Hard food safety rule: chilled TCS lots with > 4 cumulative hours above 5 °C must be discarded. */
  MAX_HOURS_ABOVE_5: 4,
  /** Chilled TCS threshold temperature (°C). */
  TCS_TEMP_C: 5,
  /** Frozen thaw threshold (°C): above -12 °C for >= 30 min may not be re-frozen. */
  FROZEN_THAW_C: -12,
  /** Frozen thaw duration threshold (minutes). */
  FROZEN_THAW_MIN: 30,
  /** Consumed shelf life percentage that triggers mandatory QA review. */
  QA_REVIEW_PCT: 70,
  /** Consumed shelf life percentage that forces discard. */
  FORCED_DISCARD_PCT: 100,
  /** Effective expiry window (days) highlighted in Today alerts. */
  EXPIRY_ALERT_DAYS: 3,
  /** Illustrative Q10 factors per category. */
  Q10_BY_CATEGORY: {
    dairy: 3.0,
    meat: 3.0,
    chocolate: 2.0,
    bakery: 2.5,
    pharma: 2.0,
    produce: 2.8,
  } as Record<LotCategory, number>,
} as const;
