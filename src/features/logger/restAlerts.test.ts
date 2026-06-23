import { describe, expect, it, vi } from 'vitest';
import {
  ensureNotificationPermission,
  shouldTriggerRestAlert,
  triggerRestTimerAlert,
  type RestAlertDeps,
} from './restAlerts';

function makeDeps(overrides: Partial<RestAlertDeps> = {}): RestAlertDeps {
  return {
    notificationSupported: true,
    notificationPermission: 'granted',
    requestNotificationPermission: vi.fn(async () => 'granted' as const),
    showNotification: vi.fn(),
    vibrate: vi.fn(),
    playBeep: vi.fn(),
    ...overrides,
  };
}

describe('shouldTriggerRestAlert', () => {
  it('defaults to true when unset', () => {
    expect(shouldTriggerRestAlert(undefined)).toBe(true);
    expect(shouldTriggerRestAlert(true)).toBe(true);
  });

  it('is false only when explicitly disabled', () => {
    expect(shouldTriggerRestAlert(false)).toBe(false);
  });
});

describe('ensureNotificationPermission', () => {
  it('requests permission when still default', async () => {
    const request = vi.fn(async () => 'granted' as const);
    const result = await ensureNotificationPermission({
      notificationSupported: true,
      notificationPermission: 'default',
      requestNotificationPermission: request,
    });
    expect(request).toHaveBeenCalledOnce();
    expect(result).toBe('granted');
  });

  it('skips request when already granted', async () => {
    const request = vi.fn(async () => 'granted' as const);
    const result = await ensureNotificationPermission({
      notificationSupported: true,
      notificationPermission: 'granted',
      requestNotificationPermission: request,
    });
    expect(request).not.toHaveBeenCalled();
    expect(result).toBe('granted');
  });
});

describe('triggerRestTimerAlert', () => {
  it('does nothing when alerts are disabled', async () => {
    const deps = makeDeps();
    await triggerRestTimerAlert(false, deps);
    expect(deps.showNotification).not.toHaveBeenCalled();
    expect(deps.vibrate).not.toHaveBeenCalled();
    expect(deps.playBeep).not.toHaveBeenCalled();
  });

  it('fires notification, vibrate, and beep when enabled and permitted', async () => {
    const deps = makeDeps();
    await triggerRestTimerAlert(true, deps);
    expect(deps.showNotification).toHaveBeenCalledWith('Rest complete', 'Time for your next set.');
    expect(deps.vibrate).toHaveBeenCalledWith(200);
    expect(deps.playBeep).toHaveBeenCalledOnce();
  });

  it('still vibrates and beeps when notification permission is denied', async () => {
    const deps = makeDeps({ notificationPermission: 'denied' });
    await triggerRestTimerAlert(undefined, deps);
    expect(deps.showNotification).not.toHaveBeenCalled();
    expect(deps.vibrate).toHaveBeenCalledWith(200);
    expect(deps.playBeep).toHaveBeenCalledOnce();
  });
});