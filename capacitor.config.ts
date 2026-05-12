import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.camilaai.app',
  appName: 'CamilaAI',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  android: {
    appendUserAgent: 'CamilaAI/1.0',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0d0d1a',
      showSpinner: false,
    },
  },
};

export default config;
