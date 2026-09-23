/* ==========================================================================
   schedule.js — meal timing and training schedule
   buildMealPlan()     → timeline of meals (from Q5 workday, adjusted by Q4 struggle)
   scaleMeal()         → scales a meals.json option to hit a meal's macro targets
   buildTrainingPlan() → 3-day plan (level from Q3, reps from Q1, days from Q5)
   No DOM code here — app.js does the rendering.
   ========================================================================== */

import { roundTo } from './calculator.js';

/* ---------- Meal schedules by workday (Q5) ---------- */
// kind: 'meal' or 'train'. slot = which list in meals.json to pull options from.
// role sets the meal's share of the day: main = full meal, light = smaller, snack = half a meal.
// tags: 'pre' (before training: more carbs, less fat), 'post' (after training: more carbs).
// minutes = time of day, used to sort and to shift carbs earlier for "low energy".
const meal = (time, minutes, name, slot, role = 'main', tags = [], note = '') => ({ kind: 'meal', time, minutes, name, slot, role, tags, note });
const train = (time, minutes, name, note = '') => ({ kind: 'train', time, minutes, name, note });

const WORKDAY_SCHEDULES = {
  // A) Standard 8–5
  A: [
    meal('7:00 AM', 420, 'Breakfast before work', 'breakfast'),
    meal('12:00 PM', 720, 'Lunch', 'lunch'),
    meal('3:30 PM', 930, 'Pre-workout snack', 'preworkout', 'snack', ['pre']),
    train('5:30–7:00 PM', 1050, 'Train', 'Prefer mornings? Train before work and swap this snack for breakfast.'),
    meal('7:30 PM', 1170, 'Dinner after training', 'dinner', 'main', ['post']),
  ],
  // B) Early shift (before 7 AM)
  B: [
    meal('4:45 AM', 285, 'Quick breakfast at wake-up', 'breakfast', 'light'),
    meal('10:00 AM', 600, 'Packed meal mid-shift', 'packed'),
    train('3:30–4:30 PM', 930, 'Train right after work'),
    meal('5:00 PM', 1020, 'Post-workout meal', 'postworkout', 'main', ['post']),
    meal('7:30 PM', 1170, 'Light dinner', 'dinner', 'light'),
  ],
  // C) Late / evening shift
  C: [
    meal('10:00 AM', 600, 'Late-morning breakfast', 'breakfast', 'main', ['pre']),
    train('11:30 AM–12:30 PM', 690, 'Train before work'),
    meal('1:00 PM', 780, 'Post-workout meal before your shift', 'postworkout', 'main', ['post']),
    meal('6:30 PM', 1110, 'Packed meal during your shift', 'packed'),
    meal('11:30 PM', 1410, 'Small protein snack after your shift', 'eveningSnack', 'snack'),
  ],
  // D) Long / unpredictable hours: 3 simple meals + 2 grab-and-go options
  D: [
    meal('Within an hour of waking', 420, 'Meal 1', 'breakfast'),
    meal('Between meals', 600, 'Grab-and-go protein #1', 'grabgo', 'snack', [], 'Keep this in your bag, car or locker.'),
    meal('Midday', 780, 'Meal 2', 'packed'),
    train('When your day allows', 900, 'Train · 35–40 min', 'Eat a meal or grab-and-go option 1–2 hours before, and your next meal within 2 hours after.'),
    meal('When your shift runs long', 990, 'Grab-and-go protein #2', 'grabgo', 'snack', [], 'For the day that goes sideways.'),
    meal('Evening', 1170, 'Meal 3', 'dinner'),
  ],
  // E) Flexible / work from home
  E: [
    meal('7:30 AM', 450, 'Breakfast', 'breakfast', 'main', ['pre']),
    train('9:30–10:30 AM', 570, 'Train mid-morning', 'Lunch-hour training works too: just slide lunch after it.'),
    meal('11:30 AM', 690, 'Lunch as your post-workout meal', 'lunch', 'main', ['post']),
    meal('6:30 PM', 1110, 'Dinner', 'dinner'),
    meal('8:30 PM', 1230, 'Optional evening snack', 'eveningSnack', 'snack'),
  ],
};

const MEALS_INTRO = {
  A: 'Built around a standard 8–5 day: fuel before work, a snack before training, and dinner after.',
  B: 'Built around an early shift: eat quick, pack your main meal, and train right after work.',
  C: 'Built around a late shift: breakfast and training before work, then meals that travel.',
  D: "Built for long, unpredictable days: three simple meals plus two grab-and-go options. Move meals around your workouts, and don't worry if the times shift.",
  E: 'Built around a flexible day: train mid-morning and let lunch be your recovery meal.',
};

