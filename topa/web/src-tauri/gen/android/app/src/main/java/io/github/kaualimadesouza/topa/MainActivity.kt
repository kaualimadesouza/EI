package io.github.kaualimadesouza.topa

import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
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
