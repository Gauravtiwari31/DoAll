package com.doall.reminders

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.doall.MainActivity
import com.doall.R
import org.json.JSONArray
import org.json.JSONObject

/** One notification to show at [fireAt] (ms since the epoch). */
internal data class Reminder(
    val id: String,
    val taskId: String,
    val title: String,
    val body: String,
    val fireAt: Long,
)

/**
 * The reminder queue and its alarm.
 *
 * The app gives the whole queue at once ([replace]). Only the earliest
 * reminder has an alarm. When it goes off, [arm] shows every reminder that is
 * due and sets the alarm for the next one. So any number of reminders work
 * with a single alarm, well clear of Android's per-app limit, and nothing has
 * to be cancelled one by one when tasks change.
 *
 * The queue is kept in SharedPreferences, because alarms don't survive a
 * reboot, an app update or a clock change: [ReminderReceiver] calls [arm] again
 * after each of those.
 */
internal object ReminderScheduler {
  private const val TAG = "DoAllReminders"
  private const val PREFS = "doall_reminders"
  private const val KEY_QUEUE = "queue"
  private const val CHANNEL_ID = "reminders"
  private const val NOTIFICATION_ID = 1

  const val ACTION_ALARM = "com.doall.reminders.ALARM"
  /** Extra on the Intent that opens the app from a notification. */
  const val EXTRA_TASK_ID = "com.doall.TASK_ID"

  /** Reminders due this close together go off together. */
  private const val BATCH_MS = 30_000L
  /** A reminder missed while the phone was off is still shown if it's this recent. */
  private const val LATE_GRACE_MS = 6 * 60 * 60 * 1000L
  /**
   * Without the exact alarm permission, the alarm aims straight at a reminder
   * only this close to it (see [arm]).
   */
  private const val FINAL_HOP_MS = 15 * 60 * 1000L

  @Synchronized
  fun replace(context: Context, reminders: List<Reminder>) {
    save(context, reminders.sortedBy { it.fireAt })
    arm(context)
  }

  @Synchronized
  fun load(context: Context): List<Reminder> {
    val raw = prefs(context).getString(KEY_QUEUE, null) ?: return emptyList()
    return try {
      parse(raw)
    } catch (e: Exception) {
      Log.w(TAG, "Dropping an unreadable reminder queue", e)
      emptyList()
    }
  }

  /** Shows what's due, then sets the alarm for the next reminder (or clears it). */
  @Synchronized
  fun arm(context: Context) {
    val now = System.currentTimeMillis()
    val queue = load(context)
    val (due, later) = queue.partition { it.fireAt <= now + BATCH_MS }
    if (due.isNotEmpty()) {
      due.filter { it.fireAt >= now - LATE_GRACE_MS }.forEach { show(context, it) }
      save(context, later)
    }

    val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
    val alarm = alarmIntent(context)
    val next = later.firstOrNull()
    if (next == null) {
      alarmManager.cancel(alarm)
      return
    }
    if (canScheduleExact(alarmManager)) {
      try {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.fireAt, alarm)
        return
      } catch (e: SecurityException) {
        // The permission was withdrawn just now; fall back to an inexact alarm.
        Log.w(TAG, "Exact alarm refused", e)
      }
    }
    // Without the permission: an inexact alarm that may still go off while the
    // phone is in Doze (deep sleep, which lasts longest when it's offline and
    // nothing else wakes it). Android delivers such an alarm up to 3/4 of its
    // lead time late (an hour at most), so a far reminder is reached in hops:
    // halfway there, then again, until it is 15 minutes away. Each hop runs
    // arm() again, which re-aims at the reminder.
    val delay = next.fireAt - now
    val target = if (delay <= FINAL_HOP_MS) next.fireAt else now + delay / 2
    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target, alarm)
  }

  fun canScheduleExact(alarmManager: AlarmManager): Boolean =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()

  fun parse(json: String): List<Reminder> {
    val array = JSONArray(json)
    return (0 until array.length()).map { i ->
      val item = array.getJSONObject(i)
      Reminder(
          id = item.getString("id"),
          taskId = item.getString("taskId"),
          title = item.getString("title"),
          body = item.optString("body"),
          fireAt = item.getLong("fireAt"),
      )
    }
  }

  private fun save(context: Context, reminders: List<Reminder>) {
    val array = JSONArray()
    reminders.forEach {
      array.put(
          JSONObject()
              .put("id", it.id)
              .put("taskId", it.taskId)
              .put("title", it.title)
              .put("body", it.body)
              .put("fireAt", it.fireAt))
    }
    prefs(context).edit().putString(KEY_QUEUE, array.toString()).apply()
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun alarmIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, ReminderReceiver::class.java).setAction(ACTION_ALARM),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  // Checked just above the call: Android 13+ needs POST_NOTIFICATIONS, granted at runtime.
  @SuppressLint("MissingPermission")
  private fun show(context: Context, reminder: Reminder) {
    val notifications = NotificationManagerCompat.from(context)
    val allowed =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
    if (!allowed || !notifications.areNotificationsEnabled()) return

    notifications.createNotificationChannel(
        NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_HIGH)
            .setName(context.getString(R.string.reminders_channel_name))
            .setDescription(context.getString(R.string.reminders_channel_description))
            .build())

    val open =
        Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_VIEW)
            .putExtra(EXTRA_TASK_ID, reminder.taskId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val contentIntent =
        PendingIntent.getActivity(
            context,
            reminder.taskId.hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    val notification =
        NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setColor(ContextCompat.getColor(context, R.color.accent))
            .setContentTitle(reminder.title)
            .setContentText(reminder.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reminder.body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setWhen(reminder.fireAt)
            .setShowWhen(true)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build()
    // Tagged by task: a task's next reminder replaces its previous one.
    notifications.notify(reminder.taskId, NOTIFICATION_ID, notification)
  }
}
