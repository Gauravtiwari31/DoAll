package com.doall.device

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import com.doall.specs.NativeDeviceSpec
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.TimeZone
import java.util.UUID

/**
 * Small platform helpers for JavaScript (src/native/NativeDevice.ts): IDs for
 * tasks created offline, the time zone, and saving the data export through
 * Android's own "Save to" screen (the Storage Access Framework), which needs
 * no storage permission.
 */
class DeviceModule(reactContext: ReactApplicationContext) :
    NativeDeviceSpec(reactContext), ActivityEventListener {

  /** The export waiting for the user to pick where it goes. */
  private class PendingSave(val contents: String, val promise: Promise)

  private var pendingSave: PendingSave? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = NAME

  override fun randomUUID(): String = UUID.randomUUID().toString()

  override fun getTimeZone(): String = TimeZone.getDefault().id

  override fun saveTextFile(fileName: String, mimeType: String, contents: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(ERROR_FAILED, "DoAll isn't in the foreground")
      return
    }
    if (pendingSave != null) {
      promise.reject(ERROR_FAILED, "Already saving a file")
      return
    }
    val intent =
        Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mimeType)
            .putExtra(Intent.EXTRA_TITLE, fileName)
    pendingSave = PendingSave(contents, promise)
    try {
      activity.startActivityForResult(intent, REQUEST_SAVE)
    } catch (e: ActivityNotFoundException) {
      pendingSave = null
      promise.reject(ERROR_FAILED, "This phone has no screen for saving files", e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_SAVE) return
    val save = pendingSave ?: return
    pendingSave = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      save.promise.resolve(false)
      return
    }
    try {
      val stream =
          activity.contentResolver.openOutputStream(uri)
              ?: throw IllegalStateException("Couldn't open the file")
      stream.use { it.write(save.contents.toByteArray(Charsets.UTF_8)) }
      save.promise.resolve(true)
    } catch (e: Exception) {
      save.promise.reject(ERROR_FAILED, e.message ?: "Couldn't write the file", e)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }

  companion object {
    const val NAME = "DoAllDevice"
    private const val REQUEST_SAVE = 4120
    private const val ERROR_FAILED = "failed"
  }
}
