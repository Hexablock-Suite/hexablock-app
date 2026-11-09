import type { Board } from './board';
import type { BoardState } from './board-state';
import type { Cloneable } from './cloneable';
import type { GameId } from './game-id';
import type { MoveHistory } from './move-history';
import type { Piece } from './piece';
import type { IPieceSource } from './piece-source';
import type { IGameRules } from './rules';
import type { IScoringPolicy } from './scoring-policy';

// Abstract Factory (statement §3.3, classes.md decision 31). One factory per variant
// creates the whole family of its game: the rules, the scoring, the piece source,
// the board, the first state and the undo history. The engine and the use cases depend
// only on this interface, so they never name a variant (rule `engine-no-variants`).
// Each factory declares its own open `GameId` (classes.md decision 30).
// `createPieceSource()` returns `undefined` for a variant with no piece source.
// `TPiece` is the item of the source. It is a `Piece` by default.
// Hexa Merge draws a new tile and its cell (`NewTile`), so it binds `TPiece` to that type.
// `createInitialState()` puts a new board and a new piece source in the first state.
// So two calls give two games that share no board and no source.
// `createHistory()` returns a new history for each game, or `undefined` for a variant
// with no undo (classes.md decision 3).
// The progress model of view 5 comes in Sprint 3.
export interface IVariantFactory<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece = Piece<TCell, TCoord>,
> {
  readonly gameId: GameId;
  createRules(): IGameRules<TMove, TState>;
  createScoring(): IScoringPolicy<TState>;
  createPieceSource(): IPieceSource<TPiece> | undefined;
  createBoard(): Board<TCell, TCoord, string>;
  createInitialState(): TState;
  createHistory(): MoveHistory<TMove, TState> | undefined;
}
