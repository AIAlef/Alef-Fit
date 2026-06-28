import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';

/// Tab 2 — Discipline home (to-do, notes, bodybuilding, alarms, weight trend).
/// Built in M4. See docs/SCREEN_MAP.md#tab-2--discipline.
class DisciplineScreen extends StatelessWidget {
  const DisciplineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabDiscipline)),
      body: Center(child: Text(l10n.comingSoon)),
    );
  }
}
