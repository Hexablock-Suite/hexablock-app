import type { ReadonlyBoard } from './board';
import type { Cloneable } from './cloneable';
import type { GameEvent } from './game-events';
import type { GameId } from '../shared/game-id';
import type { GameStateId } from './game-state-id';
import type { GridAxis } from './grid-topology';
import type { MatchId } from './match-id';
import type { Moves } from '../shared/moves';
import type { Score } from '../shared/score';

// The photo of one state at one moment (classes.md decisions 7, 29 and 34).
// It is the Memento of the state: `BoardState.snapshot()` gives it, and `restore()` takes it back.
// It is also the only way to read a state from outside: the rules, the scoring policies,
// `GameEngine.snapshot()` and `moveResultOf()` read it. It has no tactical stereotype.
// It holds a copy of the board, so a later move never changes the photo.
// It hands out no board that a caller owns: `ReadonlyBoard` has no `clone()` (issue #234).
// It holds the two ids of the state, so a state takes back only its own photo.
// Every field is private (issue #245). A reader in the domain or in a use case asks a query
// with a business name, and each query returns a value object, the read-only board or a boolean.
// `view()` gives the data that the screen of the variant draws (decision 29). The view also keeps
// its fields private, and an adapter of the edge receives its data with `deliverTo(receiver)`.
// The class is abstract: each variant photo extends it with the data of its variant,
// implements `view()` and freezes itself. `TAxis` keeps the axis type of the board,
// so the Merge photo gives the board of its topology.
export abstract class BoardSnapshot<TCell, TCoord, TAxis extends GridAxis = GridAxis> {
  protected constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: ReadonlyBoard<TCell, TCoord, TAxis>,
    private readonly score: Score,
  ) {}

  // True when this is a photo of the state `state`. A state asks it before it takes a photo back.
  isPhotoOf(state: GameStateId): boolean {
    return this.stateId.equals(state);
  }

  // True when this is a photo of a state of the match `match`.
  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  // The copy of the board that the photo holds. The rules ask it questions, `moveResultOf()`
  // copies its occupied cells, and a state takes it back with `Board.restore()`.
  // It is the same read-only copy on each call, so no reader can change the photo through it.
  boardCopy(): ReadonlyBoard<TCell, TCoord, TAxis> {
    return this.board;
  }

  // The score of the game at the moment of the photo. Three readers need the value itself:
  // the `GameEnded` event carries the final score, `moveResultOf()` puts it in `MoveResult`,
  // and a state takes it back with `restore()`.
  scoreSoFar(): Score {
    return this.score;
  }

  // The events of the move that led to this photo, in their order (issue #361).
  // `GameEngine` asks the photo after an accepted move, and it gives the ids of its game, so the
  // root builds each event (classes.md decision 29). A variant photo builds the events of its
  // variant from the facts of the last move that it keeps. The engine names no variant event.
  // This photo keeps no fact of a move, so it gives no event. The parameters exist for a
  // variant photo, so this base ignores them.
  eventsOfLastMove(_game: GameId, _match: MatchId): readonly GameEvent[] {
    return [];
  }

  // The count of the accepted moves of the game, or `undefined` for a game that counts none
  // (D26, decision 61). Every level photo, Fit and Sort, gives its own count.
  // Lines and Merge count no moves, so this base gives none. `moveResultOf()` asks it.
  moveCount(): Moves | undefined {
    return undefined;
  }

  // The data that the screen of the variant draws. Each variant photo narrows the type.
  abstract view(): unknown;
}

// The photo type that a state type gives with `snapshot()`. A variant state narrows
// `snapshot()`, so the photo of a variant keeps the data of that variant.
export type SnapshotOf<TState> = TState extends { snapshot(): infer TSnapshot } ? TSnapshot : never;

// The state of one game: its board and its score. Each variant extends it.
// The state is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`. The id is local: `GameFactory` builds it from the
// `MatchId` of the game (decision 52), and it never changes.
// A clone keeps it, because the clone is the same state at an earlier moment.
// `equals()` compares two states by that identity only.
// The state also keeps the `MatchId` of its game. `belongsTo()` tells whether the state
// is the state of a match, so `GameEngine.start()` can refuse a state of another match.
// It changes only through its own methods, which have business names.
// The rules call them, and the engine calls `addPoints()`. No other class writes a field.
// Every field of a state is private, so no other class reads a field either:
// a reader asks the photo of `snapshot()`, or the state, a query with a business name.
// `addPoints()` adds the points of one turn. The points and the score are `Score` values
// (classes.md decision 41). A total above the largest safe integer throws a RangeError,
// and the score stays as it was.
// The board changes in place. `clone()` gives the copy on which the engine plays a turn
// (classes.md decision 7). `clone()` of a variant state returns that variant state.
// `snapshot()` gives the photo of the state, and a variant state narrows its type.
// `restore()` takes back a photo of this same state: the board, the score, the variant data
// and the piece source at its position. A photo of another state throws a RangeError,
// and the state stays as it was.
// The board takes any axis, so the state needs no axis type parameter (issue 86).
export interface BoardState<TCell, TCoord> extends Cloneable<BoardState<TCell, TCoord>> {
  addPoints(points: Score): void;
  belongsTo(match: MatchId): boolean;
  equals(other: BoardState<TCell, TCoord>): boolean;
  snapshot(): BoardSnapshot<TCell, TCoord>;
  restore(snapshot: SnapshotOf<this>): void;
}

// A state takes back only its own photo: a photo of the state with a copy of its board.
// Any other photo throws a RangeError. Each state calls it before `restore()` writes anything.
export function checkOwnSnapshot<TCell, TCoord, TAxis extends GridAxis>(
  stateId: GameStateId,
  board: ReadonlyBoard<TCell, TCoord, TAxis>,
  snapshot: BoardSnapshot<TCell, TCoord, TAxis>,
): void {
  if (!snapshot.isPhotoOf(stateId)) {
    throw new RangeError('The snapshot belongs to another state.');
  }
  if (!board.equals(snapshot.boardCopy())) {
    throw new RangeError('The snapshot holds another board.');
  }
}
