import Phaser from 'phaser';
import { DEPTH, GROUND_Y, TILE } from '../constants';
import type { LevelData, DecorKind } from './level';

export interface Checkpoint {
  x: number;
  sprite: Phaser.GameObjects.Image;
  activated: boolean;
}

export interface BuiltLevel {
  groundBodies: Phaser.Physics.Arcade.StaticGroup;
  pipeBodies: Phaser.Physics.Arcade.StaticGroup;
  solidBodies: Phaser.Physics.Arcade.StaticGroup;
  blockGroup: Phaser.Physics.Arcade.StaticGroup;
  coinGroup: Phaser.Physics.Arcade.Group;
  checkpoints: Checkpoint[];
  flagX: number;
  flagTop: number;
  flagCloth: Phaser.GameObjects.Image;
  castleX: number;
  worldWidth: number;
  worldHeight: number;
}

const DECOR_TEXTURES: Record<DecorKind, string> = {
  bush: 'bush',
  bushSmall: 'bush-small',
  flower: 'flower',
  tuft: 'tuft',
  rock: 'rock',
};

const DECOR_DEPTHS: Record<DecorKind, number> = {
  bush: 2,
  bushSmall: 2,
  flower: 4,
  tuft: 4,
  rock: 1,
};

export class LevelBuilder {
  private readonly scene: Phaser.Scene;
  private readonly level: LevelData;
  private readonly groundBodies: Phaser.Physics.Arcade.StaticGroup;
  private readonly pipeBodies: Phaser.Physics.Arcade.StaticGroup;
  private readonly solidBodies: Phaser.Physics.Arcade.StaticGroup;
  private readonly blockGroup: Phaser.Physics.Arcade.StaticGroup;
  private readonly coinGroup: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, level: LevelData) {
    this.scene = scene;
    this.level = level;
    this.groundBodies = scene.physics.add.staticGroup();
    this.pipeBodies = scene.physics.add.staticGroup();
    this.solidBodies = scene.physics.add.staticGroup();
    this.blockGroup = scene.physics.add.staticGroup();
    this.coinGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
  }

  build(): BuiltLevel {
    this.buildGround();
    this.buildPipes();
    this.buildSolids();
    this.buildBlocks();
    this.buildCoins();
    this.buildDecor();
    const { checkpoints, flagCloth, flagTop, flagX, castleX } = this.buildLandmarks();

    return {
      groundBodies: this.groundBodies,
      pipeBodies: this.pipeBodies,
      solidBodies: this.solidBodies,
      blockGroup: this.blockGroup,
      coinGroup: this.coinGroup,
      checkpoints,
      flagX,
      flagTop,
      flagCloth,
      castleX,
      worldWidth: this.level.widthTiles * TILE,
      worldHeight: 17 * TILE,
    };
  }

  private buildGround(): void {
    // A dark chasm floor sits behind the terrain so pits read as drops, not
    // as a pale strip of sky at the bottom of the screen.
    this.scene.add
      .tileSprite(0, GROUND_Y, this.level.widthTiles * TILE, TILE * 2, 'pit-fill')
      .setOrigin(0, 0)
      .setDepth(1);

    this.level.ground.forEach(([start, end], segmentIndex) => {
      const width = (end - start + 1) * TILE;
      const left = start * TILE;
      const centerX = left + width / 2;

      // Rich top row, with four deterministic grass variants.
      for (let x = start; x <= end; x += 1) {
        const variant = (x * 5 + segmentIndex * 3) % 4;
        this.scene.add
          .image(x * TILE + TILE / 2, GROUND_Y + TILE / 2, `ground-top-${variant}`)
          .setDepth(3);
      }

      // Deeper soil, tiled so it stays seamless.
      this.scene.add
        .tileSprite(left, GROUND_Y + TILE, width, TILE, 'ground-fill')
        .setOrigin(0, 0)
        .setDepth(2);

      const collider = this.groundBodies.create(centerX, GROUND_Y + TILE, 'blank') as Phaser.Physics.Arcade.Sprite;
      collider.setVisible(false).setDisplaySize(width, TILE * 2).refreshBody();

      // A few deterministic grass tufts to soften the edges.
      for (let x = start + 3; x <= end - 1; x += 9) {
        this.scene.add
          .image(x * TILE, GROUND_Y, 'tuft')
          .setOrigin(0.5, 1)
          .setDepth(4)
          .setAlpha(0.9);
      }
    });
  }

  private buildPipes(): void {
    this.level.pipes.forEach((pipe) => {
      const left = pipe.x * TILE;
      const topY = GROUND_Y - pipe.height * TILE;

      for (let index = 1; index < pipe.height; index += 1) {
        this.scene.add
          .image(left + TILE, topY + index * TILE + TILE / 2, 'pipe-body')
          .setDepth(DEPTH.pipes);
      }
      this.scene.add.image(left + TILE, topY + TILE / 2, 'pipe-top').setDepth(DEPTH.pipes + 1);

      const collider = this.pipeBodies.create(
        left + TILE,
        GROUND_Y - (pipe.height * TILE) / 2,
        'blank',
      ) as Phaser.Physics.Arcade.Sprite;
      collider.setVisible(false).setDisplaySize(TILE * 2, pipe.height * TILE).refreshBody();
    });
  }

  private buildSolids(): void {
    this.level.solids.forEach((solid) => {
      const block = this.solidBodies.create(
        solid.x * TILE + TILE / 2,
        solid.row * TILE + TILE / 2,
        'stone',
      ) as Phaser.Physics.Arcade.Sprite;
      block.setDepth(DEPTH.blocks - 1);
    });
  }

  private buildBlocks(): void {
    this.level.blocks.forEach((block) => {
      const texture = block.kind === 'brick' ? 'brick' : 'q-0';
      const sprite = this.blockGroup.create(
        block.x * TILE + TILE / 2,
        block.row * TILE + TILE / 2,
        texture,
      ) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(DEPTH.blocks);
      sprite.setData('kind', block.kind);
      sprite.setData('used', false);
      if (block.kind !== 'brick') {
        sprite.play('question-shimmer');
      }
    });
  }

  private buildCoins(): void {
    this.level.coins.forEach((coin) => {
      const sprite = this.coinGroup.create(
        coin.x * TILE + TILE / 2,
        coin.row * TILE + TILE / 2,
        'coin-0',
      ) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(DEPTH.coins);
      sprite.setScale(1);
      sprite.play('coin-spin');
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setSize(8, 12);
      body.setOffset(2, 1);
    });
  }

  private buildDecor(): void {
    this.level.decor.forEach((decor) => {
      const texture = DECOR_TEXTURES[decor.kind];
      const image = this.scene.add
        .image(decor.x * TILE, GROUND_Y + 1, texture)
        .setOrigin(0.5, 1)
        .setDepth(DECOR_DEPTHS[decor.kind]);
      if (decor.flip) image.setFlipX(true);
    });

    // A wooden trail sign nudges first-time players to the right.
    this.scene.add.image(6 * TILE, GROUND_Y + 1, 'sign').setOrigin(0.5, 1).setDepth(4);
  }

  private buildLandmarks(): {
    checkpoints: Checkpoint[];
    flagX: number;
    flagTop: number;
    flagCloth: Phaser.GameObjects.Image;
    castleX: number;
  } {
    const checkpoints: Checkpoint[] = this.level.checkpoints.map((tileX) => {
      const x = tileX * TILE + TILE / 2;
      const sprite = this.scene.add
        .image(x, GROUND_Y, 'checkpoint-off')
        .setOrigin(0.5, 1)
        .setDepth(4);
      return { x, sprite, activated: false };
    });

    const flagX = this.level.flagX * TILE + TILE / 2;
    const flagTop = GROUND_Y - 164;
    this.scene.add.image(flagX, GROUND_Y, 'flagpole').setOrigin(0.5, 1).setDepth(DEPTH.flag);
    const flagCloth = this.scene.add
      .image(flagX + 7, flagTop + 22, 'flag')
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.flag + 1);

    const castleX = this.level.castleX * TILE + TILE / 2;
    this.scene.add.image(castleX, GROUND_Y, 'castle').setOrigin(0.5, 1).setDepth(4);

    return { checkpoints, flagCloth, flagTop, flagX, castleX };
  }
}
