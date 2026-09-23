/* ==========================================================================
   calculator.js — macro math
   Pure functions only (no DOM), so the numbers are easy to check and change.
   ========================================================================== */

// Q2: weight range → midpoint in lbs
export const WEIGHT_MIDPOINTS = { A: 120, B: 145, C: 175, D: 205, E: 235, F: 265 };

// Q3: activity → calories per lb of bodyweight to maintain
export const ACTIVITY_MULTIPLIERS = { A: 13, B: 14, C: 15, D: 16 };

// Q1: goal → adjustment on maintenance calories
export const GOAL_ADJUSTMENTS = { A: 0.80, B: 1.10, C: 0.90, D: 1.00 };

export const MIN_CALORIES = 1200;
export const FAT_PER_LB = 0.35;
// Protein per lb: 1 g, or 0.8 g for the two heaviest weight ranges (Q2 E/F)
const proteinPerLb = (weightKey) => (weightKey === 'E' || weightKey === 'F' ? 0.8 : 1);

const CAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

/** Round a number to the nearest step (e.g. 50 for calories, 5 for grams). */
export function roundTo(value, step) {
  return Math.round(value / step) * step;
}

/**
 * Calculate estimated starting targets.
 * @param {{goal:string, weight:string, activity:string}} answers  quiz answer keys
 * @returns {{calories:number, protein:number, carbs:number, fat:number,
 *            weight:number, maintenance:number}}
 */
export function calculateMacros(answers) {
  const weight = WEIGHT_MIDPOINTS[answers.weight];
  const multiplier = ACTIVITY_MULTIPLIERS[answers.activity];
  const adjustment = GOAL_ADJUSTMENTS[answers.goal];
  if (!weight || !multiplier || !adjustment) throw new Error('Missing answers for the calculation');

  const maintenance = weight * multiplier;
  // Round to the nearest 50, then apply the 1,200 floor
  const calories = Math.max(MIN_CALORIES, roundTo(maintenance * adjustment, 50));

  const protein = roundTo(weight * proteinPerLb(answers.weight), 5);
  const fat = roundTo(weight * FAT_PER_LB, 5);
  // Carbs fill whatever calories are left (never negative)
  const carbCalories = calories - protein * CAL_PER_G.protein - fat * CAL_PER_G.fat;
  const carbs = Math.max(0, roundTo(carbCalories / CAL_PER_G.carbs, 5));

  return { calories, protein, carbs, fat, weight, maintenance: roundTo(maintenance, 50) };
}

/** Share of calories from each macro, as fractions that add up to 1. */
export function macroSplit({ protein, carbs, fat }) {
  const p = protein * CAL_PER_G.protein;
  const c = carbs * CAL_PER_G.carbs;
  const f = fat * CAL_PER_G.fat;
  const total = p + c + f || 1;
  return { protein: p / total, carbs: c / total, fat: f / total };
}
