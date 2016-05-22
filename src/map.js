var texture = require("texture.js");
var loader = require("loader.js");
var renderer = require("renderer.js");
var glMatrix = require("gl-matrix");
var path = require("path");
var base64 = require("base64-js");

var gl = renderer.gl;
var vec2 = glMatrix.vec2;

// TODO make maps the JSON format and the maprenderer load the images
exports.loadMapFromJSON = function(data) {
	return data;
};

var TileSet = function() {
};
TileSet.prototype.getTileX = function(id) {
	return id % this.tilesAcross;
};
TileSet.prototype.getTileY = function(id) {
	return Math.floor(id / this.tilesAcross);
};

var Map = function() {};

var loadMap = function(url) {
	return new Promise(function(resolve, reject) {
		loader.loadXMLHttpRequest(url, "document", function() {
			var dirname = path.dirname(url); // url.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '') + '/';
			var root = this.responseXML.documentElement;
			var map = new Map();
			if (root.getAttribute("version") !== "1.0") throw new Error("invalid map format");
			map.width = parseInt(root.getAttribute("width"));
			map.height = parseInt(root.getAttribute("height"));
			map.tilewidth = parseInt(root.getAttribute("tilewidth"));
			map.tileheight = parseInt(root.getAttribute("tileheight"));

			var tilesets = map.tilesets = [];
			var tilesetNodes = root.getElementsByTagName("tileset");
			var tilesetPromises = [];
			for (var i = 0, length = tilesetNodes.length; i < length; i++) {
				tilesetPromises.push(new Promise(function(resolve, reject) {
					var tilesetNode = tilesetNodes[i];
					var tileset = tilesets[i] = new TileSet();
					tileset.firstgid = tilesetNode.getAttribute("firstgid");
					var source = tilesetNode.getAttribute("source");
					if (source) {
						loader.load(path.join(dirname, source), function() {
							var parser = new DOMParser();
							var xmlDoc = parser.parseFromString(this.responseText, "application/xml");
							var tilesetRoot = xmlDoc.documentElement;
							tileset.name = tilesetRoot.getAttribute("name");
							tileset.tilewidth = parseInt(tilesetRoot.getAttribute("tilewidth"));
							tileset.tileheight = parseInt(tilesetRoot.getAttribute("tileheight"));
							var image = tilesetRoot.getElementsByTagName("image")[0];
							tileset.imagePath = path.join(dirname, image.getAttribute("source"));
							tileset.imageWidth = parseInt(image.getAttribute("width"));
							tileset.imageHeight = parseInt(image.getAttribute("height"));
							resolve();
						});
					} else {
						tileset.name = tilesetNode.getAttribute("name");
						tileset.tilewidth = parseInt(tilesetNode.getAttribute("tilewidth"));
						tileset.tileheight = parseInt(tilesetNode.getAttribute("tileheight"));
						var image = tilesetNode.getElementsByTagName("image")[0];
						tileset.imagePath = path.join(dirname, image.getAttribute("source"));
						// TODO get the dimensions from the actual image
						tileset.imageWidth = parseInt(image.getAttribute("width"));
						tileset.imageHeight = parseInt(image.getAttribute("height"));
						resolve();
					}
				}));
			}
			Promise.all(tilesetPromises).then(function() {
				for (var i = 0; i < tilesets.length; i++) {
					tileset = tilesets[i];
					tileset.tilesAcross = tileset.imageWidth / tileset.tilewidth;
					tileset.texture = new texture.Region();
					tileset.texture.loadFromFile(tileset.imagePath);
				}
			}).then(function() {
				map.layers = Array.prototype.map.call(root.getElementsByTagName("layer"), function(layerNode) {
					var layer = {};
					layer.name = layerNode.getAttribute("name");
					layer.data = [];
					var data = layerNode.getElementsByTagName("data")[0];
					var encoding = data.getAttribute("encoding");
					if (encoding === "csv") {
						var array = data.textContent.split(",");
						for (var i = 0; i < array.length; i++) {
							layer.data[i] = parseInt(array[i]);
						}
					} else if (encoding === "base64") {

					} else throw new Error("Unsupported encoding for TML layer data.");
					/*
					if (data.getAttribute("encoding") !== "base64" || !!data.getAttribute("compression")) throw new Error("Bad encoding or compression.");
					var buffer = new Buffer(text, 'base64');
					for (var i = 0, length = map.width * map.height; i < length; i++) {
						// TODO account for flips
						layer.data[i] = buffer.readUInt32LE(i);
					}
					*/
					return layer;
				});
				resolve(map);
			});
		});
	});
};
exports.loadMap = loadMap;

