# Screen Map

Every screen, grouped by tab, with the source design reference in [`FitnessApp/`](../FitnessApp/). The bottom navigation (5 persistent tabs) is always present except on full-screen workout/logging views.

Legend: 🟢 has design mockup · ⚪ to be designed (no mockup provided).

---

## Tab 1 — Exercise

| Screen | What it does | Ref |
|---|---|---|
| 🟢 **Body-part list** | Cards in priority order — Chest, Back, Leg, Shoulder, Bicep, Triceps, Abs, Compound, Functional, Stretching — with accent color, "viewed" progress ring, exercise count. Calf rolls into Leg; forearm flexors→Bicep, extensors→Triceps. | `1-Exercise - show subcategories *` |
| 🟢 **Exercise list** | Workouts in a body part: thumbnail + name. Top-right **add** button. | `1-Exercise … show the workout.PNG` |
| 🟢 **Exercise detail** | Image/video carousel (page dots), **play** for mp4, target muscle, step-by-step technique. Top-right **edit**. | `1-Exercise … detailed info *` |
| ⚪ **Add / edit exercise** | Form: name, body part, target muscle, steps, default sets/reps, add photos/mp4. | — |

## Tab 2 — Discipline

| Screen | What it does | Ref |
|---|---|---|
| 🟢 **Discipline home** | Cards for the sub-modules (same visual style as Exercise). Sub-categories can be added. | `2-Discipline.png` |
| 🟢 **Fitness To-do list** | Tasks grouped by date/Today, check-off, sub-tasks (0/n), quick-add. | `2-Discipline-1 …` |
| 🟢 **Fitness Note** | Folder list → notes; editor with templates (Plan / Strategy / Motivation), tags, attachments. Folders & tags managed in Settings. | `2-Discipline-2 …` |
| 🟢 **Bodybuilding** | Own folder list → knowledge notes + image gallery; own tag set, **separate** from Notes. Managed in Settings. | `2-Discipline-3 …` |
| 🟢 **Alarm / Reminder** | List of alarms; add new; repeat rules; enable/disable. | `2-Discipline-4 …` |
| ⚪ **Weight trend recorder** | Log body weight (+ optional body-fat, photo); trend chart. Feeds Retro bulk/cut analysis. | — |

## Tab 3 — Program

| Screen | What it does | Ref |
|---|---|---|
| 🟢 **Program list** | Programs by category (bodybuilding, bulking, cutting, endurance, custom). | `3-Program-Body Project …`, `3-Program-Bodybuilding-list …` |
| 🟢 **Program detail** | Days 1–n, each listing exercises with planned sets/reps; **Edit**. Add exercises from the library or custom. | `3-Program-Bodybuilding-list of workout each day …` |
| 🟢 **Exercise (in program)** | Video plays; carousel; entry point to logging. | `3-Program-Body Project … video playing …` |
| 🟢 **Logging overlay** | Over the video: Weight(kg) + Repetitions per set, **date picker (no future)**, **past records inline**, Save/Cancel, Round n/total. | `3-Program-Bodybuilding-d1 … overlay table …` |
| 🟢 **Timer / stopwatch mode** | 3-2-1 countdown → interval timer with rep count, round counter, editable durations, swipe to edit/delete entries. | `3-Program-Bodybuilding-d2 … stopwatch …` |

## Tab 4 — Retro (History)

| Screen | What it does | Ref |
|---|---|---|
| 🟢 **History list** | Past sessions by date. Top bar: **Edit** / **Backup**. | `4-Retro … show History records …` |
| 🟢 **Session detail** | Exercises performed that day → tap for the logged sets/reps. | `4-Retro … inside show the details` |
| ⚪ **Analysis** | Progress (volume/intensity over time), duration, weight bulk/cut phases. Charts. | — |

## Tab 5 — Setting

All adjustable functions live here. Full behaviour + option lists: [SETTINGS_SPEC](./SETTINGS_SPEC.md).

| Screen | What it does | Ref |
|---|---|---|
| ⚪ **Settings home** | Grouped list: Appearance · Backup & sync · Photos & media · Modules · About. | — |
| ⚪ **Appearance** | Text size (*follow system* or *manual slider*), theme, language (EN/TH), **calendar (CE standard, optional BE)**. | — |
| ⚪ **Backup & sync** | Export/import `.zip` (DB + media); Google Drive sync; last backup/sync status. | `4-Retro … (Backup button)` |
| ⚪ **Photos & media** | Save to phone album (on/off); image quality (Original / Normal / Low). | — |
| ⚪ **Fitness Note — folders & tags** | Edit folder list; manage tags (Notes only). | — |
| ⚪ **Bodybuilding — folders & tags** | Edit folder list; manage tags (Bodybuilding only, separate). | — |
| ⚪ **To-do defaults** | Default alerts for timed + all-day to-dos (hour/minute slider); "create all-day when no time" switch. | — |
| ⚪ **Section card backgrounds** | Customize each section/sub-module card's background image + accent. | — |
| ⚪ **About** | Version, changelog link, credits. | — |

---

## Navigation model

- `StatefulShellRoute.indexedStack` with one branch per tab; each tab keeps its own back stack and scroll state.
- **Full-screen routes** (push above the shell, hiding the bottom bar): Exercise detail (video), Program logging overlay, Timer mode.
- Deep-link-ready paths, e.g. `/program/:programId/day/:dayIndex/exercise/:exerciseId/log`.
