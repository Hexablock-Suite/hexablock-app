/** @jest-environment node */
import { GamePresenter, type GameViewModel } from '../../src/adapters/game-presenter';
import { SpaceStateMapper } from '../../src/adapters/space-state-mapper';
import type { StateMapper } from '../../src/adapters/state-mapper';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { ApplyMoveRequest } from '../../src/application/apply-move';
import type { MoveResult } from '../../src/application/move-result';
import type { RedoMoveRequest } from '../../src/application/redo-move';
import { Result, UseCaseError } from '../../src/application/result';
import type { StartGameRequest } from '../../src/application/start-game';
import type { UndoMoveRequest } from '../../src/application/undo-move';
import type { UseCase } from '../../src/application/use-case';
import { ElapsedTime } from '../../src/domain/engine/elapsed-time';
import { LevelId } from '../../src/domain/engine/level-id';
import { Outcome } from '../../src/domain/engine/outcome';
import { Score } from '../../src/domain/engine/score';

// Issue #170: `GamePresenter` calls `StartGame` and `ApplyMove` through the `UseCase` port and
// turns each plain `MoveResult` into a `GameViewModel` with its `StateMapper` (MVP, layers.md).
// Since #178 it also calls `UndoMove` and `RedoMove` through the same port.
// The fakes of this file stand for a game that no variant has: a coordinate is a letter,
// a cell is a color word, a move is a word and the payload is a count.

type Coord = 'a' | 'b' | 'c';
type Model = GameViewModel<Coord, string, string>;

// A port that answers each call with the next result of its list and records each request.
class ScriptedUseCase<TRequest> implements UseCase<TRequest, MoveResult<string, Coord, number>> {
  readonly requests: TRequest[] = [];

  constructor(private readonly results: Result<MoveResult<string, Coord, number>>[]) {}

  async execute(request: TRequest): Promise<Result<MoveResult<string, Coord, number>>> {
    this.requests.push(request);
    const next = this.results.shift();
    if (next === undefined) throw new RangeError('The script has no more results.');
    return next;
  }
}

// A mapper that names what it maps, so a test sees each mapped value.
const wordMapper: StateMapper<string, number, string, string> = {
  toView: (cell) => `cell ${cell}`,
  freeView: () => 'free',
  toPayload: (count) => `count ${count}`,
};

function response(
  cells: [Coord, string][],
  freeSpaces: Coord[],
  score: number,
  outcome = Outcome.playing,
): Result<MoveResult<string, Coord, number>> {
  return Result.success({
    cells,
    freeSpaces,
    score: Score.of(score),
    outcome,
    canUndo: false,
    canRedo: false,
    hasUndo: false,
    payload: cells.length,
  });
}

function failure(code: string): Result<MoveResult<string, Coord, number>> {
  return Result.failure(new UseCaseError(code, 'An English message that no screen shows.'));
}

// The answer of a variant with undo: the same answer with the undo flags of the root (#178).
function withUndo(
  answer: Result<MoveResult<string, Coord, number>>,
  canUndo: boolean,
  canRedo: boolean,
): Result<MoveResult<string, Coord, number>> {
  return answer.ok ? Result.success({ ...answer.value, hasUndo: true, canUndo, canRedo }) : answer;
}

// The presenter over four scripted ports and a view that records each model it shows.
function presenterWith(
  starts: Result<MoveResult<string, Coord, number>>[],
  moves: Result<MoveResult<string, Coord, number>>[] = [],
  texts = textCatalog.es,
  undos: Result<MoveResult<string, Coord, number>>[] = [],
  redos: Result<MoveResult<string, Coord, number>>[] = [],
) {
  const startGame = new ScriptedUseCase<StartGameRequest>(starts);
  const applyMove = new ScriptedUseCase<ApplyMoveRequest<string>>(moves);
  const undoMove = new ScriptedUseCase<UndoMoveRequest>(undos);
  const redoMove = new ScriptedUseCase<RedoMoveRequest>(redos);
  const presenter = new GamePresenter(startGame, applyMove, undoMove, redoMove, wordMapper, texts);
  const shown: Model[] = [];
  presenter.attach({ show: (model) => shown.push(model) });
  return { presenter, startGame, applyMove, undoMove, redoMove, shown };
}

