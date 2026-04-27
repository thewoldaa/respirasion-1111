import { Capacitor } from '@capacitor/core';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const SAMPLE_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';
const DEFAULT_BANNER_HEIGHT = 56;

let initialized = false;
let initPromise = null;
let bannerVisible = false;
let privacyOptionsRequired = false;
let listenersBound = false;
let pluginCache = null;

function setAdInset(height = 0) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--ad-banner-height', `${Math.max(0, height)}px`);
  document.body.classList.toggle('has-native-ad', height > 0);
}

function getConfig() {
  const testMode = `${import.meta.env.VITE_ADMOB_ANDROID_TEST_MODE ?? 'true'}`.toLowerCase() !== 'false';

  return {
    appId: (import.meta.env.VITE_ADMOB_ANDROID_APP_ID || SAMPLE_APP_ID).trim(),
    bannerId: (import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID || SAMPLE_BANNER_ID).trim(),
    testMode,
    testDeviceIdentifiers: `${import.meta.env.VITE_ADMOB_TEST_DEVICE_IDS ?? ''}`
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    debugGeographyKey: `${import.meta.env.VITE_ADMOB_DEBUG_GEOGRAPHY ?? ''}`.toUpperCase(),
  };
}

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function getAdMobPlugin() {
  if (!isNativeAndroid()) return null;
  if (pluginCache) return pluginCache;

  const module = await import('@capacitor-community/admob');
  pluginCache = {
    AdMob: module.AdMob,
    AdmobConsentDebugGeography: module.AdmobConsentDebugGeography,
    BannerAdPluginEvents: module.BannerAdPluginEvents,
    BannerAdPosition: module.BannerAdPosition,
    BannerAdSize: module.BannerAdSize,
  };
  return pluginCache;
}

async function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return;

  const plugin = await getAdMobPlugin();
  if (!plugin) return;

  const { AdMob, BannerAdPluginEvents } = plugin;

  await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    setAdInset(size?.height || DEFAULT_BANNER_HEIGHT);
  });

  await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    setAdInset(DEFAULT_BANNER_HEIGHT);
  });

  await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
    bannerVisible = false;
    setAdInset(0);
  });

  listenersBound = true;
}

export async function initializeAdMob() {
  if (!isNativeAndroid()) return false;
  if (initialized) return true;
  if (initPromise) return initPromise;

  const config = getConfig();

  initPromise = (async () => {
    const plugin = await getAdMobPlugin();
    if (!plugin) return false;

    const { AdMob, AdmobConsentDebugGeography } = plugin;
    const debugGeography =
      AdmobConsentDebugGeography[config.debugGeographyKey] ?? AdmobConsentDebugGeography.DISABLED;

    await bindListeners();
    await AdMob.initialize({
      initializeForTesting: config.testMode,
      testingDevices: config.testDeviceIdentifiers,
    });

    let consentInfo = await AdMob.requestConsentInfo({
      debugGeography: config.testMode ? debugGeography : AdmobConsentDebugGeography.DISABLED,
      testDeviceIdentifiers: config.testMode ? config.testDeviceIdentifiers : [],
      tagForUnderAgeOfConsent: false,
    });

    if (!consentInfo.canRequestAds && consentInfo.isConsentFormAvailable) {
      consentInfo = await AdMob.showConsentForm();
    }

    privacyOptionsRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';
    initialized = consentInfo.canRequestAds || !consentInfo.isConsentFormAvailable;
    return true;
  })().catch(() => {
    initPromise = null;
    initialized = false;
    setAdInset(0);
    return false;
  });

  return initPromise;
}

export async function showBottomBanner() {
  if (!isNativeAndroid()) return false;

  const ready = await initializeAdMob();
  if (!ready || bannerVisible) return ready;

  const plugin = await getAdMobPlugin();
  if (!plugin) return false;

  const { AdMob, BannerAdPosition, BannerAdSize } = plugin;
  const config = getConfig();

  try {
    await AdMob.showBanner({
      adId: config.bannerId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: config.testMode,
    });

    bannerVisible = true;
    setAdInset(DEFAULT_BANNER_HEIGHT);
    return true;
  } catch {
    bannerVisible = false;
    setAdInset(0);
    return false;
  }
}

export async function hideBottomBanner() {
  if (!isNativeAndroid()) return;

  try {
    const plugin = await getAdMobPlugin();
    if (plugin) {
      await plugin.AdMob.removeBanner();
    }
  } catch {
    // ignore remove failures
  } finally {
    bannerVisible = false;
    setAdInset(0);
  }
}

export async function openAdPrivacyOptions() {
  if (!isNativeAndroid()) return false;

  const ready = await initializeAdMob();
  if (!ready || !privacyOptionsRequired) return false;

  try {
    const plugin = await getAdMobPlugin();
    if (!plugin) return false;
    await plugin.AdMob.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

export function getAdMobStatus() {
  const config = getConfig();
  return {
    enabled: isNativeAndroid(),
    testMode: config.testMode,
    usingSampleAppId: config.appId === SAMPLE_APP_ID,
    usingSampleBannerId: config.bannerId === SAMPLE_BANNER_ID,
    privacyOptionsRequired,
  };
}
