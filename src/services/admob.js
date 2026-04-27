import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentDebugGeography,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const SAMPLE_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';
const DEFAULT_BANNER_HEIGHT = 56;

let initialized = false;
let initPromise = null;
let bannerVisible = false;
let privacyOptionsRequired = false;
let listenersBound = false;

function setAdInset(height = 0) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--ad-banner-height', `${Math.max(0, height)}px`);
  document.body.classList.toggle('has-native-ad', height > 0);
}

function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return;

  AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    setAdInset(size?.height || DEFAULT_BANNER_HEIGHT);
  });

  AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    setAdInset(DEFAULT_BANNER_HEIGHT);
  });

  AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
    bannerVisible = false;
    setAdInset(0);
  });

  listenersBound = true;
}

function getConfig() {
  const testMode = `${import.meta.env.VITE_ADMOB_ANDROID_TEST_MODE ?? 'true'}`.toLowerCase() !== 'false';
  const debugGeography = `${import.meta.env.VITE_ADMOB_DEBUG_GEOGRAPHY ?? ''}`.toUpperCase();
  const testDeviceIdentifiers = `${import.meta.env.VITE_ADMOB_TEST_DEVICE_IDS ?? ''}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    appId: (import.meta.env.VITE_ADMOB_ANDROID_APP_ID || SAMPLE_APP_ID).trim(),
    bannerId: (import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID || SAMPLE_BANNER_ID).trim(),
    testMode,
    testDeviceIdentifiers,
    debugGeography: AdmobConsentDebugGeography[debugGeography] ?? AdmobConsentDebugGeography.DISABLED,
  };
}

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function initializeAdMob() {
  if (!isNativeAndroid()) return false;
  if (initialized) return true;
  if (initPromise) return initPromise;

  const config = getConfig();

  initPromise = (async () => {
    bindListeners();

    await AdMob.initialize({
      initializeForTesting: config.testMode,
      testingDevices: config.testDeviceIdentifiers,
    });

    let consentInfo = await AdMob.requestConsentInfo({
      debugGeography: config.testMode ? config.debugGeography : AdmobConsentDebugGeography.DISABLED,
      testDeviceIdentifiers: config.testMode ? config.testDeviceIdentifiers : [],
      tagForUnderAgeOfConsent: false,
    });

    if (!consentInfo.canRequestAds && consentInfo.isConsentFormAvailable) {
      consentInfo = await AdMob.showConsentForm();
    }

    privacyOptionsRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';
    initialized = consentInfo.canRequestAds || !consentInfo.isConsentFormAvailable;
    return true;
  })().catch((error) => {
    initPromise = null;
    initialized = false;
    setAdInset(0);
    throw error;
  });

  return initPromise;
}

export async function showBottomBanner() {
  if (!isNativeAndroid()) return false;
  await initializeAdMob();
  if (bannerVisible) return true;

  const config = getConfig();

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
}

export async function hideBottomBanner() {
  if (!isNativeAndroid()) return;

  try {
    await AdMob.removeBanner();
  } catch {
    // ignore remove failures
  } finally {
    bannerVisible = false;
    setAdInset(0);
  }
}

export async function openAdPrivacyOptions() {
  if (!isNativeAndroid()) return false;
  await initializeAdMob();

  if (!privacyOptionsRequired) return false;

  await AdMob.showPrivacyOptionsForm();
  return true;
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
