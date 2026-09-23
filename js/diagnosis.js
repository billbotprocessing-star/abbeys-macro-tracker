/* ==========================================================================
   diagnosis.js — the "Your Real Issue" rules
   Headline comes from Q4 (biggest struggle). The explanation is tailored to
   the Q1 goal (A fat loss · B muscle · C fat loss + tone · D energy/performance).
   Edit the wording freely — keep the keys (A–E / A–D) the same.
   ========================================================================== */

const DIAGNOSES = {
  // Q4 A — cravings and snacking at night
  A: {
    headline: "You're under-eating protein early in the day, so hunger peaks at night.",
    why: "Night cravings usually aren't a willpower problem. When breakfast and lunch are light on protein, your hunger builds all day and then shows up at 9 PM.",
    byGoal: {
      A: "And because you're eating less to lose fat, that gap gets bigger, which is why the evening feels like a fight.",
      B: "For building muscle, that also means your body gets most of its protein in one late window instead of all day, when it can actually use it.",
      C: "When you're trying to lose fat and tone at the same time, those late snacks quietly eat into the calorie gap you need, and the toning stalls.",
      D: "It also explains the afternoon dip: without protein earlier in the day, your energy runs out before your day does.",
    },
    fix: "Your plan below front-loads protein at breakfast and lunch and gives you a planned evening protein snack, so night hunger has nothing to feed on.",
  },

  // Q4 B — too busy, skipping meals
  B: {
    headline: "Your issue isn't what you eat — it's meal structure.",
    why: "When meals get skipped, your body goes hours on empty, and the next meal turns into whatever is closest.",
    byGoal: {
      A: "For fat loss, that swing between too little and too much makes your weekly calories unpredictable, so results feel random.",
      B: "You can't build muscle on two rushed meals a day. You need steady protein spread across the whole day, not just at dinner.",
      C: "Losing fat and toning up at the same time needs consistent protein. Skipped meals mean it never adds up to your target.",
      D: "Long gaps without food are one of the fastest ways to drain your energy and blunt your performance in the gym.",
    },
    fix: "Your plan below gives you a simple meal schedule that fits your workday, with quick options and grab-and-go picks for your busiest days.",
  },

  // Q4 C — low energy during the day
  C: {
    headline: "Your fuel timing is off. Your energy follows your carbs.",
    why: "Carbs are your body's quickest fuel. When most of them land at night, or you skip them until dinner, your daytime energy has nothing to run on.",
    byGoal: {
      A: "While you're losing fat, you don't need fewer carbs across the board, just carbs at the right times, so you stay sharp during the day and still in a calorie deficit.",
      B: "For building muscle, training on low fuel means weaker sessions and slower progress, even if your total food is right.",
      C: "To lose fat and tone, you need to train hard enough to change your shape, and that means fuel before you train, not after you've crashed.",
      D: "For energy and performance, timing matters more than anything: the same food at a different time can feel like a different diet.",
    },
    fix: "Your plan below moves your carbs earlier in the day and around your workouts, so your energy lines up with your schedule.",
  },

  // Q4 D — good all week, then the weekend
  D: {
    headline: "You don't have a willpower problem. You have a weekend plan problem.",
    why: "Five good days followed by two unplanned ones can cancel out the whole week, and that's not a discipline issue. Your weekends just don't have a structure yet.",
    byGoal: {
      A: "For fat loss, two high-calorie days can erase most of the deficit you built Monday to Friday, which is why the scale won't move.",
      B: "For building muscle, the weekend usually means skipped protein and missed training, and that slows your gains.",
      C: "When you're losing fat and toning, weekend swings keep you stuck in the middle, not quite losing and not quite building.",
      D: "Your energy on Monday is decided by the late nights and irregular meals of Saturday and Sunday.",
    },
    fix: "Your plan below keeps the same meal rhythm all week and adds a Weekend Strategy with three simple rules you can actually follow.",
  },

  // Q4 E — doing everything right but stuck
  E: {
    headline: "Your body has adapted. Your targets need recalculating.",
    why: "The plan that got you here was built for an earlier version of you, and as your body changes, the old numbers stop working.",
    byGoal: {
      A: "For fat loss, a plateau usually means your deficit has quietly shrunk. It's time for fresh numbers, not more restriction.",
      B: "For building muscle, stalling often means your food hasn't kept up with your training. Your body needs a new target to keep growing.",
      C: "Losing fat and toning at the same time needs precise numbers, and they need updating as your body changes.",
      D: "Performance plateaus usually come from fuel and training that stopped progressing. Same inputs, same outputs.",
    },
    fix: "Your plan below resets your targets and shows how to fuel and train around your week. These are starting numbers to recalculate every 2 weeks.",
  },
};

/**
 * Build the diagnosis for a set of answers.
 * @param {{goal:string, struggle:string}} answers
 * @returns {{headline:string, explanation:string, fix:string}}
 */
export function getDiagnosis({ goal, struggle }) {
  const d = DIAGNOSES[struggle] || DIAGNOSES.E;
  return {
    headline: d.headline,
    explanation: `${d.why} ${d.byGoal[goal] || ''}`.trim(),
    fix: d.fix,
  };
}
