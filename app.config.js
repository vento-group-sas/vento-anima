const {
  APP_VARIANT,
  EXPO_ANIMA_BRAND,
  selectedVariant,
} = require("./src/brand/anima/config/expo-brand.js");

module.exports = () => {
  const SENTRY_ORG = process.env.SENTRY_ORG ?? "vento-group";
  const SENTRY_PROJECT = process.env.SENTRY_PROJECT ?? "vento-anima-mobile";

  return {
    expo: {
      name: selectedVariant.appName,
      slug: EXPO_ANIMA_BRAND.slug,
      platforms: ["ios", "android"],
      scheme: selectedVariant.scheme,
      version: "1.1.9",
      jsEngine: "hermes",
      orientation: "portrait",
      icon: "./assets/icon-padded.png",
      userInterfaceStyle: "light",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#F7F5F8"
      },
      assetBundlePatterns: ["**/*"],
      ios: {
        icon: "./assets/icon-padded.png",
        supportsTablet: false,
        bundleIdentifier: selectedVariant.iosBundleId,
        buildNumber: "11",
        infoPlist: {
          NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicacion para validar el check-in.",
          ITSAppUsesNonExemptEncryption: false
        }
      },
      android: {
        package: selectedVariant.androidPackage,
        versionCode: 15,
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon-padded.png",
          backgroundColor: "#F7F5F8"
        },
        permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]
      },
      plugins: [
        "expo-router",
        "expo-secure-store",
        "expo-notifications",
        [
          "@sentry/react-native/expo",
          {
            organization: SENTRY_ORG,
            project: SENTRY_PROJECT,
          },
        ]
      ],
      updates: {
        url: `https://u.expo.dev/${EXPO_ANIMA_BRAND.expoProjectId}`
      },
      runtimeVersion: {
        policy: "appVersion"
      },
      extra: {
        appVariant: APP_VARIANT,
        appUpdateKey: selectedVariant.appUpdateKey,
        router: {},
        eas: {
          projectId: EXPO_ANIMA_BRAND.expoProjectId
        }
      }
    }
  };
};
