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
    // a preferred service holds only while resumed, and a paused totem must let other apps read tags
    if (TagEmulationService.publishedUrl != null) stopServing()
    super.onPause()
  }

  // calls arrive on the bridge's own thread; the URL changes on the UI thread, where the lifecycle reads it
  private inner class TagBridge {
    @JavascriptInterface
    fun publish(url: String) = runOnUiThread {
      TagEmulationService.publishedUrl = url
      serve()
    }

    @JavascriptInterface
    fun withdraw() = runOnUiThread {
      TagEmulationService.publishedUrl = null
      stopServing()
    }
  }

  // another app claiming the NDEF AID makes Android show the totem a "tap again" prompt and answer nothing;
  // a totem polling for tags would read the customer's wallet card instead of being read (Android 15+)
  private fun serve() {
    withNfc {
      val tag = ComponentName(this, TagEmulationService::class.java)
      if (!CardEmulation.getInstance(it).setPreferredService(this, tag)) Log.w(LOG_TAG, "preferred service refused")
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      withNfc { it.setDiscoveryTechnology(this, NfcAdapter.FLAG_READER_DISABLE, NfcAdapter.FLAG_LISTEN_KEEP) }
    }
  }

  private fun stopServing() {
    withNfc { CardEmulation.getInstance(it).unsetPreferredService(this) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) withNfc { it.resetDiscoveryTechnology(this) }
  }

  private fun withNfc(change: (NfcAdapter) -> Unit) {
    val adapter = NfcAdapter.getDefaultAdapter(this) ?: return
    try {
      change(adapter)
    } catch (e: RuntimeException) {
      // logged, never fatal: the tag itself keeps answering
      Log.w(LOG_TAG, "NFC change refused", e)
    }
  }
}

private const val LOG_TAG = "TopaTag"
