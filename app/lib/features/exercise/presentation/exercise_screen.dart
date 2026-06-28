import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';

/// Tab 1 — Exercise library (body-part list).
/// Built in M1. See docs/SCREEN_MAP.md#tab-1--exercise.
class ExerciseScreen extends StatelessWidget {
  const ExerciseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabExercise)),
      body: Center(child: Text(l10n.comingSoon)),
    );
  }
}
