const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  plugins: [
    new CleanWebpackPlugin(),
        ],
  output: {
    filename: 'index.js',
    path: path.resolve('.', 'dist')
},
mode: 'production',
optimization: {
   usedExports: true
}
};