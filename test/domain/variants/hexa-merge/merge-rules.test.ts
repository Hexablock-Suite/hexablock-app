/** @jest-environment node */
import { Board } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import { hex, type HexAxis, type HexCoord } from '../../../../src/domain/engine/hex-topology';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { BaseGameRules } from '../../../../src/domain/engine/rules';
import { MergeRules } from '../../../../src/domain/variants/hexa-merge/merge-rules';
import { MergeState } from '../../../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import type { IMergeable } from '../../../../src/domain/variants/hexa-merge/mergeable';
import type { NewTile } from '../../../../src/domain/variants/hexa-merge/new-tile';
import { Slide, type SlideSense } from '../../../../src/domain/variants/hexa-merge/slide';
import { RecordingPublisher } from '../../../support/engine/fake-game';
import {
  hexTopology,
  mergeGame,
  mergeState,
  values,
  type HexMergeState,
} from '../../../support/variants/hexa-merge/merge-game';

// The rules suite of Hexa Merge (statement §1.4, APP-NFR-12).
// The tests play through `GameEngine.play()` and the rules contract, on the real hex geometry.
// They code against the proposal on issue #57, «Propuesta, pendiente del equipo»:
// a slide merges from the leading edge, and a tile merges at most once per move.

function total(state: HexMergeState): number {
  return Object.values(values(state)).reduce((sum, value) => sum + value, 0);
}

describe('MergeTile', () => {
  it('should_wrap_the_value_when_it_is_a_power_of_two_of_two_or_more', () => {
    expect(MergeTile.of(2).value).toBe(2);
    expect(MergeTile.of(1024).value).toBe(1024);
    for (const value of [0, 1, 3, 6, 2.5, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => MergeTile.of(value)).toThrow(
        new RangeError(`A merge tile needs a power of two of 2 or more, not ${value}.`),
      );
    }
  });

  it('should_merge_into_one_tile_of_double_value_when_two_tiles_are_equal', () => {
    const a = MergeTile.of(4);
    const b = MergeTile.of(4);

    const merged = a.mergeWith(b);

    expect(a.canMergeWith(b)).toBe(true);
    expect(merged.value).toBe(8);
    expect(a.value).toBe(4);
    expect(b.value).toBe(4);
    expect(MergeTile.of(2).canMergeWith(MergeTile.of(4))).toBe(false);
    expect(() => MergeTile.of(2).mergeWith(MergeTile.of(4))).toThrow(
      new RangeError('A tile of 2 cannot merge with a tile of 4.'),
    );
  });
});

