import { SoundName, StateName } from "../enums.js";
import {
	context,
	keys,
	sounds,
	stateMachine,
	timer,
} from "../globals.js";
import { roundedRectangle } from "../../lib/DrawingHelpers.js";
import State from "../../lib/State.js";
import Board from "../objects/Board.js";
import Tile from "../objects/Tile.js";
import { getRandomPositiveInteger } from "../../lib/RandomNumberHelpers.js"

export default class PlayState extends State {
	constructor() {
		super();

		// Position in the grid which we're currently highlighting.
		this.cursor = { boardX: 0, boardY: 0 };

		// Tile we're currently highlighting (preparing to swap).
		this.selectedTile = null;

		this.level = 1;

		this.showHint = false;
		this.tile1 = {x: 0, y: 0};
		this.tile2 = {x: 0, y: 0};

		// Increases as the player makes matches.
		this.score = 0;

		// Score we have to reach to get to the next level.
		this.scoreGoal = 250;

		// How much score will be incremented by per match tile.
		this.baseScore = 5;

		// How much scoreGoal will be scaled by per level.
		this.scoreGoalScale = 1.25;

		/**
		 * The timer will countdown and the player must try and
		 * reach the scoreGoal before time runs out. The timer
		 * is reset when entering a new level.
		 */
		this.maxTimer = 60;
		this.timer = this.maxTimer;
	}

	enter(parameters) {
		this.board = parameters.board;
		this.score = parameters.score;
		this.level = parameters.level;
		this.scene = parameters.scene;
		this.timer = this.maxTimer;
		this.scoreGoal *= Math.floor(this.level * this.scoreGoalScale);

		this.startTimer();
	}

	exit() {
		timer.clear();
		sounds.pause(SoundName.Music3);
	}

	update(dt) {
		this.scene.update(dt);
		this.checkGameOver();
		this.checkVictory();
		this.updateCursor();

		// If we've pressed enter, select or deselect the currently highlighted tile.
		if (keys.Enter) {
			keys.Enter = false;

			this.selectTile();
		}

		timer.update(dt);
	}

	render() {
		this.scene.render();
		this.board.render();

		if (this.selectedTile) {
			this.renderSelectedTile();
		}
		if(this.showHint){
			this.renderHint();
		}

		this.renderCursor();
		this.renderUserInterface();
	}
	renderHint(){
		context.save();
		context.fillStyle = 'rgb(255, 255, 255, 0.5)';
		roundedRectangle(
			context,
			this.hintTile1.x + this.board.x,
			this.hintTile1.y + this.board.y,
			Tile.SIZE,
			Tile.SIZE,
			10,
		);
		roundedRectangle(
			context,
			this.hintTile2.x + this.board.x,
			this.hintTile2.y + this.board.y,
			Tile.SIZE,
			Tile.SIZE,
			10,
			false,

		);
		context.restore();
	}

	updateCursor() {
		let x = this.cursor.boardX;
		let y = this.cursor.boardY;

		if (keys.w) {
			keys.w = false;
			y = Math.max(0, y - 1);
			sounds.play(SoundName.Select);
		}
		else if (keys.s) {
			keys.s = false;
			y = Math.min(Board.SIZE - 1, y + 1);
			sounds.play(SoundName.Select);
		}
		else if (keys.a) {
			keys.a = false;
			x = Math.max(0, x - 1);
			sounds.play(SoundName.Select);
		}
		else if (keys.d) {
			keys.d = false;
			x = Math.min(Board.SIZE - 1, x + 1);
			sounds.play(SoundName.Select);
		}else if(keys.h){
			keys.h = false;
			this.lookForHints();
		}

		
		this.cursor.boardX = x;
		this.cursor.boardY = y;
	}