// How much of each macro a meal gets, relative to a full meal (1).
const ROLE_WEIGHTS = {
  main: { p: 1, c: 1, f: 1 },
  light: { p: 0.75, c: 0.6, f: 0.75 },
  snack: { p: 0.5, c: 0.5, f: 0.5 },
};

/* ---------- Callouts (from Q4) ---------- */
const WEEKEND_TIPS = [
  'Keep your first meal the same as a weekday. Protein at breakfast sets up the whole day.',
  'Plan one fun meal instead of a fun weekend. Pick it, enjoy it, then get right back on plan.',
  'Hit your protein target before evening plans, so drinks and dinner out don’t turn into a free-for-all.',
];

/**
 * Build the meal timeline.
 * @param {object} answers  quiz answer keys
 * @param {{protein:number, carbs:number, fat:number}} macros  daily targets
 * @returns {{intro:string, items:Array, callouts:Array, simpleOnly:boolean, showGrabGo:boolean}}
 */
export function buildMealPlan(answers, macros) {
  const { workday, struggle } = answers;
  // Copy the template so we can adjust it
  const items = (WORKDAY_SCHEDULES[workday] || WORKDAY_SCHEDULES.A).map((item) => ({ ...item, tags: [...(item.tags || [])] }));

  // Start with the role weights, then apply training-related tweaks
  items.forEach((item) => {
    if (item.kind !== 'meal') return;
    item.w = { ...ROLE_WEIGHTS[item.role] };
    if (item.tags.includes('pre')) { item.w.c *= 1.4; item.w.f *= 0.5; }
    if (item.tags.includes('post')) { item.w.c *= 1.4; item.w.f *= 0.8; }
  });

  const callouts = [];

  // Q4 A — night cravings: bigger protein at breakfast + lunch, planned evening protein snack
  if (struggle === 'A') {
    const mains = items.filter((i) => i.kind === 'meal' && i.role !== 'snack');
    mains.slice(0, 2).forEach((i) => { i.w.p *= 1.35; i.boosted = true; });
    let evening = items.find((i) => i.slot === 'eveningSnack');
    if (!evening) {
      evening = meal('8:30 PM', 1230, 'Planned evening protein snack', 'eveningSnack', 'snack');
      evening.w = { ...ROLE_WEIGHTS.snack };
      items.push(evening);
    } else {
      evening.name = evening.name.replace('Optional evening snack', 'Planned evening protein snack');
    }
    evening.w.p = 0.6; evening.w.c = 0.3; evening.w.f = 0.4;
    evening.note = 'Planned, not a slip-up. Eat it slowly and close the kitchen after.';
    items.filter((i) => i.boosted).forEach((i) => { i.note = i.note || 'Extra protein here keeps evening hunger in check.'; });
  }

  // Q4 C — low energy: shift carbs earlier in the day and around training
  if (struggle === 'C') {
    const meals = items.filter((i) => i.kind === 'meal');
    meals.forEach((i, idx) => {
      const early = idx < Math.ceil(meals.length / 2);
      const nearTraining = i.tags.includes('pre') || i.tags.includes('post');
      if (early || nearTraining) i.w.c *= 1.3;
      else i.w.c *= 0.6;
    });
    callouts.push({
      type: 'info',
      title: 'Carbs first, then taper',
      body: 'Most of your carbs now land earlier in the day and around your workout. Keep later meals lighter on carbs and heavier on protein and veggies.',
    });
  }

  // Q4 D — weekend strategy
  if (struggle === 'D') {
    callouts.push({ type: 'warn', title: 'Weekend Strategy', list: WEEKEND_TIPS });
  }

  // Q4 E — plateau: targets are a starting point
  if (struggle === 'E') {
    callouts.push({
      type: 'warn',
      title: 'These numbers are a starting point',
      body: "Your body adapts, so your targets should too. Follow this for 2 weeks, check your progress, and recalculate. That's exactly what we do for you in the full program.",
    });
  }

  // Q4 B — too busy: simple options only + grab-and-go picks
  const simpleOnly = struggle === 'B';
  const showGrabGo = struggle === 'B' && workday !== 'D'; // D already has grab-and-go slots

  // Split the day's macros across meals by weight (protein split evenly across full meals)
  const mealsOnly = items.filter((i) => i.kind === 'meal');
  const totals = mealsOnly.reduce((t, i) => ({ p: t.p + i.w.p, c: t.c + i.w.c, f: t.f + i.w.f }), { p: 0, c: 0, f: 0 });
  mealsOnly.forEach((i) => {
    i.target = {
      p: roundTo((macros.protein * i.w.p) / totals.p, 5),
      c: roundTo((macros.carbs * i.w.c) / totals.c, 5),
      f: roundTo((macros.fat * i.w.f) / totals.f, 5),
    };
  });

  items.sort((a, b) => a.minutes - b.minutes);
  return { intro: MEALS_INTRO[workday] || MEALS_INTRO.A, items, callouts, simpleOnly, showGrabGo };
}

