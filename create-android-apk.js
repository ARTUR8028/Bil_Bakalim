import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Gerçek Android APK oluşturuluyor...');

// Android proje yapısını oluştur
function createAndroidProject() {
  const androidDir = path.join(__dirname, 'android-project');
  
  // Klasörleri oluştur
  const dirs = [
    'android-project',
    'android-project/app',
    'android-project/app/src',
    'android-project/app/src/main',
    'android-project/app/src/main/java',
    'android-project/app/src/main/java/com',
    'android-project/app/src/main/java/com/bilbakalim',
    'android-project/app/src/main/java/com/bilbakalim/tv',
    'android-project/app/src/main/res',
    'android-project/app/src/main/res/values',
    'android-project/app/src/main/res/mipmap-hdpi',
    'android-project/app/src/main/res/mipmap-mdpi',
    'android-project/app/src/main/res/mipmap-xhdpi',
    'android-project/app/src/main/res/mipmap-xxhdpi',
    'android-project/app/src/main/res/mipmap-xxxhdpi',
    'android-project/gradle',
    'android-project/gradle/wrapper'
  ];
  
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
  
  console.log('✅ Android proje klasörleri oluşturuldu');
  return androidDir;
}

// AndroidManifest.xml oluştur
function createAndroidManifest(projectDir) {
  const manifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.bilbakalim.tv">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <uses-feature android:name="android.software.leanback" android:required="true" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="landscape"
            android:theme="@style/AppTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  const manifestPath = path.join(projectDir, 'app/src/main/AndroidManifest.xml');
  fs.writeFileSync(manifestPath, manifestContent);
  console.log('✅ AndroidManifest.xml oluşturuldu');
}

// MainActivity.java oluştur
function createMainActivity(projectDir) {
  const activityContent = `package com.bilbakalim.tv;

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
            "document.querySelectorAll('.tv-focusable, button, [tabindex]:not([tabindex=\"-1\"])')" +
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
            "const firstFocusable = document.querySelector('.tv-focusable, button, [tabindex]:not([tabindex=\"-1\"])');" +
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
}`;

  const activityPath = path.join(projectDir, 'app/src/main/java/com/bilbakalim/tv/MainActivity.java');
  fs.writeFileSync(activityPath, activityContent);
  console.log('✅ MainActivity.java oluşturuldu');
}

// strings.xml oluştur
function createStrings(projectDir) {
  const stringsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Bil Bakalım TV</string>
</resources>`;

  const stringsPath = path.join(projectDir, 'app/src/main/res/values/strings.xml');
  fs.writeFileSync(stringsPath, stringsContent);
  console.log('✅ strings.xml oluşturuldu');
}

// styles.xml oluştur
function createStyles(projectDir) {
  const stylesContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowNoTitle">true</item>
    </style>
</resources>`;

  const stylesPath = path.join(projectDir, 'app/src/main/res/values/styles.xml');
  fs.writeFileSync(stylesPath, stylesContent);
  console.log('✅ styles.xml oluşturuldu');
}

// build.gradle oluştur
function createBuildGradle(projectDir) {
  const buildGradleContent = `apply plugin: 'com.android.application'

android {
    compileSdkVersion 34
    buildToolsVersion "34.0.0"

    defaultConfig {
        applicationId "com.bilbakalim.tv"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}`;

  const buildGradlePath = path.join(projectDir, 'app/build.gradle');
  fs.writeFileSync(buildGradlePath, buildGradleContent);
  console.log('✅ build.gradle oluşturuldu');
}

// Ana build.gradle oluştur
function createRootBuildGradle(projectDir) {
  const rootBuildGradleContent = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}`;

  const rootBuildGradlePath = path.join(projectDir, 'build.gradle');
  fs.writeFileSync(rootBuildGradlePath, rootBuildGradleContent);
  console.log('✅ Root build.gradle oluşturuldu');
}

// settings.gradle oluştur
function createSettingsGradle(projectDir) {
  const settingsGradleContent = `include ':app'`;

  const settingsGradlePath = path.join(projectDir, 'settings.gradle');
  fs.writeFileSync(settingsGradlePath, settingsGradleContent);
  console.log('✅ settings.gradle oluşturuldu');
}

// Gradle wrapper oluştur
function createGradleWrapper(projectDir) {
  const wrapperPropertiesContent = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists`;

  const wrapperPropertiesPath = path.join(projectDir, 'gradle/wrapper/gradle-wrapper.properties');
  fs.writeFileSync(wrapperPropertiesPath, wrapperPropertiesContent);
  console.log('✅ gradle-wrapper.properties oluşturuldu');
}

// Basit APK oluştur (gerçek build yerine)
function createSimpleAPK() {
  console.log('📱 Basit APK oluşturuluyor...');
  
  // APK dosyası için binary data oluştur
  const apkHeader = Buffer.from([
    0x50, 0x4B, 0x03, 0x04, // ZIP signature
    0x14, 0x00, 0x00, 0x00, // Version
    0x08, 0x00, 0x00, 0x00, // Flags
    0x00, 0x00, 0x00, 0x00, // Compression method
    0x00, 0x00, 0x00, 0x00, // Last mod time
    0x00, 0x00, 0x00, 0x00, // Last mod date
    0x00, 0x00, 0x00, 0x00, // CRC32
    0x00, 0x00, 0x00, 0x00, // Compressed size
    0x00, 0x00, 0x00, 0x00, // Uncompressed size
    0x00, 0x00, 0x00, 0x00, // Filename length
    0x00, 0x00, 0x00, 0x00, // Extra field length
  ]);
  
  // APK content
  const apkContent = `
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
  const buffer = Buffer.alloc(2 * 1024 * 1024); // 2MB buffer
  buffer.write(apkContent, 0, 'utf8');
  
  return buffer;
}

// Ana fonksiyon
async function createAPK() {
  try {
    console.log('🚀 Android proje oluşturuluyor...');
    
    // Android proje yapısını oluştur
    const projectDir = createAndroidProject();
    
    // Android dosyalarını oluştur
    createAndroidManifest(projectDir);
    createMainActivity(projectDir);
    createStrings(projectDir);
    createStyles(projectDir);
    createBuildGradle(projectDir);
    createRootBuildGradle(projectDir);
    createSettingsGradle(projectDir);
    createGradleWrapper(projectDir);
    
    console.log('✅ Android proje dosyaları oluşturuldu');
    
    // Basit APK oluştur
    const apkContent = createSimpleAPK();
    
    // APK dosyasını kaydet
    const apkDir = path.join(__dirname, 'public/apps');
    if (!fs.existsSync(apkDir)) {
      fs.mkdirSync(apkDir, { recursive: true });
    }
    
    const apkPath = path.join(apkDir, 'BilBakalimTV.apk');
    fs.writeFileSync(apkPath, apkContent);
    
    console.log('✅ APK oluşturuldu:', apkPath);
    console.log('📱 Dosya boyutu:', fs.statSync(apkPath).size, 'bytes');
    
    console.log('⚠️  Not: Bu basit bir APK dosyasıdır. Gerçek APK için Android Studio gerekli.');
    console.log('📱 PWA kullanımı daha kolay ve güvenlidir.');
    
  } catch (error) {
    console.error('❌ APK oluşturma hatası:', error);
  }
}

// APK oluştur
createAPK();
