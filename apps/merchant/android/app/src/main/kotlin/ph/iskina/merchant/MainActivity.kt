package ph.iskina.merchant

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * The Kotlin side of the merchant app. FCM token registration lands once the
 * Iskina Firebase project and google-services.json exist; the foreground
 * service and printer seam are already here so the Dart side stays stable.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "ph.iskina.merchant/platform"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "deviceLabel" -> result.success("${Build.MANUFACTURER} ${Build.MODEL}")
                    "startOrderService" -> {
                        ContextCompat.startForegroundService(
                            this,
                            Intent(this, OrderAlertService::class.java),
                        )
                        result.success(true)
                    }
                    "stopOrderService" -> {
                        stopService(Intent(this, OrderAlertService::class.java))
                        result.success(true)
                    }
                    "printReceipt" -> result.success(false)
                    else -> result.notImplemented()
                }
            }
    }
}
