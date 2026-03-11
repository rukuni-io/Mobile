import 'dotenv/config';

export default {
  expo: {
    name: process.env.APP_NAME || 'GroupSave',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    statusBar: {
      barStyle: 'light-content',
      backgroundColor: 'transparent',
      hidden: false,
      translucent: true,
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      appName: process.env.APP_NAME || 'Rukuni',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@rukuni.io',
      apiUrl: process.env.API_ROUTE || 'https://phplaravel-1549794-6263813.cloudwaysapps.com/api',
    },
  },
};
