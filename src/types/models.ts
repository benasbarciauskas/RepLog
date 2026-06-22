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
