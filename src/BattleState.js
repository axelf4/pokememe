import State from "State";
var Panel = require("Panel.js");
var Container = require("Container.js");
var Dialog = require("Dialog.js");
var align = require("align.js");
var texture = require("texture.js");
var Image = require("Image.js");
import Select from "Select";
import NinePatch from "NinePatch";
import thread from "thread";
import * as stateManager from "stateManager";
var pokemon = require("pokemon.js");
var Label = require("Label.js");
var Widget = require("Widget");
var measureSpec = require("measureSpec");
const Healthbar = require("Healthbar.js");
var resources = require("resources.js");
import { Color } from "SpriteBatch";
import battle, { battleEventText, battleEventQueryAction,
	battleEventSendOut, battleEventUseMove,
	battleEventSetHealth, battleEventFaint,
	actionAttack, actionSwitchPokemon, actionRun } from "battle";
const glMatrix = require("gl-matrix");
const renderer = require("renderer");
const TWEEN = require("@tweenjs/tween.js");
import TransitionState, {fade} from "TransitionState";
import { switchPokemon as getPokemonToSwitchTo } from "ListPokemonState";

const { mat4, vec3, quat } = glMatrix;

export default class BattleState extends State {
	constructor(loader, nextState, player, enemy) {
		super();
		this.nextState = nextState;
		const self = this;

		thread(function*() {
			loader.loadTexture("textures/battleinfo.9.png").then(texRegion => {
				self.battleInfoTex = NinePatch.fromTextureRegion(texRegion);
			});
			loader.loadTexture("assets/battleground.png").then(texRegion => {
				self.groundTex = texRegion;
			});
			self.characterTex0 = loader.loadTexturePlaceholder("assets/pokemon/Slowpoke.png");
			self.characterTex1 = loader.loadTexturePlaceholder("assets/pokemon/Slowpoke.png");

			const widget = self.widget = new Panel();
			widget.direction = Panel.DIRECTION_COLUMN;

			const viewContainer = new Container();
			viewContainer.style.align = align.STRETCH;
			viewContainer.flex = 1;
			viewContainer.background = loader.loadTexturePlaceholder("assets/battlebg.png");
			widget.addWidget(viewContainer);

			const view = new Panel();
			view.direction = Panel.DIRECTION_ROW;
			view.justify = align.SPACE_AROUND;
			viewContainer.addWidget(view);

			yield loader.all(); // Wait for resources to load

			const createInfoBox = (isPlayer) => {
				const container = new Container();
				container.background = self.battleInfoTex;
				container.marginTop = 20;
				view.addWidget(container);
				container.setVisible(false);

				const vPanel = new Panel();
				vPanel.direction = Panel.DIRECTION_COLUMN;
				vPanel.marginTop = 4;
				vPanel.marginRight = 12;
				vPanel.marginBottom = 7;
				vPanel.marginLeft = 4;
				container.addWidget(vPanel);

				const label = new Label(resources.font);
				label.style.align = align.STRETCH;
				vPanel.addWidget(label);

				const hpBar = new Healthbar(loader);
				hpBar.style.align = align.STRETCH;
				vPanel.addWidget(hpBar);

				const setup = pokemon => {
					container.setVisible(true);
					label.setText(`${pokemon.name}  Lv.${pokemon.level}`);
					hpBar.setPercentage(pokemon.getHpPercentage(), false)
				};
				return { hpBar, setup };
			};
			const playerInfoBox = createInfoBox(true), enemyInfoBox = createInfoBox(false);

			var info = new Panel();
			info.direction = Panel.DIRECTION_ROW;
			info.style.height = 100;
			widget.addWidget(info);

			const showDialog = function(text) {
				return new Promise(function(resolve, reject) {
					var dialog = new Dialog(text, resolve);
					dialog.style.align = align.STRETCH;
					dialog.flex = 1;
					info.addWidget(dialog);
					dialog.requestFocus();
				});
			};

			self.playerOffset = { x: 1, y: 0, a: 1 };
			self.enemyOffset = { x: 1, y: 0, a: 1 };

			const battleGen = battle(player, enemy);

			let nextArg;
			for (;;) {
				let battleEvent = battleGen.next(nextArg);
				console.log("Battle event:", battleEvent);
				if (battleEvent.done) break;

				let eventVal = battleEvent.value;
				const object0 = eventVal.isPlayer ? self.playerOffset : self.enemyOffset;
				const object1 = eventVal.isPlayer ? self.enemyOffset : self.playerOffset;
				switch (eventVal.type) {
					case battleEventText:
						yield showDialog(eventVal.text);
						break;
					case battleEventQueryAction:
						let pokemon = eventVal.pokemon;
						let playerAction = null;
						while (!playerAction) {
							var selected = yield new Promise(function(resolve, reject) {
								var dialog = new Dialog(`What will ${pokemon.name} do?`);
								dialog.style.align = align.STRETCH;
								dialog.flex = 1;
								info.addWidget(dialog);
								var select = new Select(["FIGTH", "BAG", "POKEMON", "RUN"], 2, resolve);
								select.style.align = align.STRETCH;
								info.addWidget(select);
								select.requestFocus();
							});
							info.removeAllWidgets();
							switch (selected) {
								case -1:
									break; // Shift was pressed
								case 0: // Fight
									const moveId = yield new Promise(function(resolve, reject) {
										const moveNames = pokemon.moves.map(move => move.name);
										const select = new Select(moveNames, 2, resolve);
										select.style.align = align.STRETCH;
										select.flex = 1;
										info.addWidget(select);
										select.requestFocus();
									});
									info.removeAllWidgets();
									if (moveId !== -1) {
										const move = pokemon.moves[moveId];
										playerAction = { type: actionAttack, isPlayer: true, move };
									}
									break;
								case 1: // Bag
									yield showDialog("There's a time and place for everything, but not now...");
									break;
								case 2: // Pokemon
									let pokemonIndex = yield getPokemonToSwitchTo(loader, player);
									if (pokemonIndex != -1)
										playerAction = { type: actionSwitchPokemon, isPlayer: true, pokemonIndex };
									break;
								case 3: // Run
									if (enemy.canEscapeFrom())
										playerAction = { type: actionRun, isPlayer: true };
									else
										yield showDialog("No! There's no running from a Trainer battle!");
									break;
								default:
									throw new Error("Invalid selected value.");
							}
						}
						nextArg = playerAction;
						break;

					case battleEventSendOut:
						if (eventVal.switching) {
							yield showDialog(`Thats enough ${eventVal.oldPokemon.name}! Get the fuck back here.`);
							yield new Promise((resolve, reject) => {
								new TWEEN.Tween(object0).to({ x: [0, 1] }, 1500)
									.easing(TWEEN.Easing.Linear.None)
									.onComplete(resolve).start();
							});
						}

						yield showDialog(`${eventVal.isPlayer ? "Go" : `${enemy.getName()} sent out`} ${eventVal.pokemon.name}!`);
						yield new Promise((resolve, reject) => {
							new TWEEN.Tween(object0).to({
								x: [1, 0.25, 0],
								y: [0, -0.15, 0],
								a: [0, 1, 1],
							}, 1500)
								.interpolation(TWEEN.Interpolation.Bezier)
								.easing(TWEEN.Easing.Bounce.Out)
								.onComplete(resolve).start();
						});
						(eventVal.isPlayer ? playerInfoBox : enemyInfoBox).setup(eventVal.pokemon);
						break;
					case battleEventUseMove:
						yield new Promise((resolve, reject) => {
							new TWEEN.Tween(object0)
								.to({
									x: [ 0.05, 0.08, 0.10, -0.2, object0.x ],
									y: [ 0.05, 0.07, 0.08, 0, object0.y ],
								}, 1000)
								.interpolation(TWEEN.Interpolation.CatmullRom)
								.easing(TWEEN.Easing.Linear.None)
								.chain(new TWEEN.Tween(object1)
									.to({
										x: [ 0.1, 0.11, object1.x ],
										y: [ -0.03, -0.01, object1.y ],
									}, 1000)
									.interpolation(TWEEN.Interpolation.CatmullRom)
									.easing(TWEEN.Easing.Linear.None)
									.delay(100)
									.onComplete(resolve)).start();
						});
						break;
					case battleEventFaint:
						yield new Promise((resolve, reject) => {
							new TWEEN.Tween(object0).to({ y: -0.3, a: 0, }, 2000)
								.easing(TWEEN.Easing.Linear.None)
								.onComplete(resolve).start();
						});
						yield showDialog(`${eventVal.isPlayer ? "" : "Foe "}${eventVal.pokemon.name} fainted!`);
						if (eventVal.promptForNext) {
							let pokemonIndex;
							do {
								pokemonIndex = yield getPokemonToSwitchTo(loader, player);
							} while (pokemonIndex === -1);
							nextArg = pokemonIndex;
						}
						break;
					case battleEventSetHealth:
						let hpBar = (eventVal.isPlayer ? playerInfoBox : enemyInfoBox).hpBar;
						yield hpBar.setPercentage(eventVal.percentage);
						break;
				}
			}

			console.log("Switching to next state.");
			const transition = new TransitionState(self, fade);
			stateManager.setState(transition);
			transition.transitionTo(nextState);
		});
	}

