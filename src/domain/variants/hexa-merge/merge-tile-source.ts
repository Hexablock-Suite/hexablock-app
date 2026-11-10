import { SeededPieceSource } from '../../engine/piece-source';
import type { RandomSource } from '../../engine/random-source';
import { Range } from '../../engine/range';
import { MergeTile } from './merge-tile';
import type { NewTile } from './new-tile';

// The chance that a new tile is a 4. Else it is a 2 (statement §1.4 says «2 o 4»).
// The value codes against the proposal on issue #57, «Propuesta, pendiente del equipo»
// (overnight queue, 2026-11-06): a 2 with 0.9 and a 4 with 0.1, as in 2048.
export const DEFAULT_FOUR_CHANCE = 0.1;

// The chances that a probability can take: from 0 to 1, both included.
const CHANCES = Range.ofNumbers(0, 1);

// The source of the new Merge tiles (APP-NFR-07). It reuses the engine `SeededPieceSource`,
// so the same seed gives the same tiles, and a draw changes no source.
// Each draw reads two numbers: the first picks the empty cell, the second picks 2 or 4.
// A `fourChance` outside [0, 1] throws a RangeError.
export function mergeTileSource(
  seed: number,
  fourChance = DEFAULT_FOUR_CHANCE,
): SeededPieceSource<NewTile<MergeTile>> {
  if (!CHANCES.contains(fourChance)) {
    throw new RangeError(`The chance of a 4 must be a number from 0 to 1, not ${fourChance}.`);
  }
  return new SeededPieceSource(seed, (random: RandomSource) => ({
    place: random.next(),
    tile: MergeTile.of(random.next() < fourChance ? 4 : 2),
  }));
}