const STARTED: Model = {
  back: 'Mapa',
  board: 'Tablero',
  scoreLabel: 'Puntos',
  score: 0,
  outcome: 'En juego',
  cells: [
    ['b', 'cell red'],
    ['a', 'free'],
    ['c', 'free'],
  ],
  payload: 'count 1',
};

describe('GamePresenter', () => {
  it('should_show_the_texts_and_an_empty_board_when_the_game_has_not_started', () => {
    const { presenter, shown } = presenterWith([]);

    const expected: Model = {
      back: 'Mapa',
      board: 'Tablero',
      scoreLabel: 'Puntos',
      score: 0,
      outcome: 'Preparando el tablero',
      cells: [],
    };
    expect(presenter.viewModel()).toEqual(expected);
    expect(shown).toEqual([expected]);
  });

  it('should_give_one_pair_for_each_space_of_the_board_when_start_game_succeeds', async () => {
    const { presenter, startGame, shown } = presenterWith([
      response([['b', 'red']], ['a', 'c'], 0),
    ]);

    await presenter.onStart();

    expect(startGame.requests).toEqual([{}]);
    expect(presenter.viewModel()).toEqual(STARTED);
    expect(shown.at(-1)).toEqual(STARTED);
  });

  // Issue #172: the presenter passes the chosen level to `StartGame`. It never reads the id.
  it('should_ask_start_game_for_the_level_and_show_its_board_when_the_view_starts_a_level', async () => {
    const { presenter, startGame } = presenterWith([response([['b', 'red']], ['a', 'c'], 0)]);
    const levelId = LevelId.of('fit-02');

    await presenter.onStart(levelId);

    expect(startGame.requests).toHaveLength(1);
    expect(startGame.requests[0]?.levelId === levelId).toBe(true);
    expect(presenter.viewModel()).toEqual(STARTED);
  });

  it('should_send_the_move_through_apply_move_and_show_the_new_state_when_the_move_is_accepted', async () => {
    const { presenter, applyMove, shown } = presenterWith(
      [response([['b', 'red']], ['a', 'c'], 0)],
      [
        response(
          [
            ['b', 'red'],
            ['a', 'blue'],
          ],
          ['c'],
          12,
        ),
      ],
    );
    await presenter.onStart();

    await presenter.onMove('place blue on a');

    expect(applyMove.requests).toEqual([{ move: 'place blue on a' }]);
    expect(shown.at(-1)).toEqual({
      ...STARTED,
      score: 12,
      cells: [
        ['b', 'cell red'],
        ['a', 'cell blue'],
        ['c', 'free'],
      ],
      payload: 'count 2',
    });
  });

  it('should_name_the_outcome_with_its_text_when_the_move_wins_or_ends_the_game', async () => {
    const { presenter, shown } = presenterWith(
      [response([], ['a'], 0)],
      [response([['a', 'red']], [], 3, Outcome.victory), response([], ['a'], 3, Outcome.gameOver)],
    );
    await presenter.onStart();

    await presenter.onMove('win');
    await presenter.onMove('lose');

    expect(shown.map((model) => model.outcome)).toEqual([
      'Preparando el tablero',
      'En juego',
      '¡Victoria!',
      'Fin del juego',
    ]);
  });

  it('should_keep_the_board_and_show_the_rejected_move_text_when_apply_move_rejects_the_move', async () => {
    const { presenter, shown } = presenterWith(
      [response([['b', 'red']], ['a', 'c'], 0)],
      [failure('move-rejected')],
    );
    await presenter.onStart();

    await presenter.onMove('place red on b');

    expect(shown.at(-1)).toEqual({ ...STARTED, error: 'Esa jugada no se puede hacer' });
  });

  it('should_show_the_general_error_text_and_no_board_when_start_game_fails', async () => {
    const { presenter, shown } = presenterWith([failure('start-failed')]);

    await presenter.onStart();

    expect(shown.at(-1)).toEqual({
      back: 'Mapa',
      board: 'Tablero',
      scoreLabel: 'Puntos',
      score: 0,
      outcome: 'Preparando el tablero',
      cells: [],
      error: 'No se pudo jugar. Vuelve al mapa y abre el juego otra vez.',
    });
  });

  it('should_clear_the_error_when_the_next_move_is_accepted', async () => {
    const { presenter, shown } = presenterWith(
      [response([['b', 'red']], ['a', 'c'], 0)],
      [
        failure('move-rejected'),
        response(
          [
            ['b', 'red'],
            ['a', 'blue'],
          ],
          ['c'],
          12,
        ),
      ],
    );
    await presenter.onStart();
    await presenter.onMove('place red on b');

    await presenter.onMove('place blue on a');

    expect(shown.at(-1)?.error).toBeUndefined();
    expect(Object.keys(shown.at(-1) ?? {})).not.toContain('error');
  });

  it('should_show_nothing_more_to_a_view_when_it_detaches', async () => {
    const { presenter, shown } = presenterWith([response([['b', 'red']], ['a', 'c'], 0)]);
    presenter.detach();

    await presenter.onStart();

    expect(shown).toHaveLength(1);
    expect(presenter.viewModel()).toEqual(STARTED);
  });

  // Issue #175: a timed game shows its time of play. The time comes from the response,
  // which asks the root (`GameEngine.elapsedTime()`), so the screen reads no clock.
  // An untimed game has no time in its response and no time in its view model.
  it('should_show_the_time_of_play_in_minutes_and_seconds_when_the_response_carries_a_time', async () => {
    const timed = (ms: number) => {
      const answer = response([['b', 'red']], ['a', 'c'], 0);
      return answer.ok
        ? Result.success({ ...answer.value, elapsedMs: ElapsedTime.ofMs(ms) })
        : answer;
    };
    const { presenter, shown } = presenterWith([timed(0)], [timed(65_400), timed(600_999)]);
    await presenter.onStart();

    await presenter.onMove('place blue on a');
    await presenter.onMove('place red on c');

    expect(shown.map((model) => model.time)).toEqual([
      undefined,
      { label: 'Tiempo', value: '0:00' },
      { label: 'Tiempo', value: '1:05' },
      { label: 'Tiempo', value: '10:00' },
    ]);
  });

  it('should_give_the_english_texts_when_the_presenter_gets_the_english_catalog', async () => {
    const { presenter } = presenterWith(
      [response([['b', 'red']], ['a', 'c'], 0)],
      [failure('move-rejected'), failure('move-failed')],
      textCatalog.en,
    );
    const before = presenter.viewModel();
    await presenter.onStart();
    await presenter.onMove('place red on b');
    const rejected = presenter.viewModel();
    await presenter.onMove('place red on b');

    expect([before.back, before.board, before.scoreLabel, before.outcome]).toEqual([
      'Map',
      'Board',
      'Score',
      'Setting up the board',
    ]);
    expect([rejected.outcome, rejected.error, presenter.viewModel().error]).toEqual([
      'In play',
      'That move is not allowed',
      'The game could not go on. Go back to the map and open the game again.',
    ]);
  });
});

