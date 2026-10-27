package expo.modules.mediakeys

import android.content.Context
import android.media.AudioManager
import android.os.SystemClock
import android.view.KeyEvent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MediaKeysModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MediaKeys")

    Function("sendKey") { keyCode: Int ->
      val context = appContext.reactContext ?: return@Function false
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val now = SystemClock.uptimeMillis()
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0))
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0))
      true
    }
  }
}
