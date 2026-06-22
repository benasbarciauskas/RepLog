import { describe, expect, it } from 'vitest';
import type { ExerciseDef } from '@/types/models';
import { BUILTIN_EXERCISES, createCatalog } from '../catalog';

describe('BUILTIN_EXERCISES', () => {
  it('has at least 25 lifts', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(25);
  });

  it('every def has unique id, canonical name, muscles, category, pattern', () => {
    const ids = new Set<string>();
    for (const def of BUILTIN_EXERCISES) {
      expect(def.id).toBeTruthy();
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      expect(def.canonicalName).toBeTruthy();
      expect(def.primaryMuscles.length).toBeGreaterThan(0);
      expect(def.category).toBeTruthy();
      expect(def.pattern).toBeTruthy();
      // aliases are lowercase
      for (const a of def.aliases) {
        expect(a).toBe(a.toLowerCase());
      }
    }
  });

  it('contains the canonical ids the coach engine references', () => {
    const required = [
      'barbell-bench-press',
      'incline-bench',
      'overhead-press',
      'barbell-row',
      'back-squat',
      'front-squat',
      'deadlift',
      'weighted-pull-up',
      'pull-up',
    ];
    const ids = new Set(BUILTIN_EXERCISES.map((d) => d.id));
    for (const r of required) {
      expect(ids.has(r)).toBe(true);
    }
  });
});

describe('createCatalog().match', () => {
  const cat = createCatalog();

  it('matches exact aliases', () => {
    expect(cat.match('bench')?.id).toBe('barbell-bench-press');
    expect(cat.match('benchpress')?.id).toBe('barbell-bench-press');
    expect(cat.match('flat barbell bench press')?.id).toBe('barbell-bench-press');
    expect(cat.match('ohp')?.id).toBe('overhead-press');
    expect(cat.match('military press')?.id).toBe('overhead-press');
    expect(cat.match('pendlay row')?.id).toBe('barbell-row');
    expect(cat.match('squat')?.id).toBe('back-squat');
    expect(cat.match('conventional deadlift')?.id).toBe('deadlift');
    expect(cat.match('incline bench')?.id).toBe('incline-bench');
  });

  it('is case- and whitespace-insensitive on exact alias', () => {
    expect(cat.match('  Bench  ')?.id).toBe('barbell-bench-press');
    expect(cat.match('OHP')?.id).toBe('overhead-press');
  });

  it('fuzzy-matches close misspellings', () => {
    expect(cat.match('benchpres')?.id).toBe('barbell-bench-press');
    expect(cat.match('deadlfit')?.id).toBe('deadlift');
  });

  it('returns null for clearly uncatalogued names', () => {
    expect(cat.match('cable bicep isos')).toBeNull();
    expect(cat.match('zercher carry to the moon')).toBeNull();
  });

  it('distinguishes bodyweight pull-up from weighted pull-up by alias', () => {
    expect(cat.match('pullups')?.id).toBe('pull-up');
    expect(cat.match('weighted pullups')?.id).toBe('weighted-pull-up');
  });
});

describe('createCatalog() custom + add', () => {
  const custom: ExerciseDef = {
    id: 'unknown:cable-bicep-isos',
    canonicalName: 'Cable Bicep Isos',
    aliases: ['cable bicep isos'],
    category: 'pull',
    pattern: 'isolation',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
  };

  it('includes custom exercises passed to createCatalog', () => {
    const cat = createCatalog([custom]);
    expect(cat.match('cable bicep isos')?.id).toBe('unknown:cable-bicep-isos');
    expect(cat.all().some((d) => d.id === 'unknown:cable-bicep-isos')).toBe(true);
  });

  it('add() registers a new def at runtime', () => {
    const cat = createCatalog();
    expect(cat.match('cable bicep isos')).toBeNull();
    cat.add(custom);
    expect(cat.match('cable bicep isos')?.id).toBe('unknown:cable-bicep-isos');
  });

  it('all() returns builtins (+ custom)', () => {
    const cat = createCatalog([custom]);
    expect(cat.all().length).toBe(BUILTIN_EXERCISES.length + 1);
  });
});
