/** @jest-environment node */
import {
  AchievementsPresenter,
  type AchievementsViewModel,
} from '../../src/adapters/achievements-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type {
  AchievementSummary,
  ListAchievementsRequest,
} from '../../src/application/list-achievements';
import { Result, UseCaseError } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';

// Issue #188: `AchievementsPresenter` calls `ListAchievements` through the `UseCase` port and
// turns the plain summaries into the view model of the achievements screen (MVP, layers.md).
// Every text comes from the text catalog of one language (APP-FR-11).

// A port that answers its one call with `result` and counts the calls.
class AnsweringUseCase implements UseCase<ListAchievementsRequest, AchievementSummary[]> {
  calls = 0;

  constructor(private readonly result: Result<AchievementSummary[]>) {}

  async execute(_request: ListAchievementsRequest): Promise<Result<AchievementSummary[]>> {
    this.calls += 1;
    return this.result;
  }
}

const FOUR: AchievementSummary[] = [
  { id: 'lines-combo', completed: false },
  { id: 'fit-3', completed: true },
  { id: 'merge-256', completed: false },
  { id: 'fit-all', completed: true },
];

// The presenter over one answering port, with a view that records each model it shows.
function presenterWith(result: Result<AchievementSummary[]>, texts = textCatalog.es) {
  const port = new AnsweringUseCase(result);
  const presenter = new AchievementsPresenter(port, texts);
  const shown: AchievementsViewModel[] = [];
  presenter.attach({ show: (model) => shown.push(model) });
  return { port, presenter, shown };
}

// The title, the status, the names and the empty text of each section, in order.
function sectionsOf(model: AchievementsViewModel) {
  return model.sections.map(({ title, completed, items, empty }) => ({
    title,
    completed,
    names: items.map(({ name }) => name),
    empty,
  }));
}

describe('AchievementsPresenter', () => {
  // Before the first answer the screen shows its labels and a loading text, and no section.
  it('should_show_the_labels_and_the_loading_text_when_a_view_attaches_before_the_answer', () => {
    const { shown } = presenterWith(Result.success(FOUR));

    expect(shown).toEqual([
      { title: 'Logros', back: 'Atrás', sections: [], loading: 'Cargando los logros' },
    ]);
  });

  // The screen shows each achievement as in progress or completed: two sections, each one
  // in the order of the list. Each name comes from `achievement.<id>` in the catalog.
  it('should_put_each_achievement_in_its_section_when_the_list_answers', async () => {
    const { port, presenter, shown } = presenterWith(Result.success(FOUR));

    await presenter.onOpen();

    expect(port.calls).toBe(1);
    expect(shown).toHaveLength(2);
    expect([shown[1].loading, shown[1].error]).toEqual([undefined, undefined]);
    expect(sectionsOf(shown[1])).toEqual([
      {
        title: 'En progreso',
        completed: false,
        names: ['Completa 3 líneas a la vez', 'Llega a 256 en Hexa Merge'],
        empty: 'Completaste todos los logros.',
      },
      {
        title: 'Completados',
        completed: true,
        names: ['Gana 3 niveles de Hexa Fit', 'Gana todos los niveles de Hexa Fit'],
        empty: 'Aún no completas ningún logro.',
      },
    ]);
    expect(shown[1].sections.map(({ items }) => items.map(({ id }) => id))).toEqual([
      ['lines-combo', 'merge-256'],
      ['fit-3', 'fit-all'],
    ]);
    expect(presenter.viewModel()).toBe(shown[1]);
  });

  it('should_show_the_english_texts_when_the_presenter_takes_the_english_catalog', async () => {
    const { presenter, shown } = presenterWith(Result.success(FOUR), textCatalog.en);

    await presenter.onOpen();

    expect([shown[0].title, shown[0].back, shown[0].loading]).toEqual([
      'Achievements',
      'Back',
      'Loading the achievements',
    ]);
    expect(sectionsOf(shown[1]).map(({ title, names }) => [title, names])).toEqual([
      ['In progress', ['Clear 3 lines at once', 'Reach 256 in Hexa Merge']],
      ['Completed', ['Win 3 Hexa Fit levels', 'Win every Hexa Fit level']],
    ]);
  });

  // A failed `Result` never throws (decision 28): the screen keeps its sections and shows
  // the error text in place of the loading text.
  it('should_show_the_error_text_and_no_section_when_the_list_fails', async () => {
    const { presenter, shown } = presenterWith(
      Result.failure(new UseCaseError('list-failed', 'An English message that no screen shows.')),
    );

    await presenter.onOpen();

    expect(shown[1]).toEqual({
      title: 'Logros',
      back: 'Atrás',
      sections: [],
      error: 'No se pudieron leer los logros. Vuelve atrás y ábrelos otra vez.',
    });
  });

  // An id with no text in the catalog is a programming error of the composition root.
  it('should_reject_with_a_range_error_when_the_catalog_has_no_text_for_an_achievement', async () => {
    const { presenter } = presenterWith(Result.success([{ id: 'unknown', completed: false }]));

    await expect(presenter.onOpen()).rejects.toThrow(
      new RangeError('The text catalog has no text for the key "achievement.unknown".'),
    );
  });

  it('should_show_no_later_model_when_the_view_detaches', async () => {
    const { presenter, shown } = presenterWith(Result.success(FOUR));

    presenter.detach();
    await presenter.onOpen();

    expect(shown).toHaveLength(1);
    expect(presenter.viewModel().loading).toBeUndefined();
  });
});
