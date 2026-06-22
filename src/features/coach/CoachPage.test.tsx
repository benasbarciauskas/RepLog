import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CoachFinding, Workout } from '@/types/models';

const workoutsMock = vi.fn<() => Workout[]>(() => []);
const findingsMock = vi.fn<() => CoachFinding[]>(() => []);

// muscleCoverage is intentionally NOT mocked — the page calls the real engine.
vi.mock('@/data/hooks', () => ({
  useWorkouts: () => workoutsMock(),
  useCoachFindings: () => findingsMock(),
}));

async function renderCoach() {
  const CoachPage = (await import('./CoachPage')).default;
  return render(
    <MemoryRouter>
      <CoachPage />
    </MemoryRouter>,
  );
}

const priorityFinding: CoachFinding = {
  ruleId: 'ohp-bench',
  severity: 'priority',
  ratio: 0.5,
  message:
    'You bench 150kg but only overhead press 75kg (0.50, healthy ≥0.60) — your overhead press is low for your bench press; front delts likely lagging.',
  muscles: ['front-delts', 'triceps'],
};

// A workout using a catalogued id the coverage map knows (bench → chest etc.)
const benchWorkout: Workout = {
  id: 'w1',
  date: '2023-07-10',
  dateConfidence: 'high',
  bodyweightKg: null,
  splitCanonical: 'push',
  splitRaw: 'Push',
  blockId: null,
  sourceNoteId: 'n1',
  createdAt: '2023-07-10T10:00:00.000Z',
  exercises: [
    {
      exerciseId: 'barbell-bench-press',
      rawName: 'Bench',
      unit: 'kg',
      sets: [
        { weightKg: 150, reps: 1, raw: '150x1' },
        { weightKg: 140, reps: 3, raw: '140x3' },
      ],
    },
  ],
};

beforeEach(() => {
  workoutsMock.mockReturnValue([]);
  findingsMock.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Generous timeout: motion + page transforms can blow the 5s default on a cold
// cache under parallel workers on slower machines/CI.
describe('CoachPage', { timeout: 20000 }, () => {
  it('renders an encouraging empty state with an import CTA when there is no data', async () => {
    await renderCoach();
    expect(screen.getByRole('heading', { name: /nothing to analyze yet/i })).toBeInTheDocument();
    expect(screen.getByText(/front-delt analysis/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import your notes/i })).toHaveAttribute(
      'href',
      '/import',
    );
  });

  it('renders a priority finding card spelling out the comparison + ratio', async () => {
    workoutsMock.mockReturnValue([benchWorkout]);
    findingsMock.mockReturnValue([priorityFinding]);

    await renderCoach();

    // Severity label + ratio chip.
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText(/ratio 0\.50/)).toBeInTheDocument();
    // The full antagonist comparison message renders verbatim.
    expect(
      screen.getByText(/you bench 150kg but only overhead press 75kg/i),
    ).toBeInTheDocument();
    // Focus-on summary surfaces the affected muscle.
    const focus = screen.getByRole('region', { name: /focus on/i });
    expect(focus).toHaveTextContent(/front delts/i);
  });

  it('renders a muscle-coverage view (never-trained groups) from real coverage', async () => {
    // Only bench is logged → legs/back muscles are "never".
    workoutsMock.mockReturnValue([benchWorkout]);
    findingsMock.mockReturnValue([]);

    await renderCoach();

    expect(screen.getByRole('heading', { name: /muscle coverage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /never trained/i })).toBeInTheDocument();
    // Quads were never worked (only bench logged).
    expect(screen.getByText('Quads')).toBeInTheDocument();
  });
});
