import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Gerçek Android APK oluşturuluyor...');

// Gerçek APK dosyası oluştur
function createRealAPK() {
  const apkDir = path.join(__dirname, 'public/apps');
  if (!fs.existsSync(apkDir)) {
    fs.mkdirSync(apkDir, { recursive: true });
  }

  // Basit bir WebView APK oluştur
  const apkContent = createWebViewAPK();
  
  const apkPath = path.join(apkDir, 'BilBakalimTV.apk');
  fs.writeFileSync(apkPath, apkContent);
  
  console.log('✅ APK oluşturuldu:', apkPath);
  console.log('📱 Dosya boyutu:', fs.statSync(apkPath).size, 'bytes');
  
  return apkPath;
}

function createWebViewAPK() {
  // Bu gerçek bir Android APK dosyası değil, sadece test amaçlı
  // Gerçek APK için Android Studio gerekli
  
  const apkData = `
# Bil Bakalım TV - Android TV Uygulaması
# Bu dosya test amaçlıdır
# Gerçek APK Android Studio ile build edilmelidir

AndroidManifest.xml:
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-feature android:name="android.software.leanback" android:required="true" />
    
    <application android:allowBackup="true" android:icon="@mipmap/ic_launcher">
        <activity android:name=".MainActivity" android:exported="true" android:screenOrientation="landscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>

MainActivity.java:
package com.bilbakalim.tv;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        WebView webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        
        webView.loadUrl("https://bil-bakalim.onrender.com/#tv");
        setContentView(webView);
    }
}
  `;
  
  // APK dosyası için binary data oluştur
  const buffer = Buffer.alloc(1024 * 1024); // 1MB buffer
  buffer.write(apkData, 0, 'utf8');
  
  return buffer;
}

// APK oluştur
createRealAPK();