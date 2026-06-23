import Fuse from 'fuse.js';
import type { ExerciseDef } from '@/types/models';

export interface ExerciseCatalog {
  /** Exact alias match first, then a Fuse.js fuzzy pass. Returns null if no good match. */
  match(rawName: string): ExerciseDef | null;
  all(): ExerciseDef[];
  add(def: ExerciseDef): void;
}

/**
 * Built-in exercise catalog. The canonical ids here are a CONTRACT: the coach
 * engine's ratio rules reference them by exact id, so do not rename without
 * updating `src/coach/ratios.ts`.
 *
 * Required-exact ids: barbell-bench-press, incline-bench, overhead-press,
 * barbell-row, back-squat, front-squat, deadlift, weighted-pull-up, pull-up.
 */
export const BUILTIN_EXERCISES: ExerciseDef[] = [
  // ---- Horizontal press (chest) ----
  {
    id: 'barbell-bench-press',
    canonicalName: 'Barbell Bench Press',
    aliases: [
      'bench',
      'benchpress',
      'bench press',
      'flat bench',
      'flat barbell bench',
      'flat barbell bench press',
      'barbell bench press',
      'barbell bench',
      'bb bench',
      'bb bench press',
      'barbell bp',
      'bp',
    ],
    category: 'push',
    pattern: 'horizontal-press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front-delts'],
  },
  {
    id: 'incline-bench',
    canonicalName: 'Incline Barbell Bench Press',
    aliases: [
      'incline bench',
      'high incline',
      'incline barbell bench',
      'incline barbell bench press',
      'incline press',
      'incline bench press',
    ],
    category: 'push',
    pattern: 'horizontal-press',
    primaryMuscles: ['chest', 'front-delts'],
    secondaryMuscles: ['triceps'],
  },
  {
    id: 'dumbbell-bench-press',
    canonicalName: 'Dumbbell Bench Press',
    aliases: [
      'dumbbell bench press',
      'dumbbell bench',
      'db bench',
      'db bench press',
      'db press',
      'dumbbell press',
      'flat dumbbell press',
    ],
    category: 'push',
    pattern: 'horizontal-press',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front-delts'],
  },
  {
    id: 'incline-dumbbell-press',
    canonicalName: 'Incline Dumbbell Press',
    aliases: [
      'incline dumbbell press',
      'incline db press',
      'incline dumbbell bench',
      'incline db bench',
    ],
    category: 'push',
    pattern: 'horizontal-press',
    primaryMuscles: ['chest', 'front-delts'],
    secondaryMuscles: ['triceps'],
  },
  {
    id: 'dips',
    canonicalName: 'Dips',
    aliases: ['dips', 'dip', 'chest dips', 'tricep dips', 'parallel bar dips'],
    category: 'push',
    pattern: 'horizontal-press',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['front-delts'],
  },
  {
    id: 'cable-fly',
    canonicalName: 'Cable Fly',
    aliases: ['cable fly', 'cable flys', 'cable flyes', 'pec fly', 'chest fly', 'chest flys'],
    category: 'push',
    pattern: 'isolation',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front-delts'],
  },

  // ---- Vertical press (shoulders) ----
  {
    id: 'overhead-press',
    canonicalName: 'Overhead Press',
    aliases: [
      'ohp',
      'overhead press',
      'oh press',
      'standing press',
      'military press',
      'ohp seated',
      'seated ohp',
      'shoulder press',
      'barbell shoulder press',
      'standing overhead press',
      'bb ohp',
      'bb press',
      'strict press',
    ],
    category: 'push',
    pattern: 'vertical-press',
    primaryMuscles: ['front-delts'],
    secondaryMuscles: ['side-delts', 'triceps', 'traps'],
  },
  {
    id: 'dumbbell-shoulder-press',
    canonicalName: 'Dumbbell Shoulder Press',
    aliases: [
      'dumbbell shoulder press',
      'db shoulder press',
      'seated dumbbell press',
      'db ohp',
      'dumbbell overhead press',
    ],
    category: 'push',
    pattern: 'vertical-press',
    primaryMuscles: ['front-delts'],
    secondaryMuscles: ['side-delts', 'triceps'],
  },
  {
    id: 'lateral-raise',
    canonicalName: 'Lateral Raise',
    aliases: [
      'lateral raise',
      'lateral raises',
      'lat raise',
      'lat raises',
      'side raise',
      'side raises',
      'side lateral raise',
    ],
    category: 'push',
    pattern: 'isolation',
    primaryMuscles: ['side-delts'],
    secondaryMuscles: [],
  },
  {
    id: 'rear-delt-fly',
    canonicalName: 'Rear Delt Fly',
    aliases: [
      'rear delt fly',
      'rear delt flys',
      'rear delt flies',
      'reverse fly',
      'reverse flys',
      'reverse flies',
      'rear delt raise',
      'rear delt raises',
      'bent over rear delt fly',
    ],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['rear-delts'],
    secondaryMuscles: ['upper-back'],
  },

  // ---- Horizontal pull (back) ----
  {
    id: 'barbell-row',
    canonicalName: 'Barbell Row',
    aliases: [
      'row',
      'barbell row',
      'bent over row',
      'bent-over row',
      'pendlay row',
      'bb row',
      'barbell bent over row',
    ],
    category: 'pull',
    pattern: 'horizontal-pull',
    primaryMuscles: ['upper-back', 'lats'],
    secondaryMuscles: ['biceps', 'rear-delts', 'lower-back'],
  },
  {
    id: 'dumbbell-row',
    canonicalName: 'Dumbbell Row',
    aliases: [
      'dumbbell row',
      'db row',
      'one arm row',
      'one-arm row',
      'single arm row',
      'single arm dumbbell row',
    ],
    category: 'pull',
    pattern: 'horizontal-pull',
    primaryMuscles: ['upper-back', 'lats'],
    secondaryMuscles: ['biceps', 'rear-delts'],
  },
  {
    id: 'seated-cable-row',
    canonicalName: 'Seated Cable Row',
    aliases: ['seated cable row', 'cable row', 'cable rows', 'seated row', 'machine row'],
    category: 'pull',
    pattern: 'horizontal-pull',
    primaryMuscles: ['upper-back', 'lats'],
    secondaryMuscles: ['biceps', 'rear-delts'],
  },
  {
    id: 't-bar-row',
    canonicalName: 'T-Bar Row',
    aliases: ['t-bar row', 't bar row', 'tbar row', 'chest supported row'],
    category: 'pull',
    pattern: 'horizontal-pull',
    primaryMuscles: ['upper-back', 'lats'],
    secondaryMuscles: ['biceps', 'rear-delts'],
  },

  // ---- Vertical pull (back) ----
  {
    id: 'weighted-pull-up',
    canonicalName: 'Weighted Pull-Up',
    aliases: [
      'weighted pullup',
      'weighted pullups',
      'weighted pull-up',
      'weighted pull-ups',
      'weighted pull up',
      'weighted pull ups',
      'weighted chin up',
      'weighted chin-up',
      'weighted chinups',
    ],
    category: 'pull',
    pattern: 'vertical-pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper-back', 'rear-delts'],
  },
  {
    id: 'pull-up',
    canonicalName: 'Pull-Up',
    aliases: [
      'pullup',
      'pullups',
      'pull-up',
      'pull-ups',
      'pull up',
      'pull ups',
      'chin up',
      'chin-up',
      'chinup',
      'chinups',
    ],
    category: 'pull',
    pattern: 'vertical-pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper-back', 'rear-delts'],
  },
  {
    id: 'face-pull',
    canonicalName: 'Face Pull',
    aliases: ['face pull', 'face pulls', 'cable face pull', 'rope face pull'],
    category: 'pull',
    pattern: 'horizontal-pull',
    primaryMuscles: ['rear-delts', 'upper-back'],
    secondaryMuscles: ['traps'],
  },
  {
    id: 'lat-pulldown',
    canonicalName: 'Lat Pulldown',
    aliases: [
      'lat pulldown',
      'lat pulldowns',
      'pulldown',
      'pulldowns',
      'lat pull down',
      'lat pull-down',
      'cable pulldown',
    ],
    category: 'pull',
    pattern: 'vertical-pull',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper-back', 'rear-delts'],
  },

  // ---- Squat / legs ----
  {
    id: 'back-squat',
    canonicalName: 'Back Squat',
    aliases: [
      'squat',
      'squats',
      'back squat',
      'barbell squat',
      'bb squat',
      'high bar squat',
      'low bar squat',
      'backsquat',
    ],
    category: 'legs',
    pattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'lower-back', 'abs'],
  },
  {
    id: 'front-squat',
    canonicalName: 'Front Squat',
    aliases: ['front squat', 'front squats', 'barbell front squat'],
    category: 'legs',
    pattern: 'squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'abs', 'upper-back'],
  },
  {
    id: 'hack-squat',
    canonicalName: 'Machine Hack Squat',
    aliases: ['hack squat', 'hack squats', 'machine hack squat', 'hack squat machine'],
    category: 'legs',
    pattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
  },
  {
    id: 'leg-press',
    canonicalName: 'Leg Press',
    aliases: ['leg press', 'leg presses', 'machine leg press', 'legpress'],
    category: 'legs',
    pattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
  },
  {
    id: 'bulgarian-split-squat',
    canonicalName: 'Bulgarian Split Squat',
    aliases: [
      'bulgarian split squat',
      'bulgarian split squats',
      'split squat',
      'split squats',
      'rear foot elevated split squat',
      'bss',
    ],
    category: 'legs',
    pattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
  },
  {
    id: 'lunge',
    canonicalName: 'Lunge',
    aliases: ['lunge', 'lunges', 'walking lunge', 'walking lunges', 'dumbbell lunge'],
    category: 'legs',
    pattern: 'lunge',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
  },
  {
    id: 'leg-extension',
    canonicalName: 'Leg Extension',
    aliases: ['leg extension', 'leg extensions', 'quad extension', 'leg ext'],
    category: 'legs',
    pattern: 'isolation',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
  },
  {
    id: 'leg-curl',
    canonicalName: 'Leg Curl',
    aliases: [
      'leg curl',
      'leg curls',
      'hamstring curl',
      'hamstring curls',
      'lying leg curl',
      'seated leg curl',
    ],
    category: 'legs',
    pattern: 'isolation',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
  },
  {
    id: 'calf-raise',
    canonicalName: 'Calf Raise',
    aliases: [
      'calf raise',
      'calf raises',
      'standing calf raise',
      'seated calf raise',
      'calves',
    ],
    category: 'legs',
    pattern: 'isolation',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
  },

  // ---- Hinge ----
  {
    id: 'deadlift',
    canonicalName: 'Deadlift',
    aliases: [
      'deadlift',
      'deadlifts',
      'conventional deadlift',
      'dl',
      'barbell deadlift',
      'bb deadlift',
      'bb dl',
    ],
    category: 'pull',
    pattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes', 'lower-back'],
    secondaryMuscles: ['upper-back', 'traps', 'forearms', 'quads'],
  },
  {
    id: 'romanian-deadlift',
    canonicalName: 'Romanian Deadlift',
    aliases: [
      'romanian deadlift',
      'romanian deadlifts',
      'rdl',
      'rdls',
      'stiff leg deadlift',
      'stiff-leg deadlift',
      'sldl',
    ],
    category: 'pull',
    pattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower-back', 'upper-back'],
  },
  {
    id: 'sumo-deadlift',
    canonicalName: 'Sumo Deadlift',
    aliases: ['sumo deadlift', 'sumo deadlifts', 'sumo dl', 'sumo'],
    category: 'pull',
    pattern: 'hinge',
    primaryMuscles: ['glutes', 'hamstrings', 'quads'],
    secondaryMuscles: ['lower-back', 'traps', 'forearms'],
  },
  {
    id: 'hip-thrust',
    canonicalName: 'Hip Thrust',
    aliases: ['hip thrust', 'hip thrusts', 'barbell hip thrust', 'glute bridge'],
    category: 'legs',
    pattern: 'hinge',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
  },

  // ---- Arms ----
  {
    id: 'barbell-curl',
    canonicalName: 'Barbell Curl',
    aliases: ['barbell curl', 'barbell curls', 'bb curl', 'bicep curl', 'curls', 'curl'],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    id: 'dumbbell-curl',
    canonicalName: 'Dumbbell Curl',
    aliases: [
      'dumbbell curl',
      'dumbbell curls',
      'db curl',
      'db curls',
      'incline curl',
    ],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    id: 'hammer-curl',
    canonicalName: 'Hammer Curl',
    aliases: ['hammer curl', 'hammer curls', 'db hammer curl', 'dumbbell hammer curl'],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    id: 'preacher-curl',
    canonicalName: 'Preacher Curl',
    aliases: ['preacher curl', 'preacher curls', 'scott curl', 'ez bar preacher curl'],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    id: 'tricep-pushdown',
    canonicalName: 'Tricep Pushdown',
    aliases: [
      'tricep pushdown',
      'tricep pushdowns',
      'triceps pushdown',
      'pushdown',
      'pushdowns',
      'cable pushdown',
      'rope pushdown',
    ],
    category: 'push',
    pattern: 'isolation',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  {
    id: 'skull-crusher',
    canonicalName: 'Skull Crusher',
    aliases: [
      'skull crusher',
      'skull crushers',
      'skullcrusher',
      'lying tricep extension',
      'tricep extension',
      'overhead tricep extension',
    ],
    category: 'push',
    pattern: 'isolation',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },

  // ---- Core ----
  {
    id: 'hanging-leg-raise',
    canonicalName: 'Hanging Leg Raise',
    aliases: [
      'hanging leg raise',
      'hanging leg raises',
      'leg raise',
      'leg raises',
      'hanging knee raise',
    ],
    category: 'core',
    pattern: 'isolation',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['forearms'],
  },
  {
    id: 'plank',
    canonicalName: 'Plank',
    aliases: ['plank', 'planks', 'front plank'],
    category: 'core',
    pattern: 'isolation',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['lower-back'],
  },

  // ---- Cardio ----
  {
    id: 'running',
    canonicalName: 'Running',
    aliases: ['run', 'running', 'jog', 'jogging', 'marathon', '5k', '10k', 'treadmill'],
    category: 'cardio',
    pattern: 'cardio',
    primaryMuscles: ['quads', 'calves'],
    secondaryMuscles: ['hamstrings', 'glutes'],
  },
];

