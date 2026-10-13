const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

const common = (env, argv) => ({
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
    //onnxruntime's build that loads its wasm runtime from ort/ instead of inlining it
    conditionNames: ['onnxruntime-web-use-extern-wasm', '...'],
  },
  output: {
    //production builds go straight into the extension package, next to the files tracked there
    //(index.html, the notices, piper_phonemize.*), so the folder isn't cleaned
    path: argv.mode == 'production' ? path.resolve(__dirname, '..', 'vendor', 'piper') : path.resolve(__dirname, 'build', 'debug'),
  },
})

//Two builds because the inference worker has no document: built for the web, its runtime code reads document.baseURI
module.exports = (env, argv) => [
  {
    ...common(env, argv),
    name: 'main',
    entry: {
      main: {
        import: './src/index.tsx',
        filename: 'bundle.js',
      },
    },
    output: {
      ...common(env, argv).output,
      clean: argv.mode != 'production',
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs', to: 'ort/'},
          {from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm', to: 'ort/'},
        ]
      }),
      ...(env.analyze ? [new BundleAnalyzerPlugin()] : [])
    ],
  },
  {
    ...common(env, argv),
    target: 'webworker',
    entry: {
      inferenceWorker: {
        import: './src/inference-worker.ts',
        filename: 'inference-worker.js',
      },
    },
    //runs after the page build, so the debug build's clean doesn't remove this output
    dependencies: ['main'],
  },
]
