const {
  APP_VARIANT,
  EXPO_ANIMA_BRAND,
  selectedVariant,
} = require("./src/brand/anima/config/expo-brand.js");

module.exports = () => {
  const SENTRY_ORG = process.env.SENTRY_ORG ?? "vento-group";
  const SENTRY_PROJECT = process.env.SENTRY_PROJECT ?? "vento-anima-mobile";
  const sentryUploadsEnabled =
    process.env.SENTRY_DISABLE_AUTO_UPLOAD !== "true" &&
    process.env.EXPO_NO_SENTRY !== "true";
  const plugins = [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "ANIMA usa tu ubicacion durante un turno activo para validar asistencia y registrar salida de sede.",
        locationWhenInUsePermission: "ANIMA usa tu ubicacion para validar asistencia en la sede.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true
      }
    ],
  ];

  if (sentryUploadsEnabled) {
    plugins.push([
      "@sentry/react-native/expo",
      {
        organization: SENTRY_ORG,
        project: SENTRY_PROJECT,
      },
    ]);
  }

  return {
    expo: {
      name: selectedVariant.appName,
      slug: EXPO_ANIMA_BRAND.slug,
      platforms: ["ios", "android"],
      scheme: selectedVariant.scheme,
      version: "1.3.3",
      jsEngine: "hermes",
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
        buildNumber: "14",
        infoPlist: {
          NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicacion para validar el check-in.",
          NSLocationAlwaysAndWhenInUseUsageDescription: "Necesitamos validar tu ubicacion durante un turno activo, incluso si la aplicacion esta en segundo plano.",
          UIBackgroundModes: ["location"],
          ITSAppUsesNonExemptEncryption: false
        }
      },
      android: {
        package: selectedVariant.androidPackage,
        versionCode: 18,
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon-padded.png",
          backgroundColor: "#F7F5F8"
        },
        permissions: [
          "ACCESS_FINE_LOCATION",
          "ACCESS_COARSE_LOCATION",
          "ACCESS_BACKGROUND_LOCATION",
          "FOREGROUND_SERVICE",
          "FOREGROUND_SERVICE_LOCATION",
          "POST_NOTIFICATIONS"
        ]
      },
      plugins,
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
