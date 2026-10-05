package com.doall.googlesignin

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers [GoogleSignInModule] with React Native (see MainApplication). */
class GoogleSignInPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == GoogleSignInModule.NAME) GoogleSignInModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
        GoogleSignInModule.NAME to
            ReactModuleInfo(
                name = GoogleSignInModule.NAME,
                className = GoogleSignInModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            ),
    )
  }
}
