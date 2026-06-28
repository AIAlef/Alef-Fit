import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/discipline/presentation/discipline_screen.dart';
import '../../features/exercise/presentation/exercise_screen.dart';
import '../../features/program/presentation/program_screen.dart';
import '../../features/retro/presentation/retro_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../widgets/main_scaffold.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'root');

/// App routes. The 5 tabs use a [StatefulShellRoute] so each keeps its own
/// navigation stack and scroll position. Full-screen routes (exercise detail
/// with video, logging overlay, timer) will push above the shell in later
/// milestones — add them as child routes of the relevant branch.
final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/exercise',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          MainScaffold(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/exercise',
              builder: (context, state) => const ExerciseScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/discipline',
              builder: (context, state) => const DisciplineScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/program',
              builder: (context, state) => const ProgramScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/retro',
              builder: (context, state) => const RetroScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/settings',
              builder: (context, state) => const SettingsScreen(),
            ),
          ],
        ),
      ],
    ),
  ],
);
