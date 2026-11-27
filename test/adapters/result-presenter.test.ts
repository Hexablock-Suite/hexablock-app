/** @jest-environment node */
import { ResultPresenter, type ResultViewModel } from '../../src/adapters/result-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { LevelList, LevelSummary } from '../../src/application/level-summary';
import type { ListLevelsRequest } from '../../src/application/list-levels';
import type { MoveResult } from '../../src/application/move-result';
import type { SyncProgressRequest } from '../../src/application/sync-progress';
import { FailureCode, Result, UseCaseError } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { Outcome } from '../../src/domain/engine/outcome';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { GameResult } from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';
import { TopologyId } from '../../src/domain/shared/topology-id';

// Issue #180 (APP-FR-07, APP-FR-09): `ResultPresenter` ends a game on a result screen.
// It saves the result through `SaveProgress` (flows.md, use case 2) and finds the next level
// through `ListLevels`, which holds the rule of an open level (S3-12, #326).
// The fakes stand for the use cases of the composition root.

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');

// A `SaveProgress` port that keeps each result and answers `answer`.
class SavingUseCase implements UseCase<GameResult, void> {
  readonly saved: GameResult[] = [];

  constructor(private readonly answer: Result<void> = Result.success(undefined)) {}

  async execute(request: GameResult): Promise<Result<void>> {
    this.saved.push(request);
    return this.answer;
  }
}

// A `ListLevels` port that keeps each request and answers `answer`. A list of summaries answers
// those levels with no unavailable level.
class ListingUseCase implements UseCase<ListLevelsRequest, LevelList> {
  readonly requests: ListLevelsRequest[] = [];
  private readonly answer: Result<LevelList>;

  constructor(answer: Result<LevelSummary[]>) {
    this.answer = answer.ok
      ? Result.success({ levels: answer.value, unavailable: [] })
      : Result.failure(answer.error);
  }

  async execute(request: ListLevelsRequest): Promise<Result<LevelList>> {
    this.requests.push(request);
    return this.answer;
  }
}

// A `SyncProgress` port that keeps each request and answers `answer` (#46).
class SyncingUseCase implements UseCase<SyncProgressRequest, void> {
  readonly requests: SyncProgressRequest[] = [];

  constructor(private readonly answer: Result<void> = Result.success(undefined)) {}

  async execute(request: SyncProgressRequest): Promise<Result<void>> {
    this.requests.push(request);
    return this.answer;
  }
}

// The levels of Fit on the square after a won `fit-01`: the next level is open.
const AFTER_FIRST: LevelSummary[] = [
  { levelId: LevelId.of('fit-01'), status: LevelStatus.completed, stars: Stars.of(3) },
  { levelId: LevelId.of('fit-02'), status: LevelStatus.open },
  { levelId: LevelId.of('fit-03'), status: LevelStatus.locked },
];

// The final response of a game: a level game has a level id and a move count,
// and a game with no levels has neither.
function finalResponse(
  outcome: Outcome,
  score: number,
  level?: { levelId: string; moves: number; elapsedMs?: number },
): MoveResult<string, string> {
  return {
    cells: [],
    freeSpaces: [],
    score: Score.of(score),
    outcome,
    canUndo: false,
    canRedo: false,
    hasUndo: false,
    payload: undefined,
    ...(level === undefined
      ? {}
      : { levelId: LevelId.of(level.levelId), moves: Moves.of(level.moves) }),
    ...(level?.elapsedMs === undefined ? {} : { elapsedMs: ElapsedTime.ofMs(level.elapsedMs) }),
  };
}

// The presenter of `gameId` on the square over a saving port and a listing port, with a view
// that records each model it shows. `asked` keeps the level id of each asked `SaveProgress`.
function presenterWith(
  gameId: GameId,
  options: {
    save?: SavingUseCase;
    list?: ListingUseCase;
    saveThrows?: boolean;
    texts?: typeof textCatalog.es;
    sync?: SyncingUseCase;
  } = {},
) {
  const save = options.save ?? new SavingUseCase();
  const list = options.list ?? new ListingUseCase(Result.success(AFTER_FIRST));
  const asked: (LevelId | undefined)[] = [];
  const presenter = new ResultPresenter(
    gameId,
    TopologyId.square,
    {
      saveProgressOf: async (levelId) => {
        asked.push(levelId);
        if (options.saveThrows === true) {
          throw new RangeError('The root has no local store, so it saves no progress.');
        }
        return save;
      },
      listLevels: () => list,
      ...(options.sync === undefined ? {} : { syncProgress: () => options.sync! }),
    },
    options.texts ?? textCatalog.es,
  );
  const shown: (ResultViewModel | undefined)[] = [];
  presenter.attach({ show: (model) => shown.push(model) });
  return { presenter, save, list, asked, shown };
}

