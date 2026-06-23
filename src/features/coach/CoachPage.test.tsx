import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CoachFinding, ExerciseBest, Workout } from '@/types/models';
import type { MuscleVolume, VolumeReport } from '@/coach/volume';

const workoutsMock = vi.fn<() => Workout[]>(() => []);
const findingsMock = vi.fn<() => CoachFinding[]>(() => []);
const bestsMock = vi.fn<() => ExerciseBest[]>(() => []);
const volumeMock = vi.fn<() => VolumeReport>(() => ({
  weeks: 4,
  anchorDate: null,
  muscles: [],
}));

// balanceScore is intentionally NOT mocked — the page calls the real engine.
vi.mock('@/data/hooks', () => ({
  useWorkouts: () => workoutsMock(),
  useCoachFindings: () => findingsMock(),
  useBests: () => bestsMock(),
  useWeeklyVolume: () => volumeMock(),
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

/** Build a MuscleVolume entry for test fixtures. */
function muscleVol(
  muscle: MuscleVolume['muscle'],
  setsPerWeek: number,
  status: MuscleVolume['status'],
): MuscleVolume {
  return { muscle, setsPerWeek, totalSets: setsPerWeek * 4, status };
}

beforeEach(() => {
  workoutsMock.mockReturnValue([]);
  findingsMock.mockReturnValue([]);
  bestsMock.mockReturnValue([]);
  volumeMock.mockReturnValue({ weeks: 4, anchorDate: null, muscles: [] });
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

  it('renders a weekly volume section with undertrained chips', async () => {
    workoutsMock.mockReturnValue([benchWorkout]);
    bestsMock.mockReturnValue(scorableBests);
    findingsMock.mockReturnValue([]);
    volumeMock.mockReturnValue({
      weeks: 4,
      anchorDate: '2023-07-10',
      muscles: [
        muscleVol('hamstrings', 0, 'never'),
        muscleVol('quads', 2.5, 'under'),
        muscleVol('chest', 10, 'optimal'),
      ],
    });

    await renderCoach();

    // Weekly volume heading is present.
    expect(screen.getByRole('heading', { name: /weekly volume/i })).toBeInTheDocument();

    // An undertrained chip for quads (setsPerWeek 2.5 → '2.5/wk').
    expect(screen.getByText(/Quads · 2\.5\/wk/)).toBeInTheDocument();

    // A never chip for hamstrings (setsPerWeek 0 → '0/wk').
    expect(screen.getByText(/Hamstrings · 0\/wk/)).toBeInTheDocument();
  });
});
