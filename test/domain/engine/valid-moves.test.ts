/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules } from '../../../src/domain/engine/rules';
import { fakeCell } from '../../support/engine/fake-cell';
import { emptyState, type FakeState } from '../../support/engine/fake-game';
import {
  SquareAxis,
  square,
  squareTopology,
  type SquareCoord,
} from '../../support/engine/square-topology';

// Classes.md decision 33: `validMoves()` is a lazy generator, and the end condition
// «no valid move» asks for the first move only. These rules exist only in test/.
// A move is valid on an empty cell next to a filled cell. The generator walks the rows
// with `Board.line()` and checks the neighbors with `Board.neighborhood()`.
class AdjacentRules extends BaseGameRules<SquareCoord, FakeState> {
  visited = 0;

  *validMoves(state: FakeState): Iterable<SquareCoord> {
    const { board } = state;
    for (const rowStart of board.line(SquareAxis.row, square(0, 0))) {
      for (const c of board.line(SquareAxis.col, rowStart)) {
        this.visited += 1;
        if (this.isValid(state, c)) yield c;
      }
    }
  }

  isValid(state: FakeState, at: SquareCoord): boolean {
    const { board } = state;
    if (!board.contains(at) || board.get(at) !== undefined) return false;
    for (const n of board.neighborhood(at)) {
      if (board.get(n) !== undefined) return true;
    }
    return false;
  }

  apply(state: FakeState, at: SquareCoord): FakeState {
    state.board.occupy(at, fakeCell(1));
    return state;
  }

  resolve(_state: FakeState): Resolution {
    return Resolution.resolved();
  }

  evaluate(state: FakeState): Outcome {
    return this.noValidMove(state) ? Outcome.gameOver : Outcome.playing;
  }
}

// Rules whose moves come from a given iterable. They test `noValidMove()` alone.
class GivenMovesRules extends BaseGameRules<number, FakeState> {
  constructor(private readonly moves: () => Iterable<number>) {
    super();
  }

  *validMoves(): Iterable<number> {
    yield* this.moves();
  }

  isValid(): boolean {
    return true;
  }

  apply(state: FakeState): FakeState {
    return state;
  }

  resolve(_state: FakeState): Resolution {
    return Resolution.resolved();
  }

  evaluate(state: FakeState): Outcome {
    return this.noValidMove(state) ? Outcome.gameOver : Outcome.playing;
  }
}

// An endless generator that counts how many moves a caller reads.
// A `noValidMove()` that builds an array of the moves never returns here,
// so the test bounds the reads and fails when the count passes one.
function countingMoves(counter: { reads: number }): () => Iterable<number> {
  return function* () {
    for (let move = 0; move < 1000; move += 1) {
      counter.reads += 1;
      yield move;
    }
  };
}

// A 5 × 5 board with one filled cell.
function stateWithOneCell(at: SquareCoord): FakeState {
  const state = emptyState(5);
  state.board.occupy(at, fakeCell(1));
  return state;
}

describe('validMoves() and the no-valid-move end check', () => {
  it('should_stop_at_the_first_valid_move_when_the_end_check_runs', () => {
    const rules = new AdjacentRules();
    const state = stateWithOneCell(square(1, 0));

    const outcome = rules.evaluate(state);

    expect(outcome).toBe(Outcome.playing);
    // (0, 0) is the first cell of the walk, and it touches (1, 0).
    expect(rules.visited).toBe(1);
  });

  it('should_walk_the_whole_board_when_no_move_is_valid', () => {
    const rules = new AdjacentRules();
    const state = emptyState(5);

    const outcome = rules.evaluate(state);

    expect(outcome).toBe(Outcome.gameOver);
    expect(rules.visited).toBe(25);
  });

  it('should_give_every_valid_move_when_a_caller_reads_the_whole_generator', () => {
    const rules = new AdjacentRules();

    const moves = [...rules.validMoves(stateWithOneCell(square(2, 2)))];

    expect(moves).toEqual([square(2, 1), square(1, 2), square(3, 2), square(2, 3)]);
  });

  it('should_yield_nothing_before_the_first_read_when_the_generator_is_created', () => {
    const rules = new AdjacentRules();

    const moves = rules.validMoves(stateWithOneCell(square(2, 2)));

    expect(rules.visited).toBe(0);
    expect(moves[Symbol.iterator]().next().value).toEqual(square(2, 1));
  });

  it('should_yield_nothing_the_second_time_when_the_valid_moves_are_iterated_twice', () => {
    const rules = new AdjacentRules();
    const moves = rules.validMoves(stateWithOneCell(square(2, 2)));

    expect([...moves]).toHaveLength(4);
    expect([...moves]).toEqual([]);
  });

  it('should_end_the_game_when_the_board_is_full', () => {
    const rules = new AdjacentRules();
    const state = emptyState(2);
    for (const c of squareTopology.region(RegionSize.of(2)).cells)
      state.board.occupy(c, fakeCell(1));

    expect(rules.evaluate(state)).toBe(Outcome.gameOver);
  });

  it('should_read_one_move_only_when_the_end_check_runs_on_a_counting_generator', () => {
    const counter = { reads: 0 };
    const rules = new GivenMovesRules(countingMoves(counter));

    expect(rules.evaluate(emptyState(2))).toBe(Outcome.playing);
    expect(counter.reads).toBe(1);
  });

  it('should_never_reach_the_throw_when_the_generator_throws_after_its_first_move', () => {
    const rules = new GivenMovesRules(function* () {
      yield 1;
      throw new Error('The end check read past the first move.');
    });

    expect(rules.evaluate(emptyState(2))).toBe(Outcome.playing);
  });
});