describe('ResultPresenter', () => {
  // Before the end of a game there is no result to show.
  it('should_show_no_result_when_the_view_attaches_before_the_end_of_a_game', () => {
    const { presenter, shown } = presenterWith(FIT);

    expect(shown).toEqual([undefined]);
    expect(presenter.viewModel()).toBeUndefined();
  });

  // A won level saves a level result and offers the next level, which `ListLevels` opens.
  it('should_save_the_level_result_and_offer_the_next_level_when_the_player_wins_a_level', async () => {
    const { presenter, save, list, asked, shown } = presenterWith(FIT);

    await presenter.onFinish(
      finalResponse(Outcome.victory, 0, { levelId: 'fit-01', moves: 3, elapsedMs: 9000 }),
    );

    expect(asked).toEqual([LevelId.of('fit-01')]);
    expect(save.saved).toHaveLength(1);
    expect(
      save.saved[0]?.equals(
        GameResult.of({
          gameId: FIT,
          score: Score.of(0),
          moves: Moves.of(3),
          levelId: LevelId.of('fit-01'),
          elapsedMs: ElapsedTime.ofMs(9000),
        }),
      ),
    ).toBe(true);
    expect(list.requests).toEqual([{ gameId: FIT, figure: TopologyId.square }]);
    expect(shown.at(-1)).toEqual({
      victory: true,
      title: '¡Ganaste!',
      scoreLabel: 'Puntuación final',
      score: 0,
      back: 'Volver al mapa',
      next: { label: 'Siguiente nivel', levelId: 'fit-02' },
    });
  });

  // The last level of a figure has no next level.
  it('should_offer_no_next_level_when_the_player_wins_the_last_level_of_the_figure', async () => {
    const { presenter, shown } = presenterWith(FIT);

    await presenter.onFinish(finalResponse(Outcome.victory, 0, { levelId: 'fit-03', moves: 4 }));

    expect(shown.at(-1)).toEqual({
      victory: true,
      title: '¡Ganaste!',
      scoreLabel: 'Puntuación final',
      score: 0,
      back: 'Volver al mapa',
    });
  });

  // A lost level is not won, so nothing is saved and nothing opens. The screen offers a retry.
  it('should_save_nothing_and_offer_a_retry_when_the_player_loses_a_level', async () => {
    const { presenter, save, list, asked, shown } = presenterWith(FIT);

    await presenter.onFinish(finalResponse(Outcome.gameOver, 20, { levelId: 'fit-01', moves: 5 }));

    expect([asked, save.saved, list.requests]).toEqual([[], [], []]);
    expect(shown.at(-1)).toEqual({
      victory: false,
      title: 'Fin de la partida',
      scoreLabel: 'Puntuación final',
      score: 20,
      back: 'Volver al mapa',
      retry: 'Reintentar',
    });
  });

  // Lines and Merge end only by a game over. Their score is the result (D26).
  it('should_save_the_score_and_offer_a_retry_when_a_game_with_no_levels_ends', async () => {
    const { presenter, save, list, asked, shown } = presenterWith(LINES);

    await presenter.onFinish(finalResponse(Outcome.gameOver, 130));

    expect(asked).toEqual([undefined]);
    expect(save.saved[0]?.equals(GameResult.endless({ gameId: LINES, score: Score.of(130) }))).toBe(
      true,
    );
    expect(list.requests).toEqual([]);
    expect(shown.at(-1)).toEqual({
      victory: false,
      title: 'Fin de la partida',
      scoreLabel: 'Puntuación final',
      score: 130,
      back: 'Volver al mapa',
      retry: 'Reintentar',
    });
  });

  // A won game with no levels offers a new game, as the issue asks for Lines and Merge.
  it('should_save_the_score_and_offer_a_new_game_when_the_player_wins_a_game_with_no_levels', async () => {
    const { presenter, save, shown } = presenterWith(LINES);

    await presenter.onFinish(finalResponse(Outcome.victory, 2048));

    expect(save.saved).toHaveLength(1);
    expect(shown.at(-1)).toEqual({
      victory: true,
      title: '¡Ganaste!',
      scoreLabel: 'Puntuación final',
      score: 2048,
      back: 'Volver al mapa',
      newGame: 'Nueva partida',
    });
  });

  // A game that goes on has no result.
  it('should_do_nothing_when_the_response_keeps_the_game_playing', async () => {
    const { presenter, save, asked, shown } = presenterWith(LINES);

    await presenter.onFinish(finalResponse(Outcome.playing, 10));

    expect([asked, save.saved, shown]).toEqual([[], [], [undefined]]);
  });

  // A failed save keeps the result on the screen and says that the save failed.
  // `ListLevels` then finds the next level locked, so the screen offers no next level.
  it('should_show_the_text_of_a_failed_save_when_save_progress_fails', async () => {
    const locked: LevelSummary[] = [
      { levelId: LevelId.of('fit-01'), status: LevelStatus.open },
      { levelId: LevelId.of('fit-02'), status: LevelStatus.locked },
      { levelId: LevelId.of('fit-03'), status: LevelStatus.locked },
    ];
    const { presenter, shown } = presenterWith(FIT, {
      save: new SavingUseCase(
        Result.failure(new UseCaseError(FailureCode.saveFailed, 'The store refused the write.')),
      ),
      list: new ListingUseCase(Result.success(locked)),
    });

    await presenter.onFinish(finalResponse(Outcome.victory, 0, { levelId: 'fit-01', moves: 3 }));

    expect(shown.at(-1)).toEqual({
      victory: true,
      title: '¡Ganaste!',
      scoreLabel: 'Puntuación final',
      score: 0,
      back: 'Volver al mapa',
      error: 'No se pudo guardar el resultado.',
    });
  });

  // A root with no local store gives no `SaveProgress`: it throws a RangeError, as for
  // `loadProgress()`. The presenter shows the text of a failed save and throws nothing.
  it('should_show_the_text_of_a_failed_save_when_the_root_gives_no_save_progress', async () => {
    const { presenter, shown } = presenterWith(LINES, { saveThrows: true });

    await presenter.onFinish(finalResponse(Outcome.gameOver, 5));

    expect(shown.at(-1)?.error).toBe('No se pudo guardar el resultado.');
  });

  // A failed list keeps the result and offers no next level.
  it('should_show_the_general_text_and_no_next_level_when_list_levels_fails', async () => {
    const { presenter, shown } = presenterWith(FIT, {
      list: new ListingUseCase(
        Result.failure(new UseCaseError(FailureCode.listFailed, 'The levels are missing.')),
      ),
    });

    await presenter.onFinish(finalResponse(Outcome.victory, 0, { levelId: 'fit-01', moves: 3 }));

    expect(shown.at(-1)).toEqual({
      victory: true,
      title: '¡Ganaste!',
      scoreLabel: 'Puntuación final',
      score: 0,
      back: 'Volver al mapa',
      error: 'No se pudo cerrar la partida. Vuelve al mapa.',
    });
  });

  // A retry or a new game closes the result screen.
  it('should_show_no_result_when_the_player_closes_the_result', async () => {
    const { presenter, shown } = presenterWith(LINES);
    await presenter.onFinish(finalResponse(Outcome.gameOver, 5));

    presenter.onClose();

    expect(shown.at(-1)).toBeUndefined();
    expect(presenter.viewModel()).toBeUndefined();
  });

  // Every text comes from the catalog of the language (APP-FR-11).
  it('should_show_the_english_texts_when_the_presenter_takes_the_english_catalog', async () => {
    const { presenter, shown } = presenterWith(FIT, { texts: textCatalog.en });

    await presenter.onFinish(finalResponse(Outcome.victory, 0, { levelId: 'fit-01', moves: 3 }));

    expect(shown.at(-1)).toEqual({
      victory: true,
      title: 'You won!',
      scoreLabel: 'Final score',
      score: 0,
      back: 'Back to the map',
      next: { label: 'Next level', levelId: 'fit-02' },
    });
  });

  // #46 (APP-FR-13, D27): after each save with a session the progress of the game goes to the
  // backend. `SyncProgress` sends nothing with no session, so the presenter always asks it.
  it('should_sync_the_progress_of_the_game_after_the_save_when_a_result_is_saved', async () => {
    const sync = new SyncingUseCase();
    const { presenter, save } = presenterWith(FIT, { sync });

    await presenter.onFinish(
      finalResponse(Outcome.victory, 0, { levelId: 'fit-01', moves: 3, elapsedMs: 9000 }),
    );

    expect(save.saved).toHaveLength(1);
    expect(sync.requests).toHaveLength(1);
    expect(sync.requests[0]?.gameId.equals(FIT)).toBe(true);
    expect(presenter.viewModel()?.signIn).toBeUndefined();
    expect(presenter.viewModel()?.error).toBeUndefined();
  });

  it('should_sync_nothing_when_the_save_fails_or_nothing_is_saved', async () => {
    const sync = new SyncingUseCase();
    const failed = presenterWith(FIT, {
      sync,
      save: new SavingUseCase(
        Result.failure(new UseCaseError(FailureCode.saveFailed, 'The disk is full.')),
      ),
    });
    const lost = presenterWith(FIT, { sync });

    await failed.presenter.onFinish(
      finalResponse(Outcome.victory, 0, { levelId: 'fit-01', moves: 3, elapsedMs: 9000 }),
    );
    await lost.presenter.onFinish(
      finalResponse(Outcome.gameOver, 0, { levelId: 'fit-01', moves: 3 }),
    );

    expect(sync.requests).toHaveLength(0);
  });

  // The token lives 24 hours and has no refresh. `SyncProgress` clears the session, and the result
  // asks the player to sign in. The result stays, because the local progress keeps it.
  it('should_ask_the_player_to_sign_in_and_keep_the_result_when_the_sync_gives_session_expired', async () => {
    const sync = new SyncingUseCase(
      Result.failure(
        new UseCaseError(FailureCode.sessionExpired, 'POST /v1/progress answered 401.'),
      ),
    );
    const { presenter, shown } = presenterWith(LINES, { sync });

    await presenter.onFinish(finalResponse(Outcome.gameOver, 36));

    const model = presenter.viewModel();
    expect(model?.signIn).toEqual({
      text: textCatalog.es['result.session-expired'],
      label: textCatalog.es['result.sign-in'],
    });
    expect(model?.title).toBe(textCatalog.es['result.defeat']);
    expect(model?.score).toBe(36);
    expect(model?.error).toBeUndefined();
    expect(shown.at(-1)).toBe(model);
  });

  // A player with no network plays on: a failed sync shows nothing, and the log keeps it.
  it('should_show_the_result_with_no_error_when_the_sync_fails_another_way', async () => {
    const sync = new SyncingUseCase(
      Result.failure(new UseCaseError(FailureCode.backendUnreachable, 'No answer.')),
    );
    const { presenter } = presenterWith(LINES, { sync });

    await presenter.onFinish(finalResponse(Outcome.gameOver, 36));

    expect(presenter.viewModel()?.error).toBeUndefined();
    expect(presenter.viewModel()?.signIn).toBeUndefined();
    expect(presenter.viewModel()?.score).toBe(36);
  });

  it('should_keep_the_result_closed_when_the_player_closes_it_before_the_sync_ends', async () => {
    let answer: (result: Result<void>) => void = () => undefined;
    const slow: UseCase<SyncProgressRequest, void> = {
      execute: () => new Promise((resolve) => (answer = resolve)),
    };
    const presenter = new ResultPresenter(
      LINES,
      TopologyId.square,
      {
        saveProgressOf: async () => new SavingUseCase(),
        listLevels: () => new ListingUseCase(Result.success(AFTER_FIRST)),
        syncProgress: () => slow,
      },
      textCatalog.es,
    );

    const finished = presenter.onFinish(finalResponse(Outcome.gameOver, 36));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(presenter.viewModel()?.score).toBe(36);
    presenter.onClose();
    answer(
      Result.failure(
        new UseCaseError(FailureCode.sessionExpired, 'POST /v1/progress answered 401.'),
      ),
    );
    await finished;

    expect(presenter.viewModel()).toBeUndefined();
  });
});
