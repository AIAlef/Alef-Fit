# Repeated Pitfalls

One row per recurring mistake, so it is not repeated. Newest first. Cowork appends here
and reads this before working; relevant rows are surfaced in the mind map's `» Risks &
Pitfalls` and `» Overview` branches.

Seeded 2026-06-27 from the traps foreseen while reviewing the plan (`CLAUDE.md`,
`docs/`). They have not all "bitten" yet — the point is to keep them from biting.

| Date | Pitfall | Cause | Fix | Where it bit |
|------|---------|-------|-----|--------------|
| 2026-06-28 | Files written to the project folder from the Cowork sandbox can come back mangled on readback (corrupted a `.mmap` copy; broke `git init`'s `.git/config`) | the bridge between the sandbox and `C:\ClaudeProject` is not always byte-reliable for some writes | run Git and the Flutter toolchain **natively on your machine** (not from Cowork); for files produced in Cowork, verify after copy (md5 / `is_zipfile` / `git fsck`) and re-copy on mismatch | first map delivery · `git init` |
| 2026-06-27 | Schema changed without a Drift migration (and without updating `DATA_MODEL.md`) → existing training history lost or corrupted | Editing a Drift table directly without bumping `schemaVersion` | Every schema change = bump `schemaVersion` + add a `MigrationStrategy` step + update `DATA_MODEL.md` + a migration test, all in the same commit | `core/database/` · M1+ |
| 2026-06-27 | Build fails: `Target of URI hasn't been generated` (`*.g.dart`, `AppLocalizations`) | Generated code not regenerated after a Drift table / `@riverpod` / `.arb` edit (generated code is intentionally not committed) | Re-run `dart run build_runner build -d` + `flutter gen-l10n` after any such edit | codegen · every feature |
| 2026-06-27 | Thai support breaks late because a user-facing string was hard-coded | Convenience while building a feature in English | Route every string through `AppLocalizations` (EN + TH) from day one — no literals in widgets | every feature UI |
| 2026-06-27 | Dates render wrong / exports corrupt after enabling the BE toggle | A formatted or Buddhist-Era date was stored instead of formatted at the edge | Store UTC epoch millis (CE); BE is display-only (CE + 543), applied only when rendering | any dated table |
| 2026-06-27 | `flutter create` overwrote the scaffold's `pubspec.yaml` / `lib/main.dart` | Accepting the overwrite prompt during platform-folder generation | Keep the scaffold versions; `git checkout -- <file>` if overwritten (see `docs/SETUP.md`) | bootstrap / setup |
| 2026-06-27 | Modules become tangled — one feature imports another feature's `data/` or `presentation/` | Quick reuse across features | Move the shared piece into `core/`; never import another feature's internals (see `docs/ARCHITECTURE.md` §3) | `features/` |
| 2026-06-27 | Themed UI built before the Design System tokens were approved → rework across tabs | Code ran ahead of the approved design | Honor the design → approve → build loop; no themed code until Step 1 tokens are signed off | Step 1+ |
| 2026-06-27 | (template example) child elements written out of order; `.mmap` rejected | the MindManager schema is an ordered sequence | the writer emits children in schema order (handled by `mmap_tool.py`) | mind-map writer |
