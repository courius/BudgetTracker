package expo.modules.banknotifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Watches notifications from other apps and keeps the ones that look like a card payment
 * ("33,00 € spent at Lidl"). Matches are queued in SharedPreferences; the JS side drains the
 * queue when the app opens and does the precise parsing. Nothing leaves the device here.
 */
class BankNotificationService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName == packageName || sbn.isOngoing) return
    val n = sbn.notification ?: return
    if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

    val title = n.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = (n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: n.extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""
    val full = "$title. $text"
    if (!AMOUNT.containsMatchIn(full) || !SPEND.containsMatchIn(full)) return

    val entry = JSONObject()
      .put("packageName", sbn.packageName)
      .put("title", title)
      .put("text", text)
      .put("postedAt", sbn.postTime)
    Queue.add(this, sbn.key, entry)
    promptUser(text.ifEmpty { title })
  }

  /** Posts our own notification so the expense can be confirmed with one tap. */
  private fun promptUser(detail: String) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Detected expenses", NotificationManager.IMPORTANCE_DEFAULT)
      )
    }
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("budgettracker://add")).setPackage(packageName)
    val pending = PendingIntent.getActivity(
      this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("New expense detected")
      .setContentText("$detail — tap to add it")
      .setStyle(NotificationCompat.BigTextStyle().bigText("$detail — tap to add it"))
      .setContentIntent(pending)
      .setAutoCancel(true)
      .build()
    try {
      manager.notify(PROMPT_ID, notification)
    } catch (_: SecurityException) {
      // Notification permission not granted; the expense still shows up inside the app.
    }
  }

  companion object {
    private const val CHANNEL = "detected-expenses"
    private const val PROMPT_ID = 4201
    private val AMOUNT = Regex(
      """([€$£¥]|\b(EUR|USD|GBP|CHF|RON|PLN|SEK|NOK|DKK|CZK|HUF|MDL|JPY|CAD|AUD)\b)\s?\d|\d\s?([€$£¥]|(EUR|USD|GBP|CHF|RON|PLN|SEK|NOK|DKK|CZK|HUF|MDL|JPY|CAD|AUD)\b)""",
      RegexOption.IGNORE_CASE
    )
    private val SPEND = Regex(
      """spent|paid|payment|purchase|charged|debited|card|compra|pago|pagado|pagaste|gastado|cargo|tarjeta|achat|paiement|carte|zahlung|bezahlt|karte|plat[aă]|tranzac""",
      RegexOption.IGNORE_CASE
    )
  }
}

/** Small persistent queue shared by the service and the JS module. */
internal object Queue {
  private const val PREFS = "bank_notifications"
  private const val KEY = "queue"
  private const val LAST = "lastKey"

  @Synchronized
  fun add(context: Context, notificationKey: String, entry: JSONObject) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    // Apps often re-post the same notification when it updates; keep one copy.
    val fingerprint = notificationKey + "|" + entry.optString("text")
    if (prefs.getString(LAST, null) == fingerprint) return
    val queue = JSONArray(prefs.getString(KEY, "[]"))
    queue.put(entry)
    prefs.edit().putString(KEY, queue.toString()).putString(LAST, fingerprint).apply()
  }

  @Synchronized
  fun drain(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val queue = prefs.getString(KEY, "[]") ?: "[]"
    prefs.edit().putString(KEY, "[]").apply()
    return queue
  }
}
