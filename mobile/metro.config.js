const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Sentry's wrapper stamps each bundle with a debug ID, so crash reports from
 * a release build can be matched with its source maps (see the Android
 * workflow). It sends nothing by itself.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = withSentryConfig(
  mergeConfig(getDefaultConfig(__dirname), config),
);
