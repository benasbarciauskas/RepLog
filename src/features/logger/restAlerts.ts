/** Injectable browser deps so alert side-effects are unit-testable. */
export interface RestAlertDeps {
  notificationSupported: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  showNotification: (title: string, body: string) => void;
  vibrate: (pattern: number | number[]) => void;
  playBeep: () => void;
}

/** Whether rest-timer alerts should fire (defaults on when unset). */
export function shouldTriggerRestAlert(restAlerts: boolean | undefined): boolean {
  return restAlerts !== false;
}

/**
 * Request notification permission lazily when alerts are first enabled.
 * Returns the effective permission after any request attempt.
 */
export async function ensureNotificationPermission(
  deps: Pick<RestAlertDeps, 'notificationSupported' | 'notificationPermission' | 'requestNotificationPermission'>,
): Promise<NotificationPermission | 'unsupported'> {
  if (!deps.notificationSupported) return 'unsupported';
  if (deps.notificationPermission === 'default') {
    return deps.requestNotificationPermission();
  }
  return deps.notificationPermission;
}

/**
 * Fire rest-complete cues: Web Notification (if permitted), vibrate, and a
 * short synthesized beep. Degrades gracefully when APIs are missing or denied.
 */
export async function triggerRestTimerAlert(
  restAlerts: boolean | undefined,
  deps: RestAlertDeps,
): Promise<void> {
  if (!shouldTriggerRestAlert(restAlerts)) return;

  const permission = await ensureNotificationPermission(deps);

  if (permission === 'granted') {
    try {
      deps.showNotification('Rest complete', 'Time for your next set.');
    } catch {
      // Notification API can throw in some embedded contexts — ignore.
    }
  }

  try {
    deps.vibrate(200);
  } catch {
    // vibrate is optional
  }

  try {
    deps.playBeep();
  } catch {
    // AudioContext may be blocked until user gesture — ignore
  }
}

/** Synthesize a short beep via Web Audio (no asset file). */
export function synthesizeRestBeep(audioCtx?: AudioContext): void {
  const Ctx = typeof AudioContext !== 'undefined' ? AudioContext : undefined;
  if (!Ctx) return;
  const ctx = audioCtx ?? new Ctx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  oscillator.start(t);
  oscillator.stop(t + 0.25);
  if (!audioCtx) {
    void ctx.close();
  }
}

/** Browser-backed deps for production use. */
export function defaultRestAlertDeps(): RestAlertDeps {
  const notificationSupported = typeof Notification !== 'undefined';
  return {
    notificationSupported,
    notificationPermission: notificationSupported ? Notification.permission : 'unsupported',
    requestNotificationPermission: async () => {
      if (!notificationSupported) return 'unsupported';
      return Notification.requestPermission();
    },
    showNotification: (title, body) => {
      if (!notificationSupported || Notification.permission !== 'granted') return;
      new Notification(title, { body });
    },
    vibrate: (pattern) => {
      navigator.vibrate?.(pattern);
    },
    playBeep: () => synthesizeRestBeep(),
  };
}