	draw(batch, dt, time) {
		const gl = renderer.gl;

		if (this.widget && this.widget.flags & Widget.FLAG_LAYOUT_REQUIRED) {
			var widthMeasureSpec = measureSpec.make(this.width, measureSpec.EXACTLY);
			var heightMeasureSpec = measureSpec.make(this.height, measureSpec.EXACTLY);

			this.widget.layout(widthMeasureSpec, heightMeasureSpec);
		}

		gl.disable(gl.CULL_FACE);
		batch.begin();
		this.widget.draw(batch, dt, time);
		const oldMatrix = batch.getTransformMatrix();

		const bottomCenter = (width, height) => [-width / 2, -height],
			almostBottomCenter = (width, height) => [-width / 2, -0.9 * height],
			middleCenter = (width, height) => [-width / 2, -height / 2];

		const drawPokemon = (flipped, offset, texture) => {
			const transform = mat4.fromRotationTranslationScale(mat4.create(), quat.create(),
				vec3.fromValues(this.width / 2, this.height / 2, 0),
				vec3.fromValues(this.width / 2 * (flipped ? -1 : 1), this.width / 2, 0));
			mat4.multiply(transform, oldMatrix, transform);
			batch.setTransformMatrix(transform);

			const draw = (tex, x, y, width, align, color) => {
				const height = width * (tex.y1 - tex.y0) / (tex.x1 - tex.x0);
				const [ox, oy] = align(width, height);
				tex.draw(batch, x + ox, y + oy, width, height, color);
			};
			draw(this.groundTex, 0.5, 0.0, 0.7, middleCenter);
			draw(texture, 0.5 + offset.x, 0.0 + offset.y, 0.4, almostBottomCenter, Color.fromAlpha(offset.a));
		};
		drawPokemon(false, this.enemyOffset, this.characterTex1);
		drawPokemon(true, this.playerOffset, this.characterTex0);

		batch.setTransformMatrix(oldMatrix);
		batch.end();
		// gl.enable(gl.CULL_FACE);
	}
}
