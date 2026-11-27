import 'package:flutter/material.dart';

import 'app.dart';
import 'core/api_client.dart';
import 'core/session.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MerchantApp(
      session: SessionController(api: ApiClient(), store: SecureTokenStore()),
    ),
  );
}