/** Normalize a raw exercise name to its alias-lookup key. */
function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
}

/** Expand common gym shorthand (bb/db) into lookup variants. */
function lookupKeys(raw: string): string[] {
  const key = normalize(raw);
  if (!key) return [];

  const keys = new Set<string>([key]);

  const bb = key.replace(/^bb\s+/, 'barbell ');
  if (bb !== key) {
    keys.add(bb);
    keys.add(key.slice(3).trim());
  }

  const db = key.replace(/^db\s+/, 'dumbbell ');
  if (db !== key) {
    keys.add(db);
    keys.add(key.slice(3).trim());
  }

  // "pullups" -> "pull ups", "chinups" -> "chin ups"
  const spaced = key.replace(/(pull|chin)(ups?)\b/, '$1 $2');
  if (spaced !== key) keys.add(spaced);

  return [...keys];
}

class Catalog implements ExerciseCatalog {
  private defs: ExerciseDef[];
  private aliasIndex = new Map<string, ExerciseDef>();
  private fuse: Fuse<{ name: string; def: ExerciseDef }>;

  constructor(defs: ExerciseDef[]) {
    this.defs = [...defs];
    this.rebuild();
    // assigned in rebuild(); definite-assignment for TS
    this.fuse = this.buildFuse();
  }

