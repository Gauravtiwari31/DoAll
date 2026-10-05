package com.doall.reminders

import android.app.AlarmManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.doall.specs.NativeRemindersSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

/**
 * Task reminders for JavaScript (src/native/NativeReminders.ts): hands the
 * planned reminders to [ReminderScheduler], reports the phone settings that
 * affect them and opens those settings.
 */
class RemindersModule(reactContext: ReactApplicationContext) :
    NativeRemindersSpec(reactContext) {

  override fun getName() = NAME

  override fun setReminders(json: String, promise: Promise) {
    try {
      ReminderScheduler.replace(reactApplicationContext, ReminderScheduler.parse(json))
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject(ERROR_FAILED, e.message ?: "Couldn't schedule reminders", e)
    }
  }

  override fun getStatus(promise: Promise) {
    val context = reactApplicationContext
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    val power = context.getSystemService(PowerManager::class.java)
    val queue = ReminderScheduler.load(context)
    val status =
        Arguments.createMap().apply {
          putBoolean(
              "notificationsEnabled",
              NotificationManagerCompat.from(context).areNotificationsEnabled())
          putBoolean(
              "exactAlarmsAllowed",
              alarmManager != null && ReminderScheduler.canScheduleExact(alarmManager))
          putBoolean(
              "ignoringBatteryOptimizations",
              power?.isIgnoringBatteryOptimizations(context.packageName) == true)
          putInt("scheduled", queue.size)
          putDouble("nextAt", queue.minOfOrNull { it.fireAt }?.toDouble() ?: -1.0)
        }
    promise.resolve(status)
  }

  override fun openSettings(kind: String, promise: Promise) {
    val packageName = reactApplicationContext.packageName
    val appDetails =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
    val intent =
        when (kind) {
          "notifications" ->
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
              } else appDetails
          "exactAlarms" ->
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent(
                    Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:$packageName"))
              } else null
          // The list, not the direct "ignore battery optimisations?" prompt, which
          // Google Play only allows for a few kinds of apps.
          "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          "app" -> appDetails
          else -> null
        }
    if (intent == null) {
      promise.resolve(false)
      return
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      // Some phones lack a screen; app info always exists.
      try {
        reactApplicationContext.startActivity(appDetails.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        promise.resolve(true)
      } catch (e: ActivityNotFoundException) {
        promise.resolve(false)
      }
    }
  }

  override fun takeOpenedTaskId(promise: Promise) {
    val intent = reactApplicationContext.currentActivity?.intent
    val taskId = intent?.getStringExtra(ReminderScheduler.EXTRA_TASK_ID)
    // Once only: the same Intent is still there when the app comes back later.
    intent?.removeExtra(ReminderScheduler.EXTRA_TASK_ID)
    promise.resolve(taskId)
  }

  companion object {
    const val NAME = "DoAllReminders"
    private const val ERROR_FAILED = "failed"
  }
}
