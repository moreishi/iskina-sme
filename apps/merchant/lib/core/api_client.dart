import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'sse.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.code, this.message);

  final int statusCode;
  final String code;
  final String message;

  @override
  String toString() => message;
}

class OtpChallenge {
  const OtpChallenge({required this.challengeId, this.devCode});

  final String challengeId;
  final String? devCode;
}

class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
    : baseUrl =
          baseUrl ??
          const String.fromEnvironment(
            'API_URL',
            defaultValue: 'http://10.0.2.2:3008',
          ),
      _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? token;

  Map<String, String> get _headers => {
    'content-type': 'application/json',
    if (token != null) 'authorization': 'Bearer $token',
  };

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    late http.Response response;
    try {
      final request = http.Request(
        method,
        uri,
      )..headers.addAll(auth ? _headers : {'content-type': 'application/json'});
      if (body != null) request.body = jsonEncode(body);
      response = await http.Response.fromStream(
        await _client.send(request).timeout(const Duration(seconds: 20)),
      );
    } on TimeoutException {
      throw ApiException(0, 'timeout', 'The server took too long to answer');
    } catch (_) {
      throw ApiException(0, 'network', 'Could not reach the server');
    }

    Map<String, dynamic> decoded = const {};
    if (response.body.isNotEmpty) {
      final value = jsonDecode(response.body);
      if (value is Map<String, dynamic>) {
        decoded = value;
      }
    }
    if (response.statusCode >= 400) {
      final error = decoded['error'] as Map<String, dynamic>?;
      throw ApiException(
        response.statusCode,
        error?['code'] as String? ?? 'error',
        error?['message'] as String? ?? 'Request failed',
      );
    }
    return decoded;
  }

  Future<OtpChallenge> requestOtp(String phone) async {
    final data = await _send(
      'POST',
      '/api/v1/auth/otp',
      body: {'phone': phone},
      auth: false,
    );
    return OtpChallenge(
      challengeId: data['challengeId'] as String,
      devCode: data['devCode'] as String?,
    );
  }

  Future<VerifyResult> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    final data = await _send(
      'POST',
      '/api/v1/auth/verify',
      body: {'challengeId': challengeId, 'code': code, 'client': 'mobile'},
      auth: false,
    );
    final token = data['sessionToken'] as String?;
    if (token == null) {
      throw ApiException(500, 'session', 'No session returned');
    }
    return VerifyResult(
      token: token,
      user: MerchantUser.fromJson(data['user'] as Map<String, dynamic>),
      memberships: (data['memberships'] as List<dynamic>)
          .map((row) => Membership.fromJson(row as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<({MerchantUser user, List<Membership> memberships})> me() async {
    final data = await _send('GET', '/api/v1/auth/me');
    return (
      user: MerchantUser.fromJson(data['user'] as Map<String, dynamic>),
      memberships: (data['memberships'] as List<dynamic>)
          .map((row) => Membership.fromJson(row as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<List<MerchantOrder>> orders(String businessId) async {
    final data = await _send(
      'GET',
      '/api/v1/merchant/orders?businessId=$businessId',
    );
    return (data['orders'] as List<dynamic>? ?? const [])
        .map(
          (row) => MerchantOrder.fromJson(
            (row as Map<String, dynamic>)['order'] as Map<String, dynamic>,
            row['lines'] as List<dynamic>? ?? const [],
          ),
        )
        .toList();
  }

  Future<void> transition({
    required String businessId,
    required String orderId,
    required String to,
  }) async {
    await _send(
      'POST',
      '/api/v1/merchant/orders/$orderId/transition',
      body: {'businessId': businessId, 'to': to},
    );
  }

  Future<void> cashReceived({
    required String businessId,
    required String orderId,
  }) async {
    await _send(
      'POST',
      '/api/v1/merchant/orders/$orderId/cash-received',
      body: {'businessId': businessId},
    );
  }

  Future<AnalyticsSnapshot> analytics(String businessId, {int days = 7}) async {
    final data = await _send(
      'GET',
      '/api/v1/merchant/analytics?businessId=$businessId&days=$days',
    );
    return AnalyticsSnapshot.fromJson(data);
  }

  Future<ThemeManifest> theme(String businessId) async {
    final data = await _send(
      'GET',
      '/api/v1/merchant/theme?businessId=$businessId',
    );
    final published = data['published'] as Map<String, dynamic>?;
    final manifest =
        published?['manifest'] as Map<String, dynamic>? ??
        data['fallback'] as Map<String, dynamic>;
    return ThemeManifest.fromJson(manifest);
  }

  Future<void> registerDevice({
    required String businessId,
    required String deviceToken,
    String platform = 'android',
  }) async {
    await _send(
      'POST',
      '/api/v1/merchant/devices',
      body: {
        'businessId': businessId,
        'platform': platform,
        'token': deviceToken,
      },
    );
  }

  Future<void> logout() async {
    try {
      await _send('POST', '/api/v1/auth/logout');
    } catch (_) {
      // Signing out locally must succeed even when the network does not.
    }
  }

  /// SSE stream; emits whenever the board should refresh. Reconnects forever.
  Stream<void> orderEvents(String businessId) async* {
    while (true) {
      try {
        final request =
            http.Request(
                'GET',
                Uri.parse(
                  '$baseUrl/api/v1/merchant/events?businessId=$businessId',
                ),
              )
              ..headers.addAll({
                'authorization': 'Bearer $token',
                'accept': 'text/event-stream',
              });
        final response = await _client.send(request);
        if (response.statusCode != 200) {
          throw ApiException(response.statusCode, 'sse', 'Stream refused');
        }
        await for (final event in decodeSse(
          response.stream
              .transform(utf8.decoder)
              .transform(const LineSplitter()),
        )) {
          if (event.event == 'orders') yield null;
        }
      } catch (_) {
        await Future<void>.delayed(const Duration(seconds: 3));
      }
    }
  }
}
