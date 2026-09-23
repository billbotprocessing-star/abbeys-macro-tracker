/* ==========================================================================
   app.js — screen flow, state and rendering for the Thisisabbs macro calculator
   Screens: intro → quiz (5 questions) → email (optional) → results
   ========================================================================== */

import { calculateMacros, macroSplit } from './calculator.js';
import { getDiagnosis } from './diagnosis.js';

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
  const macros = calculateMacros(state.answers);
  const name = state.lead.firstName;
  $('#results-greeting').textContent = name ? `${name}, here's your plan` : "Here's your plan";

  renderIssue(getDiagnosis(state.answers));
  renderMacroCards(macros);
  renderDonut(macros);
}

/* 1. Your Real Issue */
function renderIssue(d) {
  $('#issue').innerHTML = `
    <p class="eyebrow">Your real issue</p>
    <h2 id="issue-title">${esc(d.headline)}</h2>
    <p>${esc(d.explanation)}</p>
    <p class="issue-fix">${esc(d.fix)}</p>`;
}

/* 2. Macro targets: four cards + donut */
function renderMacroCards(m) {
  const cards = [
    { cls: 'cal', label: 'Calories', value: m.calories.toLocaleString(), unit: 'kcal', sub: 'per day' },
    { cls: 'protein', label: 'Protein', value: m.protein, unit: 'g', sub: `${m.protein * 4} kcal` },
    { cls: 'carbs', label: 'Carbs', value: m.carbs, unit: 'g', sub: `${m.carbs * 4} kcal` },
    { cls: 'fat', label: 'Fat', value: m.fat, unit: 'g', sub: `${m.fat * 9} kcal` },
  ];
  $('#macro-cards').innerHTML = cards.map((c) => `
    <div class="macro-card ${c.cls}">
      <div class="macro-label">${c.label}</div>
      <div class="macro-value">${c.value}<span class="macro-unit">${c.unit}</span></div>
      <div class="macro-sub">${c.sub}</div>
    </div>`).join('');
}

function renderDonut(m) {
  const split = macroSplit(m);
  const parts = [
    { key: 'protein', label: 'Protein', color: 'var(--c-protein)', grams: m.protein },
    { key: 'carbs', label: 'Carbs', color: 'var(--c-carbs)', grams: m.carbs },
    { key: 'fat', label: 'Fat', color: 'var(--c-fat)', grams: m.fat },
  ];
  // Donut drawn with stroke-dasharray on circles (circumference = 100 units)
  const r = 15.9155;
  const gap = 1.2; // small surface-coloured gap between segments
  let offset = 25; // start at 12 o'clock
  const arcs = parts.map((p) => {
    const len = split[p.key] * 100;
    const drawn = Math.max(0, len - gap);
    const arc = `<circle cx="21" cy="21" r="${r}" fill="none" stroke="${p.color}" stroke-width="6"
      stroke-dasharray="${drawn.toFixed(2)} ${(100 - drawn).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>`;
    offset -= len;
    return arc;
  }).join('');

  const pct = (k) => Math.round(split[k] * 100);
  const summary = parts.map((p) => `${p.label} ${pct(p.key)}%`).join(', ');
  $('#macro-donut').innerHTML = `
    <svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Calorie split: ${summary}">
      <circle cx="21" cy="21" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"></circle>
      ${arcs}
      <text x="21" y="20.5" text-anchor="middle" font-size="5.2" font-weight="800" fill="var(--ink)">${m.calories.toLocaleString()}</text>
      <text x="21" y="26" text-anchor="middle" font-size="3.2" font-weight="600" fill="var(--muted)">kcal / day</text>
    </svg>
    <div>
      <ul class="donut-legend">
        ${parts.map((p) => `<li><span class="swatch" style="background:${p.color}"></span><span><strong>${pct(p.key)}%</strong> ${p.label} · <span class="nowrap">${p.grams} g</span></span></li>`).join('')}
      </ul>
      <figcaption class="donut-caption">Share of daily calories</figcaption>
    </div>`;
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
