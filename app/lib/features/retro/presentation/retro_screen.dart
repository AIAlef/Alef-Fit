import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';

/// Tab 4 — Retro (history + progress analysis).
/// Built in M3. See docs/SCREEN_MAP.md#tab-4--retro-history.
class RetroScreen extends StatelessWidget {
  const RetroScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabRetro)),
      body: Center(child: Text(l10n.comingSoon)),
    );
  }
}
