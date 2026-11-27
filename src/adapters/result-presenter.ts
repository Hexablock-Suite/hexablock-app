import type { LevelSummary } from '../application/level-summary';
import type { ListLevelsRequest } from '../application/list-levels';
import type { MoveResult } from '../application/move-result';
import { caughtError, FailureCode, Result } from '../application/result';
import type { UseCase } from '../application/use-case';
import { Outcome } from '../domain/engine/outcome';
import type { LevelId } from '../domain/progress/level-id';
import { LevelStatus } from '../domain/progress/level-status';
import { GameResult } from '../domain/progress/progress-model';
import type { GameId } from '../domain/shared/game-id';
import type { TopologyId } from '../domain/shared/topology-id';
import { valueOf } from './delivered';
import type { TextKey, Texts } from './texts/text-catalog';

// The view model of the victory screen and of the defeat screen (MVP, issue #180, APP-FR-07).
// It is plain data. `victory` tells the two screens apart.
export interface ResultViewModel {
  readonly victory: boolean;
  readonly title: string;
  readonly scoreLabel: string;
  readonly score: number;
  // The label of the button that goes back to the game selector map.
  readonly back: string;
  // The next level of a won level, with the label of its button and the text of its level id.
  // It exists only when `ListLevels` gives the level after the won level, and that level is
  // not locked.
  readonly next?: { readonly label: string; readonly levelId: string };
  // The label of the button that starts a new game. Only a won game with no levels has it.
  readonly newGame?: string;
  // The label of the button that plays the game again. Only a lost game has it.
  readonly retry?: string;
  // The text of a failed save or of a failed list. The result stays on the screen.
  readonly error?: string;
}

// The view of MVP: the screen that shows each new view model. `undefined` means no result:
// the game goes on, or the player closed the result.
export interface ResultView {
  show(model: ResultViewModel | undefined): void;
}

// What the presenter calls in layer 2. The composition root implements it (#180).
// `saveProgressOf()` gives the `SaveProgress` of the level `levelId`, or of the game with
// no levels: a level counts its stars with its own star rule, so each level has its own model.
// A root with no local store throws a RangeError, as `loadProgress()` does.
// `listLevels()` gives `ListLevels`, and a root with no local store throws a RangeError too.
export interface ResultUseCases {
  saveProgressOf(levelId: LevelId | undefined): Promise<UseCase<GameResult, void>>;
  listLevels(): UseCase<ListLevelsRequest, LevelSummary[]>;
}

// The text of each failure code (issue #322, classes.md decision 62). The table is a `Record`
// over the closed set of codes, so a new code with no text fails the type check.
// A failed save has its own text. Every other failure shows the general text `result.error`.
const ERROR_TEXTS: Readonly<Record<FailureCode, TextKey>> = {
  'start-failed': 'result.error',
  'no-running-game': 'result.error',
  'move-rejected': 'result.error',
  'move-failed': 'result.error',
  'publish-failed': 'result.error',
  'no-undo': 'result.error',
  'nothing-to-undo': 'result.error',
  'undo-failed': 'result.error',
  'nothing-to-redo': 'result.error',
  'redo-failed': 'result.error',
  'save-failed': 'result.error.save',
  'load-failed': 'result.error',
  'list-failed': 'result.error',
  'level-locked': 'result.error',
  'username-taken': 'result.error',
  'wrong-credentials': 'result.error',
  'invalid-credentials': 'result.error',
  'backend-unreachable': 'result.error',
  'register-failed': 'result.error',
  'login-failed': 'result.error',
  'unexpected-failure': 'result.error',
};

// The presenter of the victory screen and of the defeat screen (MVP, issue #180, APP-FR-07,
// APP-FR-09, docs/architecture/flows.md use case 2). It lives in layer 3 and imports no React.
// `GamePresenter` gives it the response of the move that ends a game (`onFinish()`).
// - It saves the result through `SaveProgress` (S3-04). A won level saves a level result with
//   its level id, its moves and its time. A game with no levels saves its score: Lines and
//   Merge count no moves (D26). A lost level saves nothing, because a lost level is not won,
//   and a saved level result opens the next level.
// - A won level offers the next level. `ListLevels` gives the levels of the game on the figure
//   with their status (S3-12, #326), so the presenter holds no copy of the rule of an open level.
//   It offers the level after the won level when that level is not locked.
// - A won game with no levels offers a new game, and a lost game offers a retry.
// The presenter reads only the plain `MoveResult` (decision 29). It builds the `GameResult` from
// its value objects and opens only the score and the level id, with `deliverTo()` (rule
// R-no-delivery-call). It keeps no level id: the root keeps the level of the match (decision 61).
// A failed `Result` never throws (decision 28): the presenter shows the result with the text of
// the failure. A port that throws gives the failure of its use case. Every text comes from the
// catalog of one language (APP-FR-11). A view attaches to see each new view model. It sees the
// current one at once.
export class ResultPresenter {
  private model: ResultViewModel | undefined = undefined;
  private view: ResultView | undefined;

