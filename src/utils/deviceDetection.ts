// Cihaz tipini tespit eden utility fonksiyonları

export type DeviceType = 'TV' | 'MOBILE' | 'TABLET' | 'DESKTOP';

export interface DeviceInfo {
  type: DeviceType;
  isTV: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

/**
 * Cihaz tipini tespit eder
 */
export const detectDeviceType = (): DeviceType => {
  const userAgent = navigator.userAgent;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // Google TV / Android TV tespiti
  const isAndroidTV = userAgent.includes('Android TV') || 
                     userAgent.includes('GoogleTV') ||
                     userAgent.includes('AFTMM') || // Amazon Fire TV
                     userAgent.includes('AFTKA') || // Amazon Fire TV Stick
                     userAgent.includes('AFTJMST12'); // Amazon Fire TV Stick 4K
  
  // TV ekran boyutu kontrolü (1920x1080 ve üzeri)
  const isTVSize = screenWidth >= 1920 && screenHeight >= 1080;
  
  // Mobil cihaz tespiti
  const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isMobileSize = screenWidth <= 768;
  
  // Tablet tespiti
  const isTabletSize = screenWidth > 768 && screenWidth <= 1024;
  
  // Desktop tespiti
  const isDesktopSize = screenWidth > 1024;
  
  // TV öncelikli kontrol
  if (isAndroidTV || (isTVSize && !isMobileDevice)) {
    return 'TV';
  }
  
  // Mobil kontrol
  if (isMobileDevice || isMobileSize) {
    return 'MOBILE';
  }
  
  // Tablet kontrol
  if (isTabletSize) {
    return 'TABLET';
  }
  
  // Desktop kontrol
  if (isDesktopSize) {
    return 'DESKTOP';
  }
  
  // Varsayılan olarak desktop
  return 'DESKTOP';
};

/**
 * Detaylı cihaz bilgilerini döndürür
 */
export const getDeviceInfo = (): DeviceInfo => {
  const type = detectDeviceType();
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const userAgent = navigator.userAgent;
  
  return {
    type,
    isTV: type === 'TV',
    isMobile: type === 'MOBILE',
    isTablet: type === 'TABLET',
    isDesktop: type === 'DESKTOP',
    screenWidth,
    screenHeight,
    userAgent
  };
};

/**
 * Cihaz tipine göre en uygun view'ı döndürür
 */
export const getOptimalView = (deviceType: DeviceType): string => {
  switch (deviceType) {
    case 'TV':
      return 'tv'; // TVHost ekranı
    case 'MOBILE':
    case 'TABLET':
    case 'DESKTOP':
      return 'host'; // QuizHost (sunucu) ekranı
    default:
      return 'home'; // Ana menü
  }
};

/**
 * Cihaz tipine göre player view'ına erişim izni verir mi?
 */
export const canAccessPlayerView = (deviceType: DeviceType): boolean => {
  // Sadece mobil, tablet ve desktop'tan player view'ına erişilebilir
  return ['MOBILE', 'TABLET', 'DESKTOP'].includes(deviceType);
};

/**
 * Cihaz tipine göre TVHost'a erişim izni verir mi?
 */
export const canAccessTVHost = (deviceType: DeviceType): boolean => {
  // Sadece TV'den TVHost'a erişilebilir
  return deviceType === 'TV';
};
