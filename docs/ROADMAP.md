# Roadmap

Staged, reviewable steps. We don't start a step until the previous one is signed off (per `AGENTS.md`: goal-driven, verify before/after). Each step ends with a buildable app and a tagged release.

**The design ↔ build loop (every step):** Claude proposes the screen design as rendered mockups → you approve or adjust → Claude builds it to match → we verify. Design never runs ahead of an approved direction; code never runs ahead of an approved design.

---

### Step 0 — Scaffold & architecture ✅ (done)
Docs, `CLAUDE.md`, runnable empty app shell (5 tabs, theme stub, routing, l10n setup, Drift schema started).
**Done when:** repo reviewed; `flutter run` shows the 5-tab shell after bootstrap.

### Step 1 — Design system (Claude-led) 🎨 ← the unifying design pass
Turn the mixed reference screens into **one cohesive theme** without losing features. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).
- Claude delivers mockups of the key screens (Exercise list/detail, Program logging + timer, Discipline home + folders/tags, Retro, Settings home + a detail, card-background treatment) for your sign-off.
- Then implements: design tokens + `AppTheme`, a reusable component library in `core/widgets`, the `app_settings` store, and theme + **text-size** wiring.
**Done when:** mockups approved and the shell + components render in the agreed theme. Tag `v0.1.0-design`.

### Step 2 — M1 · Data foundation + Exercise library
- Finalise Drift schema + first migration; repositories + tests (in-memory DB).
- Seed the 9 body parts.
- Exercise tab on the design system: body-part list (viewed/count), exercise list, **add/edit exercise** (name, muscle, steps, default sets/reps), media add (photo + mp4, honouring image-quality + save-to-album), detail carousel + video.
**Done when:** you can add a body part's workouts with your own media and view them. Tag `v0.2.0`.

### Step 3 — M2 · Program builder + in-workout logging
- Program list/detail (days, planned sets/reps); add exercises from library or custom.
- Logging overlay over video: weight/reps per set, date picker (no future), past records inline, save.
- Timer/stopwatch: 3-2-1 countdown, interval timer, round counter, editable durations, swipe edit/delete.
**Done when:** you can run a program day and log real sets. Tag `v0.3.0`.

### Step 4 — M3 · Retro (History) + backup/restore
- Session list by date; session detail → logged sets.
- Analysis: volume/intensity over time, duration; weight bulk/cut chart (`fl_chart`).
- **Backup/restore** `.zip` export/import (Retro "Backup" button + Settings); Google Drive sync groundwork.
**Done when:** history is reviewable and a full backup can be exported and restored. Tag `v0.4.0`.

### Step 5 — M4 · Discipline modules
- To-do list (sub-tasks, repeat, **all-day + alert defaults** from Settings).
- Notes (templates, attachments, **folders + tags**).
- Bodybuilding (knowledge + gallery, its **own folders + tags**).
- Alarms (`flutter_local_notifications`); Weight trend recorder.
**Done when:** all Discipline sub-modules usable. Tag `v0.5.0`.

### Step 6 — M5 · Settings, localization & polish
- Assemble the full **Setting** tab ([SETTINGS_SPEC.md](./SETTINGS_SPEC.md)): appearance & text size, backup & sync UI + Google Drive, photos & media (save-to-album, image quality), per-module folder/tag management screens, to-do alert defaults, **section card backgrounds**, calendar (CE/BE), about.
- **EN/TH localization** complete; final visual polish to the design system.
**Done when:** every adjustable function works and the app feels finished on the S26 Ultra. Tag `v1.0.0-rc`.

### Step 7 — M6 · Release & optional iOS
- Android release build/signing; Play listing (if publishing).
- Optional iOS pass (build, icons, permissions, device test).
**Done when:** shippable Android build; iOS buildable if pursued. Tag `v1.0.0`.

---

## Where settings live (so nothing is blocked)
- **Step 1:** settings *store* + core appearance (theme, text size, calendar).
- **With each feature:** that feature's own settings (e.g. folders/tags in M4, to-do alert defaults in M4).
- **Step 6 (M5):** the unified Settings tab assembles everything + adds backup/sync UI, image options, and card backgrounds.

## Parked for later (not in v1)
Multi-device cloud sync, supersets/circuits, kg/lb everywhere, cardio-specific logging, per-section special card behaviours (defined when each module lands).

## Suggested next step
Finalise this plan, then start **Step 1 (Design system)** — I'll bring mockups of the key screens for your sign-off before writing any themed code.
