export type BlockKind = 'brick' | 'coin' | 'power';

export type EnemyKind = 'grumble' | 'flutter';

export type DecorKind = 'bush' | 'bushSmall' | 'flower' | 'tuft' | 'rock';

export interface BlockSpec {
  x: number;
  row: number;
  kind: BlockKind;
}

export interface SolidSpec {
  x: number;
  row: number;
}

export interface PipeSpec {
  x: number;
  height: number;
}

export interface EnemySpec {
  x: number;
  kind: EnemyKind;
  /** For flutter enemies: the row they orbit around. */
  row?: number;
  range?: number;
}

export interface CoinSpec {
  x: number;
  row: number;
}

export interface DecorSpec {
  x: number;
  row: number;
  kind: DecorKind;
  flip?: boolean;
}

export interface LevelData {
  name: string;
  widthTiles: number;
  ground: Array<[start: number, end: number]>;
  blocks: BlockSpec[];
  solids: SolidSpec[];
  pipes: PipeSpec[];
  enemies: EnemySpec[];
  coins: CoinSpec[];
  decor: DecorSpec[];
  checkpoints: number[];
  flagX: number;
  castleX: number;
  spawnX: number;
}

function createLevel(): LevelData {
  const widthTiles = 218;
  const blocks: BlockSpec[] = [];
  const solids: SolidSpec[] = [];
  const pipes: PipeSpec[] = [];
  const enemies: EnemySpec[] = [];
  const coins: CoinSpec[] = [];
  const decor: DecorSpec[] = [];

  const block = (x: number, row: number, kind: BlockKind): void => {
    blocks.push({ x, row, kind });
  };
  const pipe = (x: number, height: number): void => {
    pipes.push({ x, height });
  };
  const coin = (x: number, row: number): void => {
    coins.push({ x, row });
  };
  const coinLine = (from: number, to: number, row: number): void => {
    for (let x = from; x <= to; x += 1) coin(x, row);
  };
  const coinArc = (center: number, lowRow: number, highRow: number): void => {
    coin(center - 2, lowRow);
    coin(center - 1, highRow);
    coin(center, highRow - 1);
    coin(center + 1, highRow);
    coin(center + 2, lowRow);
  };
  const enemy = (x: number, kind: EnemyKind = 'grumble', row?: number, range?: number): void => {
    enemies.push({ x, kind, row, range });
  };
  const bush = (x: number, kind: DecorKind = 'bush', flip = false): void => {
    decor.push({ x, row: 14, kind, flip });
  };
  const flower = (x: number, row = 14): void => {
    decor.push({ x, row, kind: 'flower' });
  };
  const tuft = (x: number, row = 14): void => {
    decor.push({ x, row, kind: 'tuft' });
  };

  // --- Opening meadow ------------------------------------------------------
  coinLine(12, 14, 11);

  block(16, 9, 'coin');

  // The classic question-row, but with a friendly power-up tucked inside.
  block(20, 9, 'brick');
  block(21, 9, 'power');
  block(22, 9, 'brick');
  block(23, 9, 'coin');
  block(24, 9, 'brick');

  // A low ledge to hop onto.
  block(28, 11, 'brick');
  block(29, 11, 'brick');
  block(30, 11, 'brick');
  coin(28, 10);
  coin(29, 10);
  coin(30, 10);

  block(32, 9, 'coin');

  pipe(38, 2);
  pipe(45, 3);

  coinLine(34, 36, 11);
  coinLine(42, 44, 10);

  enemy(26);
  enemy(35);
  enemy(43);

  bush(6);
  bush(12, 'bushSmall');
  bush(18);
  bush(31, 'bushSmall');
  bush(40);
  bush(47);
  flower(8);
  flower(14);
  flower(27);
  flower(36);
  tuft(4);
  tuft(11);
  tuft(22);
  tuft(33);
  tuft(48);

  // --- The first leap -----------------------------------------------------
  coinArc(51, 12, 9);
  bush(62);
  flower(56);

  // --- Brick hollow -------------------------------------------------------
  block(56, 9, 'coin');
  block(57, 9, 'brick');

  block(60, 11, 'brick');
  block(61, 11, 'brick');
  block(62, 11, 'brick');
  block(63, 11, 'brick');
  block(61, 9, 'coin');
  coinLine(60, 63, 10);

  pipe(65, 2);

  block(70, 9, 'brick');
  block(71, 9, 'coin');
  block(72, 9, 'brick');

  enemy(55);
  enemy(63);
  enemy(69);
  enemy(73);
  enemy(71, 'flutter', 10, 26);

  coin(75, 11);
  tuft(58);
  flower(68);
  bush(74, 'bushSmall');

  // --- The second leap ----------------------------------------------------
  coinArc(79, 12, 9);

  // --- Fern ledge ---------------------------------------------------------
  block(84, 11, 'brick');
  block(85, 11, 'brick');
  block(86, 11, 'brick');
  coinLine(84, 86, 10);

  enemy(89);
  bush(91, 'bushSmall');
  flower(87);
  tuft(83);

  // Checkpoint one.
  const checkpointOne = 93;

  pipe(98, 3);

  block(103, 9, 'brick');
  block(104, 9, 'coin');
  block(105, 9, 'brick');
  block(106, 9, 'power');
  block(107, 9, 'brick');
  coinLine(103, 107, 10);

  block(112, 11, 'brick');
  block(113, 11, 'brick');
  block(114, 11, 'brick');
  coinLine(112, 114, 10);

  enemy(101);
  enemy(108);
  enemy(112);
  enemy(116, 'flutter', 10, 32);

  bush(105);
  bush(117, 'bushSmall');
  flower(109);
  tuft(99);
  tuft(115);

  block(118, 9, 'brick');
  block(119, 9, 'brick');
  block(120, 9, 'coin');
  block(121, 9, 'brick');

  pipe(125, 2);

  block(130, 9, 'brick');
  block(131, 9, 'coin');
  block(132, 9, 'brick');

  enemy(123);
  enemy(128);
  enemy(131);

  bush(133, 'bushSmall');
  flower(126);
  tuft(135);

  block(136, 11, 'brick');
  block(137, 11, 'brick');
  block(138, 11, 'brick');
  block(139, 11, 'brick');
  block(138, 9, 'coin');
  coinLine(136, 139, 10);

  enemy(142);
  enemy(137, 'flutter', 9, 28);
  bush(143);

  // --- The third leap -----------------------------------------------------
  coinArc(146, 12, 9);

  // Checkpoint two.
  const checkpointTwo = 152;

  block(154, 9, 'brick');
  block(155, 9, 'coin');
  block(156, 9, 'brick');

  enemy(158);
  flower(159);

  block(160, 11, 'brick');
  block(161, 11, 'brick');
  block(162, 11, 'brick');
  coinLine(160, 162, 10);

  enemy(163, 'flutter', 9, 34);
  bush(157, 'bushSmall');
  tuft(149);

  pipe(165, 3);

  enemy(168);
  enemy(174);

  block(170, 11, 'brick');
  block(171, 11, 'brick');
  block(172, 11, 'brick');
  block(173, 11, 'brick');
  coinLine(170, 173, 10);

  flower(177);
  bush(178);

  block(178, 9, 'brick');
  block(179, 9, 'power');
  block(180, 9, 'brick');
  coin(179, 10);

  enemy(181);
  enemy(185);
  enemy(189, 'flutter', 9, 30);

  tuft(182);
  flower(186);
  bush(184, 'bushSmall');

  // --- Stairway to the finish --------------------------------------------
  const stairHeights = [1, 2, 3, 4, 4, 3, 2, 1];
  stairHeights.forEach((height, index) => {
    const x = 188 + index;
    for (let i = 0; i < height; i += 1) {
      solids.push({ x, row: 14 - i });
    }
  });

  enemy(196);
  coinLine(197, 199, 10);
  flower(199);
  tuft(186);

  return {
    name: 'Mushroom Meadow',
    widthTiles,
    ground: [
      [0, 49],
      [53, 77],
      [81, 144],
      [148, 217],
    ],
    blocks,
    solids,
    pipes,
    enemies,
    coins,
    decor,
    checkpoints: [checkpointOne, checkpointTwo],
    flagX: 202,
    castleX: 210,
    spawnX: 10,
  };
}

export const LEVEL = createLevel();
