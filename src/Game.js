var fowl = require("fowl");
var lerp = require("lerp");
var loader = require("loader.js");
var texture = require("texture.js");
var NinePatch = require("NinePatch.js");
var audio = require("Audio.js");
var Map = require("map.js");
var Widget = require("Widget.js");
var playerFactory = require("playerFactory.js");
var StillMovementController = require("StillMovementController.js");
var resources = require("resources.js");
var Stack = require("Stack.js");
var Panel = require("Panel.js");
var Dialog = require("Dialog.js");
var align = require("align.js");

var Position = require("Position.js");
var Direction = require("Direction.js");
var SpriteComponent = require("SpriteComponent.js");
var PlayerComponent = require("PlayerComponent.js");
var InteractionComponent = require("InteractionComponent.js");
var OldPosition = require("OldPosition.js");
var MovementComponent = require("MovementComponent.js");

var font = resources.font;
fowl.registerComponents(
		Position,
		Direction,
		SpriteComponent,
		PlayerComponent,
		InteractionComponent,
		OldPosition,
		MovementComponent);

var Game = function() {
	Stack.call(this);

	var map, mapRenderer;
	this.mapRenderer = null;
	var foregroundRenderList, backgroundRenderList;
	this.spriteSystemMask = fowl.getMask([Position, OldPosition, SpriteComponent, MovementComponent]);

	this.updateHooks = [];

	this.em = new fowl.EntityManager();

	this.player = playerFactory.createPlayer(this.em);

	this.uiLayer = new Panel();
	this.uiLayer.justify = Panel.ALIGN_FLEX_END;
	this.uiLayer.direction = Panel.DIRECTION_COLUMN;
	this.addWidget(this.uiLayer);

	this.loadScript("movement.js");
	this.loadScript("forest.js");
};
Game.prototype = Object.create(Stack.prototype);
Game.prototype.constructor = Game;

Game.prototype.update = function(dt, time) {
	var em = this.em;

	Stack.prototype.update.call(this, dt, time);

	// Call all the registered update hooks
	for (var i = 0, length = this.updateHooks.length; i < length; i++) {
		this.updateHooks[i](this, dt, em);
	}
};

Game.prototype.draw = function(batch, dt, time) {
	var em = this.em;

	this.mapRenderer.draw(this.backgroundRenderList);

	for (var entity = 0, length = em.count; entity < length; entity++) {
		if (em.matches(entity, this.spriteSystemMask)) {
			var position = pos = em.getComponent(entity, Position);
			var oldpos = em.getComponent(entity, OldPosition);
			var spriteComponent = em.getComponent(entity, SpriteComponent);
			var movement = em.getComponent(entity, MovementComponent);

			var texture = spriteComponent.texture;
			var region = spriteComponent.animation.getFrame(time);
			var u1 = (region.x + 0.5) / texture.width;
			var v1 = (region.y + 0.5) / texture.height;
			var u2 = (region.x + region.width - 0.5) / texture.width;
			var v2 = (region.y + region.height - 0.5) / texture.height;
			var x = lerp(oldpos.x, pos.x, movement.timer / movement.delay) * 16 + spriteComponent.offsetX;
			var y = lerp(oldpos.y, pos.y, movement.timer / movement.delay) * 16 + spriteComponent.offsetY;
			var width = region.width * spriteComponent.scale, height = region.height * spriteComponent.scale;
			batch.draw(texture.texture, x, y, x + width, y + height, u1, v1, u2, v2);
		}
	}

	this.mapRenderer.draw(this.foregroundRenderList);

	Stack.prototype.draw.call(this, batch, dt, time);
};

Game.prototype.say = Game.prototype.showDialog = function(text) {
	var self = this;
	return new Promise(function(resolve, reject) {
		var callback = function() { resolve(); };
		dialog = new Dialog(text, callback);
		dialog.style.height = 100;
		dialog.style.align = align.STRETCH;
		self.uiLayer.addWidget(dialog);
	});
};

Game.prototype.getMap = function() { return map; };

Game.prototype.setMap = function(map, backgroundLayers, foregroundLayers) {
	this.map = map;
	this.mapRenderer = new Map.MapRenderer(map);
	var callback = function(item) {
		if (typeof item === "string" || item instanceof String) {
			return Map.getLayerIdByName(map, item);
		}
		throw new Error("Unknown type of layer id");
	};
	backgroundLayers = backgroundLayers.map(callback);
	foregroundLayers = foregroundLayers.map(callback);
	this.backgroundRenderList = this.mapRenderer.getRenderList(backgroundLayers);
	this.foregroundRenderList = this.mapRenderer.getRenderList(foregroundLayers);
};

Game.prototype.getEntityAtCell = function(em, x, y) {
	var result = null;
	var mask = fowl.getMask([Position]);
	for (var entity = 0, length = em.count; entity < length; entity++) {
		if (em.matches(entity, mask)) {
			var position = em.getComponent(entity, Position);
			if (position.x === x && position.y === y) {
				result = entity;
			}
		}
	}
	return result;
};

Game.prototype.loadScript = function(name) {
	var self = this;
	require(["./scripts/" + name], function(script) {
		script(self);
	});
};

Game.prototype.addUpdateHook = function(hook) {
	this.updateHooks.push(hook);
};

Game.prototype.removeUpdateHook = function(hook) {
	var idx = updateHooks.indexOf(hook);
	this.updateHooks.splice(idx, 1);
};

Game.prototype.getPlayer = function() {
	return this.player;
}

Game.prototype.lock = function() {
	var playerMovement = this.em.getComponent(this.player, MovementComponent);
	playerMovement.pushController(new StillMovementController());
};

Game.prototype.release = function() {
	var playerMovement = this.em.getComponent(this.player, MovementComponent);
	playerMovement.popController();
};

Game.prototype.isSolid = function(x, y) {
	// Check for entity at cell
	var mask = fowl.getMask([Position]);
	var em = this.em;
	for (var entity = 0, length = this.em.count; entity < length; entity++) {
		if (em.matches(entity, mask)) {
			var position = em.getComponent(entity, Position);
			if (position.x === x && position.y === y) return true;
		}
	}
	// Check for collidable tile at cell
	var layer;
	var map = this.map;
	for (var i = 0, length = map.layers.length; i < length; i++) {
		if (map.layers[i].name === "meta") {
			return map.layers[i].data[x + map.width * y];
		}
	}
	throw new Error("Current map has no meta layer.");
};

Game.prototype.pushTriggers = [];

Game.prototype.clearLevel = function() {
	this.pushTriggers = [];
};

Game.prototype.save = JSON.parse(window.localStorage.getItem("gameSave"));

Game.prototype.saveTheGame = function() {
	window.localStorage.setItem("gameSave", JSON.stringify(save));
};

Game.prototype.wait = function(ms) {
	return new Promise(function(resolve, reject) {
		window.setTimeout(function() {
			resolve();
		}, ms);
	});
};

audio.loadAudio("assets/masara-town.mp3", function(buffer) {
	var source = audio.playAudio(buffer);
	source.loop = true;
});

module.exports = Game;
