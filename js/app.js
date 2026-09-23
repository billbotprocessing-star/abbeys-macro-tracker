/* ==========================================================================
   app.js — screen flow, state and rendering for the Thisisabbs macro calculator
   Screens: intro → quiz (5 questions) → email (optional) → results
   ========================================================================== */

import { calculateMacros, macroSplit } from './calculator.js';
import { getDiagnosis } from './diagnosis.js';
import { buildMealPlan, scaleMeal, buildTrainingPlan } from './schedule.js';

/* ---------- Settings you can change ---------- */

// Show the "Where should we send your plan?" step before results.
// Set to false to go straight from the last question to the results page.
export const EMAIL_GATE = true;

// Name of the Netlify form (must match the hidden form in index.html).
const FORM_NAME = 'macro-leads';

// Your Calendly event link. If this is blank or not a calendly.com link,
// the results page shows a placeholder instead of the booking calendar.
const CALENDLY_URL = 'https://calendly.com/builtbyabbs/kickstart-call-built-by-abbs';

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

/* ---------- Content (JSON) ---------- */
// meals.json and workouts.json are loaded once and cached.
let contentPromise = null;
function loadContent() {
  if (!contentPromise) {
    const get = (url) => fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
      return res.json();
    });
    contentPromise = Promise.all([get('data/meals.json'), get('data/workouts.json')])
      .then(([meals, workouts]) => ({ meals, workouts }));
  }
  return contentPromise;
}

