const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  plugins: [
    new CleanWebpackPlugin(),
        ],
  output: {
    filename: 'index.js',
    path: path.resolve('.','dev')
},
mode: 'production',
optimization: {
   usedExports: true
}
};