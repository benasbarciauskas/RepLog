import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppSettings } from '@/types/models';
import { DEFAULT_SETTINGS } from '@/data/repository';
import { detectChannel } from './channel';

const { settingsMock, saveSettings } = vi.hoisted(() => ({
  settingsMock: vi.fn<() => AppSettings>(),
  saveSettings: vi.fn(async () => {}),
}));

vi.mock('@/data/hooks', () => ({
  useSettings: () => settingsMock(),
}));

vi.mock('@/data/repository', async () => {
  const actual = await vi.importActual<typeof import('@/data/repository')>('@/data/repository');
  return { ...actual, repository: { saveSettings } };
});

async function renderSettings() {
  const SettingsPage = (await import('./SettingsPage')).default;
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  settingsMock.mockReturnValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('detectChannel', () => {
  it('maps the Vite base path to a channel', () => {
    expect(detectChannel('/RepLog/')).toBe('stable');
    expect(detectChannel('/RepLog/beta/')).toBe('beta');
    expect(detectChannel('/')).toBe('local');
    expect(detectChannel('/whatever/')).toBe('local');
  });
});

describe('SettingsPage', () => {
  it('renders the settings sections', async () => {
    await renderSettings();
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /units/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /release channel/i })).toBeInTheDocument();
  });

  it('persists a unit change via saveSettings', async () => {
    await renderSettings();
    // The unit toggle exposes a "Pounds (lb)" tab.
    fireEvent.click(screen.getByRole('tab', { name: /pounds/i }));
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ unit: 'lb' }),
    );
  });

  it('persists an OpenRouter API key via saveSettings', async () => {
    await renderSettings();
    const input = screen.getByLabelText(/OpenRouter API key/i);
    fireEvent.change(input, { target: { value: '  sk-or-test-key  ' } });
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ aiApiKey: 'sk-or-test-key' }),
    );
  });

  it('reflects the BASE_URL channel — local build shows Stable link while beta is unpublished', async () => {
    // In the test environment import.meta.env.BASE_URL is '/', i.e. a local build.
    expect(detectChannel(import.meta.env.BASE_URL)).toBe('local');
    await renderSettings();
    expect(screen.getByRole('link', { name: /stable/i })).toHaveAttribute(
      'href',
      'https://benasbarciauskas.github.io/RepLog/',
    );
    expect(screen.queryByRole('link', { name: /beta/i })).not.toBeInTheDocument();
    expect(screen.getByText(/beta channel coming soon/i)).toBeInTheDocument();
  });
});
