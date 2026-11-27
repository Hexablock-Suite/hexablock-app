/** @jest-environment node */
import {
  LevelSelectorPresenter,
  type LevelSelectorViewModel,
} from '../../src/adapters/level-selector-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { ListLevelsRequest } from '../../src/application/list-levels';
import type { LevelList, LevelSummary } from '../../src/application/level-summary';
import { Result, UseCaseError } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { GameId } from '../../src/domain/shared/game-id';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { Stars } from '../../src/domain/progress/stars';

// Issue #173: `LevelSelectorPresenter` calls `ListLevels` through the `UseCase` port and turns
// the plain summaries into the view model of the level selector (MVP, layers.md). It reads
// the status of each level that `ListLevels` gives, and it holds no copy of the rule.
// Every text comes from the text catalog of one language (APP-FR-11).

const FIT = GameId.of('hexa-fit');

// A port that answers each call with `result` and keeps each request.
class AnsweringUseCase implements UseCase<ListLevelsRequest, LevelList> {
  readonly requests: ListLevelsRequest[] = [];

  constructor(private readonly result: Result<LevelList>) {}

  async execute(request: ListLevelsRequest): Promise<Result<LevelList>> {
    this.requests.push(request);
    return this.result;
  }
}

// Four levels: a completed level with two stars, a completed level with zero stars,
// an open level and a locked level.
const FOUR: LevelSummary[] = [
  { levelId: LevelId.of('fit-01'), status: LevelStatus.completed, stars: Stars.of(2) },
  { levelId: LevelId.of('fit-02'), status: LevelStatus.completed, stars: Stars.of(0) },
  { levelId: LevelId.of('fit-03'), status: LevelStatus.open },
  { levelId: LevelId.of('fit-04'), status: LevelStatus.locked },
];

// The answer of `ListLevels` with the levels `levels` and the unavailable levels `unavailable`.
function listOf(levels: LevelSummary[], unavailable: string[] = []): LevelList {
  return { levels, unavailable: unavailable.map((levelId) => LevelId.of(levelId)) };
}

// The presenter of the Fit levels of the square over one answering port, with a view that
// records each model it shows.
function presenterWith(result: Result<LevelList>, texts = textCatalog.es) {
  const port = new AnsweringUseCase(result);
  const presenter = new LevelSelectorPresenter(
    port,
    { gameId: FIT, figure: TopologyId.square },
    texts,
  );
  const shown: LevelSelectorViewModel[] = [];
  presenter.attach({ show: (model) => shown.push(model) });
  return { port, presenter, shown };
}