	async lookForHints(){
		let hintFinished = false;
		let tile1;
		let tile2;
		do{
			const tile1Position = {
				x: getRandomPositiveInteger(1, this.board.height - 2),
				y: getRandomPositiveInteger(1, this.board.width - 2),
			};
			const tile2Position = {
				x: tile1Position.x,
				y: tile1Position.y,
			};

			// Randomly choose the second tile to be up/down/left/right of tile1.
			switch (getRandomPositiveInteger(0, 4)) {
				case 0:
					tile2Position.x++;
					break;
				case 1:
					tile2Position.x--;
					break;
				case 2:
					tile2Position.y++;
					break;
				default:
					tile2Position.y--;
					break;
			}

			tile1 = this.board.tiles[tile1Position.x][tile1Position.y];
			tile2 = this.board.tiles[tile2Position.x][tile2Position.y];

			this.board.swapTiles(tile1, tile2);

			let numMatches = this.board.calculateMatches();

			if(numMatches > 0){
				hintFinished = true;
			}

			this.board.swapTiles(tile2, tile1);
		}while(! hintFinished);

		console.log(tile1);
		console.log(tile2);

		console.log("Swapping");

		let backupTile1 = { x: tile1.boardX, y: tile1.boardY };
		let backupTile2 = { x: tile2.boardX, y: tile2.boardY};

		this.board.swapTilesAsync(tile1, tile2);
		await this.board.swapTilesAsync(tile2, tile1);

		tile1.boardX = backupTile2.x;
		tile1.boardY = backupTile2.y
		tile2.boardX = backupTile1.x;
		tile2.boardY = backupTile1.y

		console.log(tile1);
		console.log(tile2);

		await delay(1000);

		this.board.swapTilesAsync(tile2, tile1);
		await this.board.swapTilesAsync(tile1, tile2);

		console.log("After Wait");

		console.log(tile1);
		console.log(tile2);

		tile1.boardX = backupTile2.x;
		tile1.boardY = backupTile2.y
		tile2.boardX = backupTile1.x;
		tile2.boardY = backupTile1.y
	}
	

	selectTile() {
		const highlightedTile = this.board.tiles[this.cursor.boardY][this.cursor.boardX];

		/**
		 * The `?.` syntax is called "optional chaining" which allows you to check
		 * a property on an object even if that object is `null` at the time.
		 *
		 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
		 */
		const tileDistance = Math.abs(this.selectedTile?.boardX - highlightedTile.boardX) + Math.abs(this.selectedTile?.boardY - highlightedTile.boardY);

		// If nothing is selected, select current tile.
		if (!this.selectedTile) {
			this.selectedTile = highlightedTile;
		}
		// Remove highlight if already selected.
		else if (this.selectedTile === highlightedTile) {
			this.selectedTile = null;
		}
		/**
		 * If the difference between X and Y combined of this selected
		 * tile vs the previous is not equal to 1, also remove highlight.
		 */
		else if (tileDistance > 1) {
			sounds.play(SoundName.Error);
			this.selectedTile = null;
		}
		// Otherwise, do the swap, and check for matches.
		else {
			this.swapTiles(highlightedTile);
		}
	}

	async swapTiles(highlightedTile) {
		await this.board.swapTilesAsync(this.selectedTile, highlightedTile);
		let numMatches = this.board.calculateMatches();
		if(numMatches > 0){
			await this.calculateMatches();
		}else{
			await this.board.swapTilesAsync(highlightedTile, this.selectedTile);
		}

		this.selectedTile = null;
	}

	renderSelectedTile() {
		context.save();
		context.fillStyle = 'rgb(255, 255, 255, 0.5)';
		roundedRectangle(
			context,
			this.selectedTile.x + this.board.x,
			this.selectedTile.y + this.board.y,
			Tile.SIZE,
			Tile.SIZE,
			10,
			true,
			false,
		);
		context.restore();
	}

	renderCursor() {
		context.save();
		context.strokeStyle = 'white';
		context.lineWidth = 4;

		// Use board position * Tile.SIZE so that the cursor doesn't get tweened during a swap.
		roundedRectangle(
			context,
			this.cursor.boardX * Tile.SIZE + this.board.x,
			this.cursor.boardY * Tile.SIZE + this.board.y,
			Tile.SIZE,
			Tile.SIZE,
		);
		context.restore();
	}

