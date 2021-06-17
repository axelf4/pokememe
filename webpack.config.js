const path = require('path'),
	  webpack = require('webpack'),
	  HtmlWebpackPlugin = require('html-webpack-plugin'),
	  CopyPlugin = require('copy-webpack-plugin'),
	  ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin'),
	  WebpackFreeTexPacker = require("webpack-free-tex-packer");

const packOptions = {
	textureName: "atlas",
	width: 1024, height: 1024,
	fixedSize: false, powerOfTwo: true,
	extrude: 1,
	allowRotation: false, allowTrim: false,
	detectIdentical: true,
	exporter: "Pixi",
	removeFileExtension: false, prependFolderName: true,
};

module.exports = {
	resolve: {
		modules: [
			path.join(__dirname, "src"),
			"node_modules",
		],
		extensions: ['.js', '.ts'],
		fallback: {
			"path": require.resolve("path-browserify"),
			"util": require.resolve("util/"),
		},
	},
	mode: 'development',
	devtool: "source-map",
	devServer: {
		hot: true,
	},
	plugins: [
		new webpack.HotModuleReplacementPlugin(),
		new webpack.ProvidePlugin({
			process: 'process/browser',
		}),
		new HtmlWebpackPlugin({
			title: 'Game',
			meta: {viewport: 'width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0'},
		}),
		new CopyPlugin({
			patterns: [ { from: 'assets', to: 'assets' }, ],
		}),
		new ForkTsCheckerWebpackPlugin(),
		new WebpackFreeTexPacker(path.resolve(__dirname, 'assets/sprites'), 'atlases', packOptions),
	],
	module: {
		rules: [
			{
				test: /\.(js|ts)$/,
				include: path.resolve(__dirname, 'src'),
				exclude: /(node_modules|bower_components)/,
				loader: "babel-loader",
			},
			{
				test: /\.vgm/,
				type: 'asset',
			},
		]
	}
};
