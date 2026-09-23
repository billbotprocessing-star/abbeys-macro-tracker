# Abbey's Macro Tracker

A mobile-first macro calculator for **Thisisabbs**. Visitors answer 5 quick questions and get:

1. **Your Real Issue**, a diagnosis based on their biggest struggle and goal
2. **Macro targets**: calories, protein, carbs and fat, plus a donut chart
3. **Meal timing and what to eat**, built around their workday, with portions scaled to their targets
4. **A 3-day training plan** with "Watch how" videos and a "Training at home?" swap
5. **A discovery-call booking** (Calendly), prefilled with their answers

It's plain HTML, CSS and JavaScript: no framework, no build step. Every calculation runs in the browser. Leads are collected with **Netlify Forms**.

---

## Files

```
index.html          All screens, the hidden Netlify form, and the video modal
guarantee.html      Results guarantee page (placeholder terms: fill these in)
netlify.toml        Netlify settings (no build, cache and security headers)
css/styles.css      All styles. Brand colours and font are at the top.
js/app.js           Settings, questions, screen flow and rendering
js/calculator.js    Macro math
js/diagnosis.js     "Your Real Issue" wording
js/schedule.js      Meal timing rules, portion scaling, training plan rules
data/meals.json     Sample meals (edit freely)
data/workouts.json  Exercises, cues, videos, home swaps (edit freely)
videos/             Exercise clips, named [exercise-slug].mp4
```

---

## Deploy to Netlify

The simplest setup is to connect this GitHub repo, so every push redeploys automatically.

1. Log in at [app.netlify.com](https://app.netlify.com) and choose **Add new site → Import an existing project**.
2. Pick **GitHub** and select `abbeys-macro-tracker`.
3. Build settings: leave **Build command** empty and set **Publish directory** to `.` (`netlify.toml` already says this).
4. Click **Deploy**.
5. **Turn on form detection** (you only need to do this once). Go to **Site configuration → Forms** and click **Enable form detection**, then trigger a redeploy (**Deploys → Trigger deploy → Deploy site**). Netlify only finds the form during a deploy, so this step is required.
6. After the redeploy, a form called **`macro-leads`** appears under **Forms**. Take the quiz once on the live site to check that a submission comes through.
7. Optional: in **Forms → Form notifications**, add an email notification or a Zapier/webhook so each new lead reaches you or your email tool.
8. Optional: add your own domain under **Domain management**.

> You can also drag the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop), but a GitHub deploy is easier to update.

---

## Settings (top of `js/app.js`)

| Setting | What it does |
|---|---|
| `EMAIL_GATE = true` | Shows "Where should we send your plan?" before the results. Set it to `false` to skip straight to results (no lead is captured). |
| `CALENDLY_URL` | Your Calendly event link. Currently `https://calendly.com/builtbyabbs/kickstart-call-built-by-abbs`. If it's blank, the results page shows a placeholder box. |

### Calendly prefill

Name and email fill in automatically. To also pass the quiz answers, open your Calendly event → **Booking form → Invitee questions** and add **four questions, in this order**:

1. Main goal (`a1`)
2. Biggest struggle (`a2`)
3. Workday (`a3`)
4. Calculated macros (`a4`)

Calendly matches answers by question order, so keep them in this order at the top of the form.

---

## Editing content (no code)