describe('MergeRules', () => {
  it('should_move_the_tile_to_the_edge_when_it_slides_in_each_of_the_six_directions', () => {
    const cases: [HexAxis, SlideSense, HexCoord][] = [
      ['q', 'forward', hex(2, 0)],
      ['q', 'backward', hex(-2, 0)],
      ['r', 'forward', hex(0, 2)],
      ['r', 'backward', hex(0, -2)],
      ['s', 'forward', hex(2, -2)],
      ['s', 'backward', hex(-2, 2)],
    ];

    for (const [axis, toward, edge] of cases) {
      const { engine, rules } = mergeGame(mergeState([[hex(0, 0), 2]], 3));

      const outcome = engine.play(Slide.of(axis, toward));

      expect(rules).toBeInstanceOf(BaseGameRules);
      expect(outcome).toBe('playing');
      expect(values(engine.snapshot())).toEqual({ [`${edge.q},${edge.r}`]: 2 });
    }
  });

  it('should_merge_two_equal_tiles_into_one_of_double_value_when_they_collide', () => {
    const { engine } = mergeGame(
      mergeState(
        [
          [hex(-2, 0), 2],
          [hex(1, 0), 2],
          [hex(-2, 1), 2],
          [hex(0, 1), 4],
        ],
        3,
      ),
    );

    engine.play(Slide.of('q', 'forward'));

    expect(values(engine.snapshot())).toEqual({ '2,0': 4, '1,1': 4, '0,1': 2 });
  });

  it('should_merge_from_the_leading_edge_once_per_tile_when_three_or_four_equal_tiles_line_up', () => {
    const { engine } = mergeGame(
      mergeState(
        [
          // 2 2 2 → 4 2
          [hex(-2, 0), 2],
          [hex(-1, 0), 2],
          [hex(0, 0), 2],
          // 2 2 2 2 → 4 4
          [hex(-2, 1), 2],
          [hex(-1, 1), 2],
          [hex(0, 1), 2],
          [hex(1, 1), 2],
          // 4 2 2 → 4 4, not 8
          [hex(-1, -1), 4],
          [hex(0, -1), 2],
          [hex(1, -1), 2],
        ],
        3,
      ),
    );

    engine.play(Slide.of('q', 'forward'));

    expect(values(engine.snapshot())).toEqual({
      '2,0': 4,
      '1,0': 2,
      '1,1': 4,
      '0,1': 4,
      '2,-1': 4,
      '1,-1': 4,
    });
  });

  it('should_keep_the_merged_tiles_as_the_gain_of_the_move_when_a_slide_merges', () => {
    const { engine } = mergeGame(
      mergeState(
        [
          [hex(-2, 0), 2],
          [hex(0, 0), 2],
          [hex(-2, 1), 4],
          [hex(-1, 1), 4],
        ],
        3,
      ),
    );
    const before = engine.snapshot();

    engine.play(Slide.of('q', 'forward'));
    const merged = engine.snapshot();
    engine.play(Slide.of('r', 'backward'));
    const plain = engine.snapshot();

    expect(merged.merged.map((tile) => tile.value).sort((a, b) => a - b)).toEqual([4, 8]);
    expect(total(merged)).toBe(total(before));
    expect(plain.merged).toEqual([]);
    expect(total(plain)).toBe(total(before));
  });

  it('should_keep_playing_and_mark_the_target_when_a_merge_makes_the_target_tile', () => {
    const { engine, publisher } = mergeGame(
      mergeState(
        [
          [hex(-2, 0), 4],
          [hex(0, 0), 4],
        ],
        3,
      ),
      MergeTile.of(8),
    );

    const outcome = engine.play(Slide.of('q', 'forward'));
    const reached = engine.snapshot();
    const next = engine.play(Slide.of('q', 'backward'));

    expect(outcome).toBe('playing');
    expect(reached.targetReached).toBe(true);
    expect(values(reached)).toEqual({ '2,0': 8 });
    expect(next).toBe('playing');
    expect(values(engine.snapshot())).toEqual({ '-2,0': 8 });
    expect(engine.snapshot().targetReached).toBe(true);
    expect(engine.currentPhase().canPlay()).toBe(true);
    expect(publisher.events).toEqual([]);
  });

  it('should_reject_the_slide_and_keep_the_board_when_no_tile_moves_that_way', () => {
    const { engine, rules } = mergeGame(mergeState([[hex(2, 0), 2]], 3));
    const slide = Slide.of<HexAxis>('q', 'forward');

    const outcome = engine.play(slide);

    expect(rules.isValid(engine.snapshot(), slide)).toBe(false);
    expect(outcome).toBe('playing');
    expect(values(engine.snapshot())).toEqual({ '2,0': 2 });
    expect(rules.isValid(engine.snapshot(), Slide.of('q', 'backward'))).toBe(true);
  });

  it('should_reject_the_slide_when_its_axis_is_not_an_axis_of_the_topology', () => {
    const { engine, rules } = mergeGame(mergeState([[hex(0, 0), 2]], 3));
    // A cast passes the compiler, so the rules check the axis at runtime.
    const slide = Slide.of('t' as HexAxis, 'forward');

    const outcome = engine.play(slide);

    expect(rules.isValid(engine.snapshot(), slide)).toBe(false);
    expect(outcome).toBe('playing');
    expect(values(engine.snapshot())).toEqual({ '0,0': 2 });
  });

  it('should_end_the_game_when_no_slide_changes_the_board', () => {
    // A full hexagon of seven cells where no two neighbors are equal.
    const stuck = mergeState([
      [hex(0, 0), 2],
      [hex(1, 0), 4],
      [hex(1, -1), 8],
      [hex(0, -1), 4],
      [hex(-1, 0), 8],
      [hex(-1, 1), 4],
      [hex(0, 1), 8],
    ]);
    const open = mergeState([[hex(0, 0), 2]]);
    const { engine, rules } = mergeGame(stuck);

    const outcome = engine.play(Slide.of('q', 'forward'));

    expect([...rules.validMoves(stuck)]).toEqual([]);
    expect(rules.evaluate(stuck)).toBe('game-over');
    expect(rules.evaluate(open)).toBe('playing');
    expect([...rules.validMoves(open)]).toHaveLength(6);
    expect(outcome).toBe('playing');
    expect(values(engine.snapshot())).toEqual(values(stuck));
  });
});

