import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ParsedWorkout, Workout } from '@/types/models';
import { REVIEW_STATE_TAG, type ReviewRouteState } from '../import/types';

const saveWorkouts = vi.fn<(w: Workout[]) => Promise<void>>(async () => {});
const addCustomExercise = vi.fn<(d: unknown) => Promise<void>>(async () => {});
vi.mock('@/data/repository', () => ({
  repository: {
    saveWorkouts: (w: Workout[]) => saveWorkouts(w),
    addCustomExercise: (d: unknown) => addCustomExercise(d),
  },
}));

const PARSED: ParsedWorkout = {
  date: '2024-08-26',
  dateConfidence: 'high',
  bodyweightKg: 88,
  splitCanonical: 'push',
  splitRaw: 'Push',
  exercises: [
    {
      exerciseId: 'barbell-bench-press',
      rawName: 'Benchpress',
      unit: 'kg',
      sets: [{ weightKg: 105, reps: 5, raw: '105x5' }],
    },
  ],
};

function makeState(overrides: Partial<ReviewRouteState> = {}) {
  return {
    tag: REVIEW_STATE_TAG,
    workouts: [PARSED],
    skippedCount: 0,
    skipped: [],
    warnings: [],
    ...overrides,
  };
}

async function renderReview(state: unknown) {
  const ReviewPage = (await import('./ReviewPage')).default;
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/review', state }]}>
      <Routes>
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/" element={<h1>Dashboard Stub</h1>} />
        <Route path="/import" element={<h1>Import Stub</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReviewPage', () => {
  it('shows a graceful empty state with an Import CTA when visited directly', async () => {
    await renderReview(null);
    expect(
      screen.getByRole('heading', { name: /Nothing to review/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Import/i })).toBeInTheDocument();
  });

  it('edits a rep value and saves it through the repository', async () => {
    await renderReview(makeState());

    const repsInput = screen.getByLabelText(/Set 1 reps/i) as HTMLInputElement;
    expect(repsInput.value).toBe('5');
    fireEvent.change(repsInput, { target: { value: '8' } });

    // Two save buttons render (header + footer); either confirms.
    fireEvent.click(screen.getAllByRole('button', { name: /Confirm & save/i })[0]);

    await waitFor(() => expect(saveWorkouts).toHaveBeenCalledTimes(1));
    const saved = saveWorkouts.mock.calls[0][0];
    expect(saved).toHaveLength(1);
    expect(saved[0].exercises[0].sets[0].reps).toBe(8);
    // Edited value persisted, not the original.
    expect(saved[0].exercises[0].sets[0].weightKg).toBe(105);
    expect(saved[0].id).toBeTruthy();
    expect(saved[0].createdAt).toBeTruthy();

    // Navigates home after saving.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Dashboard Stub' })).toBeInTheDocument(),
    );
  });

  it('renders a collapsible "N unrelated notes skipped" peek', async () => {
    await renderReview(makeState({ skippedCount: 2, skipped: ['Groceries', 'To-do list'] }));
    const toggle = screen.getByRole('button', { name: /unrelated notes skipped/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
