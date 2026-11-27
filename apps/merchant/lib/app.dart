import 'package:flutter/material.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';

class MerchantApp extends StatefulWidget {
  const MerchantApp({super.key, required this.session});

  final SessionController session;

  @override
  State<MerchantApp> createState() => _MerchantAppState();
}

class _MerchantAppState extends State<MerchantApp> {
  @override
  void initState() {
    super.initState();
    widget.session.restore();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.session,
      builder: (context, _) {
        final session = widget.session;
        final theme = session.theme;
        final light = theme?.light ?? ThemeTokens.fallbackLight;
        final dark = theme?.dark ?? ThemeTokens.fallbackDark;

        return MaterialApp(
          title: 'Iskina Business',
          debugShowCheckedModeBanner: false,
          theme: buildMerchantTheme(light, Brightness.light),
          darkTheme: buildMerchantTheme(dark, Brightness.dark),
          themeMode: ThemeMode.system,
          home: session.restoring
              ? const Scaffold(body: Center(child: CircularProgressIndicator()))
              : session.signedIn
              ? HomeShell(session: session)
              : LoginScreen(session: session),
        );
      },
    );
  }
}
