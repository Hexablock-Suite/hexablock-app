import type { ApplyMoveRequest } from '../application/game/apply-move';
import type { MoveResult } from '../application/game/move-result';
import type { RedoMoveRequest } from '../application/game/redo-move';
import type { FailureCode, Result, UseCaseError } from '../application/result';
import type { StartGameRequest } from '../application/game/start-game';
import type { UndoMoveRequest } from '../application/game/undo-move';
import type { UseCase } from '../application/use-case';
import type { LevelId } from '../domain/progress/level-id';
import { Outcome } from '../domain/engine/events/outcome';
import { valueOf, type Delivers } from './delivered';
import type { MoveMapper } from './move-mapper';
import type { StateMapper } from './state-mapper';
import type { TextKey, Texts } from './texts/text-catalog';

// The view model of the game screen (MVP, layers.md, issue #170). It is plain data that
// the presenter builds again after each answer of a use case. It names no variant.
// `cells` holds one pair of a coordinate and a cell view for each space of the board,
// free or occupied. `BoardView` takes these pairs as they are, so the screen reads no cell.
export interface GameViewModel<TCoord, TCellView, TPayloadView> {
  // The label of the button that goes back to the game selector map.
  readonly back: string;
  // The accessible name of the board.
  readonly board: string;
  readonly cells: readonly (readonly [TCoord, TCellView])[];
  readonly scoreLabel: string;
  readonly score: number;
  // The text of the outcome, or the text of a board that has not started.
  readonly outcome: string;
  // The time of play of a timed game in minutes and seconds, such as `1:05`, with its label.
  // It exists only when the response carries a time (decision 29, issue #175).
  readonly time?: { readonly label: string; readonly value: string };
  // The undo and the redo of a variant with undo, each with its label and whether a move can go
  // back or forward now (APP-FR-08, issue #178). They exist only when the response says that
  // the variant has undo (`MoveResult.hasUndo`). The move controls of the game choose
  // which of them to show.
  readonly undo?: { readonly label: string; readonly enabled: boolean };
  readonly redo?: { readonly label: string; readonly enabled: boolean };
  // The text of the last failure of a use case. A later success clears it.
  readonly error?: string;
  // The variant data for the screen. It exists after the first answer of `StartGame`.
  readonly payload?: TPayloadView;
}

// The view of MVP: the screen that shows each new view model.
export interface GameView<TCoord, TCellView, TPayloadView> {
  show(model: GameViewModel<TCoord, TCellView, TPayloadView>): void;
}

// What hears the end of a game (#180): `ResultPresenter` saves the result and shows it.
// It gets the response of the move that ends the game.
export interface GameEndListener {
  onFinish(response: MoveResult<unknown, unknown>): Promise<void>;
}

// The text of each outcome. The set of outcomes is closed (classes.md decision 45).
const OUTCOME_TEXTS: readonly (readonly [Outcome, TextKey])[] = [
  [Outcome.playing, 'play.outcome.playing'],
  [Outcome.victory, 'play.outcome.victory'],
  [Outcome.gameOver, 'play.outcome.game-over'],
];

// The text of each failure code (issue #322, classes.md decision 62). The table is a `Record`
// over the closed set of codes, so a new code with no text fails the type check.
// Four failures have their own text. Every other failure shows the general text `play.error`.
// A quick second tap on undo or redo can find no move left (#178): its text says so.
// A link can name a locked level, and `StartGame` refuses it (#397): its text says why.
const ERROR_TEXTS: Readonly<Record<FailureCode, TextKey>> = {
  'start-failed': 'play.error',
  'no-running-game': 'play.error',
  'move-rejected': 'play.error.move-rejected',
  'move-failed': 'play.error',
  'publish-failed': 'play.error',
  'no-undo': 'play.error',
  'nothing-to-undo': 'play.error.nothing-to-undo',
  'undo-failed': 'play.error',
  'nothing-to-redo': 'play.error.nothing-to-redo',
  'redo-failed': 'play.error',
  'save-failed': 'play.error',
  'load-failed': 'play.error',
  'list-failed': 'play.error',
  'level-locked': 'play.error.level-locked',
  'username-taken': 'play.error',
  'wrong-credentials': 'play.error',
  'invalid-credentials': 'play.error',
  'backend-unreachable': 'play.error',
  'register-failed': 'play.error',
  'login-failed': 'play.error',
  'sign-in-after-sign-up-failed': 'play.error',
  'session-expired': 'play.error',
  'sync-failed': 'play.error',
  'sign-in-required': 'play.error',
  'level-has-no-board': 'play.error',
  'leaderboard-failed': 'play.error',
  'unexpected-failure': 'play.error',
};

// The presenter of the game screen (MVP, issue #170). It lives in layer 3 and imports no React.
// It calls `StartGame`, `ApplyMove`, `UndoMove` and `RedoMove` (#178) through the `UseCase`
// input port (decision 9), so it never sees a concrete use case. It reads only the plain `MoveResult` (decision 29): it never calls
// a method of `Board` or of a photo (#234). The `StateMapper` of the game turns each occupied
// cell, each free space and the payload into the data of the screen (decision 14).
// The move controls send a plain intent, and the `MoveMapper` of the game turns it into
// the domain move before `ApplyMove` (decision 14, #405).
// So the presenter names no variant, and one presenter class serves every game.
// A timed game shows the time of play of the response: the root reads it, so the screen
// reads no clock (#175). A variant with undo shows the undo and the redo of the response:
// the root answers `canUndo` and `canRedo`, so the presenter reads no history (#178).
// A failed `Result` never throws (decision 28): the presenter keeps the last board and shows
// the text of the failure. A rejected move, an undo or a redo that finds no move and a locked
// level (#397) have their own texts, and any other failure has one general text. The table of texts names every code.
// Every text comes from the catalog of one language (APP-FR-11).
// The move that ends a game also goes to the end listener, after the view sees it (#180).
// The composition root gives `ResultPresenter` as the listener.
// A view attaches to see each new view model. It sees the current one at once.
export class GamePresenter<TCell, TCoord, TMove, TView, TCellView, TPayloadView, TIntent> {
  private model: GameViewModel<TCoord, TCellView, TPayloadView>;
  private view: GameView<TCoord, TCellView, TPayloadView> | undefined;

