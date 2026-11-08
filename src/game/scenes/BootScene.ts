import Phaser from 'phaser';
import { createGameAnimations, createGameTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createGameTextures(this);
    createGameAnimations(this);
    this.scene.start('Title');
  }
}
