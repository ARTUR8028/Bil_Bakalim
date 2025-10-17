package com.bilbakalim.tv;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String APP_URL = "https://bil-bakalim.onrender.com/#tv";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        setupWebView();
        loadApp();
    }

    private void setupWebView() {
        webView = new WebView(this);
        
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(false);
        webSettings.setDefaultTextEncodingName("utf-8");
        
        // TV optimizations
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
            
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectTVNavigation();
            }
        });
        
        // TV remote key handling
        webView.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if (event.getAction() == KeyEvent.ACTION_DOWN) {
                    switch (keyCode) {
                        case KeyEvent.KEYCODE_DPAD_UP:
                        case KeyEvent.KEYCODE_DPAD_DOWN:
                        case KeyEvent.KEYCODE_DPAD_LEFT:
                        case KeyEvent.KEYCODE_DPAD_RIGHT:
                        case KeyEvent.KEYCODE_DPAD_CENTER:
                        case KeyEvent.KEYCODE_ENTER:
                            webView.dispatchKeyEvent(event);
                            return true;
                        case KeyEvent.KEYCODE_BACK:
                            if (webView.canGoBack()) {
                                webView.goBack();
                                return true;
                            }
                            break;
                    }
                }
                return false;
            }
        });
        
        setContentView(webView);
    }

    private void loadApp() {
        webView.loadUrl(APP_URL);
        Toast.makeText(this, "📺 Bil Bakalım TV Yükleniyor...", Toast.LENGTH_SHORT).show();
    }

    private void injectTVNavigation() {
        String jsCode = "(function() {" +
            "let focusedElement = null;" +
            "function handleTVNavigation(event) {" +
            "const focusableElements = Array.from(" +
            "document.querySelectorAll('.tv-focusable, button, [tabindex]:not([tabindex="-1"])')" +
            ");" +
            "if (focusableElements.length === 0) return;" +
            "const currentIndex = focusedElement ? " +
            "focusableElements.indexOf(focusedElement) : 0;" +
            "let newIndex = currentIndex;" +
            "switch(event.key) {" +
            "case 'ArrowUp':" +
            "case 'ArrowLeft':" +
            "newIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;" +
            "break;" +
            "case 'ArrowDown':" +
            "case 'ArrowRight':" +
            "newIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;" +
            "break;" +
            "case 'Enter':" +
            "case ' ':" +
            "if (focusedElement) focusedElement.click();" +
            "return;" +
            "}" +
            "focusedElement = focusableElements[newIndex];" +
            "if (focusedElement) {" +
            "focusedElement.focus();" +
            "focusedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });" +
            "}" +
            "}" +
            "document.addEventListener('keydown', handleTVNavigation);" +
            "document.addEventListener('focusin', (e) => { focusedElement = e.target; });" +
            "const firstFocusable = document.querySelector('.tv-focusable, button, [tabindex]:not([tabindex="-1"])');" +
            "if (firstFocusable) { firstFocusable.focus(); focusedElement = firstFocusable; }" +
            "console.log('📺 TV Navigation initialized');" +
            "})();";
        
        webView.evaluateJavascript(jsCode, null);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}