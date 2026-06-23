import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AppSettings } from '@/types/models';
import { SAMPLE_WORKOUTS } from '@/data/sampleData';

const DEFAULT_SETTINGS: AppSettings = {
  barWeightKg: 20,
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  unit: 'kg',
};
const settingsMock = vi.fn<() => AppSettings>(() => DEFAULT_SETTINGS);

vi.mock('@/data/hooks', () => ({
  useSettings: () => settingsMock(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}));

async function renderBlockCompare() {
  const { BlockCompare } = await import('./BlockCompare');
  return render(<BlockCompare workouts={SAMPLE_WORKOUTS} />);
}

beforeEach(() => {
  settingsMock.mockReturnValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BlockCompare', { timeout: 20000 }, () => {
  it('renders compare table with two block pickers and delta column', async () => {
    await renderBlockCompare();
    expect(screen.getByRole('combobox', { name: /select block a/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /select block b/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Δ/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /sessions/i })).toBeInTheDocument();
  });

  it('shows a delta value in the compare table', async () => {
    await renderBlockCompare();
    const cells = screen.getAllByRole('cell');
    const hasDelta = cells.some((c) => /^[+-]/.test(c.textContent?.trim() ?? '') || c.textContent === '0');
    expect(hasDelta).toBe(true);
  });

  it('shows message when fewer than two blocks exist', async () => {
    const { BlockCompare } = await import('./BlockCompare');
    const singleBlockWorkouts = SAMPLE_WORKOUTS.filter((w) => w.splitCanonical === 'push').slice(0, 2);
    render(<BlockCompare workouts={singleBlockWorkouts} />);
    expect(screen.getByText(/need at least two training blocks to compare/i)).toBeInTheDocument();
  });
});