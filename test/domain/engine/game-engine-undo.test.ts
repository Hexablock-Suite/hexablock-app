/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { Score } from '../../../src/domain/engine/score';
import type { Board, ReadonlyBoard } from '../../../src/domain/engine/board';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameOver } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import { MoveHistory } from '../../../src/domain/engine/move-history';
import { FixedListPieceSource } from '../../../src/domain/engine/piece-source';
import { Resolution } from '../../../src/domain/engine/resolution';
import type { IUndoable } from '../../../src/domain/engine/undo-capabilities';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  FakeState,
  OnePointScoring,
  RecordingPublisher,
  SourceRules,
  sourceState,
  type FakeMove,
  type FakeSnapshot,
  type SourceSnapshot,
} from '../../support/engine/fake-game';
import { phaseNameOf } from '../../support/engine/phase-name';
import {
  square,
  squareTopology,
  type SquareAxis,
  type SquareCoord,
} from '../../support/engine/square-topology';
import { MATCH_ID } from '../../support/engine/match-id';

// `GameEngine` takes the state back through the undo capability (classes.md decisions 27 and 34).
// The engine is the Memento originator: it clones the state and restores it.

const moveAt = (col: number, row = 0): FakeMove => ({
  at: square(col, row),
  cell: fakeCell(col + 1),
});

// The filled cells of a board in plain facts: its key and the fake cell value.
function filled(board: ReadonlyBoard<FakeCell, SquareCoord>): [string, number][] {
  return board.cells().map(([at, cell]) => [squareTopology.key(at), cell.value]);
}

function historyGame(rules = new FakeRules(), size = 2) {
  const publisher = new RecordingPublisher();
  const history = new MoveHistory<FakeMove, FakeSnapshot>();
  const engine = new GameEngine(
    MATCH_ID,
    GameId.of('fake-game'),
    rules,
    new OnePointScoring(),
    publisher,
    history,
  );
  engine.start(emptyState(size));
  const undoable = engine.undoable();
  if (undoable === undefined) throw new RangeError('The engine has no undo capability.');
  return { engine, undoable, publisher };
}

// The plain facts of a game for a comparison of two runs.
function factsOf(engine: GameEngine<FakeCell, SquareCoord, FakeMove, FakeState>) {
  const state = engine.snapshot();
  return {
    cells: filled(state.board),
    score: state.score,
    phase: phaseNameOf(engine.currentPhase()),
  };
}

// Rules that throw in `resolve()` while `armed` is true, after `apply()` has run on the copy.
class ArmedRules extends FakeRules {
  armed = false;

  override resolve(state: FakeState): Resolution {
    if (this.armed) throw new Error('resolve failed');
    return super.resolve(state);
  }
}

// A state that shares a budget of clones with its copies, so a test picks the failing clone.
// A state that takes photos only while its budget lasts. Each copy shares the budget.
class PhotoOnBudgetState extends FakeState {
  constructor(
    board: FakeState['board'],
    private readonly budget: { left: number },
    score: Score = Score.of(0),
  ) {
    super(board, score);
  }

  override clone(): PhotoOnBudgetState {
    return new PhotoOnBudgetState(this.board.clone(), this.budget, this.score);
  }

  override snapshot(): FakeSnapshot {
    if (this.budget.left === 0) throw new Error('photo failed');
    this.budget.left -= 1;
    return super.snapshot();
  }
}

// A scoring policy that asks for an undo from `score()`, a reentrant call.
// It keeps the error of the undo and scores the turn.
class UndoingScoring extends OnePointScoring {
  undoable: IUndoable | undefined;
  innerError: unknown;

  override score(before: FakeSnapshot, after: FakeSnapshot): Score {
    try {
      this.undoable?.undo();
    } catch (error) {
      this.innerError = error;
    }
    return super.score(before, after);
  }
}