	renderUserInterface() {
		context.fillStyle = 'rgb(56, 56, 56, 0.9)';
		roundedRectangle(
			context,
			50,
			this.board.y,
			225,
			Board.SIZE * Tile.SIZE,
			5,
			true,
			false,
		);

		context.fillStyle = 'white';
		context.font = '25px Joystix';
		context.textAlign = 'left';
		context.fillText(`Level:`, 70, this.board.y + 45);
		context.fillText(`Score:`, 70, this.board.y + 105);
		context.fillText(`Goal:`, 70, this.board.y + 165);
		context.fillText(`Timer:`, 70, this.board.y + 225);
		context.textAlign = 'right';
		context.fillText(`${this.level}`, 250, this.board.y + 45);
		context.fillText(`${this.score}`, 250, this.board.y + 105);
		context.fillText(`${this.scoreGoal}`, 250, this.board.y + 165);
		context.fillText(`${this.timer}`, 250, this.board.y + 225);
	}

	static BASE_TIMER_ADD_AMOUNT = 5;
	/**
	 * Calculates whether any matches were found on the board and tweens the needed
	 * tiles to their new destinations if so. Also removes tiles from the board that
	 * have matched and replaces them with new randomized tiles, deferring most of this
	 * to the Board class.
	 */
	async calculateMatches() {
		// Get all matches for the current board.
		let numMatches = this.board.calculateMatches();
		if(numMatches > 0){
			//adding 5 seconds per match, subtracting the level to make later levels more difficult
			let timeToAdd = Math.max(0, (PlayState.BASE_TIMER_ADD_AMOUNT - (this.level -1)));//-1 because we aren't reducing at level 1
			for(let i = 0; i < numMatches; i++){ //looping to add for each match
				this.timer = this.timer + timeToAdd; 
			}
		}
		

		// If no matches, then no need to proceed with the function.
		if (this.board.matches.length === 0) {
			return;
		}

		this.calculateScore();

		// Remove any matches from the board to create empty spaces.
		this.board.removeMatches();

		await this.placeNewTiles();

		/**
		 * Recursively call function in case new matches have been created
		 * as a result of falling blocks once new blocks have finished falling.
		 */
		await this.calculateMatches();
	}

	calculateScore() {
		this.board.matches.forEach((match) => {
			for(let i = 0; i < match.length; i++) {
				this.score += (match[i].pattern+1)*this.baseScore;//base score will be multiplied by the tier of tile to increase the score
			}
		});
	}

	async placeNewTiles() {
		// Get an array with tween values for tiles that should now fall as a result of the removal.
		const tilesToFall = this.board.getFallingTiles();

		// Tween all the falling blocks simultaneously.
		await Promise.all(tilesToFall.map((tile) => {
			timer.tweenAsync(tile.tile, tile.parameters, tile.endValues, 0.25);
		}));

		// Get an array with tween values for tiles that should replace the removed tiles.
		const newTiles = this.board.getNewTiles(this.level);

		// Tween the new tiles falling one by one for a more interesting animation.
		for (const tile of newTiles) {
			await timer.tweenAsync(tile.tile, tile.parameters, tile.endValues, 0.05);
		}
	}

	startTimer() {
		// Decrement the timer every second.
		timer.addTask(() => {
			this.timer--;

			if (this.timer <= 5) {
				sounds.play(SoundName.Clock);
			}
		}, 1, this.maxTimer);
	}

	checkVictory() {
		if (this.score < this.scoreGoal) {
			return;
		}

		sounds.play(SoundName.NextLevel);

		stateMachine.change(StateName.LevelTransition, {
			level: this.level + 1,
			score: this.score,
			scene: this.scene,
		});
	}

	checkGameOver() {
		if (this.timer > 0) {
			return;
		}

		sounds.play(SoundName.GameOver);

		stateMachine.change(StateName.GameOver, {
			score: this.score,
			scene: this.scene,
		});
	}
}
function delay(milliseconds){
	return new Promise(resolve => {
		setTimeout(resolve, milliseconds);
	});
}