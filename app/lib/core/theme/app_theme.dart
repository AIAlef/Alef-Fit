import 'package:flutter/material.dart';

/// Central light/dark theme. Per-body-part accent colors live in
/// `body_part_colors.dart`.
class AppTheme {
  AppTheme._();

  /// Amber accent matching the active tab in the design.
  static const Color seed = Color(0xFFF5C518);

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(seedColor: seed, brightness: brightness);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: const AppBarTheme(centerTitle: true),
    );
  }
}
