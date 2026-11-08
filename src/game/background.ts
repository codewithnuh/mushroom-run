import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from './constants';

export interface Backdrop {
  update(scrollX: number, time: number): void;
}

/**
 * A three-layer, pixel-cut paper backdrop. Layers are fixed to the camera and
 * their texture offsets are nudged to create gentle parallax.
 */
export function createBackdrop(scene: Phaser.Scene): Backdrop {
  scene.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky);

  const clouds = scene.add
    .tileSprite(0, 12, GAME_WIDTH, 110, 'clouds')
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(DEPTH.clouds);

  const far = scene.add
    .tileSprite(0, 108, GAME_WIDTH, 130, 'hills-far')
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(DEPTH.hillsFar);

  const near = scene.add
    .tileSprite(0, 130, GAME_WIDTH, 120, 'hills-near')
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(DEPTH.hillsNear);

  return {
    update(scrollX: number, time: number): void {
      clouds.tilePositionX = scrollX * 0.07 + time * 0.0016;
      far.tilePositionX = scrollX * 0.14;
      near.tilePositionX = scrollX * 0.28;
    },
  };
}

export function drawStageVignette(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud - 1);
  graphics.fillStyle(0x07101a, 0.12);
  graphics.fillRect(0, 0, GAME_WIDTH, 6);
  graphics.fillGradientStyle(0x07101a, 0x07101a, 0x07101a, 0x07101a, 0, 0, 0.22, 0.22);
  graphics.fillRect(0, 232, GAME_WIDTH, 38);
}
