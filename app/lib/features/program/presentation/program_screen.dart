import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';

/// Tab 3 — Program list (multi-day programs + in-workout logging).
/// Built in M2. See docs/SCREEN_MAP.md#tab-3--program.
class ProgramScreen extends StatelessWidget {
  const ProgramScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabProgram)),
      body: Center(child: Text(l10n.comingSoon)),
    );
  }
}