Map.prototype.getTilesetByGID = function(gid) {
	for (var i = tilesets.length; i >= 0; --i) {
		var tileset = tilesets[i];
		if (tileset.firstGid <= gid) return tileset;
	}
	return null;
};

Map.prototype.draw = function(spriteBatch) {
	for (var i = this.tilesets.length; i--;) {
		var tileset = this.tilesets[i];
		for (var j = 0; j < this.layers.length; j++) {
			var layer = this.layers[j];
			if (!layer.visible) continue;
			for (var row = layer.x, length = layer.x + layer.width; row < length; row++) {
				for (var col = layer.y, length = layer.y + layer.height; col < length; col++) {
					var gid = layer.data[row + col * layer.width];
					if (gid >= tileset.firstGid) {
						var x1 = row * this.tileWidth;
						var y1 = col * this.tileHeight;
						var x2 = x1 + tileset.tileWidth;
						var y2 = y1 + tileset.tileHeight;
						var sx = (tileset.getTileX(gid) - 1) * tileset.tileWidth;
						var sy = tileset.getTileY(gid) * tileset.tileHeight;
						tileset.imageWidth = 4096;
						tileset.imageHeight = 4096;
						var u1 = sx / tileset.imageWidth, v1 = sy / tileset.imageHeight, u2 = (sx + tileset.tileWidth) / tileset.imageWidth, v2 = (sy + tileset.tileHeight) / tileset.imageHeight;

						spriteBatch.draw(tileset.texture.texture, x1, y1, x2, y2, u1, v1, u2, v2);
					}
				}
			}
		}
	}
};

Map.prototype.drawLayer = function(spriteBatch, layer) {
	var data = layer.data;
	for (var row = layer.x, length = layer.x + layer.width; row < length; row++) {
		for (var col = layer.y, length = layer.y + layer.height; col < length; col++) {
			var gid = data[row + col * layer.width];
			if (!gid) continue;
			var tileset = layer.tilesetForGid[gid];
			var x1 = row * this.tileWidth;
			var y1 = col * this.tileHeight;
			var x2 = x1 + tileset.tileWidth;
			var y2 = y1 + tileset.tileHeight;
			var sx = (tileset.getTileX(gid) - 1) * tileset.tileWidth;
			var sy = tileset.getTileY(gid) * tileset.tileHeight;
			tileset.imageWidth = 4096;
			tileset.imageHeight = 4096;
			var u1 = sx / tileset.imageWidth, v1 = sy / tileset.imageHeight, u2 = (sx + tileset.tileWidth) / tileset.imageWidth, v2 = (sy + tileset.tileHeight) / tileset.imageHeight;

			spriteBatch.draw(tileset.texture.texture, x1, y1, x2, y2, u1, v1, u2, v2);
		}
	}
};

exports.getLayerIdByName = function(map, name) {
	for (var i = 0, length = map.layers.length; i < length; i++) {
		if (map.layers[i].name === name) return i;
	}
	throw new Error("Map has no layer called " + name + ".");
};

