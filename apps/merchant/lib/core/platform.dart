import 'package:flutter/services.dart';

/// Kotlin bridge. Missing on tests/desktop and safely degrades.
class MerchantPlatform {
  static const _channel = MethodChannel('ph.iskina.merchant/platform');

  static Future<String> deviceLabel() async {
    try {
      return await _channel.invokeMethod<String>('deviceLabel') ??
          'Android device';
    } catch (_) {
      return 'Android device';
    }
  }

  static Future<bool> startOrderService() async {
    try {
      return await _channel.invokeMethod<bool>('startOrderService') ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> stopOrderService() async {
    try {
      return await _channel.invokeMethod<bool>('stopOrderService') ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> printReceipt(String payload) async {
    try {
      return await _channel.invokeMethod<bool>('printReceipt', {
            'payload': payload,
          }) ??
          false;
    } catch (_) {
      return false;
    }
  }
}
