import type { ReadonlyBoard } from './board';
import type { Cloneable } from './cloneable';
import type { GameStateId } from './game-state-id';
import type { MatchId } from './match-id';

// The photo of one state at one moment (classes.md decisions 7, 29 and 34).
// It is the Memento of the state: `BoardState.snapshot()` gives it, and `restore()` takes it back.
// It is also the only way to read a state from outside: the rules, the scoring policies,
// `GameEngine.snapshot()` and `moveResultOf()` read it. It has no tactical stereotype.
// It carries domain values and no business method. It is frozen, and it holds a copy of the board,
// so a change to the photo never changes the state, and a later move never changes the photo.
// It holds the two ids of the state, so a state takes back only its own photo.
// `view()` gives the plain data that the screen of the variant draws (decision 29).
// Each variant photo extends it with the data of its variant and narrows `view()`.
export interface BoardSnapshot<TCell, TCoord> {
  readonly stateId: GameStateId;
  readonly matchId: MatchId;
  readonly board: ReadonlyBoard<TCell, TCoord, string>;
  readonly score: number;
  view(): unknown;
}

// The photo type that a state type gives with `snapshot()`. A variant state narrows
// `snapshot()`, so the photo of a variant keeps the data of that variant.
export type SnapshotOf<TState> = TState extends { snapshot(): infer TSnapshot } ? TSnapshot : never;

// The state of one game: its board and its score. Each variant extends it.
// The state is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`. A `GameStateIdGenerator` gives it, and it never changes.
// A clone keeps it, because the clone is the same state at an earlier moment.
// `equals()` compares two states by that identity only.
// The state also keeps the `MatchId` of its game. `belongsTo()` tells whether the state
// is the state of a match, so `GameEngine.start()` can refuse a state of another match.
// It changes only through its own methods, which have business names.
// The rules call them, and the engine calls `addPoints()`. No other class writes a field.
// Every field of a state is private, so no other class reads a field either:
// a reader reads the photo of `snapshot()`, or asks a query with a business name.
// `addPoints()` adds the points of one turn. Points that are not finite throw a RangeError,
// and the score stays as it was.
// The board changes in place. `clone()` gives the copy on which the engine plays a turn
// (classes.md decision 7). `clone()` of a variant state returns that variant state.
// `snapshot()` gives the photo of the state, and a variant state narrows its type.
// `restore()` takes back a photo of this same state: the board, the score, the variant data
// and the position of the piece source. A photo of another state throws a RangeError,
// and the state stays as it was.
// The board takes any axis union, so the state needs no axis type parameter (issue 86).
export interface BoardState<TCell, TCoord> extends Cloneable<BoardState<TCell, TCoord>> {
  addPoints(points: number): void;
  belongsTo(match: MatchId): boolean;
  equals(other: BoardState<TCell, TCoord>): boolean;
  snapshot(): BoardSnapshot<TCell, TCoord>;
  restore(snapshot: SnapshotOf<this>): void;
}

// A state takes back only its own photo: a photo with the id of the state and a copy of its board.
// Any other photo throws a RangeError. Each state calls it before `restore()` writes anything.
export function checkOwnSnapshot<TCell, TCoord, TAxis extends string>(
  stateId: GameStateId,
  board: ReadonlyBoard<TCell, TCoord, TAxis>,
  snapshot: { readonly stateId: GameStateId; readonly board: ReadonlyBoard<TCell, TCoord, TAxis> },
): void {
  if (!snapshot.stateId.equals(stateId)) {
    throw new RangeError('The snapshot belongs to another state.');
  }
  if (!board.equals(snapshot.board)) throw new RangeError('The snapshot holds another board.');
}
