import { SeededPieceSource } from '../../engine/piece-source';
import type { RandomSource } from '../../engine/random-source';
import type { Seed } from '../../engine/seed';
import { Chance } from './chance';
import { MergeTile } from './merge-tile';
import { NewTile } from './new-tile';

// The chance that a new tile is a 4. Else it is a 2 (statement §1.4 says «2 o 4»).
// The value codes against the proposal on issue #57, «Propuesta, pendiente del equipo»
// (overnight queue, 2026-11-06): a 2 with 0.9 and a 4 with 0.1, as in 2048.
export const DEFAULT_FOUR_CHANCE = Chance.of(0.1);

// The source of the new Merge tiles (APP-NFR-07). It reuses the engine `SeededPieceSource`,
// so the same seed gives the same tiles, and a draw changes no source.
// Each draw reads two numbers: the first picks the empty cell, the second picks 2 or 4.
// The seed and the chance check themselves (classes.md decision 48), so this function makes no check.
export function mergeTileSource(
  seed: Seed,
  fourChance: Chance = DEFAULT_FOUR_CHANCE,
): SeededPieceSource<NewTile<MergeTile>> {
  return new SeededPieceSource(seed, (random: RandomSource) => {
    const place = random.next();
    return NewTile.of(place, MergeTile.of(fourChance.hits(random.next()) ? 4 : 2));
  });
}
