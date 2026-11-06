/** @jest-environment node */
import {
  FixedListPieceSource,
  SeededPieceSource,
  type IPieceSource,
} from '../../../src/domain/engine/piece-source';
import type { RandomSource } from '../../../src/domain/engine/random-source';
import { Mulberry32Random } from '../../../src/domain/engine/mulberry32-random';

// A draw function that turns one random number into a piece name.
const colors = ['red', 'green', 'blue', 'yellow'];
const drawColor = (random: RandomSource): string =>
  colors[Math.floor(random.next() * colors.length)] ?? 'red';

function take<T>(source: IPieceSource<T>, count: number): T[] {
  const pieces: T[] = [];
  for (const piece of source) {
    pieces.push(piece);
    if (pieces.length === count) break;
  }
  return pieces;
}

describe('FixedListPieceSource', () => {
  it('should_end_after_the_last_piece_when_read_with_for_of', () => {
    const source = new FixedListPieceSource(['a', 'b', 'c']);

    expect([...source]).toEqual(['a', 'b', 'c']);
    expect(source.hasNext()).toBe(false);
  });

  it('should_throw_when_next_runs_after_the_last_piece', () => {
    const source = new FixedListPieceSource(['a']);
    source.next();

    expect(() => source.next()).toThrow('no piece left');
  });

  it('should_keep_its_pieces_when_the_caller_changes_the_list', () => {
    const list = ['a', 'b'];
    const source = new FixedListPieceSource(list);

    list.push('c');

    expect([...source]).toEqual(['a', 'b']);
  });

  it('should_end_at_once_when_the_list_is_empty', () => {
    expect([...new FixedListPieceSource<string>([])]).toEqual([]);
  });

  it('should_give_nothing_the_second_time_when_the_source_is_read_twice', () => {
    const source = new FixedListPieceSource(['a', 'b']);

    expect([...source]).toEqual(['a', 'b']);
    expect([...source]).toEqual([]);
  });

  it('should_throw_a_range_error_when_the_list_holds_undefined', () => {
    expect(() => new FixedListPieceSource<string | undefined>(['a', undefined])).toThrow(
      RangeError,
    );
    expect(() => new FixedListPieceSource<string | undefined>(['a', undefined])).toThrow(
      'undefined',
    );
  });
});

describe('SeededPieceSource', () => {
  it('should_repeat_the_same_sequence_when_two_sources_share_the_seed', () => {
    const first = take(new SeededPieceSource(42, drawColor), 20);
    const second = take(new SeededPieceSource(42, drawColor), 20);

    expect(second).toEqual(first);
  });

  it('should_give_another_sequence_when_the_seed_differs', () => {
    const first = take(new SeededPieceSource(42, drawColor), 20);
    const other = take(new SeededPieceSource(7, drawColor), 20);

    expect(other).not.toEqual(first);
  });

  it('should_never_end_when_many_pieces_are_read', () => {
    const source = new SeededPieceSource(1, drawColor);

    expect(take(source, 1000)).toHaveLength(1000);
    expect(source.hasNext()).toBe(true);
  });

  const badSeeds = [
    ['not_a_number', Number.NaN],
    ['a_decimal', 1.9],
    ['negative', -1],
    ['too_large', 4294967296],
  ] as const;
  for (const [name, seed] of badSeeds) {
    it(`should_throw_a_range_error_when_the_seed_is_${name}`, () => {
      expect(() => new SeededPieceSource(seed, drawColor)).toThrow(RangeError);
      expect(() => new Mulberry32Random(seed)).toThrow('seed');
    });
  }

  it('should_accept_the_seed_when_it_is_zero_or_the_largest_32_bit_integer', () => {
    expect(new SeededPieceSource(0, drawColor).seed).toBe(0);
    expect(new SeededPieceSource(4294967295, drawColor).seed).toBe(4294967295);
  });

  it('should_expose_its_seed_when_the_seed_is_read', () => {
    expect(new SeededPieceSource(42, drawColor).seed).toBe(42);
  });
});

describe('Mulberry32Random', () => {
  it('should_give_numbers_from_zero_up_to_one_when_next_is_read', () => {
    const random = new Mulberry32Random(3);
    const numbers = Array.from({ length: 500 }, () => random.next());

    expect(numbers.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});
