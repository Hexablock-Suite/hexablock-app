// Right example: domain code takes time and randomness by injection.
export type Clock = { now(): number };
export type RandomSource = { next(): number };

export function deal(clock: Clock, random: RandomSource) {
  return { at: new Date(clock.now()), roll: random.next() };
}
