import type { Board } from '../board/board';
import type { BoardId } from '../board/board-id';
import type { BoardState, SnapshotOf } from '../board/board-state';
import type { Cloneable } from '../cloneable';
import type { GameId } from '../../shared/game-id';
import type { GameStateId } from '../board/game-state-id';
import type { LevelTimer } from '../turn/level-timer';
import type { MatchId } from '../match-id';
import type { Piece } from '../board/piece';
import type { IPieceSource } from '../random/piece-source';
import type { IProgressModel } from '../../progress/progress-model';
import type { IGameRules } from '../turn/rules';
import type { IScoringPolicy } from '../turn/scoring-policy';
import type { IUndoable } from '../history/undo-capabilities';

// Abstract Factory (statement §3.3, classes.md decision 31). One factory per variant
// creates the whole family of its game: the rules, the scoring, the piece source,
// the board, the first state and the undo history. The engine and the use cases depend
// only on this interface, so they never name a variant (rule `engine-no-variants`).
// Each factory declares its own open `GameId` (classes.md decision 30) and keeps it private.
// `isFor()` tells whether the factory builds a game, so the composition root finds the factory
// of the chosen game and gives that id to `GameFactory` (issue #234).
// `createPieceSource()` returns `undefined` for a variant with no piece source.
// `TPiece` is the item of the source. It is a `Piece` by default.
// Hexa Merge draws a new tile and its cell (`NewTile`), so it binds `TPiece` to that type.
// `createRules()` gives the plain rules of the variant.
// `createTimer()` returns a new timer for each game, or `undefined` for a variant with no timer
// (classes.md decision 19). It takes the `MatchId` of the game, so the timer gets the local id
// of that match (classes.md decisions 50 and 52). `GameFactory` gives the timer to the root
// and wraps the rules in `TimedRulesDecorator` with it, as it gives the history (issue #234).
// `createBoard()` gives a new empty board with the id `boardId` (classes.md decision 7).
// `createInitialState()` puts a new board and the piece source in the first state.
// The first state takes its own id `stateId` and the `MatchId` of its game (decision 26),
// and its board takes the id `boardId`. `GameFactory` builds the two local ids from the `MatchId`.
// So two calls give two games that share no board. A piece source is a value
// (classes.md decision 51), so two games can share one source, and no draw changes it.
// `createHistory()` returns a new history for each game, or `undefined` for a variant
// with no undo (classes.md decision 3). The history keeps the photos of the state (decision 34).
// `createProgressModel()` gives the progress model of the game (issue #156): `HighScoreProgress`
// for a game with no levels, or `LevelProgress` with the star rule of its level.
export interface IVariantFactory<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece = Piece<TCell, TCoord>,
> {
  isFor(gameId: GameId): boolean;
  createRules(): IGameRules<TMove, TState>;
  createTimer(matchId: MatchId): LevelTimer | undefined;
  createScoring(): IScoringPolicy<TState>;
  createPieceSource(): IPieceSource<TPiece> | undefined;
  createBoard(boardId: BoardId): Board<TCell, TCoord>;
  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): TState;
  createHistory(): IUndoable<TMove, SnapshotOf<TState>> | undefined;
  createProgressModel(): IProgressModel;
}
