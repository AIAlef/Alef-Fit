import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

// ── Tables ──────────────────────────────────────────────────────────────────
// The core Exercise-library tables are defined here as the established pattern.
// Remaining tables (programs, program_days, program_exercises, workout_sessions,
// session_exercises, set_logs, todo_tasks, notes, note_media, alarms,
// weight_entries, app_settings) are added in milestone M1 — every addition
// bumps `schemaVersion` and adds an `onUpgrade` step. See docs/DATA_MODEL.md and
// docs/BACKUP_AND_VERSIONING.md §C.

class BodyParts extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get description => text().withDefault(const Constant(''))();
  IntColumn get accentColor =>
      integer().withDefault(const Constant(0xFF8E8E93))();
  TextColumn get coverImagePath => text().nullable()();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

class Exercises extends Table {
  TextColumn get id => text()();
  TextColumn get bodyPartId => text().references(BodyParts, #id)();
  TextColumn get name => text()();
  TextColumn get targetMuscle => text().withDefault(const Constant(''))();
  TextColumn get steps => text().withDefault(const Constant(''))();
  IntColumn get defaultSets => integer().withDefault(const Constant(4))();
  TextColumn get defaultReps =>
      text().withDefault(const Constant('12/10/8/6'))();
  IntColumn get viewedCount => integer().withDefault(const Constant(0))();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  IntColumn get createdAt => integer()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

class ExerciseMedia extends Table {
  TextColumn get id => text()();
  TextColumn get exerciseId =>
      text().references(Exercises, #id, onDelete: KeyAction.cascade)();
  TextColumn get type => text()(); // 'image' | 'video'
  TextColumn get path => text()();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

// ── Database ────────────────────────────────────────────────────────────────

@DriftDatabase(tables: [BodyParts, Exercises, ExerciseMedia])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_open());

  /// For tests: pass an in-memory executor (see test/ helpers in M1).
  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
        },
        onUpgrade: (m, from, to) async {
          // Add ordered migration steps here as the schema evolves.
        },
        beforeOpen: (details) async {
          await customStatement('PRAGMA foreign_keys = ON');
        },
      );
}

LazyDatabase _open() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'alef_fit.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
