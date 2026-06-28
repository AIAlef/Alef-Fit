# Architecture

How Alef.FiT is put together and why. Companion docs: [DATA_MODEL](./DATA_MODEL.md), [SCREEN_MAP](./SCREEN_MAP.md), [BACKUP_AND_VERSIONING](./BACKUP_AND_VERSIONING.md), [ROADMAP](./ROADMAP.md).

---

## 1. Principles

1. **Offline-first.** The app is fully usable with no network. The on-device database is the single source of truth. Cloud (Drive) is an optional backup destination, never a runtime dependency.
2. **Android-first, not Android-only.** Primary target is the Galaxy S26 Ultra. iOS stays buildable but is a secondary concern; nothing platform-specific is hard-coded where a plugin abstracts it.
3. **Simplicity first** (per `AGENTS.md`). Feature-first folders, light layering. No abstraction without a second caller. No speculative configurability.
4. **Your data is sacred.** Real training history must survive every app update (enforced via DB migrations) and be exportable at any time.

---

## 2. High-level shape

```
┌─────────────────────────────────────────────────────────┐
│  Presentation  (Flutter widgets + Riverpod providers)    │
│  go_router StatefulShellRoute → 5 tabs                    │
└───────────────▲─────────────────────────────────────────┘
                │ watch / read (reactive streams)
┌───────────────┴─────────────────────────────────────────┐
│  Repositories  (one per feature, plain Dart classes)     │
│  translate UI intent ↔ persistence; own business rules   │
└───────────────▲─────────────────────────────────────────┘
                │ DAOs (type-safe queries)
┌───────────────┴─────────────────────────────────────────┐
│  Data  — Drift (SQLite)  +  media files on disk          │
│  single source of truth; reactive query streams          │
└──────────────────────────────────────────────────────────┘
        │                         │
   path_provider             flutter_local_notifications,
   (media dir)               video_player, fl_chart, etc.
```

- **UI never touches Drift directly.** It goes through repositories exposed as Riverpod providers.
- **Reactivity:** Drift `watch` queries → `Stream` → Riverpod `StreamProvider` → `ref.watch` in widgets. A write anywhere updates every screen showing that data.

---

## 3. Module / dependency rules

- `core/` may not import from `features/`.
- A feature may import `core/`, but **must not** import another feature's `data/` or `presentation/` internals. If two features need to share, the shared piece moves to `core/` (or a small shared module).
- `presentation/` may depend on `data/`; `data/` must never depend on `presentation/`.
- Keep `domain/` optional: introduce entities/interfaces only when they remove duplication or unlock testing. Don't mirror every table with a hand-written entity "for cleanliness."

---

## 4. Key technical decisions

### State management — Riverpod v2
Compile-safe, testable, no `BuildContext` gymnastics, integrates cleanly with Drift streams. Providers are the DI mechanism (no separate DI package).
*Alternatives considered:* Bloc (more boilerplate for this app's size); plain `setState` (won't scale to cross-screen reactivity).

### Navigation — go_router + StatefulShellRoute
The 5 tabs need **independent, preserved navigation stacks** (e.g. you can be deep in a Program while History keeps its own scroll position). `StatefulShellRoute.indexedStack` is built exactly for that.

### Local DB — Drift (SQLite)
The data is relational (programs → days → exercises → sets → logs; sessions → set logs). Drift gives type-safe queries, reactive streams, and **explicit, testable migrations** — essential for "version management for continuous development."
*Alternatives considered:* Isar (fast, but migrations are less explicit and v4 reshaped the API); Hive (key-value, weak for relational/queryable history); raw `sqflite` (no type safety, manual everything).

### Media — files on disk, paths in DB
Photos/mp4 can be large. We copy imported media into `…/app_documents/media/<entity>/<id>/…` and store the relative path in the DB. Backups zip the DB **and** this media folder. Playback via `video_player` + `chewie`; the "video plays behind the logging overlay" screens simply stack the logging UI over the player.

### Notifications/alarms — flutter_local_notifications + timezone
Repeatable reminders (e.g. "every 10 days") and workout alarms. Android 14+/16 requires runtime permission for exact alarms — handled in Settings + first-run.

### Localization & calendar — gen-l10n, EN + TH, CE standard
`.arb` files generate a type-safe `AppLocalizations`. Dates are stored as epoch and formatted at the edge. **CE (Gregorian) is the system standard**; an optional Settings toggle can display BE (BE = CE + 543) for Thai users. Internal logic, storage, and exports always use CE.

---

## 5. Cross-cutting concerns

| Concern | Approach |
|---|---|
| **Theming** | Central `AppTheme` (light/dark) + a shared component library (the design phase). Per-category accent colors (`BodyPartColors`), one per Exercise category: Chest=purple, Back=blue, Leg=yellow, Shoulder=pink, Bicep=red, Triceps=teal, Abs=green, Compound=orange, Functional=indigo, Stretching=brown. |
| **Text scaling** | Two Settings modes: *follow system* (respect the OS font scale via `MediaQuery.textScaler`) or *manual* (a slider that overrides the scale, clamped to a safe range). |
| **Media & images** | On import, an image-quality setting (Original / Normal / Low) controls re-encoding; videos are kept as-is. A *save to phone album* toggle copies imported/captured photos to the device gallery. |
| **Section card backgrounds** | Every section/sub-module card (body parts, Discipline modules, Program categories, Note/Bodybuilding folders) carries a customizable background image + accent, keyed in a `card_appearance` table — "folders that hold objects." Some cards get content-specific handling, defined per section later. |
| **Folders & tags** | Fitness Note and Bodybuilding **each** own a separate folder list and tag set (managed in Settings). A note belongs to one folder and many tags. |
| **Errors** | Repositories surface typed failures; UI shows friendly messages. No error handling for impossible states (AGENTS.md §2). |
| **Time/timers** | Workout stopwatch/interval timer runs in a Riverpod provider; `wakelock_plus` keeps the screen on during a session. |
| **IDs** | UUID strings for entities the user creates (stable across export/import); auto-increment ints only for purely-local join rows. |
| **Testing** | `flutter_test` + `mocktail`. Repositories unit-tested against an in-memory Drift DB; widget tests for critical screens; Drift migration tests from each historical schema. |

---

## 6. What this environment can and can't do

This planning environment (Cowork) **cannot run the Flutter toolchain** — no SDK, emulator, or device. So:

- All Dart code here is written to be correct and idiomatic, but **not compiled here**.
- The user runs `flutter create`, `flutter pub get`, codegen, and builds in their own Flutter + Android Studio setup (see [SETUP.md](./SETUP.md)).
- Generated files (`*.g.dart`, `*.freezed.dart`, `AppLocalizations`) are intentionally **not** committed in the scaffold; they appear after the first codegen run.
