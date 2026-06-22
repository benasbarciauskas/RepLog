/**
 * Public parser surface. Feature code imports from `@/parser` so the internal
 * module layout (catalog / segment / fields / exerciseLine / parseNotes /
 * relevance) can move without touching consumers.
 */
export type { ExerciseCatalog } from './catalog';
export { BUILTIN_EXERCISES, createCatalog } from './catalog';
export { parseExerciseLine } from './exerciseLine';
export { detectSplit, extractBodyweight, extractDate } from './fields';
export { segmentWorkouts } from './segment';
export { parseNotes } from './parseNotes';
export { isWorkoutRelated } from './relevance';
