const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro often resolves `firebase/auth` → `@firebase/auth` to the browser ESM build.
// That build omits React Native persistence; auth falls back to memory and users must
// sign in on every cold start. Force the RN entry for native bundles only.
const firebaseAuthRnPath = path.resolve(
  __dirname,
  'node_modules/@firebase/auth/dist/rn/index.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@firebase/auth' &&
    platform &&
    platform !== 'web'
  ) {
    return { type: 'sourceFile', filePath: firebaseAuthRnPath };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