Edit a JSON file, commit, and Netlify redeploys. Keep the quotes, commas and brackets intact. If a page breaks after an edit, paste the file into [jsonlint.com](https://jsonlint.com) to find the typo.

### Meals: `data/meals.json`

Meals are grouped by slot: `breakfast`, `lunch`, `dinner`, `preworkout`, `postworkout`, `packed`, `grabgo`, `eveningSnack`. Keep **at least 3 options per slot**.

```json
{
  "name": "Chicken rice bowl",
  "simple": false,
  "foods": [
    { "item": "grilled chicken breast", "amount": 4, "unit": "oz", "role": "protein", "p": 35, "c": 0, "f": 4 },
    { "item": "cooked jasmine rice", "amount": 1, "unit": "cup", "role": "carb", "p": 4, "c": 45, "f": 0.5 },
    { "item": "roasted vegetables", "amount": 1, "unit": "cup", "role": "extra", "p": 2, "c": 10, "f": 0 }
  ]
}
```

- `p` / `c` / `f` are grams of protein, carbs and fat **for the amount written**.
- `role` controls portion scaling. Foods marked `protein`, `carb` or `fat` are resized to hit each person's meal targets. `extra` foods (veggies, sauces) stay the same.
- `simple: true` marks quick or no-cook meals. People who pick "Too busy, I skip meals" only see these, so keep at least one simple option in every slot.
- Countable foods can use `"unit": ""` with a `"plural"` so the app writes "2 rice cakes". An optional `"step"` sets rounding, e.g. `0.5` for half a banana.

### Workouts: `data/workouts.json`

Two levels (`beginner`, `intermediate`), each with 3 days of 5 exercises:

```json
{
  "name": "Goblet Squat",
  "slug": "goblet-squat",
  "type": "main",
  "sets": 3,
  "video": "videos/goblet-squat.mp4",
  "cues": ["Hold the dumbbell at your chest.", "Sit between your hips.", "Drive through your whole foot."],
  "home": { "name": "Dumbbell Squat", "slug": "dumbbell-squat", "video": "videos/dumbbell-squat.mp4", "cues": ["..."] }
}
```

- `type`: `main` (big lifts: 5–8 reps for the performance goal), `accessory`, or `core` (uses `coreReps`, e.g. `"30–45 sec"`).
- `perSide: true` adds "each side" to the reps.
- `home` is the dumbbell or bodyweight swap shown when "Training at home?" is on.
- Each level's `finisher` is the 5-minute finisher shown for the fat-loss and tone goals.

### Adding exercise videos

Save each clip in `videos/` named after its slug, e.g. `videos/goblet-squat.mp4`. Short (5–15 s), silent, looping MP4s (H.264) under about 3 MB work best on phones. If a file is missing, the modal shows the form cues with a "Video coming soon" placeholder, so you can add videos one at a time.

<details>
<summary>All 54 video file names</summary>

Gym: `goblet-squat`, `dumbbell-bench-press`, `seated-cable-row`, `dumbbell-romanian-deadlift`, `plank`, `leg-press`, `lat-pulldown`, `dumbbell-shoulder-press`, `walking-lunges`, `dead-bug`, `dumbbell-step-ups`, `incline-dumbbell-press`, `chest-supported-dumbbell-row`, `glute-bridge`, `side-plank`, `barbell-back-squat`, `barbell-bench-press`, `barbell-row`, `romanian-deadlift`, `hanging-knee-raise`, `deadlift`, `overhead-press`, `pull-ups`, `bulgarian-split-squat`, `cable-crunch`, `front-squat`, `single-arm-dumbbell-row`, `hip-thrust`, `farmer-carry`

Home: `dumbbell-squat`, `dumbbell-floor-press`, `dumbbell-bent-over-row`, `single-leg-dumbbell-rdl`, `plank-shoulder-taps`, `dumbbell-sumo-squat`, `dumbbell-pullover`, `half-kneeling-dumbbell-press`, `dumbbell-reverse-lunge`, `bird-dog`, `bodyweight-step-up`, `incline-push-up`, `single-leg-glute-bridge`, `side-plank-hip-dips`, `double-dumbbell-front-squat`, `lying-leg-raise`, `dumbbell-deadlift`, `standing-dumbbell-shoulder-press`, `couch-split-squat`, `weighted-crunch`, `dumbbell-front-squat`, `feet-elevated-push-up`, `renegade-row`, `dumbbell-hip-thrust`, `suitcase-carry`

(Each is `videos/<name>.mp4`.)
</details>

### Other wording

- **Questions**: `QUESTIONS` in `js/app.js`. Keep the option keys (A, B, C…), because the rules depend on them.
- **"Your Real Issue" text**: `js/diagnosis.js`
- **Meal times and callouts** (Weekend Strategy etc.): `js/schedule.js`
- **Guarantee terms**: replace the `[bracketed]` text in `guarantee.html`
- **Disclaimer**: bottom of `index.html`

### Brand colours and font

At the top of `css/styles.css`:

```css
--primary: #1F1F1F;   /* charcoal */
--secondary: #F1EEEA; /* warm light grey */
--accent: #7D6B5A;    /* taupe */
```

The palette is intentionally neutral. Buttons use the accent colour with `--accent-ink` (white) text, so keep that pair high-contrast if you change them. The blue, orange and gold on the macro cards and donut (`--c-protein`, `--c-carbs`, `--c-fat`) are data colours, not brand colours: they were chosen so protein, carbs and fat stay easy to tell apart, including for colour-blind visitors. To change the font, swap the Google Fonts `<link>` in `index.html` and `guarantee.html`, and update `--font`.

---

## How the numbers work (`js/calculator.js`)

- **Maintenance** = weight midpoint (Q2: 120 / 145 / 175 / 205 / 235 / 265) × activity (Q3: 13 / 14 / 15 / 16)
- **Calories** = maintenance × goal (Q1: fat loss 0.80, muscle 1.10, fat loss + tone 0.90, performance 1.00), rounded to the nearest 50, never below 1,200
- **Protein**: 1 g per lb (0.8 g per lb for 220 lbs and up). **Fat**: 0.35 g per lb. **Carbs**: the remaining calories ÷ 4
- Grams are rounded to the nearest 5. Results are labelled "estimated starting targets".

Each meal gets a share of the day's macros: protein is split evenly across full meals (snacks get half a share), and carbs lean toward the meals around training. Portions are then scaled to land close to those numbers. For very high targets, a meal can show a "Top up" line instead of a huge plate.

---

## Run it locally

The app loads its JSON with `fetch`, so opening `index.html` straight from your files won't work. Start a tiny local server in the project folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Netlify Forms only works on the live site. Locally the app still shows results and logs a warning in the console.

---

*Estimates only, not medical advice.*
