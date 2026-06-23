import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ExerciseSearchDialog, type ExercisePick } from './ExerciseSearchDialog';
import { db } from '@/data/db';

async function clearDb() {
  await db.customExercises.clear();
}

beforeEach(async () => {
  await clearDb();
});

afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  await clearDb();
});

function renderDialog(onPick: (p: ExercisePick) => void) {
  return render(
    <ExerciseSearchDialog open onOpenChange={() => {}} onPick={onPick} />,
  );
}

describe('ExerciseSearchDialog — custom exercises', () => {
  it('persists a typed-in name and picks it with a custom:<slug> id', async () => {
    const onPick = vi.fn();
    renderDialog(onPick);

    const search = await screen.findByLabelText('Search exercises');
    fireEvent.change(search, { target: { value: 'Sissy Squat' } });

    // The "Add …" custom option appears for a name not in the catalog.
    const addBtn = await screen.findByText(/Add\s*[“"]Sissy Squat[”"]/i);
    fireEvent.click(addBtn.closest('button')!);

    // It picks the new exercise with the deterministic id scheme.
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick).toHaveBeenCalledWith({
      exerciseId: 'custom:sissy-squat',
      rawName: 'Sissy Squat',
    });

    // And it was persisted to the DB (reusable).
    const stored = await db.customExercises.get('custom:sissy-squat');
    expect(stored).toBeTruthy();
    expect(stored?.canonicalName).toBe('Sissy Squat');
  });

  it('surfaces a previously-added custom exercise in future search results', async () => {
    // Seed a custom exercise as if it were created in an earlier session.
    await db.customExercises.put({
      id: 'custom:nordic-curl',
      canonicalName: 'Nordic Curl',
      aliases: ['nordic curl'],
      category: 'push',
      pattern: 'isolation',
      primaryMuscles: [],
      secondaryMuscles: [],
    });

    const onPick = vi.fn();
    renderDialog(onPick);

    const search = await screen.findByLabelText('Search exercises');
    fireEvent.change(search, { target: { value: 'nordic' } });

    // It shows up as a real catalog result (not the "Add custom" option).
    const listbox = await screen.findByRole('listbox', { name: /exercise results/i });
    const result = await within(listbox).findByText('Nordic Curl');
    fireEvent.click(result.closest('button')!);

    expect(onPick).toHaveBeenCalledWith({
      exerciseId: 'custom:nordic-curl',
      rawName: 'Nordic Curl',
    });
  });

  it('is idempotent — re-adding the same name reuses the same row/id', async () => {
    const onPick = vi.fn();
    renderDialog(onPick);

    const search = await screen.findByLabelText('Search exercises');
    fireEvent.change(search, { target: { value: 'Hack Squat' } });
    fireEvent.click(
      (await screen.findByText(/Add\s*[“"]Hack Squat[”"]/i)).closest('button')!,
    );
    await waitFor(() => expect(onPick).toHaveBeenCalled());

    // Add it again from a fresh dialog instance.
    cleanup();
    renderDialog(onPick);
    const search2 = await screen.findByLabelText('Search exercises');
    fireEvent.change(search2, { target: { value: 'Hack Squat' } });
    // Now it's a catalog hit, so picking it does not duplicate the row.
    const listbox = await screen.findByRole('listbox', { name: /exercise results/i });
    fireEvent.click(
      (await within(listbox).findByText('Hack Squat')).closest('button')!,
    );

    const all = await db.customExercises.where('id').equals('custom:hack-squat').toArray();
    expect(all).toHaveLength(1);
  });
});
