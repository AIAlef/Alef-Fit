# Backup & Version Management

This covers the two distinct things the project needs for safe continuous development:

- **A. Code version control** — protecting the *source*.
- **B. User-data backup** — protecting the *user's training history* on the device.
- **C. Database migrations** — keeping A and B compatible as the schema evolves.

---

## A. Code version control (Git)

**Repository:** this folder. Initialise once, push to a private remote (GitHub recommended).

```bash
git init
git add .
git commit -m "chore: project scaffold, architecture, and docs"
git branch -M main
git remote add origin <your-private-repo-url>
git push -u origin main
```

**Branching (solo-friendly, trunk-based):**
- `main` — always buildable.
- `feat/<thing>`, `fix/<thing>`, `chore/<thing>` — short-lived; merge back via PR or fast-forward.
- Tag each release: `v0.1.0`, `v0.2.0`, …

**Commits:** [Conventional Commits](https://www.conventionalcommits.org) — `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. This keeps history readable and lets the changelog be generated.

**Versioning:** [SemVer](https://semver.org) in `app/pubspec.yaml` as `version: MAJOR.MINOR.PATCH+BUILD` (the `+BUILD` is the Android `versionCode`). Record notable changes in `CHANGELOG.md` (Keep a Changelog format).

**Optional CI (later):** a GitHub Action running `flutter analyze` + `flutter test` on every push. Deferred until there's code to test.

**What is NOT committed:** signing keys, `key.properties`, `google-services.json`, `.env`, generated code (`*.g.dart`), build output. See `.gitignore` files.

---

## B. User-data backup (in-app, offline-first)

The "Backup" button in the Retro design and the Settings "Backup & restore" screen drive this. It is **offline-first**: the user always gets a file they own; cloud is optional.

**What's in a backup:** a single `.zip` (suggested extension `.alefbak`) containing:
```
backup.alefbak
├── manifest.json        # app version, schemaVersion, createdAt, counts, checksum
├── database.sqlite      # the full Drift DB (includes app_settings)
└── media/               # all photos + mp4 referenced by the DB
    ├── exercises/…
    ├── programs/…
    └── notes/…
```

**Export flow:**
1. Checkpoint/copy the SQLite file (`path_provider` for locations).
2. Zip DB + `media/` (`archive`), write `manifest.json`.
3. Hand the file to the user via the system share sheet (`share_plus`) — they can save locally, send to themselves, or **save to Google Drive** through the share target.

**Restore flow:**
1. Pick a `.alefbak` (`file_picker`).
2. Validate `manifest.json` (app/schema compatibility, checksum).
3. If the backup's `schemaVersion` is older, run forward migrations after import; if newer, refuse and prompt to update the app.
4. Replace DB + media (after backing up the current state to a `.restore-rollback` first).

**Optional direct Google Drive sync (later milestone):** `google_sign_in` + `googleapis` writing the same `.alefbak` to Drive's `appDataFolder`, with a "last backed up" timestamp and an optional auto-backup schedule. Not required for v1 — the share-sheet path already reaches Drive.

**Safety rules:**
- Never overwrite the live DB without first snapshotting it.
- Verify checksum before trusting a backup.
- Backup/restore must be atomic — partial restores are worse than none.

---

## C. Database migrations (the bridge)

Schema lives in Drift (`app/lib/core/database/`). The DB is where both the running app **and** every backup file meet, so migrations are the contract that keeps old data working.

**Rules (also in CLAUDE.md §7):**
1. Any schema change → bump `schemaVersion`.
2. Add an explicit step in the `MigrationStrategy` (`onUpgrade`).
3. Update [DATA_MODEL.md](./DATA_MODEL.md) in the same commit.
4. Add/keep a **migration test** from the previous schema using Drift's schema-export tooling (`drift_dev schema dump` / generated test fixtures).

**Never** do a destructive change (drop/rename a column holding user data) without a migration that preserves the data. Existing users have real history; an upgrade must never lose it.

This is the core of "version management for continuous development": code is versioned by Git (A), data is portable via backups (B), and schema evolution is guaranteed safe by migrations (C).
