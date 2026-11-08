export const touchInput = {
  left: false,
  right: false,
  run: false,
  jumpHeld: false,
  jumpQueued: false,
};

export function consumeTouchJump(): boolean {
  const queued = touchInput.jumpQueued;
  touchInput.jumpQueued = false;
  return queued;
}

export function resetTouch(): void {
  touchInput.left = false;
  touchInput.right = false;
  touchInput.run = false;
  touchInput.jumpHeld = false;
  touchInput.jumpQueued = false;
  document.querySelectorAll('.touch-button.is-down').forEach((element) => {
    element.classList.remove('is-down');
  });
}

type TouchControl = 'left' | 'right' | 'run' | 'jump';

function setControl(control: TouchControl, pressed: boolean): void {
  if (control === 'jump') {
    touchInput.jumpHeld = pressed;
    if (pressed) touchInput.jumpQueued = true;
    return;
  }
  touchInput[control] = pressed;
}

export function bindTouchControls(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-touch]');
  buttons.forEach((button) => {
    const control = button.dataset.touch as TouchControl | undefined;
    if (!control) return;

    const press = (event: PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is a convenience, not a requirement.
      }
      setControl(control, true);
      button.classList.add('is-down');
    };

    const release = (event: PointerEvent): void => {
      event.preventDefault();
      setControl(control, false);
      button.classList.remove('is-down');
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  window.addEventListener('blur', resetTouch);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') resetTouch();
  });
}
