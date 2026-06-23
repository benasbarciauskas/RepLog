import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PPL_NOTE } from '@/parser/__tests__/fixtures/notes';
import type { ReviewRouteState } from './types';

const { imageToTextMock, toastError, toastInfo } = vi.hoisted(() => ({
  imageToTextMock: vi.fn(async () => ''),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

// Mock OCR + repository so the page renders without tesseract / IndexedDB.
vi.mock('@/ocr/ocr', () => ({ imageToText: imageToTextMock }));
vi.mock('@/data/repository', () => ({
  repository: { addNote: vi.fn(async () => {}) },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: toastError,
    info: toastInfo,
  }),
}));
vi.mock('@/data/hooks', () => ({
  useWorkouts: () => [],
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

const NON_WORKOUT_TEXT = 'Grocery list: milk, eggs, bread';

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-preview'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  imageToTextMock.mockResolvedValue('');
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

  it('shows a hint about multi-note imports in the screenshots tab', async () => {
    await renderImport();
    expect(
      screen.getByText(/pasting the text or using one screenshot per note/i),
    ).toBeInTheDocument();
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

  it('stays on Paste with an info toast when pasted text has no detectable workout', async () => {
    await renderImport();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Paste/ }));
    const textarea = await screen.findByLabelText(/Paste your workout notes/i);
    fireEvent.change(textarea, { target: { value: NON_WORKOUT_TEXT } });

    fireEvent.click(screen.getByRole('button', { name: /Parse text/i }));

    await waitFor(() => expect(toastInfo).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Review Stub' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Paste/ })).toHaveAttribute('data-state', 'active');
    expect(textarea).toHaveValue(NON_WORKOUT_TEXT);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('switches to Paste with OCR text when screenshots yield no detectable workout', async () => {
    imageToTextMock.mockResolvedValue(NON_WORKOUT_TEXT);
    await renderImport();

    const input = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    const file = new File(['pixels'], 'note.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /Read & parse/i }));

    await waitFor(() => expect(toastInfo).toHaveBeenCalled());
    const textarea = await screen.findByLabelText(/Paste your workout notes/i);
    expect(textarea).toHaveValue(NON_WORKOUT_TEXT);
    expect(screen.getByRole('tab', { name: /Paste/ })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByRole('heading', { name: 'Review Stub' })).not.toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows an error when OCR reads no text from screenshots', async () => {
    imageToTextMock.mockResolvedValue('');
    await renderImport();

    const input = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    const file = new File(['pixels'], 'blank.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /Read & parse/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Review Stub' })).not.toBeInTheDocument();
    expect(toastInfo).not.toHaveBeenCalled();
  });
});