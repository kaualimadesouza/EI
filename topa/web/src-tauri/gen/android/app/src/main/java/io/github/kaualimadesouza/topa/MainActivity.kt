package io.github.kaualimadesouza.topa

import android.content.pm.PackageManager
import android.graphics.Color
import android.nfc.NfcAdapter
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

  // the page would lay out under the bars, and WebViews before 140 report no safe area to CSS
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
    if (TagEmulationService.publishedUrl != null) stopPolling()
  }

  private inner class TagBridge {
    @JavascriptInterface
    fun publish(url: String) {
      TagEmulationService.publishedUrl = url
      runOnUiThread { stopPolling() }
    }

    @JavascriptInterface
    fun withdraw() {
      TagEmulationService.publishedUrl = null
      runOnUiThread { restorePolling() }
    }
  }

  // a totem polling for tags would read the customer's wallet card instead of being read (Android 15+)
  private fun stopPolling() =
    changeDiscovery { it.setDiscoveryTechnology(this, NfcAdapter.FLAG_READER_DISABLE, NfcAdapter.FLAG_LISTEN_KEEP) }

  private fun restorePolling() = changeDiscovery { it.resetDiscoveryTechnology(this) }

  private fun changeDiscovery(change: (NfcAdapter) -> Unit) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
    val adapter = NfcAdapter.getDefaultAdapter(this) ?: return
    try {
      change(adapter)
    } catch (e: RuntimeException) {
      // only costs reliability on a crowded tap; the tag itself keeps answering
      Log.w("TopaTag", "NFC discovery change refused", e)
    }
  }
}
