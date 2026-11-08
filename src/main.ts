import '@fontsource/press-start-2p/400.css';
import './style.css';
import Phaser from 'phaser';
import { audio } from './game/audio';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { TitleScene } from './game/scenes/TitleScene';
import { bindTouchControls } from './ui';

const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const pauseButton = document.getElementById('pause-button') as HTMLButtonElement | null;
const pauseLabel = document.getElementById('pause-label');
const soundButton = document.getElementById('sound-button') as HTMLButtonElement | null;
const soundLabel = document.getElementById('sound-label');
const fullscreenButton = document.getElementById('fullscreen-button') as HTMLButtonElement | null;

function updateSoundUi(): void {
  const muted = audio.isMuted;
  document.body.classList.toggle('is-muted', muted);
  if (soundLabel) soundLabel.textContent = muted ? 'Sound off' : 'Sound on';
  soundButton?.setAttribute('aria-pressed', String(muted));
  soundButton?.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

function updateFullscreenUi(): void {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton?.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  document.body.classList.toggle('is-fullscreen', active);
}

function setupUi(): void {
  bindTouchControls();
  updateSoundUi();

  window.addEventListener('game:ready', () => {
    loading?.classList.add('is-hidden');
  });

  window.addEventListener('game:playing', (event) => {
    const playing = Boolean((event as CustomEvent<boolean>).detail);
    document.body.classList.toggle('is-playing', playing);
    if (!playing) document.body.classList.remove('is-paused');
  });

  window.addEventListener('game:paused', (event) => {
    const paused = Boolean((event as CustomEvent<boolean>).detail);
    document.body.classList.toggle('is-paused', paused);
    if (pauseLabel) pauseLabel.textContent = paused ? 'Resume' : 'Pause';
    pauseButton?.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  });

  pauseButton?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('game:pause-toggle'));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="pause"]').forEach((button) => {
    button.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:pause-toggle'));
    });
  });

  soundButton?.addEventListener('click', () => {
    const muted = audio.toggleMute();
    updateSoundUi();
    void audio.unlock();
    if (!muted) audio.play('coin');
  });

  fullscreenButton?.addEventListener('click', () => {
    void toggleFullscreen();
  });

  const unlock = (): void => {
    void audio.unlock();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyM') {
      event.preventDefault();
      audio.toggleMute();
      updateSoundUi();
      void audio.unlock();
    } else if (event.code === 'KeyP') {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('game:pause-toggle'));
    } else if (event.code === 'KeyF') {
      event.preventDefault();
      void toggleFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenUi);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && document.body.classList.contains('is-playing')) {
      if (!document.body.classList.contains('is-paused')) {
        window.dispatchEvent(new CustomEvent('game:pause-toggle'));
      }
    }
  });
}

async function toggleFullscreen(): Promise<void> {
  if (!stage) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await stage.requestFullscreen();
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape').catch(() => undefined);
      }
    }
  } catch {
    // Fullscreen may be blocked by the browser or embedded frame.
  }
}

async function boot(): Promise<void> {
  setupUi();

  try {
    await document.fonts.load('10px "Press Start 2P"');
    await document.fonts.ready;
  } catch {
    // The fallback monospace font still keeps the game playable.
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game',
    backgroundColor: '#0b1320',
    pixelArt: true,
    roundPixels: true,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 1000 },
        debug: false,
      },
    },
    input: {
      activePointers: 3,
    },
    scene: [BootScene, TitleScene, GameScene],
  };

  const game = new Phaser.Game(config);
  (window as typeof window & { __MUSHROOM_RUN__?: Phaser.Game }).__MUSHROOM_RUN__ = game;

  window.setTimeout(() => {
    loading?.classList.add('is-hidden');
  }, 5000);
}

void boot();