// Results-page view state (not saved): which meal option is showing per slot, home toggle
const view = { mealChoice: {}, atHome: false, day: 0 };

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
  if (name === 'email') {
    $('#first_name').value = state.lead.firstName || '';
    $('#email').value = state.lead.email || '';
  }
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
async function renderResults() {
  const macros = calculateMacros(state.answers);
  const name = state.lead.firstName;
  $('#results-greeting').textContent = name ? `${name}, here's your plan` : "Here's your plan";

  renderIssue(getDiagnosis(state.answers));
  renderMacroCards(macros);
  renderDonut(macros);
  renderCta(macros);

  try {
    const content = await loadContent();
    renderMeals(buildMealPlan(state.answers, macros), content.meals);
    workoutData = content.workouts;
    renderTraining();
  } catch (err) {
    console.error(err);
    $('#timeline').innerHTML = '<li class="callout warn">Sorry, the meal and training content could not load. Please refresh the page.</li>';
  }
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

/* 3. Meal timing & what to eat */
let mealPlan = null;
let mealData = null;

function renderMeals(plan, meals) {
  mealPlan = plan;
  mealData = meals;
  const perMeal = plan.items.filter((i) => i.kind === 'meal' && i.role === 'main').map((i) => i.target.p);
  const typical = perMeal.length ? Math.round(perMeal.reduce((a, b) => a + b, 0) / perMeal.length / 5) * 5 : 0;
  $('#meals-intro').textContent = `${plan.intro} Aim for about ${typical} g of protein at each main meal.`;

  let callouts = plan.callouts.map(renderCallout).join('');
  if (plan.showGrabGo) {
    const picks = mealOptions('grabgo').slice(0, 3).map((o) => o.name);
    callouts += renderCallout({ type: 'info', title: 'Grab-and-go backups', body: 'For the days you know you’ll skip a meal, keep one of these on hand:', list: picks });
  }
  $('#meal-callouts').innerHTML = callouts;
  $('#timeline').innerHTML = plan.items.map((item, idx) => renderTimelineItem(item, idx)).join('');
}

/** Options for a meal slot; "too busy" users only see the simple ones. */
function mealOptions(slot) {
  const all = (mealData && mealData.slots[slot]) || [];
  const simple = all.filter((o) => o.simple);
  return mealPlan && mealPlan.simpleOnly && simple.length ? simple : all;
}

function renderCallout(c) {
  return `
    <aside class="callout ${c.type === 'warn' ? 'warn' : ''}">
      <h3>${esc(c.title)}</h3>
      ${c.body ? `<p>${esc(c.body)}</p>` : ''}
      ${c.list ? `<ul>${c.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : ''}
    </aside>`;
}

function renderTimelineItem(item, idx) {
  if (item.kind === 'train') {
    return `
      <li class="tl-item train">
        <div class="tl-card">
          <div class="tl-time">${esc(item.time)}</div>
          <h3 class="tl-name">${esc(item.name)}</h3>
          ${item.note ? `<p class="tl-note">${esc(item.note)}</p>` : ''}
        </div>
      </li>`;
  }
  return `<li class="tl-item" id="meal-${idx}">${renderMealCard(item, idx)}</li>`;
}

function renderMealCard(item, idx) {
  const options = mealOptions(item.slot);
  const choice = currentChoice(idx) % Math.max(options.length, 1);
  const scaled = options.length ? scaleMeal(options[choice], item.target) : null;
  const pill = (label, value, color) => `<span class="pill"><span class="dot" style="background:${color}"></span>${label} ${value} g</span>`;
  return `
    <div class="tl-card">
      <div class="tl-time">${esc(item.time)}</div>
      <h3 class="tl-name">${esc(item.name)}</h3>
      ${item.note ? `<p class="tl-note">${esc(item.note)}</p>` : ''}
      ${scaled ? `
        <p class="tl-option">${esc(scaled.name)}</p>
        <ul class="tl-foods">${scaled.foods.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <div class="tl-macros" aria-label="Approximate macros">
          ${pill('Protein', scaled.macros.p, 'var(--c-protein)')}
          ${pill('Carbs', scaled.macros.c, 'var(--c-carbs)')}
          ${pill('Fat', scaled.macros.f, 'var(--c-fat)')}
        </div>
        ${scaled.topUp ? `<p class="tl-note">Top up: ${esc(scaled.topUp)}</p>` : ''}
        ${options.length > 1 ? `<button type="button" class="btn btn-outline btn-small" data-action="next-meal" data-idx="${idx}">Try another option <span class="muted">(${choice + 1} of ${options.length})</span></button>` : ''}
      ` : ''}
    </div>`;
}

/** Which option a meal shows; repeat slots (e.g. two grab-and-go) start on different options. */
function currentChoice(idx) {
  if (idx in view.mealChoice) return view.mealChoice[idx];
  const slot = mealPlan.items[idx].slot;
  return mealPlan.items.slice(0, idx).filter((i) => i.slot === slot).length;
}

function nextMealOption(idx) {
  const item = mealPlan.items[idx];
  view.mealChoice[idx] = (currentChoice(idx) + 1) % mealOptions(item.slot).length;
  const li = $(`#meal-${idx}`);
  li.innerHTML = renderMealCard(item, idx);
  $('[data-action="next-meal"]', li).focus();
}

/* 4. Training plan */
let workoutData = null;
let trainingPlan = null;

function renderTraining() {
  trainingPlan = buildTrainingPlan(state.answers, workoutData, view.atHome);
  $('#training-header').textContent = trainingPlan.header;
  $('#training-meta').textContent = trainingPlan.meta;
  $('#home-toggle').setAttribute('aria-checked', String(view.atHome));

  $('#day-tabs').innerHTML = trainingPlan.days.map((day, i) => `
    <button type="button" class="tab" role="tab" id="tab-${i}" aria-controls="panel-${i}"
      aria-selected="${i === view.day}" tabindex="${i === view.day ? 0 : -1}" data-day="${i}">
      ${esc(day.tab)}${day.sub ? `<small>${esc(day.sub)}</small>` : ''}
    </button>`).join('');

  $('#day-panels').innerHTML = trainingPlan.days.map((day, i) => `
    <div class="day-panel" role="tabpanel" id="panel-${i}" aria-labelledby="tab-${i}" ${i === view.day ? '' : 'hidden'}>
      <p class="day-focus">${esc(day.focus)}</p>
      <ol class="exercise-list">
        ${day.exercises.map((ex) => `
          <li class="exercise">
            <h3 class="exercise-name">${ex.label ? `<span class="superset-tag">${ex.label}</span>` : ''}${esc(ex.name)}</h3>
            <dl class="exercise-stats">
              <div><dt>Sets</dt><dd>${ex.sets}</dd></div>
              <div><dt>Reps</dt><dd>${esc(ex.reps)}</dd></div>
              <div><dt>Rest</dt><dd>${esc(ex.rest)}</dd></div>
            </dl>
            ${ex.cues.length ? `
              <details class="cues-toggle">
                <summary>Form tips</summary>
                <ul class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
              </details>` : ''}
          </li>`).join('')}
      </ol>
      ${trainingPlan.finisher ? `
        <aside class="callout finisher">
          <h3>${esc(trainingPlan.finisher.title)}</h3>
          <p>${esc(trainingPlan.finisher.text)}</p>
        </aside>` : ''}
    </div>`).join('');
}

function selectDay(i, { focus = false } = {}) {
  view.day = i;
  $$('#day-tabs [role="tab"]').forEach((tab, idx) => {
    tab.setAttribute('aria-selected', String(idx === i));
    tab.tabIndex = idx === i ? 0 : -1;
  });
  $$('#day-panels [role="tabpanel"]').forEach((panel, idx) => { panel.hidden = idx !== i; });
  if (focus) $(`#tab-${i}`).focus();
}

/* 5. Discovery call CTA + Calendly */
function renderCta(macros) {
  const { struggle, workday } = state.answers;
  const reasons = [];
  if (struggle === 'E') reasons.push("You're doing everything right and still stuck, and that's exactly when coaching pays off most: your numbers get recalculated every 2 weeks, so your body never gets the chance to adapt and stall.");
  if (workday === 'D') reasons.push("With long, unpredictable hours, a fixed plan breaks fast. Weekly check-ins adjust your meals and training to the week you actually have.");
  const why = $('#cta-why');
  why.hidden = !reasons.length;
  why.textContent = reasons.join(' ');

  const slot = $('#calendly-slot');
  if (!/^https:\/\/calendly\.com\//.test(CALENDLY_URL)) {
    slot.innerHTML = `
      <div class="calendly-placeholder">
        <p><strong>Booking calendar goes here.</strong></p>
        <p class="muted">Set <code>CALENDLY_URL</code> in <code>js/app.js</code> to show your Calendly scheduler.</p>
      </div>`;
    return;
  }

  const prefill = calendlyPrefill(macros);
  slot.innerHTML = `
    <div class="calendly-inline-widget" id="calendly-embed"></div>
    <p class="calendly-fallback muted">Calendar not loading? <a href="${esc(calendlyLink(prefill))}" target="_blank" rel="noopener">Open the booking page</a>.</p>`;
  loadCalendly().then(() => {
    window.Calendly.initInlineWidget({
      url: `${CALENDLY_URL}?hide_gdpr_banner=1`,
      parentElement: $('#calendly-embed'),
      prefill,
    });
  }).catch(() => { /* fallback link is already on the page */ });
}

/**
 * Calendly prefill. Name and email are native fields. Goal, struggle, workday and
 * macros go into custom questions a1–a4: add four questions to your Calendly event,
 * in this order, for them to show up (see README).
 */
function calendlyPrefill(m) {
  const a = state.answers;
  return {
    name: state.lead.firstName || '',
    email: state.lead.email || '',
    customAnswers: {
      a1: answerLabel('goal', a.goal),
      a2: answerLabel('struggle', a.struggle),
      a3: answerLabel('workday', a.workday),
      a4: `${m.calories} kcal · ${m.protein} g protein · ${m.carbs} g carbs · ${m.fat} g fat`,
    },
  };
}

function calendlyLink(prefill) {
  const params = new URLSearchParams({ name: prefill.name, email: prefill.email, ...prefill.customAnswers });
  return `${CALENDLY_URL}?${params}`;
}

let calendlyPromise = null;
function loadCalendly() {
  if (window.Calendly) return Promise.resolve();
  if (!calendlyPromise) {
    calendlyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return calendlyPromise;
}

/* ---------- Email capture (Netlify Forms) ---------- */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function submitLead(form) {
  const firstName = form.first_name.value.trim();
  const email = form.email.value.trim();

  // Validate
  const errors = { first_name: !firstName, email: !EMAIL_PATTERN.test(email) };
  Object.entries(errors).forEach(([field, bad]) => {
    form[field].setAttribute('aria-invalid', String(bad));
    form[field].setAttribute('aria-describedby', bad ? `${field}-error` : '');
    $(`#${field}-error`).hidden = !bad;
  });
  const firstBad = Object.keys(errors).find((k) => errors[k]);
  if (firstBad) { form[firstBad].focus(); return; }

  state.lead = { firstName, email };
  saveState();

  const button = $('button[type="submit"]', form);
  button.disabled = true;
  button.textContent = 'Building your plan…';

  // Honeypot filled in → a bot. Skip the submission but don't tell it.
  if (!form['bot-field'].value) {
    const m = calculateMacros(state.answers);
    const a = state.answers;
    const body = new URLSearchParams({
      'form-name': FORM_NAME,
      first_name: firstName,
      email,
      goal: answerLabel('goal', a.goal),
      weight: answerLabel('weight', a.weight),
      activity: answerLabel('activity', a.activity),
      struggle: answerLabel('struggle', a.struggle),
      workday: answerLabel('workday', a.workday),
      calories: String(m.calories),
      protein_g: String(m.protein),
      carbs_g: String(m.carbs),
      fat_g: String(m.fat),
    });
    try {
      // Don't make people wait on a slow network — give up after 5 seconds
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) console.warn(`Lead form returned ${res.status}. Netlify Forms only works on the deployed site.`);
    } catch (err) {
      console.warn('Lead form could not be sent:', err);
    }
  }

  button.disabled = false;
  button.textContent = 'Show my plan';
  showScreen('results');
}

/* ---------- Events ---------- */
document.addEventListener('click', (event) => {
  const answer = event.target.closest('.answer');
  if (answer) { chooseAnswer(answer.dataset.key); return; }

  const tab = event.target.closest('[role="tab"][data-day]');
  if (tab) { selectDay(Number(tab.dataset.day)); return; }

  if (event.target.closest('#home-toggle')) {
    view.atHome = !view.atHome;
    renderTraining();
    $('#home-toggle').focus();
    return;
  }

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
    case 'next-meal':
      nextMealOption(Number(actionEl.dataset.idx));
      break;
    case 'retake':
      Object.assign(state, freshState());
      view.mealChoice = {};
      view.atHome = false;
      view.day = 0;
      showScreen('quiz');
      break;
    default:
      break;
  }
});

document.addEventListener('keydown', (event) => {
  // Tabs: arrow keys move between days
  const tab = event.target.closest && event.target.closest('[role="tab"][data-day]');
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const count = trainingPlan.days.length;
    const current = Number(tab.dataset.day);
    const next = { ArrowLeft: (current - 1 + count) % count, ArrowRight: (current + 1) % count, Home: 0, End: count - 1 }[event.key];
    selectDay(next, { focus: true });
  }
});

$('#lead-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitLead(event.currentTarget);
});

/* ---------- Boot ---------- */
$('#year').textContent = new Date().getFullYear();
// Results need all five answers; otherwise resume where the user left off
if (state.screen === 'results' && Object.keys(state.answers).length < QUESTIONS.length) state.screen = 'intro';
showScreen(state.screen, { focus: false });
