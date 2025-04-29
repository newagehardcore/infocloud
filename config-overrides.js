const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add fallbacks for node core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "fs": false,
    "path": require.resolve("path-browserify"),
    "util": require.resolve("util/"),
    "os": require.resolve("os-browserify/browser"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "crypto": require.resolve("crypto-browserify"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "assert": require.resolve("assert/"),
    "url": require.resolve("url/"),
    "zlib": require.resolve("browserify-zlib"),
    "querystring": require.resolve("querystring-es3"),
    "process": require.resolve("process/browser"),
    "timers": false,
    // Add fallbacks for network modules causing errors
    "net": false,
    "tls": false,
    "dns": false
  };

  // Add buffer and process polyfills
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ];

  // Handle ESM modules
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false
    }
  });

  return config;
}; 