// Issue #178: a variant with undo shows an undo button and a redo button. The presenter calls
// `UndoMove` and `RedoMove` through the `UseCase` port, so it names no variant and no history.
// Each button is enabled when the root says that a move can go back or forward.
// A variant with no undo has no button in its view model.
describe('GamePresenter undo and redo', () => {
  const START = response([['b', 'red']], ['a', 'c'], 0);
  const PLACED = response(
    [
      ['b', 'red'],
      ['a', 'blue'],
    ],
    ['c'],
    12,
  );

  it('should_give_an_undo_and_a_redo_with_their_labels_and_their_state_when_the_variant_has_undo', async () => {
    const { presenter, shown } = presenterWith(
      [withUndo(START, false, false)],
      [withUndo(PLACED, true, false)],
      textCatalog.es,
      [withUndo(START, false, true)],
    );
    await presenter.onStart();
    await presenter.onMove('place blue on a');
    await presenter.onUndo();

    expect(shown.map((model) => [model.undo, model.redo])).toEqual([
      [undefined, undefined],
      [
        { label: 'Deshacer', enabled: false },
        { label: 'Rehacer', enabled: false },
      ],
      [
        { label: 'Deshacer', enabled: true },
        { label: 'Rehacer', enabled: false },
      ],
      [
        { label: 'Deshacer', enabled: false },
        { label: 'Rehacer', enabled: true },
      ],
    ]);
  });

  it('should_give_no_undo_and_no_redo_when_the_variant_has_no_undo', async () => {
    const { presenter, shown } = presenterWith([START], [PLACED]);
    await presenter.onStart();

    await presenter.onMove('place blue on a');

    expect(shown.flatMap((model) => Object.keys(model))).not.toContain('undo');
    expect(shown.flatMap((model) => Object.keys(model))).not.toContain('redo');
  });

  it('should_send_the_undo_through_undo_move_and_show_its_answer_when_the_player_undoes', async () => {
    const { presenter, undoMove, shown } = presenterWith(
      [withUndo(START, false, false)],
      [withUndo(PLACED, true, false)],
      textCatalog.es,
      [withUndo(START, false, true)],
    );
    await presenter.onStart();
    await presenter.onMove('place blue on a');

    await presenter.onUndo();

    expect(undoMove.requests).toEqual([{}]);
    expect(shown.at(-1)).toEqual({
      ...STARTED,
      undo: { label: 'Deshacer', enabled: false },
      redo: { label: 'Rehacer', enabled: true },
    });
  });

  it('should_send_the_redo_through_redo_move_and_show_its_answer_when_the_player_redoes', async () => {
    const { presenter, redoMove, shown } = presenterWith(
      [withUndo(START, false, false)],
      [withUndo(PLACED, true, false)],
      textCatalog.es,
      [withUndo(START, false, true)],
      [withUndo(PLACED, true, false)],
    );
    await presenter.onStart();
    await presenter.onMove('place blue on a');
    const placed = presenter.viewModel();
    await presenter.onUndo();

    await presenter.onRedo();

    expect(redoMove.requests).toEqual([{}]);
    expect(shown.at(-1)).toEqual(placed);
    expect(placed.cells).toEqual([
      ['b', 'cell red'],
      ['a', 'cell blue'],
      ['c', 'free'],
    ]);
  });

  // A quick second tap can reach the use case after the last move went back or forward.
  // The board stays, and the text says that no move is left, not that the game broke.
  it('should_keep_the_board_and_show_the_text_of_no_move_left_when_undo_or_redo_finds_no_move', async () => {
    const { presenter, shown } = presenterWith(
      [withUndo(START, false, false)],
      [],
      textCatalog.es,
      [failure('nothing-to-undo')],
      [failure('nothing-to-redo')],
    );
    await presenter.onStart();
    const started = presenter.viewModel();

    await presenter.onUndo();
    const afterUndo = shown.at(-1);
    await presenter.onRedo();

    expect(afterUndo).toEqual({ ...started, error: 'No hay jugada para deshacer' });
    expect(shown.at(-1)).toEqual({ ...started, error: 'No hay jugada para rehacer' });
  });

  it('should_give_the_english_labels_and_texts_when_the_presenter_gets_the_english_catalog', async () => {
    const { presenter } = presenterWith(
      [withUndo(START, true, true)],
      [],
      textCatalog.en,
      [failure('nothing-to-undo'), failure('undo-failed')],
      [failure('nothing-to-redo')],
    );
    await presenter.onStart();
    const started = presenter.viewModel();
    await presenter.onUndo();
    const nothingToUndo = presenter.viewModel().error;
    await presenter.onRedo();
    const nothingToRedo = presenter.viewModel().error;
    await presenter.onUndo();

    expect([started.undo, started.redo]).toEqual([
      { label: 'Undo', enabled: true },
      { label: 'Redo', enabled: true },
    ]);
    expect([nothingToUndo, nothingToRedo, presenter.viewModel().error]).toEqual([
      'There is no move to undo',
      'There is no move to redo',
      'The game could not go on. Go back to the map and open the game again.',
    ]);
  });
});

// The default mapper of the registry (#170): it shows whether a space is free or occupied,
// so the game screen draws the board of any game before its variant has a mapper.
describe('SpaceStateMapper', () => {
  it('should_tell_a_free_space_from_an_occupied_one_whatever_the_cell_is_when_it_maps_a_board', () => {
    const mapper = new SpaceStateMapper();

    expect([
      mapper.freeView(),
      mapper.toView('red'),
      mapper.toView(undefined),
      mapper.toView(0),
    ]).toEqual([{ occupied: false }, { occupied: true }, { occupied: true }, { occupied: true }]);
    expect(mapper.toPayload({ tray: [] })).toBeUndefined();
  });
});
