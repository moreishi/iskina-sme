import 'package:flutter/material.dart';

import 'models.dart';

Color hexColor(String value) {
  final hex = value.replaceFirst('#', '');
  if (hex.length != 6) return Colors.orange;
  return Color(int.parse('FF$hex', radix: 16));
}

ThemeData buildMerchantTheme(ThemeTokens tokens, Brightness brightness) {
  final primary = hexColor(tokens.primary);
  final onPrimary = hexColor(tokens.onPrimary);
  final accent = hexColor(tokens.accent);
  final surface = hexColor(tokens.surface);
  final onSurface = hexColor(tokens.onSurface);
  final outline = hexColor(tokens.outline);

  final scheme =
      ColorScheme.fromSeed(seedColor: primary, brightness: brightness).copyWith(
        primary: primary,
        onPrimary: onPrimary,
        secondary: accent,
        onSecondary: hexColor(tokens.onAccent),
        surface: surface,
        onSurface: onSurface,
        outline: outline,
        error: brightness == Brightness.dark
            ? const Color(0xFFFF6B6B)
            : const Color(0xFFB00020),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: hexColor(tokens.surfaceMuted),
    appBarTheme: AppBarTheme(
      backgroundColor: surface,
      foregroundColor: onSurface,
      elevation: 0,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: outline),
      ),
    ),
  );
}
