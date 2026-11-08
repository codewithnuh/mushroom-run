import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';

type Ctx = CanvasRenderingContext2D;

function makeTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not create texture ${key}`);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  texture.refresh();
}

function px(ctx: Ctx, x: number, y: number, width: number, height: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  const rows = Math.ceil(ry);
  for (let row = -rows; row <= rows; row += 1) {
    const normalized = row / ry;
    if (Math.abs(normalized) > 1) continue;
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - normalized * normalized)));
    if (half < 0) continue;
    ctx.fillRect(Math.round(cx - half), Math.round(cy + row), Math.max(1, half * 2), 1);
  }
}

function dither(ctx: Ctx, color: string, points: Array<[number, number]>): void {
  ctx.fillStyle = color;
  points.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
}

/**
 * Repeats a layer's draw calls either side of the texture so shapes that cross
 * the edge continue cleanly when the layer is tiled by a TileSprite.
 */
function tileWrap(ctx: Ctx, width: number, draw: () => void): void {
  for (const offset of [-width, 0, width]) {
    ctx.save();
    ctx.translate(offset, 0);
    draw();
    ctx.restore();
  }
}

function cloud(ctx: Ctx, x: number, y: number, scale: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  const shadow = '#c6ecf4';
  const body = '#ffffff';
  ellipse(ctx, x + 10 * scale, y + 8 * scale, 12 * scale, 6 * scale, shadow);
  ellipse(ctx, x + 20 * scale, y + 4 * scale, 10 * scale, 8 * scale, body);
  ellipse(ctx, x + 31 * scale, y + 8 * scale, 9 * scale, 6 * scale, body);
  px(ctx, x + 9 * scale, y + 8 * scale, 22 * scale, 6 * scale, body);
  px(ctx, x + 14 * scale, y + 2 * scale, 11 * scale, 3 * scale, shadow);
  ctx.globalAlpha = 1;
}

function pine(ctx: Ctx, x: number, baseline: number, height: number, color: string): void {
  px(ctx, x - 1, baseline - 3, 3, 3, '#4d6b51');
  for (let row = 0; row < height; row += 1) {
    const width = Math.min(row + 1, height - row + 1);
    px(ctx, x - width, baseline - 3 - row, width * 2 + 1, 1, color);
  }
}

function drawSky(ctx: Ctx): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, '#3f9fd4');
  gradient.addColorStop(0.32, '#6ac9e8');
  gradient.addColorStop(0.62, '#a6e7f3');
  gradient.addColorStop(0.82, '#d5f4ef');
  gradient.addColorStop(1, '#f7edc9');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Sun, made from pixel rings so it feels hand placed.
  ctx.globalAlpha = 0.2;
  ellipse(ctx, 398, 56, 31, 31, '#fff2b9');
  ctx.globalAlpha = 0.38;
  ellipse(ctx, 398, 56, 24, 24, '#fff5c9');
  ctx.globalAlpha = 1;
  ellipse(ctx, 398, 56, 16, 16, '#ffeaa1');
  ellipse(ctx, 394, 52, 8, 8, '#fff9d8');

  // Soft far-away cloud streaks.
  ctx.globalAlpha = 0.16;
  ellipse(ctx, 94, 80, 34, 5, '#ffffff');
  ellipse(ctx, 256, 48, 24, 4, '#ffffff');
  ellipse(ctx, 334, 96, 42, 4, '#ffffff');
  ctx.globalAlpha = 1;

  // Tiny birds.
  ctx.strokeStyle = 'rgba(38, 82, 105, 0.55)';
  ctx.lineWidth = 1;
  const bird = (x: number, y: number): void => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 2);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x + 6, y - 2);
    ctx.lineTo(x + 8, y);
    ctx.stroke();
  };
  bird(320, 66);
  bird(338, 56);
  bird(330, 82);

  // Warm haze at the horizon.
  const haze = ctx.createLinearGradient(0, 190, 0, GAME_HEIGHT);
  haze.addColorStop(0, 'rgba(255, 247, 213, 0)');
  haze.addColorStop(1, 'rgba(255, 237, 182, 0.42)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 190, GAME_WIDTH, GAME_HEIGHT - 190);
}

function drawClouds(ctx: Ctx): void {
  tileWrap(ctx, 480, () => {
    cloud(ctx, 18, 24, 1.15, 0.94);
    cloud(ctx, 196, 10, 0.78, 0.82);
    cloud(ctx, 322, 36, 1.35, 0.9);
    cloud(ctx, 460, 12, 0.68, 0.7);
  });
}

function drawHillsFar(ctx: Ctx): void {
  tileWrap(ctx, 480, () => {
    ctx.globalAlpha = 0.95;
    ellipse(ctx, 34, 98, 112, 54, '#7ac8bc');
    ellipse(ctx, 188, 86, 96, 60, '#8dd6c8');
    ellipse(ctx, 356, 100, 120, 48, '#7ac8bc');
    ellipse(ctx, 477, 92, 70, 54, '#8dd6c8');
    px(ctx, 0, 122, 480, 8, '#7ac8bc');
    ctx.globalAlpha = 1;

    // Lighter crests.
    ellipse(ctx, 88, 91, 54, 30, '#9de2d1');
    ellipse(ctx, 295, 97, 62, 27, '#9de2d1');
    ellipse(ctx, 407, 84, 60, 32, '#a5e8d6');

    pine(ctx, 164, 118, 20, '#5fae9f');
    pine(ctx, 174, 118, 14, '#5fae9f');
    pine(ctx, 316, 120, 24, '#5fae9f');
    pine(ctx, 328, 120, 16, '#5fae9f');
    pine(ctx, 445, 118, 19, '#5fae9f');

    dither(ctx, '#b8f0df', [
      [20, 96], [30, 92], [252, 104], [260, 101], [392, 100], [404, 96], [418, 103],
    ]);
  });
}

function drawHillsNear(ctx: Ctx): void {
  tileWrap(ctx, 480, () => {
    ellipse(ctx, 20, 92, 100, 42, '#3e9f87');
    ellipse(ctx, 146, 100, 88, 38, '#48aa8e');
    ellipse(ctx, 296, 94, 110, 44, '#3e9f87');
    ellipse(ctx, 438, 98, 94, 38, '#48aa8e');
    px(ctx, 0, 108, 480, 12, '#3e9f87');

    ctx.globalAlpha = 0.55;
    ellipse(ctx, 64, 84, 46, 22, '#5dbea0');
    ellipse(ctx, 236, 92, 50, 19, '#5dbea0');
    ellipse(ctx, 381, 82, 46, 24, '#5dbea0');
    ctx.globalAlpha = 1;

    pine(ctx, 112, 112, 30, '#2f7f6c');
    pine(ctx, 124, 112, 20, '#2f7f6c');
    pine(ctx, 206, 114, 24, '#2f7f6c');
    pine(ctx, 344, 112, 32, '#2f7f6c');
    pine(ctx, 358, 112, 22, '#2f7f6c');

    dither(ctx, '#73cbac', [
      [14, 92], [22, 88], [128, 98], [300, 94], [310, 90], [420, 96],
    ]);
  });
}

function drawGroundTop(ctx: Ctx, variant: number): void {
  px(ctx, 0, 0, 16, 16, '#8f5b38');
  px(ctx, 0, 0, 16, 2, '#3c7d4f');
  px(ctx, 0, 2, 16, 4, '#63bd69');
  px(ctx, 0, 2, 16, 1, '#91e18a');
  px(ctx, 0, 5, 16, 1, '#4b9956');
  px(ctx, 0, 6, 16, 10, '#a76e43');
  px(ctx, 0, 6, 16, 2, '#c28a58');
  px(ctx, 0, 15, 16, 1, '#714127');

  // Grass blades poke into the soil.
  px(ctx, 2, 5, 1, 3, '#4b9956');
  px(ctx, 9, 5, 1, 2, '#4b9956');
  px(ctx, 13, 5, 1, 3, '#4b9956');

  const pebbles: Array<[number, number]> = [[3, 10], [11, 12], [7, 13]];
  pebbles.forEach(([x, y]) => {
    px(ctx, x, y, 2, 1, '#c28a58');
    px(ctx, x + 1, y + 1, 1, 1, '#76452b');
  });

  if (variant === 1) {
    px(ctx, 1, 5, 1, 3, '#91e18a');
    px(ctx, 14, 5, 1, 2, '#91e18a');
    px(ctx, 6, 7, 2, 1, '#6a3e26');
  } else if (variant === 2) {
    // A tiny daisy tucked into the grass.
    px(ctx, 5, 3, 1, 2, '#4b9956');
    px(ctx, 4, 2, 1, 1, '#fff6dc');
    px(ctx, 6, 2, 1, 1, '#fff6dc');
    px(ctx, 5, 1, 1, 1, '#fff6dc');
    px(ctx, 5, 2, 1, 1, '#ffd166');
  } else if (variant === 3) {
    px(ctx, 10, 3, 1, 3, '#4b9956');
    px(ctx, 11, 4, 1, 1, '#91e18a');
    px(ctx, 12, 2, 1, 2, '#4b9956');
  }
}

function drawGroundFill(ctx: Ctx): void {
  px(ctx, 0, 0, 16, 16, '#8f5b38');
  px(ctx, 0, 0, 16, 1, '#a76e43');
  px(ctx, 0, 15, 16, 1, '#693b25');
  px(ctx, 2, 3, 2, 1, '#bd8754');
  px(ctx, 9, 5, 3, 1, '#76452b');
  px(ctx, 5, 9, 2, 2, '#c28a58');
  px(ctx, 12, 12, 2, 1, '#bd8754');
  px(ctx, 3, 13, 1, 1, '#76452b');
  px(ctx, 0, 6, 1, 4, '#7d4d30');
}

function drawBrick(ctx: Ctx): void {
  px(ctx, 0, 0, 16, 16, '#5b2b25');
  px(ctx, 1, 1, 14, 14, '#b95038');
  px(ctx, 1, 1, 14, 2, '#d96d4d');
  px(ctx, 1, 3, 14, 1, '#9f3f2d');
  px(ctx, 1, 6, 14, 1, '#6c2f26');
  px(ctx, 1, 7, 14, 1, '#d96d4d');
  px(ctx, 1, 8, 14, 1, '#9f3f2d');
  px(ctx, 1, 12, 14, 1, '#6c2f26');
  px(ctx, 1, 13, 14, 2, '#d96d4d');
  px(ctx, 7, 1, 1, 6, '#6c2f26');
  px(ctx, 3, 7, 1, 6, '#6c2f26');
  px(ctx, 11, 7, 1, 6, '#6c2f26');
  px(ctx, 2, 2, 4, 1, '#ed916d');
  px(ctx, 9, 13, 3, 1, '#ed916d');
  px(ctx, 2, 14, 1, 1, '#ffe0b2');
  px(ctx, 12, 1, 2, 1, '#ffe0b2');
}

function drawQuestion(ctx: Ctx, frame: number): void {
  const base = '#d98a25';
  px(ctx, 0, 0, 16, 16, '#6a351e');
  px(ctx, 1, 1, 14, 14, base);
  px(ctx, 1, 1, 14, 2, '#ffcf5c');
  px(ctx, 1, 2, 2, 12, '#f2b33d');
  px(ctx, 1, 13, 14, 2, '#b36a1f');
  px(ctx, 3, 3, 10, 10, '#eaa62f');
  px(ctx, 3, 3, 10, 1, '#ffdb7a');
  px(ctx, 3, 12, 10, 1, '#b36a1f');

  // Corner studs.
  px(ctx, 2, 2, 1, 1, '#fff1bb');
  px(ctx, 13, 2, 1, 1, '#fff1bb');
  px(ctx, 2, 13, 1, 1, '#8a4a1c');
  px(ctx, 13, 13, 1, 1, '#8a4a1c');

  // The question mark.
  px(ctx, 6, 4, 4, 2, '#6a351e');
  px(ctx, 10, 5, 2, 3, '#6a351e');
  px(ctx, 8, 7, 3, 2, '#6a351e');
  px(ctx, 8, 9, 2, 2, '#6a351e');
  px(ctx, 8, 12, 2, 2, '#6a351e');
  px(ctx, 7, 5, 1, 1, '#b36a1f');
  px(ctx, 9, 11, 1, 1, '#6a351e');

  // A wander highlight to make it feel alive.
  const shimmer = [
    [4, 4],
    [11, 4],
    [12, 8],
    [5, 10],
  ][frame % 4];
  px(ctx, shimmer[0], shimmer[1], 1, 1, '#fff8d8');
  if (frame % 2 === 0) px(ctx, 4, 5, 1, 1, '#ffe8a3');
  else px(ctx, 11, 10, 1, 1, '#ffe8a3');
}

function drawUsedBlock(ctx: Ctx): void {
  px(ctx, 0, 0, 16, 16, '#4b352b');
  px(ctx, 1, 1, 14, 14, '#8b6a4d');
  px(ctx, 1, 1, 14, 2, '#a98561');
  px(ctx, 1, 12, 14, 3, '#684c38');
  px(ctx, 3, 3, 10, 10, '#7b5b42');
  px(ctx, 3, 3, 10, 1, '#967456');
  px(ctx, 2, 2, 1, 1, '#d1b28a');
  px(ctx, 13, 2, 1, 1, '#d1b28a');
  px(ctx, 2, 13, 1, 1, '#4b352b');
  px(ctx, 13, 13, 1, 1, '#4b352b');
  px(ctx, 6, 6, 1, 1, '#5e4634');
  px(ctx, 10, 9, 1, 1, '#5e4634');
}

function drawStone(ctx: Ctx): void {
  px(ctx, 0, 0, 16, 16, '#37444e');
  px(ctx, 1, 1, 14, 14, '#778790');
  px(ctx, 1, 1, 14, 2, '#9baab0');
  px(ctx, 1, 5, 14, 1, '#5d6c75');
  px(ctx, 1, 10, 14, 1, '#5d6c75');
  px(ctx, 5, 1, 1, 4, '#5d6c75');
  px(ctx, 11, 6, 1, 4, '#5d6c75');
  px(ctx, 4, 11, 1, 4, '#5d6c75');
  px(ctx, 9, 12, 3, 1, '#8fa0a6');
  px(ctx, 2, 3, 1, 1, '#b4c1c4');
  px(ctx, 13, 8, 1, 1, '#b4c1c4');
  // Moss on top.
  px(ctx, 2, 1, 4, 1, '#6bbf76');
  px(ctx, 11, 2, 2, 1, '#6bbf76');
}

function drawPipe(ctx: Ctx, wide: boolean, top: boolean): void {
  const width = wide ? 40 : 32;
  const left = wide ? 0 : 0;
  if (top) {
    px(ctx, 0, 0, width, 16, '#14352d');
    px(ctx, left + 2, 1, width - 4, 12, '#278c68');
    px(ctx, left + 2, 1, width - 4, 3, '#59c893');
    px(ctx, left + 4, 4, 5, 7, '#74dea7');
    px(ctx, left + 5, 4, 2, 7, '#a0f0c4');
    px(ctx, left + width - 9, 4, 4, 7, '#1d6f55');
    px(ctx, left + width - 8, 1, 5, 3, '#3eaf82');
    px(ctx, left + 2, 12, width - 4, 3, '#123c31');
    px(ctx, left + 5, 13, width - 10, 2, '#1e624e');
    // Rim lip highlight.
    px(ctx, left + 1, 1, 2, 11, '#1b624e');
    px(ctx, left + width - 3, 1, 2, 11, '#0f4a3a');
  } else {
    px(ctx, 0, 0, width, 16, '#14352d');
    px(ctx, 3, 0, width - 6, 16, '#278c68');
    px(ctx, 4, 0, 5, 16, '#3fb887');
    px(ctx, 5, 0, 2, 16, '#74dea7');
    px(ctx, width - 9, 0, 4, 16, '#1d6f55');
    px(ctx, width - 6, 0, 2, 16, '#123c31');
    px(ctx, 0, 15, width, 1, '#0f2a24');
  }
}

function drawCoin(ctx: Ctx, frame: number): void {
  const widths = [5, 3.2, 1.2, 3.2];
  const rx = Math.max(1, widths[frame % 4]);
  px(ctx, 6 - Math.max(1, Math.round(rx)), 2, Math.max(2, Math.round(rx * 2)), 11, '#8a5216');
  ctx.globalAlpha = 0.28;
  ellipse(ctx, 6, 7, rx + 1, 7, '#ffefad');
  ctx.globalAlpha = 1;
  ellipse(ctx, 6, 7, rx, 6, '#f6b93b');
  if (rx > 2) {
    ellipse(ctx, 6, 7, Math.max(1, rx - 1.4), 4.4, '#ffd166');
    px(ctx, 5, 3, 1, 2, '#fff1b8');
    px(ctx, 4, 4, 1, 3, '#ffe391');
    px(ctx, 6, 10, 1, 2, '#c98922');
  } else {
    px(ctx, 6, 3, 1, 9, '#e3a323');
    px(ctx, 7, 4, 1, 7, '#8a5216');
  }
  if (frame % 2 === 0) px(ctx, 6, 2, 1, 1, '#fff8d8');
}

export function createGameTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'blank', 1, 1, (ctx) => px(ctx, 0, 0, 1, 1, '#ffffff'));

  // ---- Backdrop ---------------------------------------------------------
  makeTexture(scene, 'sky', GAME_WIDTH, GAME_HEIGHT, drawSky);
  makeTexture(scene, 'clouds', 480, 110, drawClouds);
  makeTexture(scene, 'hills-far', 480, 130, drawHillsFar);
  makeTexture(scene, 'hills-near', 480, 120, drawHillsNear);

  // ---- Terrain ----------------------------------------------------------
  for (let variant = 0; variant < 4; variant += 1) {
    makeTexture(scene, `ground-top-${variant}`, 16, 16, (ctx) => drawGroundTop(ctx, variant));
  }
  makeTexture(scene, 'ground-fill', 16, 16, drawGroundFill);
  makeTexture(scene, 'pit-fill', 16, 32, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 32);
    gradient.addColorStop(0, '#294345');
    gradient.addColorStop(0.45, '#182b32');
    gradient.addColorStop(1, '#0d1720');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 32);
    px(ctx, 0, 0, 16, 1, '#3d5c56');
    px(ctx, 3, 4, 3, 1, '#2f4a49');
    px(ctx, 10, 8, 4, 1, '#223a3d');
    px(ctx, 5, 14, 2, 2, '#0a1117');
    px(ctx, 12, 20, 2, 1, '#2b4545');
    px(ctx, 2, 27, 4, 1, '#081018');
    px(ctx, 8, 3, 1, 3, '#1f373c');
  });
  makeTexture(scene, 'brick', 16, 16, drawBrick);
  for (let frame = 0; frame < 4; frame += 1) {
    makeTexture(scene, `q-${frame}`, 16, 16, (ctx) => drawQuestion(ctx, frame));
  }
  makeTexture(scene, 'used-block', 16, 16, drawUsedBlock);
  makeTexture(scene, 'stone', 16, 16, drawStone);
  makeTexture(scene, 'pipe-top', 40, 16, (ctx) => drawPipe(ctx, true, true));
  makeTexture(scene, 'pipe-body', 32, 16, (ctx) => drawPipe(ctx, false, false));

  // ---- Pickups ----------------------------------------------------------
  for (let frame = 0; frame < 4; frame += 1) {
    makeTexture(scene, `coin-${frame}`, 12, 14, (ctx) => drawCoin(ctx, frame));
  }

  drawPipTextures(scene);
  drawEnemyTextures(scene);
  drawShroom(scene);

  // ---- HUD --------------------------------------------------------------
  makeTexture(scene, 'hud-coin', 12, 14, (ctx) => drawCoin(ctx, 0));
  makeTexture(scene, 'hud-cap', 14, 10, (ctx) => {
    px(ctx, 1, 2, 12, 5, '#24172b');
    ellipse(ctx, 7, 4, 6, 3, '#ef476f');
    px(ctx, 1, 6, 12, 2, '#a92c4b');
    px(ctx, 4, 2, 2, 2, '#ffe8a3');
    px(ctx, 9, 3, 2, 1, '#ffe8a3');
  });

  // ---- Decor ------------------------------------------------------------
  makeTexture(scene, 'bush', 50, 24, (ctx) => {
    ellipse(ctx, 14, 18, 14, 9, '#245f50');
    ellipse(ctx, 33, 17, 15, 10, '#245f50');
    ellipse(ctx, 23, 13, 13, 9, '#2d7860');
    px(ctx, 1, 19, 48, 5, '#245f50');
    ellipse(ctx, 15, 16, 9, 5, '#3f906f');
    ellipse(ctx, 30, 16, 9, 5, '#3f906f');
    ellipse(ctx, 23, 11, 8, 4, '#49a27b');
    px(ctx, 13, 8, 2, 1, '#7dd3a1');
    px(ctx, 34, 11, 2, 1, '#7dd3a1');
    px(ctx, 40, 20, 2, 2, '#6fc28e');
    px(ctx, 8, 21, 2, 2, '#ffd166');
    px(ctx, 9, 20, 1, 1, '#fff6dc');
  });

  makeTexture(scene, 'bush-small', 32, 17, (ctx) => {
    ellipse(ctx, 10, 12, 10, 6, '#245f50');
    ellipse(ctx, 23, 12, 9, 6, '#245f50');
    ellipse(ctx, 16, 9, 9, 6, '#2d7860');
    px(ctx, 1, 13, 30, 3, '#245f50');
    ellipse(ctx, 12, 10, 5, 3, '#3f906f');
    ellipse(ctx, 22, 11, 5, 3, '#3f906f');
    px(ctx, 18, 5, 2, 1, '#7dd3a1');
  });

  makeTexture(scene, 'flower', 9, 12, (ctx) => {
    px(ctx, 4, 5, 1, 7, '#3d8a54');
    px(ctx, 2, 8, 2, 1, '#59b46d');
    px(ctx, 6, 7, 2, 1, '#59b46d');
    px(ctx, 3, 2, 3, 2, '#fff6dc');
    px(ctx, 4, 1, 1, 4, '#fff6dc');
    px(ctx, 2, 3, 5, 1, '#fff6dc');
    px(ctx, 4, 3, 1, 1, '#ffd166');
  });

  makeTexture(scene, 'tuft', 13, 9, (ctx) => {
    px(ctx, 2, 3, 1, 6, '#3d8a54');
    px(ctx, 4, 1, 1, 8, '#4b9956');
    px(ctx, 6, 4, 1, 5, '#2f7d4f');
    px(ctx, 8, 2, 1, 7, '#4b9956');
    px(ctx, 10, 5, 1, 4, '#3d8a54');
    px(ctx, 3, 2, 1, 1, '#91e18a');
    px(ctx, 9, 1, 1, 1, '#91e18a');
  });

  makeTexture(scene, 'rock', 15, 10, (ctx) => {
    px(ctx, 1, 3, 13, 7, '#5e6b62');
    px(ctx, 2, 2, 9, 1, '#7d8b7e');
    px(ctx, 3, 1, 5, 1, '#919e8d');
    px(ctx, 3, 4, 4, 2, '#8e9b8c');
    px(ctx, 9, 6, 3, 1, '#435047');
    px(ctx, 2, 8, 11, 1, '#415046');
    px(ctx, 6, 2, 1, 1, '#c2cbb6');
  });

  makeTexture(scene, 'sign', 30, 28, (ctx) => {
    px(ctx, 13, 12, 4, 16, '#5c3d27');
    px(ctx, 14, 12, 2, 16, '#936342');
    px(ctx, 9, 9, 12, 2, '#4a3020');
    px(ctx, 1, 1, 28, 12, '#4a3020');
    px(ctx, 2, 2, 26, 10, '#c28a50');
    px(ctx, 2, 2, 26, 2, '#e0ae6d');
    px(ctx, 2, 10, 26, 2, '#8b5a35');
    // Arrow pointing into the level.
    px(ctx, 6, 6, 11, 2, '#3d2a1e');
    px(ctx, 8, 4, 2, 6, '#3d2a1e');
    px(ctx, 5, 5, 2, 4, '#3d2a1e');
    px(ctx, 17, 5, 2, 4, '#3d2a1e');
    px(ctx, 19, 4, 2, 6, '#3d2a1e');
    px(ctx, 21, 5, 2, 4, '#3d2a1e');
    px(ctx, 12, 9, 2, 1, '#f0c58b');
  });

  makeTexture(scene, 'checkpoint-off', 20, 42, (ctx) => {
    px(ctx, 8, 8, 3, 33, '#503b2b');
    px(ctx, 9, 8, 1, 33, '#8f6d4e');
    px(ctx, 3, 37, 14, 4, '#3c4a4f');
    px(ctx, 4, 36, 12, 1, '#6e7e80');
    px(ctx, 5, 11, 11, 8, '#4a565e');
    px(ctx, 6, 12, 9, 6, '#78868a');
    px(ctx, 9, 13, 2, 2, '#4a565e');
    px(ctx, 9, 16, 2, 1, '#4a565e');
  });

  makeTexture(scene, 'checkpoint-on', 20, 42, (ctx) => {
    px(ctx, 8, 8, 3, 33, '#503b2b');
    px(ctx, 9, 8, 1, 33, '#8f6d4e');
    px(ctx, 3, 37, 14, 4, '#3c4a4f');
    px(ctx, 4, 36, 12, 1, '#6e7e80');
    px(ctx, 2, 1, 17, 2, '#8c6a36');
    px(ctx, 4, 3, 13, 9, '#8c6a36');
    px(ctx, 5, 4, 11, 7, '#ffd166');
    px(ctx, 5, 4, 11, 1, '#fff1b8');
    px(ctx, 8, 6, 1, 1, '#8a5a1e');
    px(ctx, 10, 6, 1, 3, '#8a5a1e');
    px(ctx, 8, 9, 3, 1, '#8a5a1e');
    px(ctx, 9, 5, 1, 1, '#fff8d8');
  });

  drawCastle(scene);
  drawFlagpole(scene);

  makeTexture(scene, 'sparkle', 5, 5, (ctx) => {
    px(ctx, 2, 0, 1, 5, '#fff6dc');
    px(ctx, 0, 2, 5, 1, '#fff6dc');
    px(ctx, 1, 1, 1, 1, '#ffd166');
    px(ctx, 3, 3, 1, 1, '#ffd166');
  });
  makeTexture(scene, 'dust', 4, 4, (ctx) => {
    px(ctx, 0, 1, 3, 2, '#fff6dc');
    px(ctx, 1, 0, 2, 4, '#fff6dc');
  });
  makeTexture(scene, 'debris', 4, 4, (ctx) => {
    px(ctx, 0, 0, 4, 4, '#b95038');
    px(ctx, 0, 0, 4, 1, '#e88764');
    px(ctx, 2, 2, 2, 2, '#6c2f26');
  });
  makeTexture(scene, 'star', 7, 7, (ctx) => {
    px(ctx, 3, 0, 1, 7, '#fff3b0');
    px(ctx, 0, 3, 7, 1, '#fff3b0');
    px(ctx, 1, 1, 2, 2, '#ffd166');
    px(ctx, 4, 4, 2, 2, '#ffd166');
  });
}

function drawPipTextures(scene: Phaser.Scene): void {
  type ArmPose = 'down' | 'forward' | 'up' | 'out' | 'back';
  type LegPose = 'stand' | 'left' | 'right' | 'tuck' | 'spread';
  interface PipPose {
    bob: number;
    armL: ArmPose;
    armR: ArmPose;
    legL: LegPose;
    legR: LegPose;
    blink?: boolean;
  }

  const drawPip = (ctx: Ctx, pose: PipPose): void => {
    const outline = '#24172b';
    const capDark = '#a92c4b';
    const cap = '#ef476f';
    const capLight = '#ff7f96';
    const capSpot = '#ffe8a3';
    const skin = '#ffd8ae';
    const skinShadow = '#e8ab7e';
    const eye = '#24172b';
    const shirt = '#2ec4b6';
    const shirtShadow = '#1a8f86';
    const pants = '#314b8a';
    const pantsShadow = '#22345f';
    const boot = '#6b4329';
    const bootLight = '#9b6640';
    const button = '#ffd166';
    const bob = pose.bob;

    // --- Legs -----------------------------------------------------------
    const leg = (offset: number, poseSide: LegPose, side: number): void => {
      const standX = side === 0 ? 5 : 11;
      const standW = 4;
      let x = standX + offset;
      let y = 22 + bob;
      let legH = 4;
      let bootX = x - 1;
      let bootY = 25 + bob;
      let bootW = 6;
      if (poseSide === 'left') {
        x -= 1;
        y -= 1;
        legH = 3;
        bootX = x - 1;
        bootY = 24 + bob;
        bootW = 6;
      } else if (poseSide === 'right') {
        x += 1;
        y -= 1;
        legH = 3;
        bootX = x;
        bootY = 24 + bob;
        bootW = 6;
      } else if (poseSide === 'tuck') {
        x = side === 0 ? 4 : 12;
        y = 22 + bob;
        legH = 2;
        bootX = x;
        bootY = 23 + bob;
        bootW = 5;
      } else if (poseSide === 'spread') {
        x = side === 0 ? 3 : 13;
        y = 23;
        legH = 3;
        bootX = x - 1;
        bootY = 25;
        bootW = 5;
      }
      px(ctx, x, y, standW, legH, pants);
      px(ctx, x, y, 1, legH, pantsShadow);
      px(ctx, bootX, bootY, bootW, 2, outline);
      px(ctx, bootX + 1, bootY, bootW - 2, 1, boot);
      px(ctx, bootX + 1, bootY + 1, bootW - 3, 1, bootLight);
      px(ctx, bootX + bootW - 2, bootY + 1, 1, 1, '#4a2b1a');
    };

    leg(0, pose.legL, 0);
    leg(0, pose.legR, 1);

    // --- Torso ----------------------------------------------------------
    px(ctx, 4, 15 + bob, 12, 8, outline);
    px(ctx, 5, 15 + bob, 10, 7, shirt);
    px(ctx, 5, 15 + bob, 10, 1, '#6be0cd');
    px(ctx, 13, 16 + bob, 2, 5, shirtShadow);
    px(ctx, 5, 16 + bob, 1, 4, shirtShadow);

    // Overalls and straps.
    px(ctx, 6, 17 + bob, 8, 6, pants);
    px(ctx, 6, 17 + bob, 1, 6, pantsShadow);
    px(ctx, 13, 17 + bob, 1, 6, pantsShadow);
    px(ctx, 6, 15 + bob, 2, 3, pants);
    px(ctx, 12, 15 + bob, 2, 3, pants);
    px(ctx, 6, 17 + bob, 1, 1, button);
    px(ctx, 13, 17 + bob, 1, 1, button);
    px(ctx, 7, 20 + bob, 5, 2, '#2a406f');
    px(ctx, 9, 19 + bob, 1, 1, '#ffd166');

    // --- Arms -----------------------------------------------------------
    const drawArm = (side: number, armPose: ArmPose): void => {
      const dir = side === 0 ? -1 : 1;
      const shoulderX = side === 0 ? 4 : 15;
      let startX = shoulderX;
      let startY = 15 + bob;
      let w = 3;
      let h = 5;
      let handX = shoulderX + (side === 0 ? -1 : 0);
      let handY = 20 + bob;
      if (armPose === 'forward') {
        startX = side === 0 ? 1 : 15;
        startY = 16 + bob;
        w = 4;
        h = 3;
        handX = side === 0 ? -1 : 18;
        handY = 17 + bob;
      } else if (armPose === 'back') {
        startX = side === 0 ? 5 : 14;
        startY = 16 + bob;
        w = 3;
        h = 4;
        handX = side === 0 ? 3 : 17;
        handY = 20 + bob;
      } else if (armPose === 'up') {
        startX = side === 0 ? 2 : 15;
        startY = 12 + bob;
        w = 3;
        h = 5;
        handX = side === 0 ? 1 : 18;
        handY = 11 + bob;
      } else if (armPose === 'out') {
        startX = side === 0 ? 0 : 17;
        startY = 15 + bob;
        w = 3;
        h = 3;
        handX = side === 0 ? -1 : 19;
        handY = 15 + bob;
      }
      px(ctx, startX, startY, w, h, outline);
      px(ctx, startX + (side === 0 ? 0 : 1), startY, Math.max(1, w - 1), h - 1, shirt);
      px(ctx, startX + (side === 0 ? 0 : 1), startY, 1, h - 1, shirtShadow);
      px(ctx, handX, handY, 2, 2, outline);
      px(ctx, handX, handY, 2, 1, skin);
      void dir;
    };
    drawArm(0, pose.armL);
    drawArm(1, pose.armR);

    // --- Head -----------------------------------------------------------
    // Ear lobes.
    px(ctx, 2, 11 + bob, 3, 4, outline);
    px(ctx, 3, 11 + bob, 2, 3, skin);
    px(ctx, 15, 11 + bob, 3, 4, outline);
    px(ctx, 16, 11 + bob, 2, 3, skinShadow);
    px(ctx, 5, 9 + bob, 10, 8, outline);
    px(ctx, 6, 9 + bob, 9, 7, skin);
    px(ctx, 6, 9 + bob, 9, 1, '#ffebca');
    px(ctx, 13, 10 + bob, 2, 5, skinShadow);
    px(ctx, 5, 15 + bob, 10, 1, skinShadow);

    // Eyes.
    if (pose.blink) {
      px(ctx, 7, 12 + bob, 2, 1, eye);
      px(ctx, 12, 12 + bob, 2, 1, eye);
    } else {
      px(ctx, 7, 11 + bob, 2, 2, eye);
      px(ctx, 12, 11 + bob, 2, 2, eye);
      px(ctx, 7, 11 + bob, 1, 1, '#fff6dc');
      px(ctx, 12, 11 + bob, 1, 1, '#fff6dc');
    }
    // Nose and grin.
    px(ctx, 9, 13 + bob, 2, 1, skinShadow);
    px(ctx, 8, 15 + bob, 4, 1, '#b46b5b');
    px(ctx, 8, 14 + bob, 1, 1, '#d99a84');

    // --- Cap ------------------------------------------------------------
    px(ctx, 7, 1 + bob, 6, 1, outline);
    px(ctx, 5, 2 + bob, 10, 1, outline);
    px(ctx, 4, 3 + bob, 12, 1, outline);
    px(ctx, 3, 4 + bob, 14, 1, outline);
    px(ctx, 2, 5 + bob, 16, 1, outline);
    px(ctx, 1, 6 + bob, 18, 1, outline);
    px(ctx, 0, 7 + bob, 20, 2, outline);
    px(ctx, 1, 8 + bob, 18, 1, capDark);
    px(ctx, 1, 9 + bob, 18, 1, '#7e2139');

    px(ctx, 8, 2 + bob, 4, 1, cap);
    px(ctx, 6, 3 + bob, 9, 1, cap);
    px(ctx, 5, 4 + bob, 11, 1, cap);
    px(ctx, 4, 5 + bob, 13, 2, cap);
    px(ctx, 3, 7 + bob, 15, 1, cap);
    px(ctx, 2, 6 + bob, 5, 1, capLight);
    px(ctx, 3, 5 + bob, 6, 1, capLight);
    px(ctx, 3, 8 + bob, 14, 1, capDark);
    px(ctx, 4, 8 + bob, 11, 1, cap);
    // Spots.
    px(ctx, 4, 4 + bob, 3, 2, capSpot);
    px(ctx, 4, 4 + bob, 2, 1, '#fff3c4');
    px(ctx, 12, 5 + bob, 3, 2, capSpot);
    px(ctx, 15, 6 + bob, 2, 2, capSpot);
    px(ctx, 8, 2 + bob, 2, 1, '#fff3c4');
    // Brim edge.
    px(ctx, 2, 7 + bob, 17, 1, '#c83b5c');
    px(ctx, 4, 7 + bob, 6, 1, capLight);
  };

  makeTexture(scene, 'pip-idle', 20, 28, (ctx) =>
    drawPip(ctx, { bob: 0, armL: 'down', armR: 'down', legL: 'stand', legR: 'stand' }),
  );
  makeTexture(scene, 'pip-blink', 20, 28, (ctx) =>
    drawPip(ctx, { bob: 0, armL: 'down', armR: 'down', legL: 'stand', legR: 'stand', blink: true }),
  );
  makeTexture(scene, 'pip-run-0', 20, 28, (ctx) =>
    drawPip(ctx, { bob: -1, armL: 'forward', armR: 'back', legL: 'right', legR: 'left' }),
  );
  makeTexture(scene, 'pip-run-1', 20, 28, (ctx) =>
    drawPip(ctx, { bob: 0, armL: 'down', armR: 'down', legL: 'stand', legR: 'stand' }),
  );
  makeTexture(scene, 'pip-run-2', 20, 28, (ctx) =>
    drawPip(ctx, { bob: -1, armL: 'back', armR: 'forward', legL: 'left', legR: 'right' }),
  );
  makeTexture(scene, 'pip-jump', 20, 28, (ctx) =>
    drawPip(ctx, { bob: -1, armL: 'up', armR: 'up', legL: 'tuck', legR: 'tuck' }),
  );
  makeTexture(scene, 'pip-fall', 20, 28, (ctx) =>
    drawPip(ctx, { bob: 0, armL: 'out', armR: 'out', legL: 'spread', legR: 'spread' }),
  );
}

function drawEnemyTextures(scene: Phaser.Scene): void {
  const drawGrumble = (ctx: Ctx, frame: number): void => {
    const outline = '#2a1821';
    const shell = '#9c5a34';
    const shellLight = '#c57b47';
    const shellDark = '#6f3b25';
    const foot = '#633d2a';
    const footLight = '#9a6440';

    // Feet.
    const footShift = frame === 0 ? -1 : 1;
    px(ctx, 2 + footShift, 13, 5, 3, outline);
    px(ctx, 3 + footShift, 13, 3, 2, foot);
    px(ctx, 3 + footShift, 13, 2, 1, footLight);
    px(ctx, 10 - footShift, 13, 5, 3, outline);
    px(ctx, 11 - footShift, 13, 3, 2, foot);
    px(ctx, 11 - footShift, 13, 2, 1, footLight);

    // Little leaf sprout.
    px(ctx, 8, 0, 2, 2, '#3b7a4c');
    px(ctx, 10, 0, 3, 2, '#6fc28e');
    px(ctx, 12, 1, 1, 1, '#a8e5b8');

    // Main acorn body.
    ellipse(ctx, 8, 8, 7, 6, outline);
    ellipse(ctx, 8, 7, 6, 5, shell);
    ellipse(ctx, 7, 5, 4, 3, shellLight);
    px(ctx, 2, 9, 13, 3, shell);
    px(ctx, 2, 11, 12, 2, shellDark);
    px(ctx, 3, 3, 6, 1, shellLight);
    px(ctx, 5, 2, 3, 1, '#d99a60');

    // Face.
    px(ctx, 4, 6, 3, 3, '#fff2d0');
    px(ctx, 9, 6, 3, 3, '#fff2d0');
    px(ctx, 5, 7, 2, 2, outline);
    px(ctx, 9, 7, 2, 2, outline);
    px(ctx, 5, 7, 1, 1, '#fff6dc');
    px(ctx, 9, 7, 1, 1, '#fff6dc');
    // Angry brows, tilted inward.
    px(ctx, 4, 5, 3, 1, outline);
    px(ctx, 5, 4, 2, 1, outline);
    px(ctx, 9, 4, 2, 1, outline);
    px(ctx, 9, 5, 3, 1, outline);
    // Frown and fangs.
    px(ctx, 6, 10, 4, 1, outline);
    px(ctx, 6, 9, 1, 1, outline);
    px(ctx, 9, 9, 1, 1, outline);
    px(ctx, 5, 10, 1, 2, '#fff2d0');
    px(ctx, 10, 10, 1, 2, '#fff2d0');
    px(ctx, 7, 11, 2, 1, '#6f3b25');
  };

  makeTexture(scene, 'grumble-0', 16, 16, (ctx) => drawGrumble(ctx, 0));
  makeTexture(scene, 'grumble-1', 16, 16, (ctx) => drawGrumble(ctx, 1));
  makeTexture(scene, 'grumble-squash', 16, 8, (ctx) => {
    const outline = '#2a1821';
    ellipse(ctx, 8, 5, 7, 3, outline);
    ellipse(ctx, 8, 4, 6, 2, '#9c5a34');
    px(ctx, 2, 5, 12, 2, '#6f3b25');
    px(ctx, 5, 3, 1, 1, outline);
    px(ctx, 8, 3, 1, 1, outline);
    px(ctx, 11, 3, 1, 1, outline);
    px(ctx, 0, 7, 3, 1, '#2a1821');
    px(ctx, 13, 7, 3, 1, '#2a1821');
  });

  const drawFlutter = (ctx: Ctx, frame: number): void => {
    const outline = '#3b2143';
    const wing = '#f18bb1';
    const wingLight = '#ffbed4';
    const wingDark = '#b84f7c';
    const body = '#66407a';
    const bodyLight = '#9a72ad';

    // Antennae.
    px(ctx, 6, 2, 1, 3, outline);
    px(ctx, 9, 2, 1, 3, outline);
    px(ctx, 5, 1, 2, 1, outline);
    px(ctx, 9, 1, 2, 1, outline);
    px(ctx, 5, 2, 1, 1, '#ffd166');
    px(ctx, 10, 2, 1, 1, '#ffd166');

    // Wings: animate their height to give a fluttering silhouette.
    const up = frame === 0;
    px(ctx, 1, up ? 4 : 7, 6, up ? 7 : 4, outline);
    px(ctx, 2, up ? 5 : 8, 4, up ? 5 : 2, wing);
    px(ctx, 2, up ? 5 : 8, 3, 1, wingLight);
    px(ctx, 3, up ? 7 : 9, 1, 2, wingDark);

    px(ctx, 9, up ? 4 : 7, 6, up ? 7 : 4, outline);
    px(ctx, 10, up ? 5 : 8, 4, up ? 5 : 2, wing);
    px(ctx, 10, up ? 5 : 8, 3, 1, wingLight);
    px(ctx, 12, up ? 7 : 9, 1, 2, wingDark);

    // Body.
    ellipse(ctx, 8, 9, 3, 5, outline);
    ellipse(ctx, 8, 9, 2, 4, body);
    px(ctx, 7, 5, 3, 2, bodyLight);
    px(ctx, 6, 8, 1, 2, '#fff2d0');
    px(ctx, 9, 8, 1, 2, '#fff2d0');
    px(ctx, 6, 8, 1, 1, outline);
    px(ctx, 9, 8, 1, 1, outline);
    px(ctx, 7, 12, 2, 1, '#c98e52');
    px(ctx, 7, 13, 1, 1, '#8f5f33');
  };

  makeTexture(scene, 'flutter-0', 16, 16, (ctx) => drawFlutter(ctx, 0));
  makeTexture(scene, 'flutter-1', 16, 16, (ctx) => drawFlutter(ctx, 1));
  makeTexture(scene, 'flutter-squash', 16, 8, (ctx) => {
    ellipse(ctx, 8, 5, 6, 2.5, '#3b2143');
    ellipse(ctx, 8, 4, 5, 1.6, '#f18bb1');
    px(ctx, 3, 5, 4, 1, '#ffbed4');
    px(ctx, 9, 5, 4, 1, '#ffbed4');
    px(ctx, 6, 3, 1, 1, '#3b2143');
    px(ctx, 9, 3, 1, 1, '#3b2143');
  });
}

function drawShroom(scene: Phaser.Scene): void {
  makeTexture(scene, 'shroom', 16, 16, (ctx) => {
    const outline = '#4a2a1c';
    // Stem.
    px(ctx, 5, 8, 7, 7, outline);
    px(ctx, 6, 8, 5, 6, '#fff1d4');
    px(ctx, 10, 9, 1, 5, '#dcc39b');
    px(ctx, 6, 13, 4, 1, '#c7a87b');

    // Cap.
    ellipse(ctx, 8, 6, 7, 5, outline);
    ellipse(ctx, 8, 5, 6, 4, '#ffb703');
    ellipse(ctx, 7, 4, 4, 2, '#ffd166');
    px(ctx, 2, 6, 13, 2, '#e58f16');
    px(ctx, 4, 2, 2, 2, '#fff6dc');
    px(ctx, 10, 3, 2, 2, '#fff6dc');
    px(ctx, 12, 6, 2, 1, '#fff6dc');

    // Face.
    px(ctx, 6, 9, 1, 2, outline);
    px(ctx, 9, 9, 1, 2, outline);
    px(ctx, 7, 11, 2, 1, '#c2754d');
    px(ctx, 4, 15, 2, 1, '#4a2a1c');
    px(ctx, 10, 15, 2, 1, '#4a2a1c');
  });
}

function drawCastle(scene: Phaser.Scene): void {
  makeTexture(scene, 'castle', 96, 98, (ctx) => {
    const outline = '#2a2633';
    const stone = '#6e7d87';
    const stoneLight = '#96a5aa';
    const stoneDark = '#4b5963';
    const mortar = '#3c4b55';

    // Central keep.
    px(ctx, 28, 26, 40, 70, outline);
    px(ctx, 29, 27, 38, 69, stone);
    // Side towers.
    px(ctx, 6, 38, 22, 60, outline);
    px(ctx, 7, 39, 20, 58, stone);
    px(ctx, 68, 38, 22, 60, outline);
    px(ctx, 69, 39, 20, 58, stone);

    // Brick pattern.
    for (let row = 0; row < 16; row += 1) {
      const y = 28 + row * 4;
      px(ctx, 30, y, 36, 1, mortar);
    }
    for (let row = 0; row < 15; row += 1) {
      const y = 40 + row * 4;
      px(ctx, 8, y, 18, 1, mortar);
      px(ctx, 70, y, 18, 1, mortar);
    }
    px(ctx, 42, 28, 1, 68, mortar);
    px(ctx, 56, 28, 1, 68, mortar);
    px(ctx, 15, 40, 1, 56, mortar);
    px(ctx, 78, 40, 1, 56, mortar);

    // Highlights.
    px(ctx, 29, 27, 38, 1, stoneLight);
    px(ctx, 7, 39, 20, 1, stoneLight);
    px(ctx, 69, 39, 20, 1, stoneLight);
    px(ctx, 8, 40, 2, 56, stoneLight);
    px(ctx, 70, 40, 2, 56, stoneLight);
    px(ctx, 30, 28, 2, 66, stoneLight);
    px(ctx, 86, 40, 2, 56, stoneDark);

    // Battlements.
    const battlement = (x: number, y: number, width: number): void => {
      px(ctx, x, y, width, 6, outline);
      px(ctx, x + 1, y + 1, width - 2, 4, stone);
      px(ctx, x + 1, y + 1, width - 2, 1, stoneLight);
      for (let bx = x + 3; bx < x + width - 2; bx += 5) {
        px(ctx, bx, y - 5, 3, 6, outline);
        px(ctx, bx + 1, y - 4, 1, 4, stone);
        px(ctx, bx, y - 5, 1, 4, stoneLight);
      }
    };
    battlement(25, 20, 46);
    battlement(4, 32, 26);
    battlement(66, 32, 26);

    // Side turrets and roofs.
    px(ctx, 3, 22, 28, 4, outline);
    px(ctx, 4, 23, 26, 2, '#b74552');
    px(ctx, 12, 12, 10, 12, outline);
    px(ctx, 13, 13, 8, 10, stone);
    px(ctx, 15, 7, 4, 6, outline);
    px(ctx, 16, 8, 2, 4, '#ffd166');
    px(ctx, 65, 12, 10, 12, outline);
    px(ctx, 66, 13, 8, 10, stone);
    px(ctx, 77, 23, 16, 2, '#b74552');

    // Windows, warm and mysterious.
    const window = (x: number, y: number): void => {
      px(ctx, x, y, 7, 10, outline);
      px(ctx, x + 1, y + 1, 5, 8, '#ffcf70');
      px(ctx, x + 1, y + 1, 5, 1, '#fff1b8');
      px(ctx, x + 3, y + 1, 1, 8, '#b77c2f');
      px(ctx, x + 1, y + 5, 5, 1, '#b77c2f');
    };
    window(35, 42);
    window(55, 42);
    window(13, 50);
    window(76, 50);

    // Door.
    px(ctx, 38, 66, 20, 30, outline);
    px(ctx, 39, 67, 18, 29, '#46302e');
    px(ctx, 41, 67, 14, 4, '#46302e');
    px(ctx, 42, 64, 12, 3, '#46302e');
    px(ctx, 39, 67, 2, 29, '#6b4a3c');
    px(ctx, 41, 80, 4, 16, '#2a1c1d');
    px(ctx, 50, 80, 4, 16, '#2a1c1d');
    px(ctx, 47, 86, 2, 3, '#ffd166');
    px(ctx, 40, 93, 16, 3, '#25333b');
    px(ctx, 40, 93, 16, 1, '#7c8b8e');
    // Vines and moss.
    px(ctx, 29, 74, 2, 7, '#4c8c62');
    px(ctx, 61, 68, 2, 12, '#4c8c62');
    px(ctx, 23, 88, 3, 2, '#4c8c62');
    px(ctx, 86, 62, 2, 4, '#4c8c62');
  });
}

function drawFlagpole(scene: Phaser.Scene): void {
  makeTexture(scene, 'flagpole', 16, 164, (ctx) => {
    px(ctx, 6, 10, 5, 146, '#27343c');
    px(ctx, 7, 10, 2, 146, '#dce5e3');
    px(ctx, 9, 10, 1, 146, '#8b9b9d');
    ellipse(ctx, 8, 7, 6, 6, '#5c4a2a');
    ellipse(ctx, 8, 6, 5, 5, '#ffd166');
    ellipse(ctx, 7, 5, 3, 3, '#fff1b8');
    px(ctx, 2, 155, 13, 5, '#34454b');
    px(ctx, 3, 154, 11, 2, '#6f8283');
    px(ctx, 1, 159, 15, 3, '#25333a');
    px(ctx, 1, 159, 15, 1, '#516569');
  });

  makeTexture(scene, 'flag', 26, 18, (ctx) => {
    const outline = '#5e2434';
    px(ctx, 0, 1, 26, 16, outline);
    px(ctx, 1, 2, 24, 14, '#ef476f');
    px(ctx, 1, 2, 24, 2, '#ff7f96');
    px(ctx, 1, 14, 24, 2, '#a92c4b');
    // Swallow-tail on the right.
    px(ctx, 23, 2, 3, 14, '#0a1220');
    ctx.clearRect(23, 2, 3, 4);
    ctx.clearRect(23, 12, 3, 4);
    px(ctx, 20, 4, 3, 3, '#0a1220');
    ctx.clearRect(20, 4, 3, 3);
    px(ctx, 20, 11, 3, 3, '#0a1220');
    ctx.clearRect(20, 11, 3, 3);
    // Emblem.
    px(ctx, 9, 6, 6, 2, '#ffe8a3');
    px(ctx, 7, 7, 10, 2, '#ffe8a3');
    px(ctx, 8, 9, 8, 1, '#ffd166');
    px(ctx, 6, 10, 12, 1, '#ffd166');
    px(ctx, 10, 11, 4, 2, '#fff6dc');
    px(ctx, 11, 7, 2, 1, '#a92c4b');
    px(ctx, 9, 13, 2, 1, '#5e2434');
  });
}

export function createGameAnimations(scene: Phaser.Scene): void {
  if (!scene.anims.exists('coin-spin')) {
    scene.anims.create({
      key: 'coin-spin',
      frames: [
        { key: 'coin-0' },
        { key: 'coin-1' },
        { key: 'coin-2' },
        { key: 'coin-3' },
      ],
      frameRate: 9,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('question-shimmer')) {
    scene.anims.create({
      key: 'question-shimmer',
      frames: [{ key: 'q-0' }, { key: 'q-1' }, { key: 'q-2' }, { key: 'q-3' }],
      frameRate: 5,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('grumble-walk')) {
    scene.anims.create({
      key: 'grumble-walk',
      frames: [{ key: 'grumble-0' }, { key: 'grumble-1' }],
      frameRate: 7,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('flutter-fly')) {
    scene.anims.create({
      key: 'flutter-fly',
      frames: [{ key: 'flutter-0' }, { key: 'flutter-1' }],
      frameRate: 10,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('pip-run')) {
    scene.anims.create({
      key: 'pip-run',
      frames: [{ key: 'pip-run-0' }, { key: 'pip-run-1' }, { key: 'pip-run-2' }],
      frameRate: 10,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('pip-jump')) {
    scene.anims.create({
      key: 'pip-jump',
      frames: [{ key: 'pip-jump' }],
      frameRate: 1,
    });
  }
  if (!scene.anims.exists('pip-fall')) {
    scene.anims.create({
      key: 'pip-fall',
      frames: [{ key: 'pip-fall' }],
      frameRate: 1,
    });
  }
  if (!scene.anims.exists('pip-idle-blink')) {
    scene.anims.create({
      key: 'pip-idle-blink',
      frames: [
        { key: 'pip-idle', duration: 2400 },
        { key: 'pip-blink', duration: 130 },
        { key: 'pip-idle', duration: 2100 },
      ],
      repeat: -1,
    });
  }
}
