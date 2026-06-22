import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PPL_NOTE } from '@/parser/__tests__/fixtures/notes';
import type { ReviewRouteState } from './types';

// Mock OCR + repository so the page renders without tesseract / IndexedDB.
vi.mock('@/ocr/ocr', () => ({ imageToText: vi.fn(async () => '') }));
vi.mock('@/data/repository', () => ({
  repository: { addNote: vi.fn(async () => {}) },
}));

// A stub Review screen that surfaces the route-state it received, so the test
// can assert Import handed off the parsed workouts.
function ReviewStub() {
  const state = useLocation().state as (ReviewRouteState & { tag: string }) | null;
  return (
    <div>
      <h1>Review Stub</h1>
      <span data-testid="workout-count">{state?.workouts.length ?? 0}</span>
      <span data-testid="tag">{state?.tag ?? ''}</span>
    </div>
  );
}

async function renderImport() {
  const ImportPage = (await import('./ImportPage')).default;
  return render(
    <MemoryRouter initialEntries={['/import']}>
      <Routes>
        <Route path="/import" element={<ImportPage />} />
        <Route path="/review" element={<ReviewStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportPage', () => {
  it('renders all three import modes', async () => {
    await renderImport();
    expect(screen.getByRole('tab', { name: /Screenshots/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Paste/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Video/ })).toBeInTheDocument();
  });

  it('surfaces the HEVC caveat in the video tab', async () => {
    await renderImport();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Video/ }));
    expect(await screen.findByText(/HEVC/i)).toBeInTheDocument();
  });

  it('parses pasted notes and routes to Review with the parsed workouts', async () => {
    await renderImport();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Paste/ }));
    const textarea = await screen.findByLabelText(/Paste your workout notes/i);
    fireEvent.change(textarea, { target: { value: PPL_NOTE } });

    fireEvent.click(screen.getByRole('button', { name: /Parse text/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Review Stub' })).toBeInTheDocument(),
    );
    expect(
      Number(screen.getByTestId('workout-count').textContent),
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('tag').textContent).toBe('replog:review');
  });

  it('keeps the parse button disabled until there is paste input', async () => {
    await renderImport();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Paste/ }));
    const btn = screen.getByRole('button', { name: /Parse text/i });
    expect(btn).toBeDisabled();
    const textarea = await screen.findByLabelText(/Paste your workout notes/i);
    fireEvent.change(textarea, { target: { value: 'Bench: 100x5' } });
    expect(screen.getByRole('button', { name: /Parse text/i })).toBeEnabled();
  });
});
