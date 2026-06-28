# Alef.FiT

A personal fitness & bodybuilding app. **Android-first** (Samsung Galaxy S26 Ultra), iOS optional. Built with **Flutter**, **offline-first**.

> **Status:** Planning + scaffold. No features implemented yet — this repo currently contains the architecture, docs, and an empty (but runnable) app skeleton for review.

## The 5 tabs

1. **Exercise** — workout library by body part, with technique, photos, and mp4 video.
2. **Discipline** — to-do list, notes, bodybuilding gallery, alarms, weight trend.
3. **Program** — multi-day programs with in-workout logging (video background, sets/reps, timer, dated history).
4. **Retro** — training history and progress analysis.
5. **Setting** — settings, localization, backup/restore.

## Where to start

| If you want to… | Read |
|---|---|
| Understand the whole plan | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| See every screen | [`docs/SCREEN_MAP.md`](./docs/SCREEN_MAP.md) |
| Configure the app (Settings) | [`docs/SETTINGS_SPEC.md`](./docs/SETTINGS_SPEC.md) |
| The visual language | [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) |
| Understand the data | [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) |
| Know the build order | [`docs/ROADMAP.md`](./docs/ROADMAP.md) |
| Set up backup & Git | [`docs/BACKUP_AND_VERSIONING.md`](./docs/BACKUP_AND_VERSIONING.md) |
| Get the app running | [`docs/SETUP.md`](./docs/SETUP.md) |
| Work with an AI agent here | [`CLAUDE.md`](./CLAUDE.md) + [`AGENTS.md`](./AGENTS.md) |

## Quick start

The Flutter project lives in [`app/`](./app/). Platform folders are generated once:

```bash
cd app
flutter create --org com.alefinnovation --project-name alef_fit --platforms=android,ios .
flutter pub get
dart run build_runner build -d
flutter run
```

Full instructions: [`docs/SETUP.md`](./docs/SETUP.md).

## Design references

Original screen designs are in [`FitnessApp/`](./FitnessApp/); each filename describes the screen. These are reference only and are not bundled into the app.