// Edge cases of the walkthrough of PR #109 (issue #120).
describe('Merge edge cases', () => {
  it('should_throw_a_range_error_when_the_tile_value_is_negative_zero_or_negative_infinity', () => {
    // A tile value is a power of two of 2 or more. Any other number throws (merge-tile.ts).
    for (const value of [-0, Number.NEGATIVE_INFINITY]) {
      expect(() => MergeTile.of(value)).toThrow(RangeError);
      expect(() => MergeTile.of(value)).toThrow(
        `A merge tile needs a power of two of 2 or more, not ${value}.`,
      );
    }
  });

  it('should_throw_and_keep_the_game_when_a_tile_or_a_merge_leaves_the_safe_integers', () => {
    // 2^53 is a power of two, but it is not a safe integer (merge-tile.ts).
    const big = MergeTile.of(2 ** 52);
    const tooBig = 'A merge tile needs a power of two of 2 or more, not 9007199254740992.';
    const { engine, publisher } = mergeGame(
      mergeState(
        [
          [hex(1, 0), 2 ** 52],
          [hex(2, 0), 2 ** 52],
        ],
        3,
      ),
    );

    expect(() => MergeTile.of(2 ** 53)).toThrow(RangeError);
    expect(() => MergeTile.of(2 ** 53)).toThrow(tooBig);
    expect(() => big.mergeWith(MergeTile.of(2 ** 52))).toThrow(tooBig);
    // The rollback of a turn keeps the board and the phase (classes.md decision 21).
    expect(() => engine.play(Slide.of('q', 'forward'))).toThrow(tooBig);
    expect(values(engine.snapshot())).toEqual({ '1,0': 2 ** 52, '2,0': 2 ** 52 });
    expect(engine.currentPhase().name).toBe('playing');
    expect(publisher.events).toEqual([]);
  });

  it('should_merge_any_mergeable_cell_and_keep_the_game_when_its_merge_throws', () => {
    // The rules need only `IMergeable` from a cell (decision 8, mergeable.ts).
    // An exception leaves the board, the score and the phase (game-engine.ts).
    interface Chip extends IMergeable<Chip> {
      readonly label: string;
    }
    function chip(label: string, failing = false): Chip {
      return {
        label,
        canMergeWith: (other) => other.label === label,
        mergeWith: (other) => {
          if (failing) throw new Error('The merge failed.');
          return chip(label + other.label);
        },
      };
    }
    function chipGame(cells: readonly [HexCoord, Chip][]) {
      const board = new Board<Chip, HexCoord, HexAxis>(
        hexTopology.region(RegionSize.of(3)),
        hexTopology,
      );
      for (const [at, cell] of cells) board.set(at, cell);
      const engine = new GameEngine<
        Chip,
        HexCoord,
        Slide<HexAxis>,
        MergeState<Chip, HexCoord, HexAxis>
      >(
        GameId.of('hexa-merge'),
        new MergeRules<Chip, HexCoord, HexAxis>(chip('aaaa')),
        { score: () => 0 },
        new RecordingPublisher(),
      );
      engine.start(new MergeState(board, new FixedListPieceSource<NewTile<Chip>>([])));
      return engine;
    }
    function labels(engine: ReturnType<typeof chipGame>): Record<string, string> {
      const out: Record<string, string> = {};
      for (const [at, cell] of engine.snapshot().board.cells())
        out[hexTopology.key(at)] = cell.label;
      return out;
    }
    const merging = chipGame([
      [hex(1, 0), chip('a')],
      [hex(2, 0), chip('a')],
    ]);
    const failing = chipGame([
      [hex(1, 0), chip('a', true)],
      [hex(2, 0), chip('a', true)],
    ]);

    const merged = merging.play(Slide.of('q', 'forward'));

    expect(merged).toBe('playing');
    expect(labels(merging)).toEqual({ '2,0': 'aa' });
    expect(() => failing.play(Slide.of('q', 'forward'))).toThrow('The merge failed.');
    expect(failing.currentPhase().name).toBe('playing');
    expect(labels(failing)).toEqual({ '1,0': 'a', '2,0': 'a' });
    // A slide on the axis r moves no chip into another, so no merge runs.
    expect(failing.play(Slide.of('r', 'forward'))).toBe('playing');
    expect(labels(failing)).toEqual({ '1,1': 'a', '2,0': 'a' });
  });

  it('should_end_the_game_when_the_board_is_empty', () => {
    // The game ends when no slide changes the board (merge-rules.ts).
    // On an empty board no tile moves, so no slide changes it.
    const empty = mergeState([], 2);
    const { engine, rules, publisher } = mergeGame(empty);

    const outcome = engine.play(Slide.of('q', 'forward'));

    expect(rules.evaluate(empty)).toBe('game-over');
    expect([...rules.validMoves(empty)]).toEqual([]);
    expect(outcome).toBe('playing');
    expect(values(engine.snapshot())).toEqual({});
    expect(publisher.events).toEqual([]);
  });
});
