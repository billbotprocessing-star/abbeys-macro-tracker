/* ==========================================================================
   app.js — screen flow, state and rendering for the Thisisabbs macro calculator
   Screens: intro → quiz (5 questions) → email (optional) → results
   ========================================================================== */

/* ---------- Settings you can change ---------- */

// Show the "Where should we send your plan?" step before results.
// Set to false to go straight from the last question to the results page.
export const EMAIL_GATE = true;

// Name of the Netlify form (must match the hidden form in index.html).
const FORM_NAME = 'macro-leads';

/* ---------- Assessment questions ---------- */
// Each option has a key (A, B, C…) used by the calculator and rules,
// and a label shown to the user (and sent to Netlify / Calendly).
export const QUESTIONS = [
  {
    id: 'goal',
    text: "What's your main goal?",
    options: [
      { key: 'A', label: 'Lose body fat' },
      { key: 'B', label: 'Build muscle' },
      { key: 'C', label: 'Lose fat and tone up at the same time' },
      { key: 'D', label: 'Improve energy and performance' },
    ],
  },
  {
    id: 'weight',
    text: "What's your current weight?",
    options: [
      { key: 'A', label: 'Under 130 lbs' },
      { key: 'B', label: '130–160 lbs' },
      { key: 'C', label: '160–190 lbs' },
      { key: 'D', label: '190–220 lbs' },
      { key: 'E', label: '220–250 lbs' },
      { key: 'F', label: '250+ lbs' },
    ],
  },
  {
    id: 'activity',
    text: 'Which best describes your typical week?',
    options: [
      { key: 'A', label: 'Mostly sitting, not currently working out' },
      { key: 'B', label: 'Somewhat active, working out 1–2x a week' },
      { key: 'C', label: 'Working out 3–4x a week' },
      { key: 'D', label: 'Very active job or working out 5+ times a week' },
    ],
  },
  {
    id: 'struggle',
    text: "What's your biggest struggle right now?",
    options: [
      { key: 'A', label: 'Cravings and snacking at night' },
      { key: 'B', label: 'Too busy, I skip meals' },
      { key: 'C', label: 'Low energy during the day' },
      { key: 'D', label: "I'm good all week, then the weekend happens" },
      { key: 'E', label: "I'm doing everything right but I'm stuck" },
    ],
  },
  {
    id: 'workday',
    text: 'What does a typical workday look like for you?',
    options: [
      { key: 'A', label: 'Standard day shift (roughly 8–5, Monday to Friday)' },
      { key: 'B', label: 'Early shift (I start before 7 AM)' },
      { key: 'C', label: 'Late or evening shift (I work afternoons or nights)' },
      { key: 'D', label: 'Long or unpredictable hours (12+ hour days, on call, or changing shifts)' },
      { key: 'E', label: 'Flexible (I work from home or set my own hours)' },
    ],
  },
];

/** Human-readable label for an answer, e.g. answerLabel('goal', 'A') → "Lose body fat". */
export function answerLabel(questionId, key) {
  const q = QUESTIONS.find((item) => item.id === questionId);
  const opt = q && q.options.find((o) => o.key === key);
  return opt ? opt.label : '';
}

/* ---------- State ---------- */
// Kept in sessionStorage so a refresh doesn't lose progress.
const STORAGE_KEY = 'thisisabbs-macro-state';

const state = loadState() || freshState();

function freshState() {
  return { screen: 'intro', qIndex: 0, answers: {}, lead: { firstName: '', email: '' } };
}

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return saved && saved.screen ? saved : null;
  } catch (e) {
    return null;
  }
}

function saveState() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode — ignore */ }
}

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape text before putting it into innerHTML. */
export function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* ---------- Screen switching ---------- */
function showScreen(name, { focus = true } = {}) {
  state.screen = name;
  saveState();
  $$('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== name; });

  if (name === 'quiz') renderQuestion();
  if (name === 'results') renderResults();

  window.scrollTo(0, 0);
  // Move keyboard / screen-reader focus to the new screen's heading
  if (focus) {
    const heading = $(`[data-screen="${name}"] [tabindex="-1"]`);
    if (heading) heading.focus({ preventScroll: true });
  }
}

/* ---------- Quiz ---------- */
function renderQuestion() {
  const q = QUESTIONS[state.qIndex];
  const n = state.qIndex + 1;
  const total = QUESTIONS.length;

  $('#progress-label').textContent = `Question ${n} of ${total}`;
  $('.progress-track').setAttribute('aria-valuenow', String(n));
  $('#progress-fill').style.width = `${(n / total) * 100}%`;
  $('#question-title').textContent = q.text;

  const selected = state.answers[q.id];
  $('#answers').innerHTML = q.options.map((opt) => `
    <button type="button" class="answer" data-key="${opt.key}" aria-pressed="${opt.key === selected}">
      <span class="answer-key" aria-hidden="true">${opt.key}</span>
      <span>${esc(opt.label)}</span>
    </button>`).join('');
}

function chooseAnswer(key) {
  const q = QUESTIONS[state.qIndex];
  state.answers[q.id] = key;
  saveState();

  // Show the selection briefly, then auto-advance
  $$('#answers .answer').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.key === key)));
  setTimeout(() => {
    if (state.qIndex < QUESTIONS.length - 1) {
      state.qIndex += 1;
      saveState();
      renderQuestion();
      $('#question-title').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else {
      finishQuiz();
    }
  }, 180);
}

function goBack() {
  if (state.screen === 'email') {
    state.qIndex = QUESTIONS.length - 1;
    showScreen('quiz');
  } else if (state.screen === 'quiz' && state.qIndex > 0) {
    state.qIndex -= 1;
    saveState();
    renderQuestion();
    $('#question-title').focus({ preventScroll: true });
  } else {
    showScreen('intro');
  }
}

function finishQuiz() {
  showScreen(EMAIL_GATE ? 'email' : 'results');
}

/* ---------- Results ---------- */
function renderResults() {
  // Filled in by the calculator / results steps
}

/* ---------- Events ---------- */
document.addEventListener('click', (event) => {
  const answer = event.target.closest('.answer');
  if (answer) { chooseAnswer(answer.dataset.key); return; }

  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  switch (actionEl.dataset.action) {
    case 'start':
      state.qIndex = 0;
      showScreen('quiz');
      break;
    case 'back':
      goBack();
      break;
    case 'retake':
      Object.assign(state, freshState());
      showScreen('quiz');
      break;
    default:
      break;
  }
});

/* ---------- Boot ---------- */
$('#year').textContent = new Date().getFullYear();
// Results need all five answers; otherwise resume where the user left off
if (state.screen === 'results' && Object.keys(state.answers).length < QUESTIONS.length) state.screen = 'intro';
showScreen(state.screen, { focus: false });
