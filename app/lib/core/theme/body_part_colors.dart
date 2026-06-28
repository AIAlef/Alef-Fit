import 'package:flutter/material.dart';

/// Accent color per Exercise category, matching the Exercise tab design.
///
/// Map order = the default display/seed order (priority: large muscles first,
/// then medium top-down/front-back, then exercise-type categories).
/// Roll-ups: Calf and other lower-leg muscles live under Leg; forearm flexors
/// go under Bicep, extensors under Triceps.
///
/// Stored as an int per row in the DB (`body_parts.accentColor`); these are the
/// seed defaults used when the library is first populated.
class BodyPartColors {
  BodyPartColors._();

  static const Map<String, Color> byName = {
    // Large muscles
    'Chest': Color(0xFFAF52DE),
    'Back': Color(0xFF0A84FF),
    'Leg': Color(0xFFFFD60A),
    // Medium muscles (top-down, front-back)
    'Shoulder': Color(0xFFFF2D92),
    'Bicep': Color(0xFFFF3B30),
    'Triceps': Color(0xFF5AC8FA),
    'Abs': Color(0xFF34C759),
    // Exercise-type categories
    'Compound': Color(0xFFFF9500),
    'Functional': Color(0xFF5E5CE6),
    'Stretching': Color(0xFFA2845E),
  };

  /// Default category order for seeding `body_parts.sortOrder`.
  static List<String> get ordered => byName.keys.toList();

  static Color of(String category) =>
      byName[category] ?? const Color(0xFF8E8E93);
}
