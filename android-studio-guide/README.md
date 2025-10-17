# 🚀 Android Studio ile Gerçek APK Oluşturma

## 📱 Adım Adım Rehber

### 1️⃣ **Android Studio'da Yeni Proje Oluştur**
- **File** → **New** → **New Project**
- **Empty Activity** seç
- **Name:** `BilBakalimTV`
- **Package name:** `com.bilbakalim.tv`
- **Language:** Java
- **Minimum SDK:** API 21 (Android 5.0)

### 2️⃣ **MainActivity.java Kodunu Yapıştır**
```java
package com.bilbakalim.tv;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
        
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("https://bil-bakalim.onrender.com/#tv");
        setContentView(webView);
    }
}
```

### 3️⃣ **AndroidManifest.xml Güncelle**
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.bilbakalim.tv">
    
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-feature android:name="android.software.leanback" android:required="true" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Bil Bakalım TV"
        android:supportsRtl="true"
        android:theme="@style/Theme.Leanback">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="landscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 4️⃣ **Build.gradle (Root) Güncelle**
```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.13.0'
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.20'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

### 5️⃣ **Build.gradle (App) Güncelle**
```gradle
plugins {
    id 'com.android.application'
}

android {
    namespace 'com.bilbakalim.tv'
    compileSdk 34

    defaultConfig {
        applicationId "com.bilbakalim.tv"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation 'androidx.leanback:leanback:1.0.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.10.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
```

### 6️⃣ **APK Build Et**
1. **Build** → **Build APK(s)**
2. **Build** → **Generate Signed Bundle/APK**
3. **APK** seç
4. **Create new keystore** (ilk kez)
5. **Build** → **Build APK(s)**

### 7️⃣ **APK Dosyasını Kopyala**
- **app/build/outputs/apk/debug/app-debug.apk**
- Bu dosyayı `public/apps/BilBakalimTV.apk` olarak kopyala

## 🎯 **Sonuç**
- ✅ Gerçek Android APK
- ✅ Google TV uyumlu
- ✅ WebView ile PWA yükleme
- ✅ Landscape mod
- ✅ İnternet izni

## 📱 **Test Et**
1. APK'yı Android TV'ye yükle
2. Uygulamayı aç
3. PWA otomatik yüklenecek
4. Quiz oyunu çalışacak
