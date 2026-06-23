import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

async function renderPrTimeline() {
  const { PrTimeline } = await import('./PrTimeline');
  return render(
    <MemoryRouter>
      <PrTimeline workouts={SAMPLE_WORKOUTS} />
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

describe('PrTimeline', { timeout: 20000 }, () => {
  it('renders PR rows linked to exercise progress pages', async () => {
    await renderPrTimeline();
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/exercise\//));
  });

  it('narrows rows when a lift filter is selected', async () => {
    await renderPrTimeline();
    const select = screen.getByRole('combobox', { name: /filter by lift/i });
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options.length).toBeGreaterThan(1);

    const benchOption = [...select.querySelectorAll('option')].find((o) =>
      /bench press/i.test(o.textContent ?? ''),
    );
    expect(benchOption).toBeTruthy();

    const allCount = screen.getAllByRole('link').length;
    fireEvent.change(select, { target: { value: benchOption!.getAttribute('value') } });
    const filteredCount = screen.getAllByRole('link').length;
    expect(filteredCount).toBeLessThan(allCount);
    expect(filteredCount).toBeGreaterThan(0);
  });
});