/* ---------- Portion scaling ---------- */
// Default rounding step per unit (override per food with "step" in meals.json)
const UNIT_STEPS = { oz: 0.5, g: 25, cup: 0.25, tbsp: 0.5, tsp: 0.5, scoop: 0.5, slice: 1, bottle: 1, stick: 1, '': 1 };
const PLURAL_UNITS = { cup: 'cups', slice: 'slices', scoop: 'scoops', bottle: 'bottles', stick: 'sticks' };
const ROLE_MACRO = { protein: 'p', carb: 'c', fat: 'f' };

/**
 * Scale a meal option so it lands close to the meal's p/c/f targets.
 * Protein foods, carb foods and fat foods each get one scale factor; we solve
 * for the three factors together (a tiny 3×3 linear system), then round each
 * portion to a sensible kitchen amount and report the resulting macros.
 */
export function scaleMeal(option, target) {
  const roles = ['protein', 'carb', 'fat'].filter((r) => option.foods.some((f) => f.role === r));
  const sum = (role, m) => option.foods.filter((f) => f.role === role).reduce((s, f) => s + f[m], 0);
  const fixed = (m) => option.foods.filter((f) => !ROLE_MACRO[f.role]).reduce((s, f) => s + f[m], 0);

  // Solve for the free roles; if a factor lands outside sensible portion sizes,
  // lock it at the limit and re-solve the others with it fixed.
  const factor = {};
  for (let pass = 0; pass < roles.length; pass += 1) {
    const free = roles.filter((r) => !(r in factor));
    if (!free.length) break;
    const locked = (m) => Object.entries(factor).reduce((s, [r, k]) => s + k * sum(r, m), 0);
    // Row per macro we're solving for, column per role
    const A = free.map((r) => free.map((col) => sum(col, ROLE_MACRO[r])));
    const b = free.map((r) => target[ROLE_MACRO[r]] - fixed(ROLE_MACRO[r]) - locked(ROLE_MACRO[r]));
    const solved = solveLinear(A, b) || free.map((r, i) => (A[i][i] ? b[i] / A[i][i] : 1));
    const out = free.filter((r, i) => clamp(solved[i], MIN_SCALE, MAX_SCALE) !== solved[i]);
    if (!out.length) { free.forEach((r, i) => { factor[r] = solved[i]; }); break; }
    // Lock the most out-of-range factor, then try again
    const worst = free.reduce((w, r, i) => {
      const dist = Math.abs(clamp(solved[i], MIN_SCALE, MAX_SCALE) - solved[i]);
      return dist > w.dist ? { r, i, dist } : w;
    }, { dist: -1 });
    factor[worst.r] = clamp(solved[worst.i], MIN_SCALE, MAX_SCALE);
  }

  const foods = option.foods.map((food) => {
    const k = factor[food.role] || 1;
    const step = food.step || UNIT_STEPS[food.unit] || 0.25;
    const amount = Math.max(step, roundTo(food.amount * k, step));
    const ratio = amount / food.amount;
    return { ...food, amount, p: food.p * ratio, c: food.c * ratio, f: food.f * ratio };
  });
  const total = foods.reduce((t, f) => ({ p: t.p + f.p, c: t.c + f.c, f: t.f + f.f }), { p: 0, c: 0, f: 0 });
  const macros = { p: Math.round(total.p), c: Math.round(total.c), f: Math.round(total.f) };

  // Big targets can outgrow a sensible plate — suggest a simple top-up instead
  const topUps = [];
  const shortP = target.p - macros.p;
  const shortC = target.c - macros.c;
  if (shortP >= 10) topUps.push(`+${roundTo(shortP, 5)} g protein (e.g. a protein shake or Greek yogurt)`);
  if (shortC >= 20) topUps.push(`+${roundTo(shortC, 5)} g carbs (e.g. fruit, rice or bread)`);

  return { name: option.name, foods: foods.map(formatFood), macros, topUp: topUps.join(' and ') };
}

// Keep portions between ¼× and 3× the written amount
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 1)); }