  private buildFuse(): Fuse<{ name: string; def: ExerciseDef }> {
    const entries: { name: string; def: ExerciseDef }[] = [];
    for (const def of this.defs) {
      entries.push({ name: normalize(def.canonicalName), def });
      for (const alias of def.aliases) {
        entries.push({ name: normalize(alias), def });
      }
    }
    return new Fuse(entries, {
      keys: ['name'],
      includeScore: true,
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  private rebuild(): void {
    this.aliasIndex.clear();
    for (const def of this.defs) {
      this.aliasIndex.set(normalize(def.canonicalName), def);
      for (const alias of def.aliases) {
        this.aliasIndex.set(normalize(alias), def);
      }
    }
    this.fuse = this.buildFuse();
  }

  match(rawName: string): ExerciseDef | null {
    const keys = lookupKeys(rawName);
    if (keys.length === 0) return null;

    // 1. exact alias / canonical-name hit (bb/db expanded variants first)
    for (const key of keys) {
      const exact = this.aliasIndex.get(key);
      if (exact) return exact;
    }

    // 2. fuzzy fallback — try each expanded key, keep best score
    let best: ExerciseDef | null = null;
    let bestScore = 0.3;
    for (const key of keys) {
      const hits = this.fuse.search(key, { limit: 1 });
      if (hits.length > 0 && hits[0].score !== undefined && hits[0].score < bestScore) {
        bestScore = hits[0].score;
        best = hits[0].item.def;
      }
    }
    return best;
  }

  all(): ExerciseDef[] {
    return [...this.defs];
  }

  add(def: ExerciseDef): void {
    this.defs.push(def);
    this.rebuild();
  }
}

/**
 * Build an exercise catalog: built-ins plus any custom (user-defined) exercises.
 * Custom defs take precedence when aliases collide (registered last wins in the index).
 */
export function createCatalog(custom?: ExerciseDef[]): ExerciseCatalog {
  return new Catalog([...BUILTIN_EXERCISES, ...(custom ?? [])]);
}
