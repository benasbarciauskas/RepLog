import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CoachFinding, ExerciseBest, Workout } from '@/types/models';

const workoutsMock = vi.fn<() => Workout[]>(() => []);
const findingsMock = vi.fn<() => CoachFinding[]>(() => []);
const bestsMock = vi.fn<() => ExerciseBest[]>(() => []);
const customExercisesMock = vi.fn(() => []);
const activeProgramMock = vi.fn(() => undefined);

// muscleCoverage + balanceScore are intentionally NOT mocked — the page calls
// the real engines.
vi.mock('@/data/hooks', () => ({
  useWorkouts: () => workoutsMock(),
  useCoachFindings: () => findingsMock(),
  useBests: () => bestsMock(),
  useCustomExercises: () => customExercisesMock(),
  useActiveProgram: () => activeProgramMock(),
}));

async function renderCoach() {
  const CoachPage = (await import('./CoachPage')).default;
  return render(
    <MemoryRouter>
      <CoachPage />
    </MemoryRouter>,
  );
}

/** ExerciseBest with just an e1RM (what balanceScore reads). */
function best(exerciseId: string, e1rm: number): ExerciseBest {
  return {
    exerciseId,
    maxWeightKg: e1rm,
    maxWeightDate: '2023-07-10',
    bestE1rmKg: e1rm,
    bestE1rmDate: '2023-07-10',
    repPRs: [],
  };
}

const priorityFinding: CoachFinding = {
  ruleId: 'ohp-bench',
  severity: 'priority',
  ratio: 0.4,
  message:
    'You bench 150kg but only overhead press 60kg (0.40, healthy ≥0.60) — your overhead press is low for your bench press; front delts likely lagging.',
  muscles: ['front-delts', 'triceps'],
};

// Bench + OHP both present so balanceScore can fire ohp-bench.
const scorableBests: ExerciseBest[] = [
  best('barbell-bench-press', 150),
  best('overhead-press', 60),
];

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
  bestsMock.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Generous timeout: motion + gauges can blow the 5s default on a cold cache
// under parallel workers on slower machines/CI.
describe('CoachPage', { timeout: 20000 }, () => {
  it('renders an encouraging empty state with CTAs when there is no data', async () => {
    await renderCoach();
    expect(
      screen.getByRole('heading', { name: /nothing to score yet/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import your notes/i })).toHaveAttribute(
      'href',
      '/import',
    );
  });

  it('prompts for more lifts when data exists but no ratio can be scored', async () => {
    // Only bench logged → no pair → overall is null.
    workoutsMock.mockReturnValue([benchWorkout]);
    bestsMock.mockReturnValue([best('barbell-bench-press', 150)]);

    await renderCoach();
    expect(
      screen.getByRole('heading', { name: /log one more lift/i }),
    ).toBeInTheDocument();
  });

  it('shows the Balance Score ring and a recommendation card with scorable data', async () => {
    workoutsMock.mockReturnValue([benchWorkout]);
    bestsMock.mockReturnValue(scorableBests);
    findingsMock.mockReturnValue([priorityFinding]);

    await renderCoach();

    // The headline score ring is present (accessible img with a Balance Score label).
    expect(
      screen.getByRole('img', { name: /balance score \d+ out of 100/i }),
    ).toBeInTheDocument();

    // Recommendation section + the priority card spelling out the comparison.
    expect(
      screen.getByRole('heading', { name: /do this to improve/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText(/ratio 0\.40/)).toBeInTheDocument();
    expect(
      screen.getByText(/you bench 150kg but only overhead press 60kg/i),
    ).toBeInTheDocument();
  });

  it('renders a muscle-coverage view (never-trained groups) from real coverage', async () => {
    // Only bench is logged → legs/back muscles are "never".
    workoutsMock.mockReturnValue([benchWorkout]);
    bestsMock.mockReturnValue(scorableBests);
    findingsMock.mockReturnValue([]);

    await renderCoach();

    expect(screen.getByRole('heading', { name: /muscle coverage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /never trained/i })).toBeInTheDocument();
    // Quads were never worked (only bench logged).
    expect(screen.getByText('Quads')).toBeInTheDocument();
  });

  it('renders weekly volume rows and a recommendation for undertrained muscles', async () => {
    const recentDate = new Date().toISOString().slice(0, 10);
    const volumeWorkout: Workout = {
      ...benchWorkout,
      date: recentDate,
      createdAt: `${recentDate}T10:00:00.000Z`,
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          rawName: 'Bench',
          unit: 'kg',
          sets: [{ weightKg: 100, reps: 5, raw: '100x5' }],
        },
      ],
    };

    workoutsMock.mockReturnValue([volumeWorkout]);
    bestsMock.mockReturnValue(scorableBests);
    findingsMock.mockReturnValue([]);

    await renderCoach();

    expect(screen.getByRole('heading', { name: /weekly volume/i })).toBeInTheDocument();
    expect(screen.getByText(/working sets per muscle over the last 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/add \d+ sets of quads this week/i)).toBeInTheDocument();
    const volumeSection = screen.getByRole('heading', { name: /weekly volume/i }).closest('section');
    expect(volumeSection).not.toBeNull();
    expect(volumeSection!.querySelectorAll('li').length).toBeGreaterThan(0);
  });
});
