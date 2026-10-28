package io.github.kaualimadesouza.topa

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

  // runs before the first page load, so the kiosk finds window.TopaTag from the start
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(TagBridge(), "TopaTag")
  }

  override fun onResume() {
    super.onResume()
    if (TagEmulationService.publishedUrl != null) listenOnly(true)
  }

  private inner class TagBridge {
    @JavascriptInterface
    fun publish(url: String) {
      TagEmulationService.publishedUrl = url
      runOnUiThread { listenOnly(true) }
    }

    @JavascriptInterface
    fun withdraw() {
      TagEmulationService.publishedUrl = null
      runOnUiThread { listenOnly(false) }
    }
  }

  // a totem polling for tags would read the customer's wallet card instead of being read (Android 15+)
  private fun listenOnly(on: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
    val adapter = NfcAdapter.getDefaultAdapter(this) ?: return
    try {
      if (on) {
        adapter.setDiscoveryTechnology(this, NfcAdapter.FLAG_READER_DISABLE, NfcAdapter.FLAG_LISTEN_KEEP)
      } else {
        adapter.resetDiscoveryTechnology(this)
      }
    } catch (e: RuntimeException) {
      // only costs reliability on a crowded tap; the tag itself keeps answering
      Log.w("TopaTag", "NFC discovery change refused", e)
    }
  }
}
