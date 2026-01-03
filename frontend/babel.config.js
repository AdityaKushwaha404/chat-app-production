module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // MUST be last plugin
      'react-native-reanimated/plugin',
    ],
  };
};
