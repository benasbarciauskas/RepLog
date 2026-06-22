import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the data layer so the shell renders without IndexedDB.
const useWorkoutsMock = vi.fn<() => unknown[]>(() => []);
const useWorkoutCountMock = vi.fn<() => number | undefined>(() => 0);
vi.mock('@/data/hooks', () => ({
  useWorkouts: () => useWorkoutsMock(),
  useWorkoutCount: () => useWorkoutCountMock(),
  // Dashboard + Coach (rendered at "/" and "/coach") also read these; the shell
  // test only cares that the page mounts, so empty arrays are enough.
  useBests: () => [],
  useBlocks: () => [],
  useBodyweightSeries: () => [],
  useCoachFindings: () => [],
}));

// Render the shell at a given route. App provides no Router, so we wrap it.
async function renderApp(initialPath = '/') {
  const App = (await import('./App')).default;
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  useWorkoutsMock.mockReset();
  useWorkoutsMock.mockReturnValue([]);
  useWorkoutCountMock.mockReset();
  useWorkoutCountMock.mockReturnValue(0);
  localStorage.clear();
});

describe('App shell', () => {
  it('renders the RepLog wordmark', async () => {
    await renderApp('/import');
    // Wordmark renders in both sidebar and mobile top bar.
    expect(screen.getAllByText('Rep').length).toBeGreaterThan(0);
  });

  it('renders the primary navigation links', async () => {
    await renderApp('/import');
    const navs = screen.getAllByRole('navigation');
    const labels = navs.flatMap((nav) =>
      within(nav)
        .queryAllByRole('link')
        .map((l) => l.textContent),
    );
    expect(labels.join(' ')).toMatch(/Dashboard/);
    expect(labels.join(' ')).toMatch(/Import/);
    expect(labels.join(' ')).toMatch(/Coach/);
  });

  it('redirects "/" to Import when there are no workouts', async () => {
    useWorkoutCountMock.mockReturnValue(0);
    await renderApp('/');
    // <Navigate> resolves on a later tick — wait for the page heading.
    expect(
      await screen.findByRole('heading', { name: 'Import', level: 1 }),
    ).toBeInTheDocument();
  });

  it('shows the Dashboard at "/" when workouts exist', async () => {
    useWorkoutCountMock.mockReturnValue(1);
    await renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
  });

  it('renders the Coach page at /coach', async () => {
    await renderApp('/coach');
    expect(
      await screen.findByRole('heading', { name: 'Coach', level: 1 }),
    ).toBeInTheDocument();
  });
});