var MapRenderer = exports.MapRenderer = function(map) {
	this.map = map;
	if (map.tilewidth !== map.tileheight) throw new Error("Tile dimensions do not match.");
	this.tileSize = map.tilewidth;

	// Upload the layers
	var components = 3;
	var layers = this.layers = new Array();
	for (var i = 0; i < map.layers.length; i++) {
		var layer = map.layers[i];
		// if (!layer.visible) continue; // Commented because visible should only affect the Tiled editor
		var width = map.width;
		var height = map.height;

		for (var tsId = map.tilesets.length; tsId--;) {
			var tileset = map.tilesets[tsId];
			var tilesetUsed = false, otherTilesetsUsed = false;
			var data = new Uint8Array(width * height * components), idx = 0;
			for (var col = 0, length = height; col < length; col++) {
				for (var row = 0, length = width; row < length; row++) {
					var gid = layer.data[row + col * width];
					if (gid >= tileset.firstgid) {
						tilesetUsed = true;
						data[idx++] = tileset.getTileX(gid) - 1;
						data[idx++] = tileset.getTileY(gid);
						data[idx++] = 1;
					} else {
						otherTilesetsUsed = true;
						data[idx++] = 0;
						data[idx++] = 0;
						data[idx++] = 0;
					}
				}
			}
			if (!tilesetUsed) continue;

			var tiles = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tiles);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, data);

			this.layers.push({
				layer: layer,
				layerId: i,
				width: width,
				height: height,
				tileset: tileset,
				sprites: tileset.texture,
				tiles: tiles,
			});

			if (!otherTilesetsUsed) break;
		}
	}

	var vertexShader = [
		"precision mediump float;",

		"attribute vec2 position;",
		"attribute vec2 texture;",

		"varying vec2 pixelCoord;",
		"varying vec2 texCoord;",

		"uniform vec2 viewOffset;",
		"uniform vec2 viewportSize;",
		"uniform vec2 inverseTileTextureSize;",
		"uniform float inverseTileSize;",

		"void main(void) {",
		"	pixelCoord = (texture * viewportSize) + viewOffset;",
		"	texCoord = pixelCoord * inverseTileTextureSize * inverseTileSize;",
		"	gl_Position = vec4(position, 0.0, 1.0);",
		"}"
	].join("\n");

	var fragmentShader = [
		"precision mediump float;",

		"varying vec2 pixelCoord;",
		"varying vec2 texCoord;",

		"uniform sampler2D tiles;",
		"uniform sampler2D sprites;",
		"uniform vec2 inverseSpriteTextureSize;",
		"uniform float tileSize;",

		"void main(void) {",
		"	vec4 tile = texture2D(tiles, texCoord);",
		"	if (texCoord.x < .0 || texCoord.y < .0 || texCoord.x > 1.0 || texCoord.y > 1.0 || tile.z == .0) discard;",
		"	vec2 spriteOffset = floor(tile.xy * 256.0) * tileSize;",
		"	vec2 spriteCoord = mod(pixelCoord, tileSize);",
		"	gl_FragColor = texture2D(sprites, (spriteOffset + spriteCoord) * inverseSpriteTextureSize);",
		"}"
	].join("\n");

	var quadVerts = [
		//x  y  u  v
		1,  1, 1, 0,
		-1,  1, 0, 0,
		1, -1, 1, 1,
		-1, -1, 0, 1,
	];
	this.quadVertBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVerts), gl.STATIC_DRAW);

	var program = this.program = renderer.createProgram({
		vertexShader: vertexShader,
		fragmentShader: fragmentShader
	});
	gl.useProgram(this.program);
	gl.uniform1f(gl.getUniformLocation(this.program, "tileSize"), this.tileSize);
	gl.uniform1f(gl.getUniformLocation(this.program, "inverseTileSize"), 1 / this.tileSize);
	gl.uniform1i(gl.getUniformLocation(this.program, "sprites"), 0);
	gl.uniform1i(gl.getUniformLocation(this.program, "tiles"), 1);

	this.scaledViewportSize = vec2.create();
	vec2.set(this.scaledViewportSize, 640, 480);

	this.viewportSizeLoc = gl.getUniformLocation(this.program, "viewportSize");
	this.viewOffsetLoc = gl.getUniformLocation(this.program, "viewOffset");
	this.inverseTileTextureSizeLoc = gl.getUniformLocation(this.program, "inverseTileTextureSize");
	this.inverseSpriteTextureSizeLoc = gl.getUniformLocation(this.program, "inverseSpriteTextureSize");
};

Map.MapRenderer = MapRenderer;

MapRenderer.prototype.getRenderList = function(layers) {
	var list = [];
	for (var i = 0, length = layers.length; i < length; i++) {
		outer:
		for ( var j = 0; j < this.layers.length; j++) {
			if (this.layers[j].layerId === layers[i]) {
			   	list.push(this.layers[j]);
				break outer;
			}
		}
	}
	return list;
};

MapRenderer.prototype.draw = function(layers) {
	var x = 0, y = 0;
	gl.useProgram(this.program);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertBuffer);

	var positionLocation = 0;
	var textureLocation = 1;
	gl.enableVertexAttribArray(positionLocation);
	gl.enableVertexAttribArray(textureLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
	gl.vertexAttribPointer(textureLocation, 2, gl.FLOAT, false, 16, 8);

	gl.uniform2fv(this.viewportSizeLoc, this.scaledViewportSize);

	var scrollScaleX = 1, scrollScaleY = 1;

	layers = layers || this.layers;

	// Draw each layer of the map
	for (var i = 0, length = layers.length; i < length; i++) {
		var layer = layers[i];

		gl.uniform2f(this.viewOffsetLoc, Math.floor(x * scrollScaleX), Math.floor(y * scrollScaleY));
		gl.uniform2f(this.inverseTileTextureSizeLoc, 1 / this.map.width, 1 / this.map.height);
		gl.uniform2f(this.inverseSpriteTextureSizeLoc, 1 / layer.sprites.width, 1 / layer.sprites.height);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, layer.sprites.texture);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, layer.tiles);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
};