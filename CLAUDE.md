# CLAUDE.md

Project context and working rules for the **Alef.FiT** fitness app. Read this before doing any work in this repo.

> Behavioural rules live in [`AGENTS.md`](./AGENTS.md). This file is project context + conventions. When the two overlap, AGENTS.md wins.

---

## 1. What this is

A personal training app, **Android-first** (target device: Samsung Galaxy S26 Ultra), iOS as an optional secondary target. Built with **Flutter**. **Offline-first**: all data lives on the device; backup is by file export (and optional Google Drive).

The app has **5 bottom-navigation tabs**:

| # | Tab (code name) | Purpose |
|---|-----------------|---------|
| 1 | **Exercise** (`exercise`)   | Library of workouts grouped by body part. View technique, image carousel, mp4 video. Add/edit workouts. |
| 2 | **Discipline** (`discipline`) | Sub-modules: To-do list, Notes, Bodybuilding (knowledge + image gallery), Alarm/Reminder, Weight trend. |
| 3 | **Program** (`program`)     | Named multi-day programs (Day 1–7) made of exercises with planned sets/reps. In-workout logging with video background, sets/reps, timer/stopwatch, dated history. |
| 4 | **Retro** (`retro`)         | History of past sessions by date; analysis of progress, intensity, duration, and bulk/cut weight phases. |
| 5 | **Setting** (`settings`)    | All adjustable functions: appearance & text size, backup & sync, image/media options, per-module folders & tags, to-do alert defaults, section card backgrounds, localization, about. See [`docs/SETTINGS_SPEC.md`](./docs/SETTINGS_SPEC.md). |

Full detail: [`docs/SCREEN_MAP.md`](./docs/SCREEN_MAP.md). Original design references are in [`FitnessApp/`](./FitnessApp/) (filenames describe each screen).

---

## 2. Tech stack (decided)

- **Framework:** Flutter (stable channel), Dart 3.
- **State management:** Riverpod v2 (`flutter_riverpod`, `riverpod_annotation`).
- **Navigation:** `go_router` with `StatefulShellRoute` for the 5 persistent tabs.
- **Local database:** **Drift** (SQLite) — relational, type-safe, reactive, first-class migrations (important for continuous schema evolution).
- **Media:** `video_player` + `chewie` for mp4; `image_picker` / `file_picker` for adding media; files stored in app documents dir, paths in DB.
- **Notifications/alarms:** `flutter_local_notifications` + `timezone`.
- **Charts:** `fl_chart` (weight trend, Retro analysis).
- **Backup:** `archive` (zip), `path_provider`, `share_plus`, `file_picker`; optional Drive via `googleapis` + `google_sign_in` (later).
- **Localization:** `flutter_localizations` + `intl` + gen-l10n. Locales: **English + Thai**. **Calendar: CE (Gregorian) is the system standard**; a Buddhist-Era (BE) display toggle is optional.
- **Keep-awake during workout:** `wakelock_plus`.

Rationale and alternatives considered: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 3. Repo layout

```
.
├── AGENTS.md                 # AI behavioural guidelines (authoritative)
├── CLAUDE.md                 # this file
├── README.md
├── docs/                     # the plan / architecture (read these)
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── SCREEN_MAP.md
│   ├── BACKUP_AND_VERSIONING.md
│   ├── SETTINGS_SPEC.md      # detailed Setting-tab behaviour
│   ├── DESIGN_SYSTEM.md      # the unified visual language (design phase)
│   ├── ROADMAP.md
│   └── SETUP.md              # how to bootstrap the Flutter project
├── FitnessApp/               # original design reference images (not bundled in build)
└── app/                      # the Flutter project (alef_fit)
    ├── pubspec.yaml
    ├── analysis_options.yaml
    └── lib/
        ├── main.dart
        ├── app.dart
        ├── core/             # cross-cutting: theme, router, database, l10n, widgets
        └── features/         # one folder per feature: exercise, discipline, program, retro, settings
            └── <feature>/
                ├── data/        # Drift DAOs, repositories
                ├── domain/      # entities, repository interfaces (only when it earns its keep)
                └── presentation/# screens, widgets, Riverpod providers
```

**Feature-first.** Code is organised by feature, not by layer. Shared things go in `core/`.

---

## 4. Architecture conventions

- **Offline-first, single source of truth = the Drift database.** UI watches DB streams (via Riverpod). No hidden in-memory caches that can drift out of sync.
- **Layering, kept light (per AGENTS.md "simplicity first"):**
  - `presentation` → Riverpod providers → `data` repositories → Drift.
  - Add a `domain` layer (entities + interfaces) **only** where it removes real duplication or enables testing. Do not create a use-case class for a one-line passthrough.
- **No business logic in widgets.** Widgets read providers and render. Logic lives in providers/repositories.
- **Media is referenced, not embedded.** Store file paths in the DB; copy imported media into the app documents dir under a stable folder structure.
- **All user-facing strings go through l10n** (`AppLocalizations`), never hard-coded — English and Thai from day one.
- **Dates:** store as UTC epoch millis (or ISO-8601) in the DB. **Default display is CE (Gregorian)**; an optional BE toggle formats at the edge only. Storage, logic, and exports are always CE. Never store formatted date strings.

---

## 5. Coding standards

- Follow `analysis_options.yaml` (flutter_lints + a few extra rules). `flutter analyze` must be clean.
- `dart format .` before every commit.
- Naming: files `snake_case.dart`; classes `UpperCamelCase`; providers `camelCaseProvider`.
- Prefer composition over inheritance; prefer `const` constructors.
- Keep widgets small; extract once a `build` method gets unwieldy.
- **Surgical changes only** (AGENTS.md §3): don't reformat or refactor unrelated code.

---

## 6. Common commands

> The platform folders (`android/`, `ios/`) are generated once via `flutter create` — see [`docs/SETUP.md`](./docs/SETUP.md). Run these from `app/`.

```bash
flutter pub get                              # install deps
dart run build_runner build -d              # generate Drift + Riverpod code
flutter gen-l10n                             # generate localization
flutter analyze                              # lint (must be clean)
dart format .                                # format
flutter test                                 # unit/widget tests
flutter run                                  # run on device/emulator
flutter build apk --release                  # Android build
```

After editing any Drift table, Riverpod-annotated provider, or `.arb` file, re-run the codegen commands above.

---

## 7. Data & schema changes

The schema is owned by Drift in `app/lib/core/database/`. Every schema change **must**:

1. Bump `schemaVersion`.
2. Add a migration step in the `MigrationStrategy`.
3. Update [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md).

Never edit data shape without a migration — existing users have real history that must survive upgrades. See [`docs/BACKUP_AND_VERSIONING.md`](./docs/BACKUP_AND_VERSIONING.md).

---

## 8. Two kinds of "backup" — don't confuse them

- **Code backup / version control** = Git + remote (GitHub). Branches, tags, CHANGELOG.
- **User-data backup** = in-app export of DB + media to a `.zip` (and optional Google Drive). Offline-first; the user owns their file.

Both are specified in [`docs/BACKUP_AND_VERSIONING.md`](./docs/BACKUP_AND_VERSIONING.md).

---

## 9. Working agreement

- This is a **collaborative, staged** build. Plan and get sign-off before implementing a milestone (see [`docs/ROADMAP.md`](./docs/ROADMAP.md)).
- When something is ambiguous, **stop and ask** (AGENTS.md §1). State assumptions explicitly.
- This Cowork environment **cannot compile Flutter**. Code is written to be correct and idiomatic; the user builds/runs it in Flutter + Android Studio.
