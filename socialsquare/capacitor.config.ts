import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.socialsquare.app',
  appName: 'SocialSquare',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "438982943802-70qgbbglo3ei6ufhubp5hp1asiuv0oov.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
