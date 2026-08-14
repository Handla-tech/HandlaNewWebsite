module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo handles expo-router transforms in SDK 50+.
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 moved its Babel plugin into react-native-worklets.
      // This plugin must be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
