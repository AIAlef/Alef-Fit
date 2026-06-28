import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';

/// Tab 5 — Setting (language, calendar CE/BE, theme, backup/restore, about).
/// Built in M5. See docs/SCREEN_MAP.md#tab-5--setting.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.tabSetting)),
      body: Center(child: Text(l10n.comingSoon)),
    );
  }
}
