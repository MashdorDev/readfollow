const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

module.exports = (env, argv) => ({
  entry: {
    main: {
      import: './src/index.tsx',
      filename: 'bundle.js',
    },
    inferenceWorker: {
      import: './src/inference-worker.ts',
      filename: 'inference-worker.js',
    },
  },
  devtool: argv.mode == 'production' ? undefined : 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    //production builds go straight into the extension package, next to the files tracked there
    //(index.html, the notices, piper_phonemize.*), so the folder isn't cleaned
    path: argv.mode == 'production' ? path.resolve(__dirname, '..', 'vendor', 'piper') : path.resolve(__dirname, 'build', 'debug'),
    clean: argv.mode != 'production',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm', to: 'ort/'},
      ]
    }),
    ...(env.analyze ? [new BundleAnalyzerPlugin()] : [])
  ],
})
