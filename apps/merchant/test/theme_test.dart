import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskina_merchant/core/models.dart';
import 'package:iskina_merchant/core/theme.dart';

void main() {
  test('theme maps manifest tokens to Material colours', () {
    final data = buildMerchantTheme(
      ThemeTokens.fallbackLight,
      Brightness.light,
    );
    expect(data.colorScheme.primary, hexColor('#D40000'));
    expect(data.colorScheme.onPrimary, hexColor('#FFFFFF'));
    expect(data.scaffoldBackgroundColor, hexColor('#F5F2EE'));
  });

  test('dark theme keeps its own surface', () {
    final data = buildMerchantTheme(ThemeTokens.fallbackDark, Brightness.dark);
    expect(data.brightness, Brightness.dark);
    expect(data.colorScheme.surface, hexColor('#0E0E0E'));
  });

  test('bad hex falls back instead of throwing', () {
    expect(hexColor('nope'), Colors.orange);
  });
}
