#!/usr/bin/env node

/**
 * Render Deployment Monitor & Auto-Fixer
 * Otomatik hata tespiti ve çözüm sistemi
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Environment variables yükle
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RenderMonitor {
  constructor() {
    this.apiKey = process.env.RENDER_API_KEY;
    this.serviceId = process.env.RENDER_SERVICE_ID;
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL; // Opsiyonel
    this.checkInterval = 60000; // 1 dakika
    this.maxRetries = 3;
    this.retryDelay = 30000; // 30 saniye
    
    console.log('🚀 RenderMonitor initialized');
    console.log(`🔑 API Key: ${this.apiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`🆔 Service ID: ${this.serviceId || '❌ Missing'}`);
  }

  /**
   * Render API'ye istek gönder
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.render.com',
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(body);
            resolve({ status: res.statusCode, data: jsonData });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Service durumunu kontrol et
   */
  async checkServiceHealth() {
    try {
      console.log('🔍 Service durumu kontrol ediliyor...');
      console.log(`🔑 API Key: ${this.apiKey ? '✅ Set' : '❌ Missing'}`);
      console.log(`🆔 Service ID: ${this.serviceId || '❌ Missing'}`);
      
      const response = await this.makeRequest(`/v1/services/${this.serviceId}`);
      
      if (response.status === 200) {
        const service = response.data;
        console.log(`✅ Service: ${service.name}`);
        console.log(`📊 Durum: ${service.serviceDetails?.buildCommand ? 'Build' : 'Running'}`);
        console.log(`🌐 URL: ${service.serviceDetails?.url || 'N/A'}`);
        
        return {
          healthy: service.serviceDetails?.healthCheckPath ? true : false,
          status: service.serviceDetails?.buildCommand ? 'building' : 'running',
          url: service.serviceDetails?.url,
          lastDeploy: service.serviceDetails?.lastDeploy
        };
      } else {
        console.log(`❌ Service durumu alınamadı: ${response.status}`);
        console.log(`📋 Response: ${JSON.stringify(response.data, null, 2)}`);
        return { healthy: false, error: response.data };
      }
    } catch (error) {
      console.log(`❌ Service kontrolü başarısız: ${error.message}`);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Deployment loglarını kontrol et
   */
  async checkDeploymentLogs() {
    try {
      console.log('📋 Deployment logları kontrol ediliyor...');
      
      const response = await this.makeRequest(`/v1/services/${this.serviceId}/deploys`);
      
      if (response.status === 200 && response.data.length > 0) {
        const latestDeploy = response.data[0];
        console.log(`📦 Son deployment: ${latestDeploy.id}`);
        console.log(`⏰ Tarih: ${new Date(latestDeploy.createdAt).toLocaleString('tr-TR')}`);
        console.log(`📊 Durum: ${latestDeploy.status}`);
        
        // Hata kontrolü
        if (latestDeploy.status === 'build_failed' || latestDeploy.status === 'update_failed') {
          console.log('🚨 Deployment hatası tespit edildi!');
          return {
            hasError: true,
            deployId: latestDeploy.id,
            status: latestDeploy.status,
            createdAt: latestDeploy.createdAt
          };
        }
        
        return { hasError: false, deploy: latestDeploy };
      }
      
      return { hasError: false, deploy: null };
    } catch (error) {
      console.log(`❌ Deployment logları alınamadı: ${error.message}`);
      return { hasError: true, error: error.message };
    }
  }

  /**
   * Service'i yeniden başlat
   */
  async restartService() {
    try {
      console.log('🔄 Service yeniden başlatılıyor...');
      
      const response = await this.makeRequest(`/v1/services/${this.serviceId}/deploys`, 'POST', {
        clearCache: 'clear'
      });
      
      if (response.status === 201) {
        console.log('✅ Service başarıyla yeniden başlatıldı!');
        return { success: true, deployId: response.data.id };
      } else {
        console.log(`❌ Service yeniden başlatılamadı: ${response.status}`);
        return { success: false, error: response.data };
      }
    } catch (error) {
      console.log(`❌ Service yeniden başlatma hatası: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Discord webhook'a bildirim gönder
   */
  async sendNotification(message, isError = false) {
    if (!this.webhookUrl) return;
    
    try {
      const payload = {
        content: isError ? `🚨 **HATA**: ${message}` : `✅ **BİLGİ**: ${message}`,
        username: 'Render Monitor',
        avatar_url: 'https://render.com/favicon.ico'
      };
      
      const options = {
        hostname: 'discord.com',
        port: 443,
        path: this.webhookUrl.replace('https://discord.com/api/webhooks/', '/api/webhooks/'),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(options);
      req.write(JSON.stringify(payload));
      req.end();
    } catch (error) {
      console.log(`❌ Bildirim gönderilemedi: ${error.message}`);
    }
  }

  /**
   * Ana monitoring döngüsü
   */
  async startMonitoring() {
    console.log('🚀 Render Monitor başlatılıyor...');
    console.log(`⏰ Kontrol aralığı: ${this.checkInterval / 1000} saniye`);
    
    if (!this.apiKey) {
      console.log('❌ RENDER_API_KEY environment variable gerekli!');
      process.exit(1);
    }
    
    if (!this.serviceId) {
      console.log('❌ RENDER_SERVICE_ID environment variable gerekli!');
      process.exit(1);
    }
    
    let consecutiveErrors = 0;
    
    const monitor = async () => {
      try {
        console.log('\n' + '='.repeat(50));
        console.log(`🕐 ${new Date().toLocaleString('tr-TR')} - Monitoring başlıyor...`);
        
        // Service durumunu kontrol et
        const health = await this.checkServiceHealth();
        
        // Deployment loglarını kontrol et
        const logs = await this.checkDeploymentLogs();
        
        if (logs.hasError) {
          consecutiveErrors++;
          console.log(`🚨 Hata tespit edildi! (${consecutiveErrors}/${this.maxRetries})`);
          
          if (consecutiveErrors >= this.maxRetries) {
            console.log('🔄 Maksimum deneme sayısına ulaşıldı, service yeniden başlatılıyor...');
            
            const restart = await this.restartService();
            if (restart.success) {
              console.log('✅ Service başarıyla yeniden başlatıldı!');
              await this.sendNotification(`Service otomatik olarak yeniden başlatıldı. Deploy ID: ${restart.deployId}`);
              consecutiveErrors = 0;
            } else {
              console.log('❌ Service yeniden başlatılamadı!');
              await this.sendNotification(`Service yeniden başlatılamadı: ${restart.error}`, true);
            }
          } else {
            console.log(`⏳ ${this.retryDelay / 1000} saniye sonra tekrar denenecek...`);
            setTimeout(monitor, this.retryDelay);
            return;
          }
        } else {
          consecutiveErrors = 0;
          console.log('✅ Her şey normal çalışıyor!');
        }
        
        // Sonraki kontrolü planla
        setTimeout(monitor, this.checkInterval);
        
      } catch (error) {
        console.log(`❌ Monitoring hatası: ${error.message}`);
        consecutiveErrors++;
        
        if (consecutiveErrors >= this.maxRetries) {
          console.log('🚨 Kritik hata! Service yeniden başlatılıyor...');
          await this.restartService();
          consecutiveErrors = 0;
        }
        
        setTimeout(monitor, this.retryDelay);
      }
    };
    
    // İlk kontrolü başlat
    monitor();
  }

  /**
   * Manuel service restart
   */
  async manualRestart() {
    console.log('🔄 Manuel service restart başlatılıyor...');
    const result = await this.restartService();
    
    if (result.success) {
      console.log('✅ Service başarıyla yeniden başlatıldı!');
      await this.sendNotification(`Manuel restart başarılı. Deploy ID: ${result.deployId}`);
    } else {
      console.log('❌ Service yeniden başlatılamadı!');
      await this.sendNotification(`Manuel restart başarısız: ${result.error}`, true);
    }
    
    return result;
  }
}

// CLI kullanımı
console.log('🔍 CLI Debug Info:');
console.log(`import.meta.url: ${import.meta.url}`);
console.log(`process.argv[1]: ${process.argv[1]}`);
console.log(`process.argv[2]: ${process.argv[2]}`);

// Her zaman CLI mode'u çalıştır
console.log('✅ CLI mode activated');
const monitor = new RenderMonitor();

const command = process.argv[2];
console.log(`🎯 Command: ${command}`);

switch (command) {
  case 'start':
    monitor.startMonitoring();
    break;
  case 'restart':
    monitor.manualRestart();
    break;
  case 'health':
    monitor.checkServiceHealth().then(result => {
      console.log('📊 Health Check Result:', result);
    }).catch(error => {
      console.log('❌ Health Check Error:', error);
    });
    break;
  case 'logs':
    monitor.checkDeploymentLogs().then(console.log);
    break;
  default:
    console.log(`
🚀 Render Monitor - Otomatik Hata Çözme Sistemi

Kullanım:
  node render-monitor.js start     - Monitoring başlat
  node render-monitor.js restart  - Service'i yeniden başlat
  node render-monitor.js health   - Service durumunu kontrol et
  node render-monitor.js logs     - Deployment loglarını kontrol et

Environment Variables:
  RENDER_API_KEY      - Render API anahtarı (gerekli)
  RENDER_SERVICE_ID   - Service ID (gerekli)
  DISCORD_WEBHOOK_URL - Discord webhook URL (opsiyonel)
    `);
    break;
}

export default RenderMonitor;