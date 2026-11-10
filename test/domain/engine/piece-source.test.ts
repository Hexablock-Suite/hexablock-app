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

// The first `count` pieces of a source. The read is pure, so the source stays where it is.
function first<T>(source: IPieceSource<T>, count: number): T[] {
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
    const end = source.take().rest.take().rest.take().rest;

    expect([...source]).toEqual(['a', 'b', 'c']);
    expect(source.hasNext()).toBe(true);
    expect(end.hasNext()).toBe(false);
    expect([...end]).toEqual([]);
  });

  it('should_throw_a_range_error_when_take_runs_after_the_last_piece', () => {
    const end = new FixedListPieceSource(['a']).take().rest;

    expect(() => end.take()).toThrow(new RangeError('The piece source has no piece left.'));
    expect(() => new FixedListPieceSource<string>([]).take()).toThrow(RangeError);
  });

  it('should_keep_its_pieces_when_the_caller_changes_the_list', () => {
    const list = ['a', 'b'];
    const source = new FixedListPieceSource(list);
    const rest = source.take().rest;

    list.push('c');
    list[1] = 'z';

    expect([...source]).toEqual(['a', 'b']);
    expect([...rest]).toEqual(['b']);
  });

  it('should_end_at_once_when_the_list_is_empty', () => {
    expect([...new FixedListPieceSource<string>([])]).toEqual([]);
    expect(new FixedListPieceSource<string>([]).hasNext()).toBe(false);
  });

  it('should_give_the_same_pieces_the_second_time_when_the_source_is_read_twice', () => {
    const source = new FixedListPieceSource(['a', 'b']);

    expect([...source]).toEqual(['a', 'b']);
    expect([...source]).toEqual(['a', 'b']);
  });

  it('should_give_the_same_pieces_when_two_sources_are_built_from_the_same_list', () => {
    expect([...new FixedListPieceSource(['a', 'b'])]).toEqual([
      ...new FixedListPieceSource(['a', 'b']),
    ]);
  });

  it('should_return_the_piece_and_the_next_source_and_stay_at_its_position_when_take_runs', () => {
    const source = new FixedListPieceSource(['a', 'b', 'c']);

    const { piece, rest } = source.take();

    expect(piece).toBe('a');
    expect(rest === source).toBe(false);
    expect([...rest]).toEqual(['b', 'c']);
    expect([...source]).toEqual(['a', 'b', 'c']);
  });

  it('should_give_the_same_piece_twice_when_take_runs_twice_on_one_source', () => {
    const source = new FixedListPieceSource(['a', 'b']);

    expect([source.take().piece, source.take().piece]).toEqual(['a', 'a']);
    expect([...source.take().rest]).toEqual([...source.take().rest]);
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
    const one = first(new SeededPieceSource(42, drawColor), 20);
    const other = first(new SeededPieceSource(42, drawColor), 20);

    expect(other).toEqual(one);
  });

  it('should_give_another_sequence_when_the_seed_differs', () => {
    const one = first(new SeededPieceSource(42, drawColor), 20);
    const other = first(new SeededPieceSource(7, drawColor), 20);

    expect(other).not.toEqual(one);
  });

  it('should_never_end_when_many_pieces_are_read', () => {
    const source = new SeededPieceSource(1, drawColor);

    expect(first(source, 1000)).toHaveLength(1000);
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

  it('should_give_the_same_pieces_the_second_time_when_a_seeded_source_is_read_in_two_loops', () => {
    const source = new SeededPieceSource(42, drawColor);

    const one = first(source, 5);
    const again = first(source, 5);

    expect(again).toEqual(one);
    expect(one).toEqual(first(new SeededPieceSource(42, drawColor), 5));
  });

  it('should_return_the_piece_and_the_next_source_and_stay_at_its_position_when_take_runs', () => {
    const source = new SeededPieceSource(42, drawColor);
    const expected = first(new SeededPieceSource(42, drawColor), 10);

    const { piece, rest } = source.take();

    expect(piece).toBe(expected[0]);
    expect(rest === source).toBe(false);
    expect(rest.seed).toBe(42);
    expect(first(source, 10)).toEqual(expected);
  });

  it('should_give_the_same_piece_twice_when_take_runs_twice_on_one_source', () => {
    // Seed 42 gives two different first pieces, so a source that moves fails here.
    const source = new SeededPieceSource(42, drawColor);
    const [one, two] = first(new SeededPieceSource(42, drawColor), 2);

    expect(one).not.toBe(two);
    expect([source.take().piece, source.take().piece]).toEqual([one, one]);
    expect([source.take().rest.take().piece, source.take().rest.take().piece]).toEqual([two, two]);
  });

  it('should_continue_the_sequence_of_the_seed_when_the_next_source_is_read', () => {
    const expected = first(new SeededPieceSource(42, drawColor), 12);

    const second = new SeededPieceSource(42, drawColor).take().rest;
    const third = second.take().rest;

    expect(first(second, 11)).toEqual(expected.slice(1));
    expect(first(third, 10)).toEqual(expected.slice(2));
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

// Prototype (classes.md decision 7). `RandomSource` stays `Cloneable`: a clone copies
// the generator state. The seeded piece source draws from a clone, so it never moves.
describe('cloning a random source', () => {
  it('should_give_the_same_numbers_when_a_random_source_is_cloned', () => {
    const random = new Mulberry32Random(7);
    random.next();

    const randomClone = random.clone();

    expect(Array.from({ length: 10 }, () => randomClone.next())).toEqual(
      Array.from({ length: 10 }, () => random.next()),
    );
  });

  it('should_keep_the_original_unchanged_when_a_clone_draws', () => {
    const random = new Mulberry32Random(7);
    const fresh = new Mulberry32Random(7);
    const expected = Array.from({ length: 5 }, () => fresh.next());

    const randomClone = random.clone();
    for (let i = 0; i < 5; i += 1) randomClone.next();

    expect(Array.from({ length: 5 }, () => random.next())).toEqual(expected);
  });
});
