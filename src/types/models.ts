export type Unit = 'kg' | 'lb';

export type SplitCanonical =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower'
  | 'chest-back' | 'chest-tris' | 'back-bis' | 'shoulders' | 'arms'
  | 'full-body' | 'cardio' | 'unknown';

export type MuscleGroup =
  | 'chest' | 'front-delts' | 'side-delts' | 'rear-delts'
  | 'lats' | 'traps' | 'upper-back' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'lower-back';

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'cardio';
export type MovementPattern =
  | 'horizontal-press' | 'vertical-press' | 'horizontal-pull' | 'vertical-pull'
  | 'squat' | 'hinge' | 'lunge' | 'isolation' | 'carry' | 'cardio';

export interface ExerciseDef {
  id: string;                 // 'barbell-bench-press'
  canonicalName: string;      // 'Barbell Bench Press'
  aliases: string[];          // lowercase alias strings
  category: ExerciseCategory;
  pattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
}

export interface SetEntry {
  weightKg: number | null;    // null = bodyweight / unspecified
  reps: number;
  rpe?: number | null;        // optional rate of perceived exertion (6–10)
  isWarmup?: boolean;
  isFailure?: boolean;
  raw: string;                // original token, e.g. '105x5'
}

export interface WorkoutExercise {
  exerciseId: string;         // catalog id, or 'unknown:<slug>' if uncatalogued
  rawName: string;
  unit: Unit;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  date: string;               // ISO 'yyyy-mm-dd'
  dateConfidence: 'high' | 'low';
  bodyweightKg: number | null;
  splitCanonical: SplitCanonical;
  splitRaw: string | null;
  blockId: string | null;
  sourceNoteId: string;
  exercises: WorkoutExercise[];
  createdAt: string;          // ISO datetime
}

export type NoteSource = 'screenshot' | 'paste' | 'share';
export type NoteStatus = 'parsed' | 'needs-review' | 'confirmed';
export interface RawNote {
  id: string;
  sourceType: NoteSource;
  rawText: string;
  importedAt: string;
  status: NoteStatus;
}

export interface TrainingBlock {
  id: string;
  startDate: string; endDate: string;
  splitCanonical: SplitCanonical;
  label: string;
}

// analytics outputs (defined here so coach can import without depending on analytics impl)
export interface RepPR { reps: number; weightKg: number; date: string }
export interface ExerciseBest {
  exerciseId: string;
  maxWeightKg: number | null;
  maxWeightDate: string | null;
  bestE1rmKg: number | null;
  bestE1rmDate: string | null;
  repPRs: RepPR[];
}

// coach outputs
export type FindingSeverity = 'ok' | 'flag' | 'priority';
export interface CoachFinding {
  ruleId: string;
  severity: FindingSeverity;
  ratio: number | null;
  message: string;
  muscles: MuscleGroup[];
}

// parser output (candidate workouts, pre-storage)
export interface ParsedWorkout {
  date: string; dateConfidence: 'high' | 'low';
  bodyweightKg: number | null;
  splitCanonical: SplitCanonical; splitRaw: string | null;
  exercises: WorkoutExercise[];
}
export interface ParseResult { workouts: ParsedWorkout[]; warnings: string[] }

// ---------------------------------------------------------------------------
// v1.1 live logger. The active session is the mutable,
// in-progress workout; on finish it's converted to an immutable `Workout`.
// Kept separate from `Workout`/`SetEntry` so logging-in-progress rows can be
// partial (null weight/reps) without weakening the saved data model.
// ---------------------------------------------------------------------------

/** One editable set row in a live workout. `done` toggles it into the saved set. */
export interface ActiveSet {
  id: string;
  weightKg: number | null;
  reps: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  done: boolean;
}

/** One exercise within a live workout, with its own ordered set rows. */
export interface ActiveExercise {
  id: string;
  exerciseId: string;         // catalog id, or 'unknown:<slug>' if uncatalogued
  rawName: string;
  unit: Unit;
  sets: ActiveSet[];
  restSeconds?: number;       // per-exercise rest-timer default (falls back to AppSettings)
  note?: string;
}

/** The single in-progress workout, persisted so it survives refresh. */
export interface ActiveSession {
  id: string;
  startedAt: string;          // ISO datetime
  routineId?: string | null;  // set when started from a routine
  bodyweightKg?: number | null;
  splitCanonical?: SplitCanonical;
  exercises: ActiveExercise[];
}

/** A reusable template a session can be started from. */
export interface Routine {
  id: string;
  name: string;
  exercises: {
    exerciseId: string;
    rawName: string;
    targetSets: number;
    targetReps?: number;
    restSeconds?: number;
  }[];
  createdAt: string;          // ISO datetime
  updatedAt: string;          // ISO datetime
}

// ---------------------------------------------------------------------------
// v1.2 program generator — research-based, on-device workout plans.
// ---------------------------------------------------------------------------

export type ProgramGoal = 'hypertrophy' | 'strength';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type SplitChoice = 'auto' | 'full-body' | 'push-pull-legs' | 'upper-lower';
export type SleepQuality = 'poor' | 'average' | 'good';
export type StressLevel = 'low' | 'moderate' | 'high';

export interface ProgramConfig {
  goal: ProgramGoal;
  experience: Experience;
  daysPerWeek: number;
  split: SplitChoice;
  minutesPerSession: number;
  /** Optional — defaults to average when absent (backward-compatible). */
  sleep?: SleepQuality;
  /** Optional — defaults to moderate when absent (backward-compatible). */
  stress?: StressLevel;
}

export interface ProgramDayExercise {
  exerciseId: string;
  rawName: string;
  targetSets: number;
  repRange: [number, number];
  rir: number;
  restSeconds: number;
}

export type ProgramDayIntensity = 'heavy' | 'moderate' | 'light';

export interface ProgramDay {
  name: string;
  splitCanonical: SplitCanonical;
  exercises: ProgramDayExercise[];
  /** Set when DUP shifts intensity for repeated day-types within the week. */
  intensity?: ProgramDayIntensity;
}

export interface Program {
  id: string;
  name: string;
  config: ProgramConfig;
  days: ProgramDay[];
  createdAt: string;
  updatedAt: string;
}

/** App-wide preferences for the logger (bar/plate config, rest, display unit). */
export interface AppSettings {
  barWeightKg: number;
  availablePlatesKg: number[];
  defaultRestSeconds: number;
  unit: Unit;
  /** User's OpenRouter API key — stored locally, never exported in backups. */
  aiApiKey?: string;
  /** OpenRouter model id for AI parse (defaults to a free tier model). */
  aiModel?: string;
  /** OpenRouter model id for vision screenshot import (must support images). */
  aiVisionModel?: string;
}
