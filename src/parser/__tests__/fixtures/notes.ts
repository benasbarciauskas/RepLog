/**
 * Real-shaped workout-note fixtures, transcribed from the kind of messy phone
 * notes RepLog must parse (the v1 spec's "Workout from 26 Aug 2024 (PPL)" block
 * plus neighbouring sessions). Kept verbatim-messy on purpose: scheme prefixes,
 * kg/kgs/no-unit mix, carried weights, decimals, an inline secondary exercise
 * ("archers x 10") that should surface as a warning, and a cardio session.
 */

export const PPL_NOTE = `Workout from 26 Aug 2024 (PPL)
Push day - 88ish kgs
Benchpress 5x5: 105x 5, 5, 5, 5, 4
OHP: 70kgx5, 60kgx 8
Incline bench: 80x8, 80x8, 75x10
Cable bicep isos: 20kg x 11, 12`;

export const MULTI_SESSION_NOTE = `Workout from 26 Aug 2024 (PPL)
Push day - 88ish kgs
Benchpress 5x5: 105x 5, 5, 5, 5, 4
OHP: 70kgx5, 60kgx 8
Incline bench: 80x8, 80x8

28 Aug 2024
Pull - 87 kgs
Weighted pullups 5x5: 30kgsx 5, 5, 5, 5, 7, 13
Barbell row: 80x8, 80x8, 75x10
Pullups: 20, 16, 12, then archers x 10

30 Aug 2024
Leg Day
Squat: 140x5, 140x5, 130x8
Deadlift: 180x3, 180x3
RDL: 100x8, 100x8

2 Sep 2024
Marathon (42.2km - 6:16 pace)`;
