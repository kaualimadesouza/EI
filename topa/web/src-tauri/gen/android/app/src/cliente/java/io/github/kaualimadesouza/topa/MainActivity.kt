package io.github.kaualimadesouza.topa

import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
    super.onCreate(savedInstanceState)
    keepClearOfSystemBars(findViewById(android.R.id.content))
  }

  // the page would lay out under the bars; padding here works on every WebView, CSS safe areas do not
  private fun keepClearOfSystemBars(content: View) {
    val barColorRes = resources.getIdentifier("system_bars", "color", packageName)
    if (barColorRes != 0) content.setBackgroundColor(getColor(barColorRes))
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      WindowInsetsCompat.CONSUMED
    }
  }

  // customer app provides native flavor and never registers the totem HCE tag bridge
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(AppBridge("cliente"), "TopaNative")
  }

  private inner class AppBridge(private val flavor: String) {
    @JavascriptInterface
    fun getFlavor(): String = flavor
  }
}