/** Gaussian elimination for a small square system. Returns null if singular. */
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-9) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      for (let c = col; c <= n; c += 1) M[r][c] -= k * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** "1.5 cups cooked rice", "2 rice cakes", "½ banana" */
function formatFood(food) {
  const amt = formatAmount(food.amount);
  const many = food.amount > 1;
  if (!food.unit) return `${amt} ${many && food.plural ? food.plural : food.item}`;
  const unit = many && PLURAL_UNITS[food.unit] ? PLURAL_UNITS[food.unit] : food.unit;
  return `${amt} ${unit} ${food.item}`;
}

function formatAmount(n) {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100) / 100;
  const symbol = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac];
  if (!symbol) return String(Math.round(n * 100) / 100);
  return whole ? `${whole}${symbol}` : symbol;
}

/* ==========================================================================
   Training
   ========================================================================== */

const TRAINING_DAYS = {
  A: { header: 'train Mon/Wed/Fri, early morning or 5:30–7 PM', days: ['Mon', 'Wed', 'Fri'] },
  B: { header: 'train Mon/Wed/Fri, right after work', days: ['Mon', 'Wed', 'Fri'] },
  C: { header: 'train Tue/Thu/Sat, late morning before work', days: ['Tue', 'Thu', 'Sat'] },
  D: { header: 'train any 3 non-consecutive days, 35–40 min sessions using supersets', days: [null, null, null] },
  E: { header: 'train Mon/Wed/Fri, mid-morning or at lunch', days: ['Mon', 'Wed', 'Fri'] },
};

// Rep scheme from Q1 goal. "main" = the big lift of each day, "other" = everything else.
const REP_SCHEMES = {
  A: { summary: '10–15 reps, short rest, plus a 5-minute finisher', main: { reps: '10–15', rest: '45 sec' }, other: { reps: '10–15', rest: '30–45 sec' }, finisher: true },
  C: { summary: '10–15 reps, short rest, plus a 5-minute finisher', main: { reps: '10–15', rest: '45 sec' }, other: { reps: '10–15', rest: '30–45 sec' }, finisher: true },
  B: { summary: '8–12 reps to build muscle', main: { reps: '8–12', rest: '90 sec' }, other: { reps: '8–12', rest: '60 sec' }, finisher: false },
  D: { summary: '5–8 reps on main lifts for strength, 8–12 on the rest', main: { reps: '5–8', rest: '2–3 min' }, other: { reps: '8–12', rest: '60–90 sec' }, finisher: false },
};

/**
 * Build the 3-day training plan.
 * @param {object} answers  quiz answer keys
 * @param {object} workouts contents of data/workouts.json
 * @param {boolean} atHome  swap every exercise for its home alternative
 */
export function buildTrainingPlan(answers, workouts, atHome = false) {
  const levelKey = answers.activity === 'A' || answers.activity === 'B' ? 'beginner' : 'intermediate';
  const level = workouts.levels[levelKey];
  const scheme = REP_SCHEMES[answers.goal] || REP_SCHEMES.B;
  const timing = TRAINING_DAYS[answers.workday] || TRAINING_DAYS.A;
  const supersets = answers.workday === 'D';

  const days = level.days.map((day, dayIdx) => {
    const exercises = day.exercises.map((ex, i) => {
      const src = atHome && ex.home ? { ...ex, ...ex.home, type: ex.type } : ex;
      const isCore = ex.type === 'core';
      const plan = ex.type === 'main' ? scheme.main : scheme.other;
      let rest = isCore ? '30–45 sec' : plan.rest;
      let label = '';
      if (supersets) {
        // Pair exercises: A1/A2, B1/B2, then C1 on its own
        const pair = Math.floor(i / 2);
        const letter = 'ABC'[pair];
        const second = i % 2 === 1;
        const lastAlone = i === day.exercises.length - 1 && i % 2 === 0;
        label = `${letter}${lastAlone ? '' : second ? '2' : '1'}`;
        if (!second && !lastAlone) rest = `None, go to ${letter}2`;
        else if (!isCore) rest = '60–90 sec';
      }
      return {
        name: src.name,
        cues: src.cues || [],
        sets: src.sets || ex.sets,
        reps: isCore ? (src.coreReps || ex.coreReps || '30–45 sec') : `${plan.reps}${src.perSide ? ' each side' : ''}`,
        rest,
        label,
      };
    });
    return {
      tab: `Day ${dayIdx + 1}`,
      sub: timing.days[dayIdx] || '',
      focus: day.focus,
      exercises,
    };
  });

  const finisher = scheme.finisher ? level.finisher : null;
  return {
    header: `Based on your workday: ${timing.header}`,
    levelLabel: level.label,
    meta: `${level.label} level · ${scheme.summary}${supersets ? ' · run pairs back to back as supersets' : ''}`,
    days,
    finisher,
  };
}
