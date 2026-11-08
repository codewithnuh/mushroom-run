export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const TILE = 16;
export const WORLD_ROWS = 17;
export const GROUND_ROW = 15;
export const GROUND_Y = GROUND_ROW * TILE; // 240
export const WORLD_HEIGHT = WORLD_ROWS * TILE; // 272

export const PIXEL_FONT = '"Press Start 2P", ui-monospace, monospace';

export const DEPTH = {
  sky: -50,
  clouds: -40,
  hillsFar: -35,
  hillsNear: -30,
  worldDecorBack: 1,
  worldDecor: 2,
  coins: 5,
  blocks: 6,
  pipes: 7,
  enemies: 8,
  powerups: 9,
  player: 10,
  worldDecorFront: 12,
  fx: 20,
  flag: 18,
  castle: 4,
  hud: 100,
  overlay: 200,
} as const;

export const COLORS = {
  cream: 0xfff6dc,
  creamText: '#fff6dc',
  gold: 0xffd166,
  goldText: '#ffd166',
  coral: 0xef476f,
  coralText: '#ef476f',
  teal: 0x2ec4b6,
  tealText: '#2ec4b6',
  ink: 0x0b1320,
  inkText: '#0b1320',
  white: 0xffffff,
} as const;

export const STORAGE = {
  highScore: 'mushroom-run:high-score',
  muted: 'mushroom-run:muted',
} as const;

export const REGISTRY = {
  lives: 'lives',
  score: 'score',
  coins: 'coins',
  checkpoint: 'checkpoint',
  powered: 'powered',
  highScore: 'highScore',
} as const;

export const START_LIVES = 3;
export const LEVEL_TIME = 320;
export const COINS_PER_LIFE = 50;

export const PLAYER = {
  walkSpeed: 112,
  runSpeed: 168,
  acceleration: 1200,
  airAcceleration: 720,
  drag: 1500,
  airDrag: 280,
  jumpSpeed: 382,
  gravity: 1000,
  coyoteMs: 105,
  jumpBufferMs: 135,
  stompBounce: 255,
} as const;
