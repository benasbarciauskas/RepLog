import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PPL_NOTE } from '@/parser/__tests__/fixtures/notes';
import type { ReviewRouteState } from './types';

const {
  imageToTextMock,
  settingsMock,
  toastError,
  toastInfo,
  aiParseWorkoutsFromImagesMock,
} = vi.hoisted(() => ({
  imageToTextMock: vi.fn(async () => ''),
  settingsMock: vi.fn(() => ({})),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  aiParseWorkoutsFromImagesMock: vi.fn(),
}));

// Mock OCR + repository so the page renders without tesseract / IndexedDB.
vi.mock('@/ocr/ocr', () => ({ imageToText: imageToTextMock }));
vi.mock('@/data/repository', () => ({
  repository: {
    addNote: vi.fn(async () => {}),
    getCustomExercises: vi.fn(async () => []),
  },
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
  useSettings: () => settingsMock(),
}));
vi.mock('@/ai/openrouter', () => ({
  VISION_IMAGE_CAP: 8,
  aiParseWorkouts: vi.fn(),
  aiParseWorkoutsFromImages: aiParseWorkoutsFromImagesMock,
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
  settingsMock.mockReturnValue({});
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

  it('shows the AI parse button only when an OpenRouter key is set', async () => {
    await renderImport();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Paste/ }));
    expect(screen.queryByRole('button', { name: /AI parse/i })).not.toBeInTheDocument();

    settingsMock.mockReturnValue({ aiApiKey: 'sk-or-test' });
    cleanup();
    await renderImport();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Paste/ }));
    expect(screen.getByRole('button', { name: /AI parse/i })).toBeInTheDocument();
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

  it('does not render the Read with AI button when no OpenRouter key is set', async () => {
    await renderImport();

    const input = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    const file = new File(['pixels'], 'note.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.queryByRole('button', { name: /Read with AI/i })).not.toBeInTheDocument();
  });

  it('renders the Read with AI button when a key is set and images are staged', async () => {
    settingsMock.mockReturnValue({ aiApiKey: 'sk-or-test' });
    await renderImport();

    const input = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    const file = new File(['pixels'], 'note.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('button', { name: /Read with AI/i })).toBeInTheDocument();
  });

  it('calls aiParseWorkoutsFromImages with data URLs and routes to Review', async () => {
    const DATA_URL = 'data:image/png;base64,mockdata';
    const parsedWorkout = {
      date: '2024-08-26',
      dateConfidence: 'high' as const,
      bodyweightKg: null,
      splitCanonical: 'push' as const,
      splitRaw: 'push',
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          rawName: 'Bench press',
          unit: 'kg' as const,
          sets: [{ weightKg: 105, reps: 5, rpe: null, raw: '105x5' }],
        },
      ],
    };

    aiParseWorkoutsFromImagesMock.mockResolvedValue([parsedWorkout]);
    settingsMock.mockReturnValue({
      aiApiKey: 'sk-or-test',
      aiVisionModel: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = DATA_URL;
      readAsDataURL() {
        queueMicrotask(() => {
          this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
        });
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    await renderImport();

    const input = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    const file = new File(['pixels'], 'note.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /Read with AI/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Review Stub' })).toBeInTheDocument(),
    );

    expect(aiParseWorkoutsFromImagesMock).toHaveBeenCalledWith(
      [DATA_URL],
      {
        apiKey: 'sk-or-test',
        model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
      },
      expect.anything(),
    );
    expect(screen.getByTestId('workout-count').textContent).toBe('1');
    expect(screen.getByTestId('tag').textContent).toBe('replog:review');
  });
});