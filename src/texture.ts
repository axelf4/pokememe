const renderer = require("renderer.js"), gl = renderer.gl;
import { isPowerOfTwo, nextPowerOfTwo } from "./pow2";
import SpriteBatch, { white } from "./SpriteBatch";
import { range } from "./utils";

export default interface Texture {
	/** The texture name. */
	texture: WebGLTexture;
	width: number;
	height: number;
};

export function loadTexture(src: string): Promise<TexRegion> {
	return new Promise((resolve, reject) => {
		let image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = function() {
			const regionWidth = image.width, regionHeight = image.height;
			let img: HTMLImageElement | HTMLCanvasElement = image;
			if (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height)) {
				// Scale up the texture to the next highest power of two dimensions.
				const canvas = document.createElement("canvas");
				canvas.width = nextPowerOfTwo(image.width);
				canvas.height = nextPowerOfTwo(image.height);
				const ctx = canvas.getContext("2d");
				if (ctx === null) throw new Error("Context identifier '2d' is not supported");
				ctx.drawImage(image, 0, 0, image.width, image.height);
				img = canvas;
			}
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

			resolve(new TexRegion({ texture, width: img.width, height: img.height },
									0, 0, regionWidth, regionHeight));
		};
		image.onerror = reject;
		image.src = src;
	});
}

export class TexRegion {
	u1: number;
	v1: number;
	u2: number;
	v2: number;

	constructor(readonly texture: Texture,
				x0 = 0, y0 = 0, x1 = texture.width, y1 = texture.height) {
		this.u1 = x0 / texture.width;
		this.v1 = y0 / texture.height;
		this.u2 = x1 / texture.width;
		this.v2 = y1 / texture.height;
	}

	getRegion(): {x0: number, y0: number, x1: number, y1: number} {
		let {width: texWidth, height: texHeight} = this.texture;
		return {x0: this.u1 * texWidth, y0: this.v1 * texHeight,
				x1: this.u2 * texWidth, y1: this.v2 * texHeight};
	}

	getSize(): {width: number, height: number} {
		let {x0, y0, x1, y1} = this.getRegion();
		return {width: x1 - x0, height: y1 - y0};
	}

	/**
	 * Creates tiles out of this region starting from the top-left corner.
	 *
	 * @param padding Inner separation between consecutive tiles.
	 * @return The 2D array of tiles indexed by [row][column].
	 */
	split(tileWidth: number, tileHeight: number, padding = 0): Array<Array<TexRegion>> {
		let {x0, y0, x1, y1} = this.getRegion(),
			width = x1 - x0, height = y1 - y0,
			numRows = height / (tileHeight + padding), numCols = width / (tileWidth + padding);

		return range(numRows).map(row => range(numCols).map(col => {
			let x = x0 + col * (tileWidth + padding),
			y = y0 + row * (tileHeight + padding);
			return new TexRegion(this.texture, x, y, x + tileWidth, y + tileHeight);
		}));
	}

	draw(batch: SpriteBatch, x1: number, y1: number, x2: number, y2: number,
		 color = white): void {
		batch.draw(this.texture.texture, x1, y1, x2, y2,
				   this.u1, this.v1, this.u2, this.v2, color);
	}
}

export const whiteTexRegion: TexRegion
	= new TexRegion({ texture: renderer.whiteTexture, width: 1, height: 1 });