  constructor(
    private readonly gameId: GameId,
    private readonly figure: TopologyId,
    private readonly useCases: ResultUseCases,
    private readonly texts: Texts,
  ) {}

  // The view sees the current view model at once, and each later one.
  attach(view: ResultView): void {
    this.view = view;
    view.show(this.model);
  }

  // The view sees no later view model.
  detach(): void {
    this.view = undefined;
  }

  viewModel(): ResultViewModel | undefined {
    return this.model;
  }

  // Ends the game of `response`: saves its result and shows the victory or the defeat.
  // A response of a game that goes on changes nothing.
  async onFinish(response: MoveResult<unknown, unknown>): Promise<void> {
    const victory = response.outcome.equals(Outcome.victory);
    if (!victory && !response.outcome.equals(Outcome.gameOver)) return;
    const saved = await this.save(response, victory);
    const next = victory ? await this.nextLevel(response.levelId) : undefined;
    const failure = [saved, next?.result].find((result) => result?.ok === false);
    this.model = {
      victory,
      title: this.texts[victory ? 'result.victory' : 'result.defeat'],
      scoreLabel: this.texts['result.score'],
      score: valueOf(response.score),
      back: this.texts['result.back'],
      ...this.choicesOf(victory, response, next?.levelId),
      ...(failure === undefined || failure.ok
        ? {}
        : { error: this.texts[ERROR_TEXTS[failure.error.code]] }),
    };
    this.view?.show(this.model);
  }

  // Closes the result: the player plays again or starts a new game.
  onClose(): void {
    this.model = undefined;
    this.view?.show(this.model);
  }

  // The buttons of the result. A won level offers its next level, a won game with no levels
  // offers a new game, and a lost game offers a retry.
  private choicesOf(
    victory: boolean,
    response: MoveResult<unknown, unknown>,
    next: LevelId | undefined,
  ): Pick<ResultViewModel, 'next' | 'newGame' | 'retry'> {
    if (!victory) return { retry: this.texts['result.retry'] };
    if (next !== undefined) {
      return { next: { label: this.texts['result.next-level'], levelId: valueOf(next) } };
    }
    return isEndless(response) ? { newGame: this.texts['result.new-game'] } : {};
  }

  // Saves the result of `response` through `SaveProgress`, or nothing for a lost level.
  // It gives the answer of the save, or `undefined` when nothing is saved.
  private async save(
    response: MoveResult<unknown, unknown>,
    victory: boolean,
  ): Promise<Result<void> | undefined> {
    const result = this.resultOf(response, victory);
    if (result === undefined) return undefined;
    return attempt(FailureCode.saveFailed, async () =>
      (await this.useCases.saveProgressOf(response.levelId)).execute(result),
    );
  }

  // The `GameResult` of `response` (D26): the result of a won level, or the result of a game
  // with no levels. A lost level and a game with levels that started with no level have none.
  private resultOf(
    response: MoveResult<unknown, unknown>,
    victory: boolean,
  ): GameResult | undefined {
    const { score, moves, levelId, elapsedMs } = response;
    if (isEndless(response)) return GameResult.endless({ gameId: this.gameId, score });
    if (!victory || moves === undefined || levelId === undefined) return undefined;
    return GameResult.of({
      gameId: this.gameId,
      score,
      moves,
      levelId,
      ...(elapsedMs === undefined ? {} : { elapsedMs }),
    });
  }

  // The level after the won level `won` in the list of `ListLevels`, when it is not locked,
  // with the answer of the list. A game with no level id lists nothing.
  private async nextLevel(
    won: LevelId | undefined,
  ): Promise<{ result: Result<LevelSummary[]>; levelId?: LevelId } | undefined> {
    if (won === undefined) return undefined;
    const result = await attempt(FailureCode.listFailed, () =>
      this.useCases.listLevels().execute({ gameId: this.gameId, figure: this.figure }),
    );
    if (!result.ok) return { result };
    const at = result.value.findIndex((summary) => summary.levelId.equals(won));
    const next = at === -1 ? undefined : result.value[at + 1];
    if (next === undefined || next.status.equals(LevelStatus.locked)) return { result };
    return { result, levelId: next.levelId };
  }
}

// A game with no levels counts no moves and has no level id (D26).
function isEndless(response: MoveResult<unknown, unknown>): boolean {
  return response.moves === undefined && response.levelId === undefined;
}

// The answer of `call`. A port that throws gives a failure with the code `code`.
async function attempt<T>(code: FailureCode, call: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await call();
  } catch (thrown) {
    return Result.failure(caughtError(code, thrown));
  }
}