  constructor(
    private readonly startGame: UseCase<StartGameRequest, MoveResult<TCell, TCoord, TView>>,
    private readonly applyMove: UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord, TView>>,
    private readonly undoMove: UseCase<UndoMoveRequest, MoveResult<TCell, TCoord, TView>>,
    private readonly redoMove: UseCase<RedoMoveRequest, MoveResult<TCell, TCoord, TView>>,
    private readonly mapper: StateMapper<TCell, TView, TCellView, TPayloadView>,
    private readonly moves: MoveMapper<TIntent, TMove>,
    private readonly texts: Texts,
    private readonly ended?: GameEndListener,
  ) {
    this.model = {
      ...this.labels(),
      score: 0,
      outcome: texts['play.starting'],
      cells: [],
    };
  }

  // The view sees the current view model at once, and each later one.
  attach(view: GameView<TCoord, TCellView, TPayloadView>): void {
    this.view = view;
    view.show(this.model);
  }

  // The view sees no later view model.
  detach(): void {
    this.view = undefined;
  }

  viewModel(): GameViewModel<TCoord, TCellView, TPayloadView> {
    return this.model;
  }

  // Opens a new game through `StartGame`. `levelId` names the level that the player chose,
  // and a game with no levels starts with no level id (issue #172).
  // The presenter passes the id on and never reads it.
  async onStart(levelId?: LevelId): Promise<void> {
    this.present(await this.startGame.execute(levelId === undefined ? {} : { levelId }));
  }

  // Plays the move of `intent` through `ApplyMove`. The move mapper builds the domain move (#405).
  // A move that ends the game goes to the end listener too (#180).
  async onMove(intent: TIntent): Promise<void> {
    const result = await this.applyMove.execute({ move: this.moves.toMove(intent) });
    this.present(result);
    if (result.ok && !result.value.outcome.equals(Outcome.playing)) {
      await this.ended?.onFinish(result.value);
    }
  }

  // Takes back the last move through `UndoMove` (#178).
  async onUndo(): Promise<void> {
    this.present(await this.undoMove.execute({}));
  }

  // Plays the last undone move again through `RedoMove` (#178).
  async onRedo(): Promise<void> {
    this.present(await this.redoMove.execute({}));
  }

  private present(result: Result<MoveResult<TCell, TCoord, TView>>): void {
    this.model = result.ok
      ? this.modelOf(result.value)
      : { ...this.model, error: this.errorText(result.error) };
    this.view?.show(this.model);
  }

  // The occupied spaces come first, then the free ones. `BoardView` places each space
  // with the layout of the figure, so the order changes no place.
  private modelOf(
    response: MoveResult<TCell, TCoord, TView>,
  ): GameViewModel<TCoord, TCellView, TPayloadView> {
    return {
      ...this.labels(),
      score: valueOf(response.score),
      outcome: this.outcomeText(response.outcome),
      cells: [
        ...response.cells.map(([at, cell]) => [at, this.mapper.toView(cell)] as const),
        ...response.freeSpaces.map((at) => [at, this.mapper.freeView()] as const),
      ],
      payload: this.mapper.toPayload(response.payload),
      ...(response.elapsedMs === undefined
        ? {}
        : { time: { label: this.texts['play.time'], value: clockText(response.elapsedMs) } }),
      ...this.historyOf(response),
    };
  }

  // The undo and the redo of a variant with undo, and nothing for a variant with no undo.
  private historyOf(
    response: MoveResult<TCell, TCoord, TView>,
  ): Pick<GameViewModel<TCoord, TCellView, TPayloadView>, 'undo' | 'redo'> {
    if (!response.hasUndo) return {};
    return {
      undo: { label: this.texts['play.undo'], enabled: response.canUndo },
      redo: { label: this.texts['play.redo'], enabled: response.canRedo },
    };
  }

  private labels(): Pick<
    GameViewModel<TCoord, TCellView, TPayloadView>,
    'back' | 'board' | 'scoreLabel'
  > {
    return {
      back: this.texts['play.back'],
      board: this.texts['play.board'],
      scoreLabel: this.texts['play.score'],
    };
  }

  // The set of outcomes is closed, so an outcome without a text is a programming error.
  private outcomeText(outcome: Outcome): string {
    const found = OUTCOME_TEXTS.find(([candidate]) => candidate.equals(outcome));
    if (found === undefined) throw new RangeError('The presenter has no text for this outcome.');
    return this.texts[found[1]];
  }

  private errorText(error: UseCaseError): string {
    return this.texts[ERROR_TEXTS[error.code]];
  }
}

// A time in milliseconds as whole minutes and seconds, such as `1:05`. The presenter is an
// adapter of the edge, so it receives the number with `valueOf()` (rule R-no-delivery-call).
// `LeaderboardPresenter` shows the time of a board row with it too (#47).
export function clockText(elapsed: Delivers<number>): string {
  const seconds = Math.floor(valueOf(elapsed) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
