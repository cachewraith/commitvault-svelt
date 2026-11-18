/**
 * Second-by-second countdowns for the auth screens: rate-limit waits
 * (`Retry-After`), "send a new code" cooldowns and code expiry.
 * Call `stop()` from `onDestroy`.
 */

/** "42 seconds", "2 minutes" (rounded up). */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export class Countdown {
  /** Whole seconds left; `0` when not running. */
  remaining = $state(0);
  #timer: ReturnType<typeof setInterval> | undefined;

  get active(): boolean {
    return this.remaining > 0;
  }

  /** Count down `seconds` (rounded up, at least 1); `onend` runs when it reaches 0. */
  start(seconds: number, onend?: () => void): void {
    this.stop();
    this.remaining = Math.max(1, Math.ceil(seconds));
    this.#timer = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.stop();
        onend?.();
      }
    }, 1000);
  }

  /** Count down to an ISO timestamp; does nothing (stays at 0) if it has passed. */
  startUntil(iso: string, onend?: () => void): void {
    const seconds = (Date.parse(iso) - Date.now()) / 1000;
    if (Number.isFinite(seconds) && seconds > 0) this.start(seconds, onend);
    else this.stop();
  }

  stop(): void {
    clearInterval(this.#timer);
    this.#timer = undefined;
    this.remaining = 0;
  }
}
