import Phaser from 'phaser';
import { audio } from '../audio';
import { createBackdrop, type Backdrop } from '../background';
import {
  COINS_PER_LIFE,
  COLORS,
  DEPTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  LEVEL_TIME,
  PIXEL_FONT,
  REGISTRY,
  START_LIVES,
  STORAGE,
  TILE,
  WORLD_HEIGHT,
} from '../constants';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { PowerUp } from '../entities/PowerUp';
import { LEVEL } from '../level/level';
import { LevelBuilder, type BuiltLevel } from '../level/LevelBuilder';
import { consumeTouchJump, resetTouch, touchInput } from '../../ui';

interface GameSceneData {
  intro?: boolean;
  spawnTile?: number;
  fromDeath?: boolean;
}

interface ControlKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
}

type GameState = 'intro' | 'playing' | 'paused' | 'dying' | 'won' | 'gameover' | 'complete';

function readStoredBest(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE.highScore) ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function pad(value: number, size: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(size, '0');
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private built!: BuiltLevel;
  private backdrop!: Backdrop;
  private grumbleGroup!: Phaser.Physics.Arcade.Group;
  private flutterGroup!: Phaser.Physics.Arcade.Group;
  private powerUpGroup!: Phaser.Physics.Arcade.Group;
  private grumbles: Enemy[] = [];
  private flutters: Enemy[] = [];
  private keys!: ControlKeys;

  private hudScore!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private hudCoins!: Phaser.GameObjects.Text;
  private hudTime!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastTween: Phaser.Tweens.Tween | null = null;

  private state: GameState = 'playing';
  private stateBeforePause: 'intro' | 'playing' = 'playing';
  private paused = false;
  private overlayReady = false;
  private pauseScreen: Phaser.GameObjects.Container | null = null;
  private fromDeath = false;

  private score = 0;
  private coins = 0;
  private lives = START_LIVES;
  private combo = 0;
  private timeLeft = LEVEL_TIME;
  private savedCheckpoint = 0;
  private subtotalScore = 0;
  private lastTimeBonus = 0;
  private lastFlagBonus = 0;

  private flagX = 0;
  private flagTop = 0;
  private castleX = 0;
  private flagCloth!: Phaser.GameObjects.Image;

  private readonly onPauseRequest = (): void => {
    this.togglePause();
  };

  private readonly onOverlayEnter = (): void => {
    if (this.overlayReady && (this.state === 'gameover' || this.state === 'complete')) {
      this.overlayReady = false;
      this.returnToTitle();
    }
  };

  constructor() {
    super('Game');
  }

  create(data: GameSceneData = {}): void {
    this.resetSession();
    this.fromDeath = Boolean(data.fromDeath);

    document.body.classList.add('is-playing');
    document.body.classList.remove('is-paused');
    document.body.classList.remove('is-controls-ready');
    window.dispatchEvent(new CustomEvent('game:playing', { detail: true }));
    window.dispatchEvent(new CustomEvent('game:paused', { detail: false }));
    resetTouch();

    this.backdrop = createBackdrop(this);

    this.score = Number(this.registry.get(REGISTRY.score) ?? 0);
    this.coins = Number(this.registry.get(REGISTRY.coins) ?? 0);
    this.lives = Number(this.registry.get(REGISTRY.lives) ?? START_LIVES);
    this.savedCheckpoint = Number(this.registry.get(REGISTRY.checkpoint) ?? 0);

    const builder = new LevelBuilder(this, LEVEL);
    this.built = builder.build();
    this.flagX = this.built.flagX;
    this.flagTop = this.built.flagTop;
    this.castleX = this.built.castleX;
    this.flagCloth = this.built.flagCloth;

    this.physics.world.setBounds(0, 0, this.built.worldWidth, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.built.worldWidth, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor('#8edcf7');
    this.cameras.main.setRoundPixels(true);

    const spawnTile = data.spawnTile ?? LEVEL.spawnX;
    const spawnX = this.savedCheckpoint > 0 ? this.savedCheckpoint + TILE : spawnTile * TILE + TILE / 2;

    this.player = new Player(this, spawnX, GROUND_Y - 1);
    this.cameras.main.setScroll(
      Phaser.Math.Clamp(spawnX - GAME_WIDTH * 0.34, 0, this.built.worldWidth - GAME_WIDTH),
      0,
    );
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(84, GAME_HEIGHT);

    this.grumbleGroup = this.physics.add.group();
    this.flutterGroup = this.physics.add.group();
    this.powerUpGroup = this.physics.add.group();

    LEVEL.enemies.forEach((spec) => {
      const x = spec.x * TILE + TILE / 2;
      if (spec.kind === 'flutter') {
        const enemy = new Enemy(this, x, 'flutter', spec.row ?? 10, spec.range ?? 28);
        this.flutterGroup.add(enemy);
        this.flutters.push(enemy);
      } else {
        const enemy = new Enemy(this, x, 'grumble');
        this.grumbleGroup.add(enemy);
        this.grumbles.push(enemy);
      }
    });

    this.setupCollisions();
    this.setupInput();
    this.createHud();
    this.prepareCheckpoints();

    this.player.on('jump', this.onPlayerJump, this);
    this.player.on('land', this.onPlayerLand, this);
    this.player.on('step', this.onPlayerStep, this);

    window.addEventListener('game:pause-toggle', this.onPauseRequest);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard?.on('keydown-ENTER', this.onOverlayEnter, this);

    this.cameras.main.fadeIn(260, 8, 14, 24);

    const showIntro = Boolean(data.intro);
    if (showIntro) {
      this.player.controlsEnabled = false;
      this.state = 'intro';
      this.showIntroOverlay();
    } else {
      this.state = 'playing';
      this.player.controlsEnabled = true;
      document.body.classList.add('is-controls-ready');
      if (this.fromDeath) {
        this.player.setInvulnerable(2000);
        this.time.delayedCall(280, () => {
          this.showToast(this.savedCheckpoint > 0 ? 'CHECKPOINT REACHED' : 'TRY AGAIN!', COLORS.goldText);
        });
      }
    }

    this.updateHud();
  }

  update(time: number, delta: number): void {
    if (this.state === 'paused') return;

    this.backdrop.update(this.cameras.main.scrollX, time);

    if (this.state === 'gameover' || this.state === 'complete') {
      this.updateHud();
      return;
    }

    if (this.state === 'dying' || this.state === 'won') {
      this.updateHud();
      return;
    }

    const controls = this.readControls();
    this.player.tick(time, delta, controls);

    if (this.state === 'intro') {
      this.updateHud();
      return;
    }

    if (this.state === 'playing') {
      this.grumbles.forEach((enemy) => {
        if (enemy.active) enemy.tick(time, delta);
      });
      this.flutters.forEach((enemy) => {
        if (enemy.active) enemy.tick(time, delta);
      });
      this.powerUpGroup.getChildren().forEach((child) => {
        if (child.active) (child as PowerUp).tick();
      });

      this.updateTime(delta);
      this.updateCheckpoints();

      if (this.player.y > WORLD_HEIGHT + 24) {
        this.killPlayer();
      }
    }

    this.updateHud();
  }

  private resetSession(): void {
    this.grumbles = [];
    this.flutters = [];
    this.combo = 0;
    this.timeLeft = LEVEL_TIME;
    this.savedCheckpoint = 0;
    this.subtotalScore = 0;
    this.lastTimeBonus = 0;
    this.lastFlagBonus = 0;
    this.state = 'playing';
    this.stateBeforePause = 'playing';
    this.paused = false;
    this.overlayReady = false;
    this.pauseScreen = null;
    this.toastTween = null;
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.player, this.built.groundBodies);
    this.physics.add.collider(this.player, this.built.pipeBodies);
    this.physics.add.collider(this.player, this.built.solidBodies);
    this.physics.add.collider(this.player, this.built.blockGroup, (_playerObject, blockObject) => {
      const block = blockObject as Phaser.Physics.Arcade.Sprite;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (this.state !== 'playing') return;
      if (!(body.blocked.up || body.touching.up)) return;
      this.bumpBlock(block);
    });

    this.physics.add.collider(this.grumbleGroup, this.built.groundBodies);
    this.physics.add.collider(this.grumbleGroup, this.built.pipeBodies);
    this.physics.add.collider(this.grumbleGroup, this.built.solidBodies);
    this.physics.add.collider(this.grumbleGroup, this.built.blockGroup);
    this.physics.add.collider(this.grumbleGroup, this.grumbleGroup);

    this.physics.add.collider(this.powerUpGroup, this.built.groundBodies);
    this.physics.add.collider(this.powerUpGroup, this.built.pipeBodies);
    this.physics.add.collider(this.powerUpGroup, this.built.solidBodies);
    this.physics.add.collider(this.powerUpGroup, this.built.blockGroup);

    this.physics.add.overlap(this.player, this.built.coinGroup, (_playerObject, coinObject) => {
      const coin = coinObject as Phaser.Physics.Arcade.Sprite;
      if (!coin.active || this.state !== 'playing') return;
      this.collectCoin(coin);
    });

    this.physics.add.overlap(this.player, this.powerUpGroup, (_playerObject, powerUpObject) => {
      const powerUp = powerUpObject as PowerUp;
      if (!powerUp.active || powerUp.collected || this.state !== 'playing') return;
      this.collectPowerUp(powerUp);
    });

    this.physics.add.collider(this.player, this.grumbleGroup, (_playerObject, enemyObject) => {
      if (this.state !== 'playing') return;
      this.handleEnemyContact(enemyObject as Enemy, false);
    });

    this.physics.add.overlap(this.player, this.flutterGroup, (_playerObject, enemyObject) => {
      if (this.state !== 'playing') return;
      this.handleEnemyContact(enemyObject as Enemy, true);
    });

    const flagZone = this.add.zone(this.flagX, GROUND_Y - 80, 28, 160);
    this.physics.add.existing(flagZone, true);
    this.physics.add.overlap(this.player, flagZone, () => {
      if (this.state === 'playing') this.finishLevel();
    });
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required');
    this.keys = keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    }) as unknown as ControlKeys;
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    ]);
  }

  private readControls(): {
    left: boolean;
    right: boolean;
    run: boolean;
    jumpPressed: boolean;
    jumpHeld: boolean;
  } {
    const keyboard = this.keys;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(keyboard.space) ||
      Phaser.Input.Keyboard.JustDown(keyboard.up) ||
      Phaser.Input.Keyboard.JustDown(keyboard.w) ||
      consumeTouchJump();
    const jumpHeld =
      keyboard.space.isDown || keyboard.up.isDown || keyboard.w.isDown || touchInput.jumpHeld;
    return {
      left: keyboard.left.isDown || keyboard.a.isDown || touchInput.left,
      right: keyboard.right.isDown || keyboard.d.isDown || touchInput.right,
      run: keyboard.shift.isDown || touchInput.run,
      jumpPressed,
      jumpHeld,
    };
  }

  private createHud(): void {
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: PIXEL_FONT,
      fontSize: '5px',
      color: '#a8babd',
    };
    const valueStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: PIXEL_FONT,
      fontSize: '8px',
      color: '#fff6dc',
    };

    this.add
      .rectangle(0, 0, GAME_WIDTH, 34, 0x06101a, 0.44)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);
    this.add
      .rectangle(0, 33, GAME_WIDTH, 1, 0xffffff, 0.09)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    const makeLabel = (x: number, y: number, text: string, right = false): Phaser.GameObjects.Text =>
      this.add
        .text(x, y, text, labelStyle)
        .setOrigin(right ? 1 : 0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1);

    const makeValue = (x: number, y: number, text: string, right = false): Phaser.GameObjects.Text =>
      this.add
        .text(x, y, text, valueStyle)
        .setOrigin(right ? 1 : 0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1)
        .setShadow(1, 1, '#07101a', 0, true, true);

    makeLabel(14, 5, 'SCORE');
    this.hudScore = makeValue(14, 17, '000000');

    makeLabel(112, 5, 'LIVES');
    this.add
      .image(112, 23, 'hud-cap')
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    this.hudLives = makeValue(130, 17, 'x 3');

    makeLabel(198, 5, 'COINS');
    this.add
      .image(198, 23, 'hud-coin')
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1)
      .setScale(0.72);
    this.hudCoins = makeValue(214, 17, 'x 00');

    makeLabel(300, 5, 'WORLD');
    makeValue(300, 17, '1-1');

    makeLabel(466, 5, 'TIME', true);
    this.hudTime = makeValue(466, 17, '320', true);

    this.toastText = this.add
      .text(GAME_WIDTH / 2, 54, '', {
        fontFamily: PIXEL_FONT,
        fontSize: '7px',
        color: COLORS.goldText,
        align: 'center',
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.overlay - 2)
      .setAlpha(0)
      .setStroke('#071019', 3);
  }

  private prepareCheckpoints(): void {
    this.built.checkpoints.forEach((checkpoint) => {
      if (this.savedCheckpoint >= checkpoint.x) {
        checkpoint.activated = true;
        checkpoint.sprite.setTexture('checkpoint-on');
      }
    });
  }

  private updateHud(): void {
    if (!this.hudScore) return;
    this.hudScore.setText(pad(this.score, 6));
    this.hudLives.setText(`x ${this.lives}`);
    this.hudCoins.setText(`x ${pad(this.coins % 100, 2)}`);
    this.hudTime.setText(pad(Math.ceil(this.timeLeft), 3));
  }

  private updateTime(delta: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - Math.min(delta, 50) / 1000);
    if (this.timeLeft <= 0) {
      this.killPlayer();
    }
  }

  private updateCheckpoints(): void {
    this.built.checkpoints.forEach((checkpoint) => {
      if (checkpoint.activated || this.player.x < checkpoint.x - 4) return;
      checkpoint.activated = true;
      checkpoint.sprite.setTexture('checkpoint-on');
      this.registry.set(REGISTRY.checkpoint, checkpoint.x);
      this.savedCheckpoint = checkpoint.x;
      audio.play('checkpoint');
      this.addScore(250);
      this.sparkleAt(checkpoint.x, GROUND_Y - 30, 8);
      this.tweens.add({
        targets: checkpoint.sprite,
        y: checkpoint.sprite.y - 5,
        duration: 130,
        yoyo: true,
        ease: 'Quad.out',
      });
      this.showToast('CHECKPOINT SAVED', COLORS.goldText);
    });
  }

  private bumpBlock(block: Phaser.Physics.Arcade.Sprite): void {
    if (block.getData('bumping')) return;
    const homeY = (block.getData('homeY') as number | undefined) ?? block.y;
    if (!block.getData('homeY')) block.setData('homeY', homeY);
    const kind = block.getData('kind') as 'brick' | 'coin' | 'power';
    const used = Boolean(block.getData('used'));

    block.setData('bumping', true);
    this.tweens.add({
      targets: block,
      y: homeY - 5,
      duration: 65,
      yoyo: true,
      ease: 'Quad.out',
      onComplete: () => {
        block.y = homeY;
        block.setData('bumping', false);
      },
    });

    if (used) {
      audio.play('bump');
      return;
    }

    if (kind === 'brick') {
      if (this.player.isBig) {
        this.breakBrick(block);
      } else {
        audio.play('bump');
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(45);
      }
      return;
    }

    block.setData('used', true);
    block.anims.stop();
    block.setTexture('used-block');

    if (kind === 'coin') {
      this.popCoinFromBlock(block);
    } else {
      this.spawnPowerUp(block.x, homeY - 8);
    }
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(48);
  }

  private breakBrick(block: Phaser.Physics.Arcade.Sprite): void {
    audio.play('break');
    this.addScore(50);
    this.cameras.main.shake(100, 0.004);
    this.popScore(block.x, block.y - 8, '+50', COLORS.goldText);
    for (let i = 0; i < 5; i += 1) {
      const debris = this.add
        .image(block.x + Phaser.Math.Between(-6, 6), block.y, 'debris')
        .setDepth(DEPTH.fx)
        .setScale(Phaser.Math.FloatBetween(0.7, 1.2));
      this.tweens.add({
        targets: debris,
        x: debris.x + Phaser.Math.Between(-26, 26),
        y: debris.y + Phaser.Math.Between(-20, 22),
        angle: Phaser.Math.Between(-160, 160),
        alpha: 0,
        duration: Phaser.Math.Between(350, 520),
        ease: 'Quad.out',
        onComplete: () => debris.destroy(),
      });
    }
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-170);    this.tweens.killTweensOf(block);
    this.built.blockGroup.remove(block, true, true);
  }

  private popCoinFromBlock(block: Phaser.Physics.Arcade.Sprite): void {
    const coin = this.add
      .sprite(block.x, block.y - 8, 'coin-0')
      .setDepth(DEPTH.fx)
      .setScale(1.15);
    coin.play('coin-spin');
    this.tweens.add({
      targets: coin,
      y: block.y - 38,
      alpha: 0,
      duration: 600,
      ease: 'Quad.out',
      onComplete: () => coin.destroy(),
    });
    this.addCoin(1);
    this.addScore(200);
    this.popScore(block.x, block.y - 18, '+200', COLORS.goldText);
    this.sparkleAt(block.x, block.y - 6, 5);
    audio.play('coin');
  }

  private spawnPowerUp(x: number, topY: number): void {
    const powerUp = new PowerUp(this, x, topY);
    this.powerUpGroup.add(powerUp);
    audio.play('powerup');
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    const x = coin.x;
    const y = coin.y;
    coin.disableBody(true, true);
    this.addCoin(1);
    this.addScore(200);
    this.popScore(x, y - 8, '+200', COLORS.goldText);
    this.sparkleAt(x, y, 5);
    audio.play('coin');
  }

  private collectPowerUp(powerUp: PowerUp): void {
    powerUp.collect();
    this.registry.set(REGISTRY.powered, true);
    this.addScore(1000);
    this.popScore(powerUp.x, powerUp.y - 14, '+1000', COLORS.goldText);
    this.sparkleAt(powerUp.x, powerUp.y - 6, 10);

    if (!this.player.isBig) {
      this.player.grow();
      audio.play('grow');
      this.showToast('SUPER SHROOM!', COLORS.goldText);
      this.cameras.main.flash(130, 255, 238, 170, false);
    } else {
      audio.play('powerup');
      this.showToast('+1000', COLORS.goldText);
    }
  }

  private handleEnemyContact(enemy: Enemy, flying: boolean): void {
    if (this.state !== 'playing' || enemy.dead) return;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    const stomp = flying
      ? playerBody.velocity.y > 40 && playerBody.bottom <= enemyBody.top + 14
      : (playerBody.velocity.y >= 0 && playerBody.bottom <= enemyBody.top + 12) ||
        (playerBody.touching.down && enemyBody.touching.up);

    if (stomp) {
      enemy.stomp();
      this.player.bounce(playerBody.velocity.y > 0);
      this.combo = Math.min(this.combo + 1, 7);
      const points = 100 * Math.pow(2, this.combo - 1);
      this.addScore(points);
      this.popScore(enemy.x, enemy.y - 16, `+${points}`, COLORS.tealText);
      this.cameras.main.shake(70, 0.0025);
      audio.play('stomp');
      this.sparkleAt(enemy.x, enemy.y - 8, 5);
      if (this.combo > 1) {
        this.showToast(`COMBO x${this.combo}`, COLORS.tealText);
      }
    } else {
      this.hurtPlayer();
    }
  }

  private hurtPlayer(): void {
    if (this.state !== 'playing' || this.player.invulnerable) return;
    this.combo = 0;
    if (this.player.isBig) {
      this.player.shrink();
      this.player.setInvulnerable(1600);
      audio.play('shrink');
      this.cameras.main.shake(180, 0.006);
      this.cameras.main.flash(130, 239, 71, 111, false);
      this.showToast('OUCH!', COLORS.coralText);
      this.sparkleAt(this.player.x, this.player.y - 16, 6);
    } else {
      this.killPlayer();
    }
  }

  private killPlayer(): void {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.combo = 0;
    document.body.classList.remove('is-controls-ready');
    resetTouch();
    audio.play('die');
    this.cameras.main.shake(200, 0.005);
    this.player.playDeathHop();

    this.time.delayedCall(1500, () => {
      this.lives -= 1;
      this.registry.set(REGISTRY.lives, Math.max(0, this.lives));
      if (this.lives > 0) {
        this.registry.set(REGISTRY.powered, false);
        this.scene.restart({ fromDeath: true });
      } else {
        this.lives = 0;
        this.showGameOver();
      }
    });
  }

  private finishLevel(): void {
    if (this.state !== 'playing') return;
    this.state = 'won';
    resetTouch();
    audio.play('flag');

    const height = Phaser.Math.Clamp(GROUND_Y - this.player.y, 0, 150);
    this.lastFlagBonus = Math.round(500 + (height / 150) * 4500);
    const courseScore = this.score;
    this.addScore(this.lastFlagBonus);
    this.popScore(this.player.x, this.player.y - 24, `+${this.lastFlagBonus}`, COLORS.goldText);
    this.subtotalScore = courseScore;
    this.lastTimeBonus = Math.floor(this.timeLeft) * 50;
    this.addScore(this.lastTimeBonus);
    this.timeLeft = 0;

    this.player.freeze();
    this.player.playClimbAnimation();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    this.cameras.main.flash(220, 255, 239, 184, false);
    this.showToast('COURSE CLEAR!', COLORS.goldText);

    this.tweens.add({
      targets: this.player,
      x: this.flagX - 3,
      y: GROUND_Y - 2,
      duration: 900,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: this.flagCloth,
      y: GROUND_Y - 26,
      duration: 880,
      ease: 'Sine.in',
    });
    this.sparkleAt(this.flagX, this.flagTop + 30, 10);

    this.time.delayedCall(980, () => {
      this.player.playRunAnimation();
      this.player.setFlipX(false);
      this.tweens.add({
        targets: this.player,
        x: this.castleX,
        duration: 1300,
        ease: 'Sine.inOut',
      });
      this.tweens.add({
        targets: this.player,
        alpha: 0,
        delay: 880,
        duration: 360,
      });
    });

    this.time.delayedCall(2550, () => {
      this.showWinOverlay();
    });
  }

  private togglePause(): void {
    if (this.paused) {
      this.resumePause();
      return;
    }
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.paused = true;
    this.stateBeforePause = this.state;
    this.state = 'paused';
    resetTouch();
    this.showPauseScreen();
    this.physics.world.pause();
    this.anims.pauseAll();
    this.tweens.pauseAll();
    this.time.paused = true;
    window.dispatchEvent(new CustomEvent('game:paused', { detail: true }));
  }

  private resumePause(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseScreen?.destroy(true);
    this.pauseScreen = null;
    this.time.paused = false;
    this.physics.world.resume();
    this.anims.resumeAll();
    this.tweens.resumeAll();
    this.state = this.stateBeforePause;
    resetTouch();
    window.dispatchEvent(new CustomEvent('game:paused', { detail: false }));
    audio.play('pause');
  }

  private showPauseScreen(): void {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 10);
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050c15, 0.72)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    dim.on('pointerdown', () => {
      this.resumePause();
    });

    const panel = this.add.graphics();
    panel.fillStyle(0x0c1724, 0.96);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 100, 92, 200, 88, 8);
    panel.lineStyle(1, COLORS.gold, 0.7);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 100, 92, 200, 88, 8);

    const title = this.add
      .text(GAME_WIDTH / 2, 106, 'PAUSED', {
        fontFamily: PIXEL_FONT,
        fontSize: '16px',
        color: COLORS.goldText,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 3, '#6e4b11', 0, true, true);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 136, 'TAKE A BREATH', {
        fontFamily: PIXEL_FONT,
        fontSize: '5px',
        color: '#a8babd',
      })
      .setOrigin(0.5, 0);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 154, 'P OR TAP TO RESUME', {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#fff6dc',
      })
      .setOrigin(0.5, 0);

    container.add([dim, panel, title, subtitle, prompt]);
    this.pauseScreen = container;
  }

  private showGameOver(): void {
    this.state = 'gameover';
    this.overlayReady = false;
    this.physics.world.pause();
    this.anims.pauseAll();
    resetTouch();
    this.stopPlayingUi();
    const best = this.commitBest();
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setAlpha(0);

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a12, 0.9).setOrigin(0, 0);
    const panel = this.add.graphics();
    panel.fillStyle(0x0e1724, 0.97);
    panel.fillRoundedRect(70, 47, 340, 178, 8);
    panel.lineStyle(1, COLORS.coral, 0.8);
    panel.strokeRoundedRect(70, 47, 340, 178, 8);
    panel.lineStyle(1, 0xffffff, 0.08);
    panel.strokeRoundedRect(73, 50, 334, 172, 6);

    const overline = this.add
      .text(GAME_WIDTH / 2, 66, 'THE MEADOW CLAIMS YOU', {
        fontFamily: PIXEL_FONT,
        fontSize: '5px',
        color: '#83959e',
      })
      .setOrigin(0.5, 0);

    const title = this.add
      .text(GAME_WIDTH / 2, 82, 'GAME OVER', {
        fontFamily: PIXEL_FONT,
        fontSize: '17px',
        color: COLORS.coralText,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 3, '#511c2a', 0, true, true);

    const rule = this.add.rectangle(0, 114, 300, 1, 0xffffff, 0.12).setOrigin(0, 0.5);
    rule.x = GAME_WIDTH / 2 - 150;

    const scoreLabel = this.add.text(96, 126, 'SCORE', {
      fontFamily: PIXEL_FONT,
      fontSize: '6px',
      color: '#a8babd',
    });
    const scoreValue = this.add
      .text(384, 124, pad(this.score, 6), {
        fontFamily: PIXEL_FONT,
        fontSize: '9px',
        color: '#fff6dc',
      })
      .setOrigin(1, 0);
    const coinLabel = this.add.text(96, 144, 'COINS', {
      fontFamily: PIXEL_FONT,
      fontSize: '6px',
      color: '#a8babd',
    });
    const coinValue = this.add
      .text(384, 142, pad(this.coins, 2), {
        fontFamily: PIXEL_FONT,
        fontSize: '9px',
        color: COLORS.goldText,
      })
      .setOrigin(1, 0);

    const bestText = this.add
      .text(GAME_WIDTH / 2, 166, `BEST  ${pad(best, 6)}`, {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#7c9099',
      })
      .setOrigin(0.5, 0);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 190, 'PRESS ENTER / TAP', {
        fontFamily: PIXEL_FONT,
        fontSize: '7px',
        color: '#fff6dc',
      })
      .setOrigin(0.5, 0);

    const blocker = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.001)
      .setOrigin(0, 0);

    container.add([dim, panel, overline, title, rule, scoreLabel, scoreValue, coinLabel, coinValue, bestText, prompt, blocker]);

    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 320,
      ease: 'Quad.out',
    });
    this.tweens.add({
      targets: prompt,
      alpha: 0.42,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.time.delayedCall(700, () => {
      this.overlayReady = true;
      blocker.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.overlayReady) this.returnToTitle();
      });
    });
  }

  private showWinOverlay(): void {
    if (this.state !== 'won') return;
    this.state = 'complete';
    this.overlayReady = false;
    this.physics.world.pause();
    resetTouch();
    this.stopPlayingUi();
    const best = this.commitBest();
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay).setAlpha(0);

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a12, 0.88).setOrigin(0, 0);
    const panel = this.add.graphics();
    panel.fillStyle(0x0e1822, 0.98);
    panel.fillRoundedRect(58, 44, 364, 188, 8);
    panel.lineStyle(2, COLORS.gold, 0.9);
    panel.strokeRoundedRect(58, 44, 364, 188, 8);
    panel.lineStyle(1, 0xffffff, 0.08);
    panel.strokeRoundedRect(62, 48, 356, 180, 6);

    const stars = [
      this.add.image(112, 66, 'star').setScale(1.2),
      this.add.image(368, 66, 'star').setScale(1.2),
    ];

    const overline = this.add
      .text(GAME_WIDTH / 2, 58, 'MUSHROOM MEADOW COMPLETE', {
        fontFamily: PIXEL_FONT,
        fontSize: '5px',
        color: '#9fb5b5',
      })
      .setOrigin(0.5, 0);

    const title = this.add
      .text(GAME_WIDTH / 2, 74, 'COURSE CLEAR!', {
        fontFamily: PIXEL_FONT,
        fontSize: '15px',
        color: COLORS.goldText,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 3, '#77520f', 0, true, true);

    const rule = this.add.rectangle(88, 105, 304, 1, 0xffffff, 0.14).setOrigin(0, 0.5);

    const makeRow = (
      y: number,
      label: string,
      value: string,
      valueColor = '#fff6dc',
      size = 8,
    ): Phaser.GameObjects.Text[] => {
      const left = this.add.text(88, y, label, {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#a8babd',
      });
      const right = this.add
        .text(392, y - 2, value, {
          fontFamily: PIXEL_FONT,
          fontSize: `${size}px`,
          color: valueColor,
        })
        .setOrigin(1, 0);
      return [left, right];
    };

    const scoreRow = makeRow(116, 'SCORE', pad(this.subtotalScore, 6));
    const flagRow = makeRow(135, 'FLAG BONUS', `+${this.lastFlagBonus}`, COLORS.goldText, 7);
    const timeRow = makeRow(154, 'TIME BONUS', `+${this.lastTimeBonus}`, COLORS.goldText, 7);

    const totalLabel = this.add.text(88, 178, 'TOTAL', {
      fontFamily: PIXEL_FONT,
      fontSize: '7px',
      color: '#a8babd',
    });
    const totalValue = this.add
      .text(392, 175, pad(this.score, 6), {
        fontFamily: PIXEL_FONT,
        fontSize: '12px',
        color: COLORS.goldText,
      })
      .setOrigin(1, 0);

    const bestText = this.add
      .text(GAME_WIDTH / 2, 198, `BEST  ${pad(best, 6)}`, {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#7c9099',
      })
      .setOrigin(0.5, 0);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 216, 'PRESS ENTER / TAP', {
        fontFamily: PIXEL_FONT,
        fontSize: '7px',
        color: '#fff6dc',
      })
      .setOrigin(0.5, 0);

    const blocker = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.001)
      .setOrigin(0, 0);

    container.add([
      dim,
      panel,
      ...stars,
      overline,
      title,
      rule,
      ...scoreRow,
      ...flagRow,
      ...timeRow,
      totalLabel,
      totalValue,
      bestText,
      prompt,
      blocker,
    ]);

    this.tweens.add({ targets: container, alpha: 1, duration: 340, ease: 'Quad.out' });
    this.tweens.add({
      targets: stars,
      scale: { from: 0.8, to: 1.35 },
      angle: { from: -8, to: 8 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: prompt,
      alpha: 0.42,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.time.addEvent({
      delay: 240,
      loop: true,
      callback: () => this.spawnConfetti(),
    });

    this.time.delayedCall(700, () => {
      this.overlayReady = true;
      blocker.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.overlayReady) this.returnToTitle();
      });
    });
  }

  private spawnConfetti(): void {
    const x = Phaser.Math.Between(20, GAME_WIDTH - 20);
    const star = this.add
      .image(x, -8, Phaser.Math.Between(0, 1) === 0 ? 'star' : 'sparkle')
      .setScrollFactor(0)
      .setDepth(DEPTH.overlay + 6)
      .setScale(Phaser.Math.FloatBetween(0.7, 1.4))
      .setTint(Phaser.Utils.Array.GetRandom([0xffd166, 0xef476f, 0x2ec4b6, 0xfff6dc]));
    this.tweens.add({
      targets: star,
      y: GAME_HEIGHT + 12,
      x: x + Phaser.Math.Between(-40, 40),
      angle: Phaser.Math.Between(-240, 240),
      alpha: { from: 1, to: 0.25 },
      duration: Phaser.Math.Between(1800, 3100),
      ease: 'Sine.in',
      onComplete: () => star.destroy(),
    });
  }

  private showIntroOverlay(): void {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x061019, 0.9).setOrigin(0, 0);
    const topLabel = this.add
      .text(GAME_WIDTH / 2, 86, 'MUSHROOM MEADOW', {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#8ec9bd',
      })
      .setOrigin(0.5, 0);
    const title = this.add
      .text(GAME_WIDTH / 2, 104, 'WORLD 1-1', {
        fontFamily: PIXEL_FONT,
        fontSize: '20px',
        color: '#fff6dc',
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 4, '#27454b', 0, true, true);
    const rule = this.add.rectangle(GAME_WIDTH / 2, 140, 160, 1, 0xffffff, 0.14).setOrigin(0.5);
    const cap = this.add.image(GAME_WIDTH / 2 - 24, 158, 'hud-cap').setScale(1.2).setOrigin(0.5);
    const lives = this.add
      .text(GAME_WIDTH / 2 - 10, 152, `x ${this.lives}`, {
        fontFamily: PIXEL_FONT,
        fontSize: '8px',
        color: '#fff6dc',
      })
      .setOrigin(0, 0);
    const ready = this.add
      .text(GAME_WIDTH / 2, 184, 'GET READY', {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#ffd166',
      })
      .setOrigin(0.5, 0);
    container.add([dim, topLabel, title, rule, cap, lives, ready]);

    this.tweens.add({
      targets: ready,
      alpha: 0.4,
      duration: 420,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: container,
      alpha: 0,
      delay: 1250,
      duration: 300,
      ease: 'Quad.in',
      onComplete: () => {
        container.destroy(true);
        if (this.state === 'intro') {
          this.state = 'playing';
          this.player.controlsEnabled = true;
          document.body.classList.add('is-controls-ready');
          const touchDevice =
            window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
          this.showToast(
            touchDevice ? 'A TO JUMP  ·  B TO RUN' : 'SHIFT TO RUN  ·  SPACE TO JUMP',
            COLORS.creamText,
          );
        }
      },
    });
  }

  private showToast(message: string, color: string): void {
    if (!this.toastText) return;
    this.toastTween?.stop();
    this.toastText.setText(message);
    this.toastText.setColor(color);
    this.toastText.setAlpha(1);
    this.toastText.setY(52);
    this.toastTween = this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      y: 46,
      delay: 950,
      duration: 420,
      ease: 'Quad.in',
    });
  }

  private popScore(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color,
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx + 2)
      .setStroke('#051019', 3);
    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 800,
      ease: 'Quad.out',
      onComplete: () => label.destroy(),
    });
  }

  private sparkleAt(x: number, y: number, count = 6): void {
    for (let i = 0; i < count; i += 1) {
      const sparkle = this.add
        .image(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-6, 6), i % 3 === 0 ? 'star' : 'sparkle')
        .setDepth(DEPTH.fx)
        .setScale(Phaser.Math.FloatBetween(0.45, 0.9))
        .setAlpha(0.95);
      this.tweens.add({
        targets: sparkle,
        x: sparkle.x + Phaser.Math.Between(-20, 20),
        y: sparkle.y + Phaser.Math.Between(-26, -8),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, 520),
        ease: 'Quad.out',
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  private dustAt(x: number, y: number, strong = false): void {
    const count = strong ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      const dust = this.add
        .image(x + Phaser.Math.Between(-5, 5), y - 2, 'dust')
        .setDepth(DEPTH.fx)
        .setScale(Phaser.Math.FloatBetween(0.55, 1))
        .setAlpha(0.62);
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-16, 16),
        y: dust.y - Phaser.Math.Between(2, 12),
        alpha: 0,
        duration: Phaser.Math.Between(220, 380),
        ease: 'Quad.out',
        onComplete: () => dust.destroy(),
      });
    }
  }

  private addScore(points: number): void {
    this.score += points;
    this.registry.set(REGISTRY.score, this.score);
  }

  private addCoin(amount: number): void {
    this.coins += amount;
    this.registry.set(REGISTRY.coins, this.coins);
    if (this.coins > 0 && this.coins % COINS_PER_LIFE === 0) {
      this.lives += 1;
      this.registry.set(REGISTRY.lives, this.lives);
      audio.play('oneup');
      this.showToast('1-UP!', COLORS.goldText);
      this.sparkleAt(this.player.x, this.player.y - 24, 12);
    }
  }

  private commitBest(): number {
    const stored = readStoredBest();
    const registryBest = Number(this.registry.get(REGISTRY.highScore) ?? 0);
    const best = Math.max(stored, Number.isFinite(registryBest) ? registryBest : 0, this.score);
    this.registry.set(REGISTRY.highScore, best);
    try {
      localStorage.setItem(STORAGE.highScore, String(best));
    } catch {
      // High scores are nice to have; ignore storage failures.
    }
    return best;
  }

  private stopPlayingUi(): void {
    document.body.classList.remove('is-playing');
    document.body.classList.remove('is-paused');
    document.body.classList.remove('is-controls-ready');
    window.dispatchEvent(new CustomEvent('game:playing', { detail: false }));
    window.dispatchEvent(new CustomEvent('game:paused', { detail: false }));
  }

  private returnToTitle(): void {
    this.overlayReady = false;
    resetTouch();
    this.scene.start('Title');
  }

  private onPlayerJump(x: number, y: number): void {
    this.combo = 0;
    this.dustAt(x, y + 18, true);
  }

  private onPlayerLand(x: number, y: number, fallSpeed: number): void {
    this.combo = 0;
    this.dustAt(x, y, fallSpeed > 220);
  }

  private onPlayerStep(x: number, y: number): void {
    this.dustAt(x, y, false);
  }

  private shutdown(): void {
    window.removeEventListener('game:pause-toggle', this.onPauseRequest);
    this.input.keyboard?.off('keydown-ENTER', this.onOverlayEnter, this);
    this.player?.off('jump', this.onPlayerJump, this);
    this.player?.off('land', this.onPlayerLand, this);
    this.player?.off('step', this.onPlayerStep, this);
    document.body.classList.remove('is-paused');
    window.dispatchEvent(new CustomEvent('game:paused', { detail: false }));
    resetTouch();
  }
}
