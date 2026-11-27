import { Board, type ReadonlyBoard } from '../../../src/domain/engine/board';
import { BoardBuilder } from '../../../src/domain/engine/board-builder';
import { BoardId } from '../../../src/domain/engine/board-id';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import type { BoardState, SnapshotOf } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import { GameId } from '../../../src/domain/shared/game-id';
import type { GeometryFactory } from '../../../src/domain/engine/geometry-factory';
import type { GridAxis, GridTopology } from '../../../src/domain/engine/grid-topology';
import type { MatchId } from '../../../src/domain/engine/match-id';
import type { IGameRules } from '../../../src/domain/engine/rules';
import { CellNode, ShapeGroup } from '../../../src/domain/engine/shape-node';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { MATCH_ID } from './match-id';
import { BOARD_ID, STATE_ID } from './entity-ids';

// The games that the tests know: the four variants and the fake game of the engine tests.
const KNOWN_GAMES = ['hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge', 'fake-game'].map((id) =>
  GameId.of(id),
);

// The id of the game that a variant factory builds. A factory keeps its id private and answers
// `isFor()` (issue #234), so the helper asks it each known id, as the composition root does.
export function gameIdOf(factory: { isFor(gameId: GameId): boolean }): GameId {
  const found = KNOWN_GAMES.find((id) => factory.isFor(id));
  if (found === undefined) throw new RangeError('The factory builds no known game.');
  return found;
}

// One code path for every variant: it reads only the `IVariantFactory` contract
// (classes.md decision 31). It names no variant and never reads the game id to branch.
// `GameFactory` assembles the game, as in the app (classes.md decision 40), so a timed variant
// gets its timer (issue #234). The helper gives every game the fixed `MATCH_ID`, so the first
// state takes `STATE_ID` and its board `BOARD_ID`. `rules` are the plain rules of the variant,
// for the synchronous domain tests that read the rules of the game.
export function startVariant<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const engine = new GameFactory<TCell, TCoord, TMove, TState>(gameIdOf(factory), factory, {
    next: () => MATCH_ID,
  }).createGame();
  return { engine, rules: factory.createRules() };
}

// A new empty board with the shape of `board` and the id of the board of the match `matchId`.
// A photo hands out no board that a caller owns (issue #234). So a test that builds a state
// again from a photo builds a new board with `BoardBuilder`, and the state takes the cells
// of the photo back with `restore()`.
export function boardLike<TCell, TCoord>(
  board: ReadonlyBoard<TCell, TCoord>,
  geometry: GeometryFactory<TCoord>,
  matchId: MatchId,
): Board<TCell, TCoord> {
  return new BoardBuilder(geometry)
    .withFigure(new ShapeGroup(board.coordinates().map((c) => new CellNode(c))))
    .build<TCell>(BoardId.of(matchId));
}

// The same board as `boardLike()`, on a topology with its own axes, such as `HexAxis`.
// `BoardBuilder` gives a board with any axis, so a state with an axis type takes this board.
export function boardOnTopologyLike<TCell, TCoord, TAxis extends GridAxis>(
  board: ReadonlyBoard<TCell, TCoord, TAxis>,
  topology: GridTopology<TCoord, TAxis>,
  matchId: MatchId,
): Board<TCell, TCoord, TAxis> {
  return new Board<TCell, TCoord, TAxis>(
    BoardId.of(matchId),
    BoardShape.of(board.coordinates()),
    topology,
  );
}

// The first move of the lazy generator of the rules (classes.md decision 33).
export function firstValidMove<TMove, TState>(
  rules: IGameRules<TMove, TState>,
  state: TState,
): TMove {
  for (const move of rules.validMoves(state)) return move;
  throw new RangeError('The state has no valid move.');
}

// The first valid move of a new game of `factory`. A new game starts from the first state
// that the factory creates, so the rules read a new first state with the same content.
// The engine never gives its state away: `GameEngine.snapshot()` gives a photo (decision 34).
export function firstMoveOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>): TMove {
  return firstValidMove(
    factory.createRules(),
    factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID),
  );
}

// A live state with the content of `photo`, a photo of a game that `startVariant` started.
// The engine never gives its state away, so the rules cannot read a photo (decision 34).
// `startVariant` gives every state `STATE_ID` and every board `BOARD_ID`. So a new first state
// of the factory with the same ids takes the photo back with `restore()`.
export function liveStateOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(
  factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
  photo: SnapshotOf<TState>,
): TState {
  const state = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
  state.restore(photo);
  return state;
}
