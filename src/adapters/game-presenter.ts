import type { ApplyMoveRequest } from '../application/apply-move';
import type { MoveResult } from '../application/move-result';
import type { Result, UseCaseError } from '../application/result';
import type { StartGameRequest } from '../application/start-game';
import type { UseCase } from '../application/use-case';
import { Outcome } from '../domain/engine/outcome';
import type { Score } from '../domain/engine/score';
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
  // The text of the last failure of a use case. A later success clears it.
  readonly error?: string;
  // The variant data for the screen. It exists after the first answer of `StartGame`.
  readonly payload?: TPayloadView;
}

// The view of MVP: the screen that shows each new view model.
export interface GameView<TCoord, TCellView, TPayloadView> {
  show(model: GameViewModel<TCoord, TCellView, TPayloadView>): void;
}

// The text of each outcome. The set of outcomes is closed (classes.md decision 45).
const OUTCOME_TEXTS: readonly (readonly [Outcome, TextKey])[] = [
  [Outcome.playing, 'play.outcome.playing'],
  [Outcome.victory, 'play.outcome.victory'],
  [Outcome.gameOver, 'play.outcome.game-over'],
];

// The presenter of the game screen (MVP, issue #170). It lives in layer 3 and imports no React.
// It calls `StartGame` and `ApplyMove` through the `UseCase` input port (decision 9), so it never
// sees a concrete use case. It reads only the plain `MoveResult` (decision 29): it never calls
// a method of `Board` or of a photo (#234). The `StateMapper` of the game turns each occupied
// cell, each free space and the payload into the data of the screen (decision 14).
// So the presenter names no variant, and one presenter class serves every game.
// A failed `Result` never throws (decision 28): the presenter keeps the last board and shows
// the text of the failure. A rejected move has its own text, and any other failure has one
// general text. Every text comes from the catalog of one language (APP-FR-11).
// A view attaches to see each new view model. It sees the current one at once.
export class GamePresenter<TCell, TCoord, TMove, TView, TCellView, TPayloadView> {
  private model: GameViewModel<TCoord, TCellView, TPayloadView>;
  private view: GameView<TCoord, TCellView, TPayloadView> | undefined;

  constructor(
    private readonly startGame: UseCase<StartGameRequest, MoveResult<TCell, TCoord, TView>>,
    private readonly applyMove: UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord, TView>>,
    private readonly mapper: StateMapper<TCell, TView, TCellView, TPayloadView>,
    private readonly texts: Texts,
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

  // Opens a new game through `StartGame`.
  async onStart(): Promise<void> {
    this.present(await this.startGame.execute({}));
  }

  // Plays one move through `ApplyMove`.
  async onMove(move: TMove): Promise<void> {
    this.present(await this.applyMove.execute({ move }));
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
      score: numberOf(response.score),
      outcome: this.outcomeText(response.outcome),
      cells: [
        ...response.cells.map(([at, cell]) => [at, this.mapper.toView(cell)] as const),
        ...response.freeSpaces.map((at) => [at, this.mapper.freeView()] as const),
      ],
      payload: this.mapper.toPayload(response.payload),
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
    return error.code === 'move-rejected'
      ? this.texts['play.error.move-rejected']
      : this.texts['play.error'];
  }
}

// The number of a score. The presenter is an adapter of the edge, so it receives the value
// through `deliverTo()` (rule R-no-delivery-call).
function numberOf(score: Score): number {
  let value = 0;
  score.deliverTo({
    receive: (delivered) => {
      value = delivered;
    },
  });
  return value;
}
