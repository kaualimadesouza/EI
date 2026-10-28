package io.github.kaualimadesouza.topa

import android.content.ComponentName
import android.content.pm.PackageManager
import android.graphics.Color
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // light icons over the teal that fills the bars
    enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
    super.onCreate(savedInstanceState)
    keepClearOfSystemBars(findViewById(android.R.id.content))
  }

  // the page would lay out under the bars; padding here works on every WebView, CSS safe areas do not
  private fun keepClearOfSystemBars(content: View) {
    content.setBackgroundColor(getColor(R.color.system_bars))
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      WindowInsetsCompat.CONSUMED
    }
  }

  // runs before the first page load; without HCE there is no bridge, so the kiosk points to the sticker
  override fun onWebViewCreate(webView: WebView) {
    if (packageManager.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)) {
      webView.addJavascriptInterface(TagBridge(), "TopaTag")
    }
  }

  override fun onResume() {
    super.onResume()
    if (TagEmulationService.publishedUrl != null) serve()
  }

  override fun onPause() {
    // Android honours a preferred service only while its activity is resumed
    if (TagEmulationService.publishedUrl != null) releaseTag()
    super.onPause()
  }

  private inner class TagBridge {
    @JavascriptInterface
    fun publish(url: String) {
      TagEmulationService.publishedUrl = url
      runOnUiThread { serve() }
    }

    @JavascriptInterface
    fun withdraw() {
      TagEmulationService.publishedUrl = null
      runOnUiThread {
        releaseTag()
        restorePolling()
      }
    }
  }

  private fun serve() {
    preferTag()
    stopPolling()
  }

  // when another app also claims the NDEF AID, Android shows the totem a "tap again" prompt and answers nothing
  private fun preferTag() =
    withNfc { CardEmulation.getInstance(it).setPreferredService(this, ComponentName(this, TagEmulationService::class.java)) }

  private fun releaseTag() = withNfc { CardEmulation.getInstance(it).unsetPreferredService(this) }

  // a totem polling for tags would read the customer's wallet card instead of being read (Android 15+)
  private fun stopPolling() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
    withNfc { it.setDiscoveryTechnology(this, NfcAdapter.FLAG_READER_DISABLE, NfcAdapter.FLAG_LISTEN_KEEP) }
  }

  private fun restorePolling() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
    withNfc { it.resetDiscoveryTechnology(this) }
  }

  private fun withNfc(change: (NfcAdapter) -> Unit) {
    val adapter = NfcAdapter.getDefaultAdapter(this) ?: return
    try {
      change(adapter)
    } catch (e: RuntimeException) {
      // a refusal only brings back the problem the call avoids; the tag itself keeps answering
      Log.w("TopaTag", "NFC change refused", e)
    }
  }
}
