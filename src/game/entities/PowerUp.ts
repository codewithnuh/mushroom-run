import Phaser from 'phaser';
import { DEPTH, WORLD_HEIGHT } from '../constants';

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  collected = false;
  private direction: 1 | -1 = 1;
  private started = false;

  constructor(scene: Phaser.Scene, x: number, topY: number) {
    super(scene, x, topY, 'shroom');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(DEPTH.powerups);
    this.setScale(0.35);
    this.setAlpha(0);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12);
    body.setOffset(2, 4);
    body.setAllowGravity(false);
    body.enable = false;
    body.pushable = false;

    scene.tweens.add({
      targets: this,
      y: topY - 10,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 380,
      ease: 'Back.out',
      onComplete: () => this.activate(),
    });
  }

  private activate(): void {
    if (this.started || this.collected) return;
    this.started = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(true);
    body.setVelocity(this.direction * 42, -40);
  }

  tick(): void {
    if (!this.started || this.collected) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body?.enable) return;
    if (body.blocked.left) {
      this.direction = 1;
    } else if (body.blocked.right) {
      this.direction = -1;
    }
    body.setVelocityX(this.direction * 42);
    if (this.y > WORLD_HEIGHT + 60) {
      this.destroy();
    }
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.scene.tweens.add({
      targets: this,
      y: this.y - 16,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: 240,
      ease: 'Quad.out',
      onComplete: () => this.destroy(),
    });
  }
}
