import type { ConfigContext, ExpoConfig } from 'expo/config';

// Google sign-in on iOS needs the reversed client ID as a URL scheme
// (com.googleusercontent.apps.XXXX). It is only known once you create the OAuth client,
// so the plugin is added when the variable is set — see README "Google setup".
const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BudgetTracker',
  slug: 'budgettracker',
  version: '1.0.0',
  scheme: 'budgettracker',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B1220',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.courius.budgettracker',
    // Needed to sign the Lock Screen widget; set to your Apple Team ID.
    appleTeamId: process.env.APPLE_TEAM_ID,
  },
  android: {
    package: 'com.courius.budgettracker',
    adaptiveIcon: {
      backgroundColor: '#0B1220',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    ['expo-router', { root: './src/app' }],
    '@bacons/apple-targets',
    ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, object]] : []),
  ],
  experiments: { typedRoutes: true },
});
