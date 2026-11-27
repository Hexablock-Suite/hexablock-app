/** @jest-environment node */
import {
  LevelSelectorPresenter,
  type LevelSelectorViewModel,
} from '../../src/adapters/level-selector-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { ListLevelsRequest } from '../../src/application/list-levels';
import type { LevelSummary } from '../../src/application/level-summary';
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
class AnsweringUseCase implements UseCase<ListLevelsRequest, LevelSummary[]> {
  readonly requests: ListLevelsRequest[] = [];

  constructor(private readonly result: Result<LevelSummary[]>) {}

  async execute(request: ListLevelsRequest): Promise<Result<LevelSummary[]>> {
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

// The presenter of the Fit levels of the square over one answering port, with a view that
// records each model it shows.
function presenterWith(result: Result<LevelSummary[]>, texts = textCatalog.es) {
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
    const { shown } = presenterWith(Result.success(FOUR));

    expect(shown).toEqual([
      { title: 'Niveles', back: 'Mapa', levels: [], loading: 'Cargando los niveles' },
    ]);
  });

  // The screen shows each level as completed, open or locked, in the order of the list,
  // with the stars of a completed level. A completed level and an open level start;
  // a locked level does not.
  it('should_show_each_level_as_completed_open_or_locked_when_the_list_answers', async () => {
    const { port, presenter, shown } = presenterWith(Result.success(FOUR));

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
    const { presenter, shown } = presenterWith(Result.success(FOUR), textCatalog.en);

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
    const { presenter, shown } = presenterWith(Result.success([]));

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

  it('should_show_no_later_model_when_the_view_detaches', async () => {
    const { presenter, shown } = presenterWith(Result.success(FOUR));

    presenter.detach();
    await presenter.onOpen();

    expect(shown).toHaveLength(1);
    expect(presenter.viewModel().levels).toHaveLength(4);
  });
});
