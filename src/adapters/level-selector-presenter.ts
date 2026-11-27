import type { ListLevelsRequest } from '../application/list-levels';
import type { LevelSummary } from '../application/level-summary';
import type { Result } from '../application/result';
import type { UseCase } from '../application/use-case';
import { LevelStatus } from '../domain/progress/level-status';
import { valueOf } from './delivered';
import type { TextKey, Texts } from './texts/text-catalog';

// One level on the level selector (#173).
export interface LevelChoice {
  // The text of the `LevelId` of the level. The screen opens the game route with it.
  readonly id: string;
  // The name of the level from its place in the list, for example «Nivel 2».
  readonly name: string;
  // The text of the status of the level, for example «Bloqueado».
  readonly status: string;
  // Whether the level is completed. The screen draws a completed level in its own color.
  readonly completed: boolean;
  // Whether a press starts the level. A locked level does not start.
  readonly playable: boolean;
  // The stars of a completed level as one text, for example «Estrellas 2».
  // It exists only for a completed level.
  readonly stars?: string;
  // The label of the button that opens the leaderboard of the level (#47).
  // It exists only for a completed level.
  readonly leaderboard?: string;
}

// The view model of the level selector (MVP, layers.md, issue #173). It is plain data
// that the presenter builds again after the answer of `ListLevels`.
export interface LevelSelectorViewModel {
  readonly title: string;
  // The label of the button that goes back to the map.
  readonly back: string;
  // The levels of the game on the chosen figure, in the order of the list. The list is empty
  // until the first successful answer.
  readonly levels: readonly LevelChoice[];
  // The loading text. It exists only before the first answer.
  readonly loading?: string;
  // The text of a successful answer with no level. The screen shows it in place of the list.
  readonly empty?: string;
  // The text of a failed answer. A later success clears it.
  readonly error?: string;
}

// The view of MVP: the screen that shows each new view model.
export interface LevelSelectorView {
  show(model: LevelSelectorViewModel): void;
}

// The catalog key of the text of each status. The table reads no rule of a status:
// `ListLevels` gives the status of each level, and `LevelStatus.ofEach()` holds the rule.
const STATUS_TEXTS: readonly (readonly [LevelStatus, TextKey])[] = [
  [LevelStatus.completed, 'levels.status.completed'],
  [LevelStatus.open, 'levels.status.open'],
  [LevelStatus.locked, 'levels.status.locked'],
];

// The presenter of the level selector (MVP, issue #173, APP-FR-02). It lives in layer 3 and
// imports no React. It calls `ListLevels` through the `UseCase` input port (decision 9), so it
// never sees a concrete use case. It asks for the levels of the game and the figure of
// `request`, and it reads only the plain `LevelSummary` list.
// The screen shows each level as completed, open or locked, from the `LevelStatus` that
// `ListLevels` gives: the presenter compares the status with `equals()` to find its text.
// A completed level and an open level start; a locked level does not. The presenter is an
// adapter of the edge, so it receives the text of the level id and the number of the stars
// with `valueOf()` of `delivered.ts` (rule R-no-delivery-call, issue #408).
// A completed level also carries the label of the button of its leaderboard (#47).
// A figure with no level gives an empty list, and the screen shows the text of no levels.
// A failed `Result` never throws (decision 28): the presenter keeps its levels and shows
// the text of the failure. A view attaches to see each new view model. It sees the current one
// at once.
export class LevelSelectorPresenter {
  private model: LevelSelectorViewModel;
  private view: LevelSelectorView | undefined;

  constructor(
    private readonly listLevels: UseCase<ListLevelsRequest, LevelSummary[]>,
    private readonly request: ListLevelsRequest,
    private readonly texts: Texts,
  ) {
    this.model = {
      title: texts['levels.title'],
      back: texts['levels.back'],
      levels: [],
      loading: texts['levels.loading'],
    };
  }

  // The view sees the current view model at once, and each later one.
  attach(view: LevelSelectorView): void {
    this.view = view;
    view.show(this.model);
  }

  // The view sees no later view model.
  detach(): void {
    this.view = undefined;
  }

  viewModel(): LevelSelectorViewModel {
    return this.model;
  }

  // Reads the levels through `ListLevels`.
  async onOpen(): Promise<void> {
    this.present(await this.listLevels.execute(this.request));
  }

  private present(result: Result<LevelSummary[]>): void {
    const { title, back, levels } = this.model;
    if (!result.ok) {
      this.model = { title, back, levels, error: this.texts['levels.error'] };
    } else if (result.value.length === 0) {
      this.model = { title, back, levels: [], empty: this.texts['levels.none'] };
    } else {
      this.model = { title, back, levels: result.value.map((each, at) => this.choiceOf(each, at)) };
    }
    this.view?.show(this.model);
  }

  // The choice of the level `summary` at the place `at` of the list.
  private choiceOf(summary: LevelSummary, at: number): LevelChoice {
    const choice = {
      id: valueOf(summary.levelId),
      name: `${this.texts['levels.level']} ${at + 1}`,
      status: this.texts[statusKeyOf(summary.status)],
      completed: summary.status.equals(LevelStatus.completed),
      playable: !summary.status.equals(LevelStatus.locked),
    };
    const board = choice.completed ? { leaderboard: this.texts['leaderboard.open'] } : {};
    return summary.stars === undefined
      ? { ...choice, ...board }
      : {
          ...choice,
          stars: `${this.texts['levels.stars']} ${valueOf(summary.stars)}`,
          ...board,
        };
  }
}

// The catalog key of the text of `status`.
function statusKeyOf(status: LevelStatus): TextKey {
  const entry = STATUS_TEXTS.find(([each]) => each.equals(status));
  if (entry === undefined) throw new RangeError('The level selector has no text for this status.');
  return entry[1];
}
