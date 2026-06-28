import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // TODO(M3): init timezone + notifications here when the Alarm module lands.
  runApp(const ProviderScope(child: AlefFitApp()));
}
