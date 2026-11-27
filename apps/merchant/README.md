# Iskina Business (merchant app)

Flutter app for MSME staff and owners: sign in with OTP, process orders and
bookings, watch the board over SSE, read insights, and see the business's
published theme.

**Android-first.** The Kotlin layer owns the foreground alert service and the
printer seam; iOS comes in M7. One app serves every business — branding is
runtime, never a per-SME binary.

## Requirements

- Flutter 3.47+ (Dart 3.13)
- Android SDK + JDK 17 to build/run on a device (analyze and test do not need
  them)
- The API running locally on `:3008`

## Run

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3008
```

`10.0.2.2` reaches the host from the Android emulator. On a physical phone use
your machine's LAN IP. Sign in with a demo number and the dev OTP shown on the
login screen (the API only exposes it outside production).

Quality gates:

```bash
dart format lib test
flutter analyze
flutter test
```

## Layout

```
lib/
  core/        api client, SSE decoder, session/token store, theme mapping, models
  screens/     login, home shell, orders, insights, settings
android/       Kotlin platform bridge + OrderAlertService
```

## Known gaps

- **FCM is not wired yet.** Device registration exists on the API; the app needs
  the Iskina Firebase project and `google-services.json` before it can obtain a
  token. Until then the Kotlin foreground service keeps order alerts visible.
- Barcode/thermal printing is a stub returning `false` from `printReceipt`.
- Tests cover the SSE decoder, order action map and theme mapping; no widget or
  integration tests yet.
