/** @jest-environment node */
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import type { GameEvent, GameEventPublisher } from '../../src/domain/engine/game-events';
import type { Piece } from '../../src/domain/engine/piece';
import { FixedListPieceSource, type IPieceSource } from '../../src/domain/engine/piece-source';
import { RegionSize } from '../../src/domain/engine/region-size';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import type { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { SortFactory } from '../../src/domain/variants/hexa-sort/sort-factory';
import { square, squareTopology, type SquareCoord } from '../support/engine/square-topology';
import { firstValidMove } from '../support/engine/variant-game';
import { errorOf, gameUseCases, valueOf } from '../support/application/game-use-cases';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory, stack, stackPiece } from '../support/variants/hexa-sort/sort-game';

// `StartGame` and `ApplyMove` run the four variants through one code path (issue 100,
// APP-FR-03, classes.md decisions 9, 28 and 29). The helper reads only `IVariantFactory`.

async function startAndPlayOnce<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, startGame, applyMove } = gameUseCases(factory);
  const started = valueOf(await startGame.execute({}));
  const startCells = games.running().snapshot().board.cells();
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
  const played = valueOf(await applyMove.execute({ move }));
  const after = games.running().snapshot();
  return { gameId: factory.gameId.value, started, startCells, played, after };
}

class ThrowingPublisher implements GameEventPublisher {
  publish(_event: GameEvent): void {
    throw new Error('The event bus is down.');
  }
}

// A factory whose first state throws, as a broken level would.
function brokenStart<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(
  factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
): IVariantFactory<TCell, TCoord, TMove, TState, TPiece> {
  return {
    gameId: factory.gameId,
    createRules: () => factory.createRules(),
    createScoring: () => factory.createScoring(),
    createPieceSource: () => factory.createPieceSource(),
    createBoard: () => factory.createBoard(),
    createInitialState: () => {
      throw new RangeError('The level is broken.');
    },
  };
}

// A Sort level whose source throws in `clone()`, as a broken level source would.
// The real sources never throw there, so this double stands in for the level data.
function sortLevelWithUncloneableSource(): SortFactory<SquareCoord> {
  const pieces = new FixedListPieceSource([stack('red')].map(stackPiece));
  const source: IPieceSource<Piece<ColorStack, SquareCoord>> = {
    hasNext: () => pieces.hasNext(),
    next: () => pieces.next(),
    [Symbol.iterator]: () => pieces[Symbol.iterator](),
    clone: () => {
      throw new RangeError('The level source cannot be copied.');
    },
  };
  return new SortFactory(squareTopology, { size: RegionSize.of(2), source, goalsNeeded: 1 });
}

describe('StartGame and ApplyMove', () => {
  it('should_start_and_play_each_variant_through_the_same_path_when_the_use_cases_get_the_four_factories', async () => {
    const runs = [
      await startAndPlayOnce(linesFactory()),
      await startAndPlayOnce(fitFactory()),
      await startAndPlayOnce(sortFactory()),
      await startAndPlayOnce(mergeFactory()),
    ];

    expect(runs.map((r) => [r.gameId, r.started.outcome, r.played.outcome])).toEqual([
      ['hexa-lines', 'playing', 'playing'],
      ['hexa-fit', 'playing', 'victory'],
      ['hexa-sort', 'playing', 'playing'],
      ['hexa-merge', 'playing', 'playing'],
    ]);
    for (const run of runs) {
      expect(run.started).toEqual({
        cells: run.startCells,
        score: 0,
        outcome: 'playing',
        canUndo: false,
        canRedo: false,
      });
      expect(run.played).toEqual({
        cells: run.after.board.cells(),
        score: run.after.score,
        outcome: run.played.outcome,
        canUndo: false,
        canRedo: false,
      });
    }
    // Merge starts with two tiles, so the start result carries the cells of the board.
    expect(runs[3].started.cells).toHaveLength(2);
  });

  it('should_return_a_start_failed_failure_and_keep_no_game_when_the_factory_throws', async () => {
    const { games, startGame } = gameUseCases(brokenStart(fitFactory()));

    const error = errorOf(await startGame.execute({}));

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The level is broken.',
      false,
    ]);
    expect(games.current()).toBeUndefined();
  });

  it('should_return_a_start_failed_failure_and_keep_no_game_when_the_sort_level_source_cannot_be_cloned', async () => {
    // `SortFactory` clones the level source for each game, so the clone error stops the start.
    const factory = sortLevelWithUncloneableSource();
    const { games, startGame } = gameUseCases(factory);

    const error = errorOf(await startGame.execute({}));

    expect(() => factory.createInitialState()).toThrow(
      new RangeError('The level source cannot be copied.'),
    );

    expect([error.code, error.message, error.retryable]).toEqual([
      'start-failed',
      'The level source cannot be copied.',
      false,
    ]);
    expect(games.current()).toBeUndefined();
  });

  it('should_return_a_move_rejected_failure_and_keep_the_board_when_the_rules_reject_the_move', async () => {
    const { games, startGame, applyMove } = gameUseCases(linesFactory());
    valueOf(await startGame.execute({}));
    const before = games.running().snapshot();

    const error = errorOf(await applyMove.execute({ move: new PlacePiece(0, square(9, 9)) }));

    expect([error.code, error.retryable]).toEqual(['move-rejected', false]);
    const after = games.running().snapshot();
    expect([after.board.cells(), after.score, after.tray]).toEqual([
      before.board.cells(),
      before.score,
      before.tray,
    ]);
    expect(games.running().phase.name).toBe('playing');
  });

  it('should_return_a_no_running_game_failure_when_apply_move_runs_before_start_game', async () => {
    const { applyMove } = gameUseCases(linesFactory());

    const error = errorOf(await applyMove.execute({ move: new PlacePiece(0, square(0, 0)) }));

    expect([error.code, error.retryable]).toEqual(['no-running-game', false]);
  });

  it('should_return_a_move_failed_failure_and_throw_nothing_when_the_engine_throws', async () => {
    // The game is over after the first Fit move, so a second move makes the engine throw.
    const factory = fitFactory();
    const { games, startGame, applyMove } = gameUseCases(factory);
    valueOf(await startGame.execute({}));
    const move = firstValidMove(factory.createRules(), games.running().snapshot());
    valueOf(await applyMove.execute({ move }));

    const error = errorOf(await applyMove.execute({ move }));

    expect([error.code, error.retryable]).toEqual(['move-failed', false]);
    expect(error.message).toMatch(/cannot accept a move/);
  });

  it('should_return_a_move_failed_failure_when_the_event_publisher_throws', async () => {
    const factory = fitFactory();
    const { games, startGame, applyMove } = gameUseCases(factory, new ThrowingPublisher());
    valueOf(await startGame.execute({}));
    const move = firstValidMove(factory.createRules(), games.running().snapshot());

    const error = errorOf(await applyMove.execute({ move }));

    expect([error.code, error.message]).toEqual(['move-failed', 'The event bus is down.']);
  });

  it('should_leave_the_engine_unchanged_when_a_caller_changes_the_cells_of_a_move_result', async () => {
    const { games, startGame } = gameUseCases(mergeFactory());
    const started = valueOf(await startGame.execute({}));
    const before = games.running().snapshot().board.cells();

    started.cells[0][0] = started.cells[1][0];
    started.cells.pop();
    started.cells.push(...before);

    expect(games.running().snapshot().board.cells()).toEqual(before);
    expect(Object.keys(started).sort()).toEqual([
      'canRedo',
      'canUndo',
      'cells',
      'outcome',
      'score',
    ]);
  });
});
