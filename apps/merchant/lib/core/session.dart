import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'models.dart';
import 'platform.dart';

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'iskina_sme_session';

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class MemoryTokenStore implements TokenStore {
  String? _value;

  @override
  Future<String?> read() async => _value;

  @override
  Future<void> write(String token) async => _value = token;

  @override
  Future<void> clear() async => _value = null;
}

class SessionController extends ChangeNotifier {
  SessionController({required this.api, required this.store});

  final ApiClient api;
  final TokenStore store;

  MerchantUser? user;
  List<Membership> memberships = const [];
  Membership? selected;
  ThemeManifest? theme;
  bool restoring = true;

  bool get signedIn => user != null;
  String? get businessId => selected?.businessId;

  Future<void> restore() async {
    try {
      final token = await store.read();
      if (token == null) return;
      api.token = token;
      final result = await api.me();
      _apply(result.user, result.memberships);
      await loadTheme();
    } catch (_) {
      api.token = null;
      await store.clear();
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> signIn({
    required String challengeId,
    required String code,
  }) async {
    final result = await api.verifyOtp(challengeId: challengeId, code: code);
    api.token = result.token;
    await store.write(result.token);
    _apply(result.user, result.memberships);
    await loadTheme();
    notifyListeners();
  }

  void _apply(MerchantUser nextUser, List<Membership> nextMemberships) {
    user = nextUser;
    memberships = nextMemberships;
    Membership? firstBusiness;
    for (final membership in nextMemberships) {
      if (membership.businessId != null) {
        firstBusiness = membership;
        break;
      }
    }
    selected = firstBusiness;
  }

  Future<void> selectBusiness(Membership membership) async {
    selected = membership;
    await loadTheme();
    notifyListeners();
  }

  Future<void> loadTheme() async {
    final id = businessId;
    if (id == null) {
      theme = null;
      return;
    }
    try {
      theme = await api.theme(id);
    } catch (_) {
      theme = null;
    }
  }

  Future<void> logout() async {
    await api.logout();
    await store.clear();
    await MerchantPlatform.stopOrderService();
    api.token = null;
    user = null;
    memberships = const [];
    selected = null;
    theme = null;
    notifyListeners();
  }
}