describe('LevelSelectorPresenter', () => {
  // Before the first answer the screen shows its labels and a loading text, and no level.
  it('should_show_the_labels_and_the_loading_text_when_a_view_attaches_before_the_answer', () => {
    const { shown } = presenterWith(Result.success(listOf(FOUR)));

    expect(shown).toEqual([
      { title: 'Niveles', back: 'Mapa', levels: [], loading: 'Cargando los niveles' },
    ]);
  });

  // The screen shows each level as completed, open or locked, in the order of the list,
  // with the stars of a completed level. A completed level and an open level start;
  // a locked level does not.
  it('should_show_each_level_as_completed_open_or_locked_when_the_list_answers', async () => {
    const { port, presenter, shown } = presenterWith(Result.success(listOf(FOUR)));

    await presenter.onOpen();

    expect(port.requests).toHaveLength(1);
    expect(port.requests[0].gameId.equals(FIT)).toBe(true);
    expect(port.requests[0].figure.equals(TopologyId.square)).toBe(true);
    expect(shown).toHaveLength(2);
    expect(shown[1]).toEqual({
      title: 'Niveles',
      back: 'Mapa',
      levels: [
        {
          id: 'fit-01',
          name: 'Nivel 1',
          status: 'Completado',
          completed: true,
          playable: true,
          stars: 'Estrellas 2',
        },
        {
          id: 'fit-02',
          name: 'Nivel 2',
          status: 'Completado',
          completed: true,
          playable: true,
          stars: 'Estrellas 0',
        },
        { id: 'fit-03', name: 'Nivel 3', status: 'Abierto', completed: false, playable: true },
        { id: 'fit-04', name: 'Nivel 4', status: 'Bloqueado', completed: false, playable: false },
      ],
    });
    expect(presenter.viewModel()).toBe(shown[1]);
  });

  it('should_show_the_english_texts_when_the_presenter_takes_the_english_catalog', async () => {
    const { presenter, shown } = presenterWith(Result.success(listOf(FOUR)), textCatalog.en);

    await presenter.onOpen();

    expect([shown[0].title, shown[0].back, shown[0].loading]).toEqual([
      'Levels',
      'Map',
      'Loading the levels',
    ]);
    expect(shown[1].levels.map(({ name, status, stars }) => [name, status, stars])).toEqual([
      ['Level 1', 'Completed', 'Stars 2'],
      ['Level 2', 'Completed', 'Stars 0'],
      ['Level 3', 'Open', undefined],
      ['Level 4', 'Locked', undefined],
    ]);
  });

  // A figure with no level gives an empty list: the screen shows the text of no levels,
  // not an empty list with no text.
  it('should_show_the_no_levels_text_when_the_figure_has_no_level', async () => {
    const { presenter, shown } = presenterWith(Result.success(listOf([])));

    await presenter.onOpen();

    expect(shown[1]).toEqual({
      title: 'Niveles',
      back: 'Mapa',
      levels: [],
      empty: 'Aún no hay niveles para esta figura.',
    });
  });

  // A failed `Result` never throws (decision 28): the screen shows the error text in place
  // of the loading text, and no level.
  it('should_show_the_error_text_and_no_level_when_the_list_fails', async () => {
    const { presenter, shown } = presenterWith(
      Result.failure(new UseCaseError('list-failed', 'An English message that no screen shows.')),
    );

    await presenter.onOpen();

    expect(shown[1]).toEqual({
      title: 'Niveles',
      back: 'Mapa',
      levels: [],
      error: 'No se pudieron leer los niveles. Vuelve al mapa y ábrelos otra vez.',
    });
  });

  // Issue #307: a level that the backend lists as unavailable shows in its own section after the
  // levels, with the text of an unavailable level, and a press does not start it. The level has
  // no place in the list of the figure, so the section names it by its id.
  it('should_show_each_unavailable_level_in_a_section_after_the_levels_when_the_list_names_unavailable_levels', async () => {
    const { presenter, shown } = presenterWith(
      Result.success(listOf(FOUR.slice(2), ['fit-16', 'fit-17'])),
    );

    await presenter.onOpen();

    expect(shown[1]).toEqual({
      title: 'Niveles',
      back: 'Mapa',
      levels: [
        { id: 'fit-03', name: 'Nivel 1', status: 'Abierto', completed: false, playable: true },
        { id: 'fit-04', name: 'Nivel 2', status: 'Bloqueado', completed: false, playable: false },
      ],
      unavailable: {
        title: 'No disponibles',
        levels: [
          {
            id: 'fit-16',
            name: 'fit-16',
            status: 'No disponible',
            completed: false,
            playable: false,
          },
          {
            id: 'fit-17',
            name: 'fit-17',
            status: 'No disponible',
            completed: false,
            playable: false,
          },
        ],
      },
    });
  });

  // A figure with no level still shows the unavailable levels of the game, after the text of
  // no levels. The English catalog has its own texts.
  it('should_show_the_no_levels_text_and_the_unavailable_section_when_the_figure_has_no_level', async () => {
    const { presenter, shown } = presenterWith(
      Result.success(listOf([], ['fit-16'])),
      textCatalog.en,
    );

    await presenter.onOpen();

    expect(shown[1]).toEqual({
      title: 'Levels',
      back: 'Map',
      levels: [],
      empty: 'There are no levels for this figure yet.',
      unavailable: {
        title: 'Unavailable levels',
        levels: [
          {
            id: 'fit-16',
            name: 'fit-16',
            status: 'Not available',
            completed: false,
            playable: false,
          },
        ],
      },
    });
  });

  it('should_show_no_later_model_when_the_view_detaches', async () => {
    const { presenter, shown } = presenterWith(Result.success(listOf(FOUR)));

    presenter.detach();
    await presenter.onOpen();

    expect(shown).toHaveLength(1);
    expect(presenter.viewModel().levels).toHaveLength(4);
  });
});
