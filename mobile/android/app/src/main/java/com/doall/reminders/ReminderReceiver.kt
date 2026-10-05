package com.doall.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Wakes up for the reminder alarm, and for the system events that clear or
 * skew alarms (reboot, app update, clock or time zone change, the exact alarm
 * permission changing). Either way the queue is gone through again: due
 * reminders are shown and the alarm is set for the next one.
 */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    ReminderScheduler.arm(context)
  }
}
