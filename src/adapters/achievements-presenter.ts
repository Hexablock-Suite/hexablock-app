import type { AchievementSummary, ListAchievementsRequest } from '../application/list-achievements';
import type { Result } from '../application/result';
import type { UseCase } from '../application/use-case';
import type { TextKey, Texts } from './texts/text-catalog';

// One achievement on the achievements screen: its id and its name in one language.
export interface AchievementItem {
  readonly id: string;
  readonly name: string;
}

// One section of the achievements screen: the achievements in progress, or the completed ones.
// `completed` tells the two sections apart, so the screen draws each one without its position.
// `empty` is the text that the screen shows when the section holds no achievement.
export interface AchievementSection {
  readonly title: string;
  readonly completed: boolean;
  readonly items: readonly AchievementItem[];
  readonly empty: string;
}

// The view model of the achievements screen (MVP, layers.md, issue #188). It is plain data
// that the presenter builds again after the answer of `ListAchievements`.
export interface AchievementsViewModel {
  readonly title: string;
  // The label of the button that goes back.
  readonly back: string;
  // The achievements in progress first, then the completed ones. The list is empty
  // until the first successful answer.
  readonly sections: readonly AchievementSection[];
  // The loading text. It exists only before the first answer.
  readonly loading?: string;
  // The text of a failed answer. A later success clears it.
  readonly error?: string;
}

// The view of MVP: the screen that shows each new view model.
export interface AchievementsView {
  show(model: AchievementsViewModel): void;
}

// The presenter of the achievements screen (MVP, issue #188). It lives in layer 3 and imports
// no React. It calls `ListAchievements` through the `UseCase` input port (decision 9), so it never
// sees a concrete use case. It reads only the plain `AchievementSummary` list.
// The screen shows each achievement as in progress or completed: the presenter puts each one
// in its section, in the order of the list. The name of an achievement lives under
// `achievement.<id>` in the text catalog (APP-FR-11). An id with no text is a programming error
// of the composition root, so it throws a RangeError.
// A failed `Result` never throws (decision 28): the presenter keeps its sections and shows
// the text of the failure. A view attaches to see each new view model. It sees the current one
// at once.
export class AchievementsPresenter {
  private model: AchievementsViewModel;
  private view: AchievementsView | undefined;

  constructor(
    private readonly listAchievements: UseCase<ListAchievementsRequest, AchievementSummary[]>,
    private readonly texts: Texts,
  ) {
    this.model = {
      title: texts['achievements.title'],
      back: texts['achievements.back'],
      sections: [],
      loading: texts['achievements.loading'],
    };
  }

  // The view sees the current view model at once, and each later one.
  attach(view: AchievementsView): void {
    this.view = view;
    view.show(this.model);
  }

  // The view sees no later view model.
  detach(): void {
    this.view = undefined;
  }

  viewModel(): AchievementsViewModel {
    return this.model;
  }

  // Reads the achievements through `ListAchievements`.
  async onOpen(): Promise<void> {
    this.present(await this.listAchievements.execute({}));
  }

  private present(result: Result<AchievementSummary[]>): void {
    const { title, back, sections } = this.model;
    this.model = result.ok
      ? { title, back, sections: this.sectionsOf(result.value) }
      : { title, back, sections, error: this.texts['achievements.error'] };
    this.view?.show(this.model);
  }

  private sectionsOf(summaries: readonly AchievementSummary[]): AchievementSection[] {
    const items = (completed: boolean) =>
      summaries
        .filter((summary) => summary.completed === completed)
        .map(({ id }) => ({ id, name: this.text(`achievement.${id}`) }));
    return [
      {
        title: this.texts['achievements.in-progress'],
        completed: false,
        items: items(false),
        empty: this.texts['achievements.none-in-progress'],
      },
      {
        title: this.texts['achievements.completed'],
        completed: true,
        items: items(true),
        empty: this.texts['achievements.none-completed'],
      },
    ];
  }

  // A key that the catalog does not hold throws a RangeError.
  private text(key: string): string {
    if (!holds(this.texts, key)) {
      throw new RangeError(`The text catalog has no text for the key "${key}".`);
    }
    return this.texts[key];
  }
}

// Whether `texts` holds the key `key`. `Object.hasOwn` reads only the own keys.
function holds(texts: Texts, key: string): key is TextKey {
  return Object.hasOwn(texts, key);
}
