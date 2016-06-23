var Position = require("Position.js");
var Direction = require("Direction.js");
var OldPosition = require("OldPosition.js");
var MovementComponent = require("MovementComponent.js");

var MovementSystem = function(game) {
	this.game = game;
	var em = game.em;
	this.mask = em.getMask([Position, OldPosition, Direction, MovementComponent]);
};

MovementSystem.prototype.update = function(dt, time) {
	var em = this.game.em;
	for (var entity = 0, length = em.count; entity < length; ++entity) {
		if (em.matches(entity, this.mask)) {
			var position = em.getComponent(entity, Position);
			var oldpos = em.getComponent(entity, OldPosition);
			var direction = em.getComponent(entity, Direction);
			var movement = em.getComponent(entity, MovementComponent);

			var still = position.x === oldpos.x && position.y === oldpos.y;
			if (!still) {
				movement.timer += dt;
				if (movement.timer >= movement.delay) {
					oldpos.x = position.x;
					oldpos.y = position.y;
				} else {
					continue;
				}
			}
			movement.timer = Math.max(0, movement.timer - movement.delay);
			var newDirection = movement.getController().getTarget(this.game, dt, position, entity);
			position.x += Direction.getDeltaX(newDirection);
			position.y += Direction.getDeltaY(newDirection);
		}
	}
};

module.exports = MovementSystem;