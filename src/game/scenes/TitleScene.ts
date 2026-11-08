import Phaser from 'phaser';
import { audio } from '../audio';
import { createBackdrop } from '../background';
import {
  COLORS,
  GAME_WIDTH,
  GROUND_Y,
  PIXEL_FONT,
  REGISTRY,
  START_LIVES,
  STORAGE,
  TILE,
} from '../constants';
import { LEVEL } from '../level/level';

function readHighScore(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE.highScore) ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export class TitleScene extends Phaser.Scene {
  private starting = false;
  private inputReady = false;
  private backdropCleanup: (() => void)[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    this.starting = false;
    this.inputReady = false;
    this.cameras.main.setBackgroundColor('#0b1320');
    this.cameras.main.fadeIn(260, 10, 18, 32);

    document.body.classList.remove('is-playing', 'is-paused');
    window.dispatchEvent(new CustomEvent('game:playing', { detail: false }));

    const highScore = readHighScore();
    this.registry.set(REGISTRY.highScore, highScore);

    const backdrop = createBackdrop(this);

    // A strip of meadow for the title characters to stand on.
    for (let x = 0; x < 30; x += 1) {
      this.add
        .image(x * TILE + TILE / 2, GROUND_Y + TILE / 2, `ground-top-${x % 4}`)
        .setDepth(3);
    }
    this.add.tileSprite(0, GROUND_Y + TILE, GAME_WIDTH, 32, 'ground-fill').setOrigin(0, 0).setDepth(2);

    this.add.image(104, GROUND_Y + 1, 'bush').setOrigin(0.5, 1).setDepth(4);
    this.add.image(440, GROUND_Y + 1, 'bush-small').setOrigin(0.5, 1).setDepth(4).setFlipX(true);
    this.add.image(170, GROUND_Y, 'tuft').setOrigin(0.5, 1).setDepth(4);
    this.add.image(306, GROUND_Y, 'tuft').setOrigin(0.5, 1).setDepth(4);
    this.add.image(364, GROUND_Y, 'flower').setOrigin(0.5, 1).setDepth(4);

    // Little diorama characters.
    const hero = this.add
      .sprite(54, GROUND_Y, 'pip-idle')
      .setOrigin(0.5, 1)
      .setScale(1.6)
      .setDepth(10);
    hero.play('pip-idle-blink');

    const grumble = this.add
      .sprite(424, GROUND_Y, 'grumble-0')
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setScale(1.3);
    grumble.play('grumble-walk');
    this.tweens.add({
      targets: grumble,
      x: 396,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      onYoyo: () => grumble.setFlipX(true),
      onRepeat: () => grumble.setFlipX(false),
    });

    const flutter = this.add
      .sprite(382, 154, 'flutter-0')
      .setDepth(9)
      .setScale(1.2);
    flutter.play('flutter-fly');
    this.tweens.add({
      targets: flutter,
      y: 132,
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Coins bobbing in the breeze.
    const floatingCoins = [
      { x: 336, y: 120 },
      { x: 356, y: 103 },
      { x: 376, y: 120 },
    ];
    floatingCoins.forEach((coin, index) => {
      const image = this.add.sprite(coin.x, coin.y, 'coin-0').setScale(1.25).setDepth(9);
      image.play('coin-spin');
      this.tweens.add({
        targets: image,
        y: coin.y - 7,
        duration: 900 + index * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });

    // Wall of title art.
    const shadowStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: PIXEL_FONT,
      fontSize: '28px',
      color: '#5b2433',
    };
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: PIXEL_FONT,
      fontSize: '28px',
      color: '#fff6dc',
    };

    this.add
      .text(GAME_WIDTH / 2 + 3, 61, 'MUSHROOM', shadowStyle)
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.add
      .text(GAME_WIDTH / 2, 58, 'MUSHROOM', titleStyle)
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setShadow(0, 3, '#a92c4b', 0, true, true);

    this.add
      .text(GAME_WIDTH / 2 + 4, 103, 'RUN', {
        fontFamily: PIXEL_FONT,
        fontSize: '52px',
        color: '#8e2b47',
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.add
      .text(GAME_WIDTH / 2, 99, 'RUN', {
        fontFamily: PIXEL_FONT,
        fontSize: '52px',
        color: '#ffd166',
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setShadow(0, 4, '#b9621d', 0, true, true);

    this.add
      .text(GAME_WIDTH / 2, 162, 'A TINY PLATFORM ADVENTURE', {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#1c4b55',
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0)
      .setDepth(21);

    // Start panel.
    const panel = this.add.graphics().setDepth(19);
    panel.fillStyle(0x07121c, 0.82);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 105, 181, 210, 30, 6);
    panel.lineStyle(1, COLORS.gold, 0.88);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 105, 181, 210, 30, 6);
    panel.lineStyle(1, 0xffffff, 0.12);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 102, 184, 204, 24, 4);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 190, 'PRESS ENTER / TAP', {
        fontFamily: PIXEL_FONT,
        fontSize: '7px',
        color: '#fff6dc',
      })
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.tweens.add({
      targets: prompt,
      alpha: 0.45,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const bestPill = this.add.graphics().setDepth(20);
    bestPill.fillStyle(0x071a21, 0.34);
    bestPill.fillRoundedRect(GAME_WIDTH / 2 - 68, 216, 136, 15, 3);
    bestPill.lineStyle(1, 0xffffff, 0.08);
    bestPill.strokeRoundedRect(GAME_WIDTH / 2 - 68, 216, 136, 15, 3);

    this.add
      .text(GAME_WIDTH / 2, 220, `BEST  ${String(highScore).padStart(6, '0')}`, {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#c8ded4',
      })
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.add
      .text(14, 12, 'WORLD 1-1', {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#174451',
      })
      .setDepth(21);
    this.add
      .text(GAME_WIDTH - 14, 12, '1 PLAYER', {
        fontFamily: PIXEL_FONT,
        fontSize: '6px',
        color: '#174451',
      })
      .setOrigin(1, 0)
      .setDepth(21);

    // Drift the title backdrop gently even before the game starts.
    const onBackdrop = (time: number): void => {
      backdrop.update(time * 0.005, time);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, onBackdrop);
    this.backdropCleanup.push(() => this.events.off(Phaser.Scenes.Events.UPDATE, onBackdrop));

    const start = (): void => {
      if (!this.inputReady || this.starting) return;
      this.starting = true;
      audio.unlock();
      audio.play('start');
      this.cameras.main.fadeOut(220, 8, 14, 24);
      this.time.delayedCall(220, () => {
        this.registry.set(REGISTRY.lives, START_LIVES);
        this.registry.set(REGISTRY.score, 0);
        this.registry.set(REGISTRY.coins, 0);
        this.registry.set(REGISTRY.checkpoint, 0);
        this.registry.set(REGISTRY.powered, false);
        this.scene.start('Game', { intro: true, spawnTile: LEVEL.spawnX });
      });
    };

    const onEnter = (): void => start();
    const onSpace = (event: KeyboardEvent): void => {
      event.preventDefault();
      start();
    };
    this.input.keyboard?.on('keydown-ENTER', onEnter);
    this.input.keyboard?.on('keydown-SPACE', onSpace);
    this.input.once('pointerdown', start);
    this.backdropCleanup.push(() => {
      this.input.keyboard?.off('keydown-ENTER', onEnter);
      this.input.keyboard?.off('keydown-SPACE', onSpace);
    });

    this.time.delayedCall(240, () => {
      this.inputReady = true;
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.backdropCleanup.forEach((cleanup) => cleanup());
      this.backdropCleanup = [];
    });

    // Let the web shell reveal the canvas.
    window.dispatchEvent(new CustomEvent('game:ready'));

    // A tiny sparkle now and then keeps the meadow alive.
    this.time.addEvent({
      delay: 1400,
      loop: true,
      callback: () => {
        const x = Phaser.Math.Between(80, 420);
        const y = Phaser.Math.Between(80, 190);
        const sparkle = this.add.image(x, y, 'sparkle').setDepth(8).setAlpha(0).setScale(0.7);
        this.tweens.add({
          targets: sparkle,
          alpha: { from: 0, to: 0.9 },
          scale: { from: 0.4, to: 1.1 },
          duration: 600,
          yoyo: true,
          onComplete: () => sparkle.destroy(),
        });
      },
    });
  }
}
