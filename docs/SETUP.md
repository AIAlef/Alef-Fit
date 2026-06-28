# Setup

How to turn this scaffold into a running app. You need this on your own machine — the planning environment can't run Flutter.

## Prerequisites

- **Flutter SDK** (stable). Verify with `flutter doctor` (resolve all checkmarks).
- **Android Studio** (or VS Code + Flutter/Dart extensions) with an Android SDK.
- A device/emulator — ideally the **Galaxy S26 Ultra** (enable USB debugging) or an Android emulator.
- (Optional) Xcode + a Mac for the iOS target.

## 1. Generate the platform folders

The scaffold ships `app/lib/` + `pubspec.yaml` but **not** the generated `android/` and `ios/` folders (those are machine-generated). Create them in place:

```bash
cd app
flutter create --org com.alefinnovation --project-name alef_fit --platforms=android,ios .
```

`flutter create` adds the missing platform folders without deleting the existing `lib/`. If it offers to overwrite `pubspec.yaml` or `lib/main.dart`, **keep the scaffold's versions** (decline/restore from git).

## 2. Install dependencies

```bash
flutter pub get
```

## 3. Run code generation

Drift, Riverpod, and localization use generated code (not committed):

```bash
dart run build_runner build --delete-conflicting-outputs
flutter gen-l10n
```

Re-run these whenever you change a Drift table, a `@riverpod` provider, or an `.arb` file. During active development you can watch:

```bash
dart run build_runner watch -d
```

## 4. Run

```bash
flutter analyze        # should be clean
flutter run            # pick your device
```

You should see the **5-tab shell** (Exercise / Discipline / Program / Retro / Setting) with placeholder screens.

## 5. Android specifics for the S26 Ultra

- **minSdk / targetSdk:** set `targetSdk` to the latest installed platform; keep `minSdk` at 24+ (raise if a plugin requires it).
- **Permissions** to add as features land: media access (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`), notifications (`POST_NOTIFICATIONS`), exact alarms (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`) for the Alarm module.
- Test video playback and the keep-awake (`wakelock_plus`) on the real device.

## 6. First commit

```bash
cd ..        # repo root
git init && git add . && git commit -m "chore: project scaffold, architecture, and docs"
```

See [BACKUP_AND_VERSIONING.md](./BACKUP_AND_VERSIONING.md) for branching, releases, and the remote.

---

### Troubleshooting

| Symptom | Fix |
|---|---|
| `Target of URI hasn't been generated` (`*.g.dart`, `app_localizations.dart`) | Run step 3 (codegen / gen-l10n). |
| `flutter create` overwrote a scaffold file | Restore it from git (`git checkout -- <file>`). |
| Drift build errors after a schema edit | Bump `schemaVersion`, add the migration, re-run build_runner. |
