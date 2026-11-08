import Phaser from 'phaser';
import { audio } from '../audio';
import { DEPTH, PLAYER } from '../constants';

export interface PlayerControls {
  left: boolean;
  right: boolean;
  run: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  isBig = false;
  invulnerable = false;
  controlsEnabled = true;

  private coyoteUntil = 0;
  private jumpBufferUntil = 0;
  private jumpCutReady = false;
  private wasOnGround = false;
  private lastFallSpeed = 0;
  private nextStepDust = 0;
  private invulnerabilityTimer: Phaser.Time.TimerEvent | null = null;
  private invulnerabilityTween: Phaser.Tweens.Tween | null = null;
  private scaleTween: Phaser.Tweens.Tween | null = null;
  private animationKey = '';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'pip-idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setDepth(DEPTH.player);
    this.setCollideWorldBounds(false);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 22);
    body.setOffset(5, 6);
    body.setMaxVelocity(200, 520);
    body.pushable = false;

    this.playAnimation('pip-idle-blink');
  }

  get isOnGround(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  tick(time: number, delta: number, controls: PlayerControls): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body || !body.enable) return;

    if (!this.controlsEnabled) {
      body.setAccelerationX(0);
      body.setDragX(PLAYER.drag);
      this.updateAnimation();
      this.wasOnGround = this.isOnGround;
      return;
    }

    const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const maxSpeed = controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const onGround = this.isOnGround;
    const acceleration = onGround ? PLAYER.acceleration : PLAYER.airAcceleration;

    if (direction !== 0) {
      if (onGround) {
        body.setDragX(0);
        // Turn sharply. This keeps the character feeling snappy.
        if (Math.sign(body.velocity.x) === -direction && Math.abs(body.velocity.x) > 25) {
          body.setAccelerationX(direction * acceleration * 2.1);
        } else {
          body.setAccelerationX(direction * acceleration);
        }
      } else {
        body.setDragX(0);
        body.setAccelerationX(direction * acceleration);
      }
      this.setFlipX(direction < 0);
    } else {
      body.setAccelerationX(0);
      body.setDragX(onGround ? PLAYER.drag : PLAYER.airDrag);
    }

    if (Math.abs(body.velocity.x) > maxSpeed && Math.sign(body.velocity.x) === direction) {
      body.setVelocityX(maxSpeed);
    }

    // Landing state and coyote time.
    if (onGround) {
      this.coyoteUntil = time + PLAYER.coyoteMs;
    }
    if (controls.jumpPressed) {
      this.jumpBufferUntil = time + PLAYER.jumpBufferMs;
    }

    const canJump = time < this.jumpBufferUntil && (onGround || time < this.coyoteUntil);
    if (canJump) {
      body.setVelocityY(-PLAYER.jumpSpeed);
      this.jumpBufferUntil = 0;
      this.coyoteUntil = 0;
      this.jumpCutReady = true;
      audio.play('jump');
      this.emit('jump', this.x, this.y - 18);
      this.scene.tweens.add({
        targets: this,
        scaleX: this.isBig ? 1.26 : 1.07,
        scaleY: this.isBig ? 1.07 : 0.92,
        duration: 90,
        yoyo: true,
        ease: 'Quad.out',
      });
    }

    // Releasing the button shortens the hop, but only once per jump.
    if (!controls.jumpHeld && this.jumpCutReady && body.velocity.y < -155) {
      body.setVelocityY(body.velocity.y * 0.72);
      this.jumpCutReady = false;
    }
    if (onGround) this.jumpCutReady = false;

    if (!onGround && body.velocity.y > 260 && this.lastFallSpeed <= 260) {
      this.playAnimation('pip-fall');
    }

    if (!this.wasOnGround && onGround) {
      this.emit('land', this.x, this.y, this.lastFallSpeed);
      if (this.lastFallSpeed > 180) {
        audio.play('land');
      }
    }

    if (onGround && direction !== 0) {
      if (time > this.nextStepDust) {
        this.nextStepDust = time + 150;
        this.emit('step', this.x - direction * 6, this.y);
      }
    }

    this.lastFallSpeed = body.velocity.y;
    this.wasOnGround = onGround;
    this.updateAnimation();
    void delta;
  }

  updateAnimation(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!this.controlsEnabled) {
      this.playAnimation(this.isOnGround ? 'pip-idle-blink' : 'pip-fall');
      return;
    }
    if (!this.isOnGround) {
      this.playAnimation(body.velocity.y < -30 ? 'pip-jump' : 'pip-fall');
      return;
    }
    if (Math.abs(body.velocity.x) > 12) {
      this.playAnimation('pip-run');
    } else {
      this.playAnimation('pip-idle-blink');
    }
  }

  private playAnimation(key: string): void {
    if (this.animationKey === key && this.anims.isPlaying) return;
    this.animationKey = key;
    this.play(key, true);
  }

  grow(): void {
    if (this.isBig) return;
    this.isBig = true;
    this.scaleTween?.stop();
    this.scaleTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 180,
      ease: 'Back.out',
    });
  }

  shrink(): void {
    if (!this.isBig) return;
    this.isBig = false;
    this.scaleTween?.stop();
    this.scaleTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Quad.out',
    });
  }

  bounce(strong = false): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(strong ? -PLAYER.stompBounce - 40 : -PLAYER.stompBounce);
    this.lastFallSpeed = body.velocity.y;
  }

  setInvulnerable(durationMs = 1500): void {
    this.invulnerable = true;
    this.invulnerabilityTimer?.remove(false);
    this.invulnerabilityTween?.stop();
    this.setAlpha(1);
    this.invulnerabilityTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.28,
      duration: 90,
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        this.setAlpha(1);
      },
    });
    this.invulnerabilityTimer = this.scene.time.delayedCall(durationMs, () => {
      this.invulnerable = false;
      this.setAlpha(1);
    });
  }

  freeze(): void {
    this.controlsEnabled = false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAccelerationX(0);
    body.setVelocity(0, 0);
    body.allowGravity = false;
    this.setAlpha(1);
    this.invulnerabilityTween?.stop();
    this.invulnerabilityTimer?.remove(false);
    this.invulnerable = true;
    this.playAnimation('pip-idle-blink');
  }

  /**
   * A cartoony death hop. The physics body is switched off so the scene can
   * restart on its own schedule without the player colliding with the world.
   */
  playDeathHop(): void {
    this.controlsEnabled = false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.allowGravity = false;
    body.enable = false;
    this.setAlpha(1);
    this.playAnimation('pip-jump');
    this.scene.tweens.add({
      targets: this,
      y: this.y - 34,
      duration: 260,
      ease: 'Quad.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          y: this.y + 360,
          duration: 900,
          ease: 'Quad.in',
        });
      },
    });
  }

  playClimbAnimation(): void {
    this.playAnimation('pip-jump');
  }

  playIdleAnimation(): void {
    this.playAnimation('pip-idle-blink');
  }

  playRunAnimation(): void {
    this.playAnimation('pip-run');
  }
}
