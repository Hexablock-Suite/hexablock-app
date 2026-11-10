/** @jest-environment node */
import { BoardId } from '../../src/domain/engine/board-id';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { GameStateId } from '../../src/domain/engine/game-state-id';
import { MatchId } from '../../src/domain/engine/match-id';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { gameUseCases, valueOf } from '../support/application/game-use-cases';
import { firstValidMove } from '../support/engine/variant-game';
import { fitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';

// R7: the state of a game and its board are entities (classes.md decisions 7 and 26).
// The state has its own `GameStateId` and knows its match. The board has its own `BoardId`.
// A move, an undo and a Merge slide change the state, and never its identity.
// The use cases open the first game with the ids `match-1`, `state-1` and `board-1`.

const MATCH = MatchId.of('match-1');
const STATE = GameStateId.of('state-1');
const BOARD = BoardId.of('board-1');

// The identity of the running state: its match, its own id and the id of its board.
function identityOf<TCell, TCoord>(
  state: BoardState<TCell, TCoord>,
  reference: BoardState<TCell, TCoord>,
  other: BoardState<TCell, TCoord>,
) {
  return {
    ofTheMatch: state.belongsTo(MATCH),
    ofAnotherMatch: state.belongsTo(MatchId.of('match-2')),
    sameState: state.equals(reference),
    anotherState: state.equals(other),
    sameBoard: state.board.equals(reference.board),
    anotherBoard: state.board.equals(other.board),
  };
}

const KEPT = {
  ofTheMatch: true,
  ofAnotherMatch: false,
  sameState: true,
  anotherState: false,
  sameBoard: true,
  anotherBoard: false,
};

// Starts a game, plays one valid move, and undoes it when the variant has undo.
// It returns the identity of the running state after each step.
async function playAndUndo<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, startGame, applyMove, undoMove } = gameUseCases(factory);
  const reference = factory.createInitialState(MATCH, STATE, BOARD);
  const other = factory.createInitialState(MATCH, GameStateId.of('state-2'), BoardId.of('board-2'));
  const identity = () => identityOf(games.running().snapshot(), reference, other);
  valueOf(await startGame.execute({}));
  const started = identity();
  const move = firstValidMove(factory.createRules(), games.running().snapshot());
  valueOf(await applyMove.execute({ move }));
  const moved = identity();
  const undone = factory.createHistory() === undefined ? undefined : await undoMove.execute({});
  return { started, moved, undone: undone === undefined ? undefined : identity() };
}

describe('The identity of the running state', () => {
  it('should_keep_the_state_of_its_match_and_its_board_when_a_move_is_applied_and_undone', async () => {
    const runs = {
      lines: await playAndUndo(linesFactory()),
      fit: await playAndUndo(fitFactory()),
      sort: await playAndUndo(sortFactory()),
      merge: await playAndUndo(mergeFactory()),
    };

    expect(runs).toEqual({
      lines: { started: KEPT, moved: KEPT, undone: undefined },
      fit: { started: KEPT, moved: KEPT, undone: KEPT },
      sort: { started: KEPT, moved: KEPT, undone: undefined },
      merge: { started: KEPT, moved: KEPT, undone: KEPT },
    });
  });

  it('should_keep_the_identity_of_the_merge_state_when_each_slide_is_applied', async () => {
    const factory = mergeFactory(7);
    const { games, startGame, applyMove } = gameUseCases(factory);
    const reference = factory.createInitialState(MATCH, STATE, BOARD);
    const other = factory.createInitialState(
      MATCH,
      GameStateId.of('state-2'),
      BoardId.of('board-2'),
    );
    valueOf(await startGame.execute({}));
    const seen = [];

    for (let turn = 0; turn < 5; turn += 1) {
      const move = firstValidMove(factory.createRules(), games.running().snapshot());
      valueOf(await applyMove.execute({ move }));
      seen.push(identityOf(games.running().snapshot(), reference, other));
    }

    expect(seen).toEqual([KEPT, KEPT, KEPT, KEPT, KEPT]);
  });

  it('should_throw_a_range_error_and_keep_the_game_when_a_state_of_another_match_starts_it', async () => {
    const factory = linesFactory();
    const { games, startGame } = gameUseCases(factory);
    valueOf(await startGame.execute({}));
    const engine = games.running();
    const before = engine.snapshot().board.cells();
    const foreign = factory.createInitialState(MatchId.of('match-2'), STATE, BOARD);

    expect(() => engine.start(foreign)).toThrow(
      new RangeError('The first state belongs to another match.'),
    );
    expect(engine.snapshot().board.cells()).toEqual(before);
    expect(engine.snapshot().belongsTo(MATCH)).toBe(true);
  });
});
