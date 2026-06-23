import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ExerciseSearchDialog, type ExercisePick } from './ExerciseSearchDialog';
import { buildCustomExerciseDef } from './customExercise';
import { db } from '@/data/db';
import { repository } from '@/data/repository';

async function clearDb() {
  await db.customExercises.clear();
}

beforeEach(async () => {
  await clearDb();
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await clearDb();
});

function renderDialog(onPick: (p: ExercisePick) => void) {
  return render(
    <ExerciseSearchDialog open onOpenChange={() => {}} onPick={onPick} />,
  );
}

async function openCreateForm(name: string) {
  const search = await screen.findByLabelText('Search exercises');
  fireEvent.change(search, { target: { value: name } });
  const addBtn = await screen.findByText(new RegExp(`Add\\s*[“"]${name}[”"]`, 'i'));
  fireEvent.click(addBtn.closest('button')!);
  await screen.findByText('Custom exercise');
}

async function selectPrimaryMuscle(label: string) {
  const group = await screen.findByRole('group', { name: /primary muscles/i });
  fireEvent.click(within(group).getByRole('button', { name: label }));
}

describe('ExerciseSearchDialog — custom exercises', () => {
  it('persists a tagged custom exercise and picks it with a custom:<slug> id', async () => {
    const onPick = vi.fn();
    renderDialog(onPick);

    await openCreateForm('Sissy Squat');
    await selectPrimaryMuscle('Quads');
    fireEvent.click(await screen.findByRole('button', { name: /add exercise/i }));

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick).toHaveBeenCalledWith({
      exerciseId: 'custom:sissy-squat',
      rawName: 'Sissy Squat',
    });

    const stored = await db.customExercises.get('custom:sissy-squat');
    expect(stored).toBeTruthy();
    expect(stored?.canonicalName).toBe('Sissy Squat');
    expect(stored?.primaryMuscles).toEqual(['quads']);
    expect(stored?.category).toBe('legs');
    expect(stored?.pattern).toBe('isolation');
  });

  it('passes a full ExerciseDef with chosen muscles to addCustomExercise', async () => {
    const addSpy = vi.spyOn(repository, 'addCustomExercise');
    const onPick = vi.fn();
    renderDialog(onPick);

    await openCreateForm('Spider Curl');
    await selectPrimaryMuscle('Biceps');
    fireEvent.click(await screen.findByRole('button', { name: /add exercise/i }));

    await waitFor(() => expect(addSpy).toHaveBeenCalledTimes(1));
    const def = addSpy.mock.calls[0][0];
    expect(def).toEqual(
      buildCustomExerciseDef({
        canonicalName: 'Spider Curl',
        primaryMuscles: ['biceps'],
      }),
    );
    expect(def.primaryMuscles).toEqual(['biceps']);
    expect(def.id).toBe('custom:spider-curl');
  });

  it('surfaces a previously-added custom exercise in future search results', async () => {
    await db.customExercises.put({
      id: 'custom:nordic-curl',
      canonicalName: 'Nordic Curl',
      aliases: ['nordic curl'],
      category: 'legs',
      pattern: 'hinge',
      primaryMuscles: ['hamstrings'],
      secondaryMuscles: ['glutes'],
    });

    const onPick = vi.fn();
    renderDialog(onPick);

    const search = await screen.findByLabelText('Search exercises');
    fireEvent.change(search, { target: { value: 'nordic' } });

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

    await openCreateForm('Hack Squat');
    await selectPrimaryMuscle('Quads');
    fireEvent.click(await screen.findByRole('button', { name: /add exercise/i }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());

    cleanup();
    renderDialog(onPick);
    const search2 = await screen.findByLabelText('Search exercises');
    fireEvent.change(search2, { target: { value: 'Hack Squat' } });
    const listbox = await screen.findByRole('listbox', { name: /exercise results/i });
    fireEvent.click(
      (await within(listbox).findByText('Hack Squat')).closest('button')!,
    );

    const all = await db.customExercises.where('id').equals('custom:hack-squat').toArray();
    expect(all).toHaveLength(1);
  });

  it('requires at least one primary muscle before submit', async () => {
    renderDialog(vi.fn());
    await openCreateForm('Mystery Move');
    const submit = await screen.findByRole('button', { name: /add exercise/i });
    expect(submit).toBeDisabled();
  });
});