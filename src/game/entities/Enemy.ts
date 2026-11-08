import Phaser from 'phaser';
import { DEPTH, GROUND_Y, WORLD_HEIGHT } from '../constants';
import type { EnemyKind } from '../level/level';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  dead = false;

  private direction: 1 | -1 = -1;
  private readonly speed: number;
  private readonly baseX: number;
  private readonly baseY: number;
  private readonly range: number;
  private flightPhase = 0;

  constructor(scene: Phaser.Scene, x: number, kind: EnemyKind, row?: number, range = 28) {
    const isFlutter = kind === 'flutter';
    super(scene, x, isFlutter ? (row ?? 10) * 16 + 8 : GROUND_Y, isFlutter ? 'flutter-0' : 'grumble-0');
    this.kind = kind;
    this.speed = isFlutter ? 32 : 27;
    this.baseX = x;
    this.baseY = isFlutter ? (row ?? 10) * 16 + 8 : GROUND_Y;
    this.range = range;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.enemies);
    this.setCollideWorldBounds(false);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.pushable = false;

    if (isFlutter) {
      this.setOrigin(0.5, 0.5);
      body.setSize(10, 10);
      body.setOffset(3, 3);
      body.setAllowGravity(false);
      body.setImmovable(true);
      this.play('flutter-fly');
      this.setFlipX(true);
    } else {
      this.setOrigin(0.5, 1);
      body.setSize(12, 12);
      body.setOffset(2, 4);
      this.play('grumble-walk');
      this.setVelocityX(this.direction * this.speed);
    }
  }

  tick(time: number, delta: number): void {
    if (this.dead) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body?.enable) return;

    if (this.kind === 'flutter') {
      this.flightPhase += delta * 0.004;
      const targetY = this.baseY + Math.sin(this.flightPhase + this.baseX * 0.01) * 13;
      body.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 6, -46, 46));

      if (this.x <= this.baseX - this.range) {
        this.direction = 1;
        this.setFlipX(false);
      } else if (this.x >= this.baseX + this.range) {
        this.direction = -1;
        this.setFlipX(true);
      }
      body.setVelocityX(this.direction * this.speed);
    } else {
      if (body.blocked.left) {
        this.direction = 1;
      } else if (body.blocked.right) {
        this.direction = -1;
      }
      if (Math.abs(body.velocity.x) < 2) {
        this.direction = this.direction === 1 ? -1 : 1;
      }
      body.setVelocityX(this.direction * this.speed);
      this.setFlipX(this.direction === 1);
    }

    if (this.y > WORLD_HEIGHT + 80) {
      this.destroy();
    }
    void time;
  }

  stomp(): void {
    if (this.dead) return;
    this.dead = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
    this.setTexture(this.kind === 'flutter' ? 'flutter-squash' : 'grumble-squash');
    this.setDepth(DEPTH.fx);
    this.setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      delay: 280,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }

  killSilently(): void {
    this.dead = true;
    this.destroy();
  }
}
