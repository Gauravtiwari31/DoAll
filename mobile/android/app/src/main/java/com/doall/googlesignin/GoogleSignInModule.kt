package com.doall.googlesignin

import android.util.Log
import androidx.core.content.ContextCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.doall.specs.NativeGoogleSignInSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/**
 * "Sign in with Google" through Android's Credential Manager, which replaced
 * the deprecated Google Sign-In SDK. It shows Google's own account chooser and
 * hands back an ID token issued to the DoAll server's OAuth client; the server
 * verifies it with Google. The JavaScript side is src/native/NativeGoogleSignIn.ts.
 */
class GoogleSignInModule(reactContext: ReactApplicationContext) :
    NativeGoogleSignInSpec(reactContext) {

  private val credentialManager by lazy { CredentialManager.create(reactApplicationContext) }

  override fun getName() = NAME

  override fun signIn(webClientId: String, promise: Promise) {
    // The chooser is a screen of its own, so it starts from the current Activity.
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(ERROR_FAILED, "DoAll isn't in the foreground")
      return
    }
    // The "Sign in with Google" button flow: every account on the phone, plus
    // "Add account". (The bottom-sheet flow is for unprompted sign-in.)
    val request =
        GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build())
            .build()
    credentialManager.getCredentialAsync(
        activity,
        request,
        null,
        ContextCompat.getMainExecutor(activity),
        object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
          override fun onResult(result: GetCredentialResponse) = resolveIdToken(result, promise)

          override fun onError(e: GetCredentialException) = reject(e, promise)
        },
    )
  }

  override fun signOut(promise: Promise) {
    credentialManager.clearCredentialStateAsync(
        ClearCredentialStateRequest(),
        null,
        ContextCompat.getMainExecutor(reactApplicationContext),
        object : CredentialManagerCallback<Void?, ClearCredentialException> {
          override fun onResult(result: Void?) = promise.resolve(null)

          override fun onError(e: ClearCredentialException) {
            // Logging out of DoAll must never fail because of this.
            Log.w(NAME, "Couldn't clear the Google sign-in state", e)
            promise.resolve(null)
          }
        },
    )
  }

  private fun resolveIdToken(result: GetCredentialResponse, promise: Promise) {
    val credential = result.credential
    if (credential !is CustomCredential ||
        credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
      promise.reject(ERROR_FAILED, "Unexpected credential type ${credential.type}")
      return
    }
    try {
      promise.resolve(GoogleIdTokenCredential.createFrom(credential.data).idToken)
    } catch (e: GoogleIdTokenParsingException) {
      promise.reject(ERROR_FAILED, "Couldn't read Google's answer", e)
    }
  }

  private fun reject(e: GetCredentialException, promise: Promise) {
    val code =
        when (e) {
          is GetCredentialCancellationException -> ERROR_CANCELLED
          is NoCredentialException,
          is GetCredentialProviderConfigurationException,
          is GetCredentialUnsupportedException -> ERROR_UNAVAILABLE
          else -> ERROR_FAILED
        }
    // A wrong client ID or a missing SHA-1 fingerprint in Google Cloud also ends up here.
    if (code != ERROR_CANCELLED) Log.w(NAME, "Google sign-in failed (${e.type})", e)
    promise.reject(code, e.message ?: e.type, e)
  }

  companion object {
    const val NAME = "DoAllGoogleSignIn"
    private const val ERROR_CANCELLED = "cancelled"
    private const val ERROR_UNAVAILABLE = "unavailable"
    private const val ERROR_FAILED = "failed"
  }
}