describe('GameEngine undo capability', () => {
  it('should_give_no_capability_when_the_engine_has_no_history', () => {
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FakeRules(),
      new OnePointScoring(),
      new RecordingPublisher(),
    );
    engine.start(emptyState());

    expect(engine.undoable()).toBeUndefined();
    expect(engine.redoable()).toBeUndefined();
  });

  it('should_give_the_capability_with_no_move_to_undo_when_the_game_starts', () => {
    const { engine, undoable } = historyGame();

    expect(undoable.canUndo()).toBe(false);
    expect(engine.redoable()).toBeUndefined();
  });

  it('should_give_back_the_board_and_the_score_before_the_move_when_the_capability_undoes_it', () => {
    const { engine, undoable } = historyGame();
    engine.play(moveAt(0));
    const afterFirst = factsOf(engine);
    engine.play(moveAt(1));

    expect(undoable.canUndo()).toBe(true);
    undoable.undo();

    expect(factsOf(engine)).toEqual(afterFirst);
    expect(afterFirst).toEqual({ cells: [['0,0', 1]], score: Score.of(1), phase: 'playing' });
    expect(undoable.canUndo()).toBe(true);
  });

  it('should_put_the_piece_source_back_when_the_undone_move_drew_a_piece', () => {
    const publisher = new RecordingPublisher();
    const pieces = [fakeCell(1), fakeCell(2), fakeCell(3)];
    const history = new MoveHistory<SquareCoord, SourceSnapshot>();
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new SourceRules(),
      { score: () => Score.of(0) },
      publisher,
      history,
    );
    engine.start(sourceState(new FixedListPieceSource(pieces)));
    engine.play(square(0, 0));

    engine.undoable()?.undo();
    engine.play(square(1, 0));

    // The draw of the undone move comes back, so the new move gets the same piece.
    expect(filled(engine.snapshot().board)).toEqual([['1,0', 1]]);
    expect(engine.snapshot().source.next()).toEqual(fakeCell(2));
  });

  it('should_keep_the_old_state_when_a_caller_changes_a_snapshot_after_a_move', () => {
    const { engine, undoable } = historyGame();
    engine.play(moveAt(0));

    // The photo shows a read-only board. A cast reaches its copy of the board.
    const photo = engine.snapshot();
    (photo.board as Board<FakeCell, SquareCoord, SquareAxis>).occupy(square(1, 1), fakeCell(9));
    undoable.undo();

    expect(factsOf(engine)).toEqual({ cells: [], score: Score.of(0), phase: 'playing' });
  });

  it('should_record_nothing_when_the_rules_reject_the_move', () => {
    const { engine, undoable } = historyGame();

    engine.tryPlay({ at: square(9, 9), cell: fakeCell(1) });

    expect(undoable.canUndo()).toBe(false);
  });

  it('should_record_nothing_when_the_turn_throws', () => {
    const rules = new ArmedRules();
    const { engine, undoable } = historyGame(rules);
    rules.armed = true;

    expect(() => engine.play(moveAt(0))).toThrow('resolve failed');

    expect(undoable.canUndo()).toBe(false);
    expect(factsOf(engine)).toEqual({ cells: [], score: Score.of(0), phase: 'playing' });
  });

  it('should_save_no_turn_when_the_photo_for_the_undo_throws', () => {
    const budget = { left: Number.POSITIVE_INFINITY };
    const { engine, undoable } = historyGame();
    engine.start(new PhotoOnBudgetState(emptyState().board, budget));
    // After the rules, the first photo is the Memento: the photo of the state before the move.
    budget.left = 0;

    expect(() => engine.play(moveAt(0))).toThrow('photo failed');

    budget.left = Number.POSITIVE_INFINITY;
    expect(undoable.canUndo()).toBe(false);
    expect(factsOf(engine)).toEqual({ cells: [], score: Score.of(0), phase: 'playing' });
    expect(engine.play(moveAt(0))).toBe(Outcome.playing);
    expect(undoable.canUndo()).toBe(true);
  });

  it('should_forget_the_moves_and_keep_the_end_of_the_game_when_the_last_move_ends_it', () => {
    const { engine, undoable, publisher } = historyGame(new FakeRules(), 1);
    engine.play(moveAt(0));
    const finished = factsOf(engine);

    expect(finished.phase).toBe('game-over');
    expect(undoable.canUndo()).toBe(false);
    expect(() => undoable.undo()).toThrow(new RangeError('The history has no move to undo.'));
    expect(factsOf(engine)).toEqual(finished);
    expect(publisher.events).toEqual([
      new GameOver(GameId.of('fake-game'), MATCH_ID, Outcome.gameOver, Score.of(1)),
    ]);
  });

  it('should_refuse_the_undo_and_change_nothing_when_the_game_is_paused', () => {
    const { engine, undoable } = historyGame();
    engine.play(moveAt(0));
    const played = factsOf(engine);
    engine.pause();

    expect(() => undoable.undo()).toThrow(
      new RangeError('The game cannot accept an undo in the paused phase.'),
    );

    expect(undoable.canUndo()).toBe(true);
    expect(factsOf(engine)).toEqual({ ...played, phase: 'paused' });

    engine.resume();
    undoable.undo();

    expect(factsOf(engine)).toEqual({ cells: [], score: Score.of(0), phase: 'playing' });
  });

  // `play()` enters the resolving phase before it calls the scoring.
  // The resolving phase refuses an undo, so the turn of the reentrant call stays whole.
  it('should_refuse_a_reentrant_undo_and_keep_both_moves_when_the_scoring_asks_for_it_in_a_turn', () => {
    const scoring = new UndoingScoring();
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FakeRules(),
      scoring,
      new RecordingPublisher(),
      new MoveHistory<FakeMove, FakeSnapshot>(),
    );
    engine.start(emptyState());
    engine.play(moveAt(0));
    scoring.undoable = engine.undoable();

    engine.play(moveAt(1));

    expect(scoring.innerError).toBeInstanceOf(RangeError);
    expect(scoring.innerError).toEqual(
      new RangeError('The game cannot accept an undo in the resolving phase.'),
    );
    expect(factsOf(engine)).toEqual({
      cells: [
        ['0,0', 1],
        ['1,0', 2],
      ],
      score: Score.of(2),
      phase: 'playing',
    });
    // The refused undo kept its command: both moves still come back.
    scoring.undoable = undefined;
    engine.undoable()?.undo();
    engine.undoable()?.undo();
    expect(factsOf(engine)).toEqual({ cells: [], score: Score.of(0), phase: 'playing' });
  });

  it('should_forget_the_moves_of_the_old_game_when_the_engine_starts_again', () => {
    const { engine, undoable } = historyGame();
    engine.play(moveAt(0));

    engine.start(emptyState());

    expect(undoable.canUndo()).toBe(false);
    expect(factsOf(engine)).toEqual({ cells: [], score: Score.of(0), phase: 'playing' });
  });

  it('should_play_the_same_turns_when_the_engine_has_a_history', () => {
    const run = (withHistory: boolean) => {
      const publisher = new RecordingPublisher();
      const history = withHistory ? new MoveHistory<FakeMove, FakeSnapshot>() : undefined;
      const engine = new GameEngine(
        MATCH_ID,
        GameId.of('fake-game'),
        new FakeRules(),
        new OnePointScoring(),
        publisher,
        history,
      );
      engine.start(emptyState());
      const reports = [moveAt(0), moveAt(0), moveAt(1), { at: square(9, 9), cell: fakeCell(1) }];
      return {
        answers: reports.map((move) => engine.tryPlay(move)),
        facts: factsOf(engine),
        events: publisher.events,
      };
    };

    expect(run(true)).toEqual(run(false));
  });
});
