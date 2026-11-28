import {
  LeaderboardPresenter,
  type LeaderboardViewModel,
} from '../../src/adapters/leaderboard-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { GlobalLeaderboardRequest } from '../../src/application/leaderboard/get-global-leaderboard';
import type { LevelLeaderboardRequest } from '../../src/application/leaderboard/get-level-leaderboard';
import type { Leaderboard, LeaderboardRow } from '../../src/application/ports/leaderboard';
import {
  FailureCode,
  Result,
  UseCaseError,
  type FailureCode as Code,
} from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { LevelId } from '../../src/domain/progress/level-id';
import { Stars } from '../../src/domain/progress/stars';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';

// Issue #47 (APP-FR-14): the presenter of the leaderboard screen shows the global board of a game,
// or the board of one level when the screen names a level. It shows each row with the rank of the
// backend, the name of the player and the record as one text, and one text for each failure.

const es = textCatalog.es;
const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');
const FIT_01 = LevelId.of('fit-01');

const score = (rank: number, username: string, value: number): LeaderboardRow => ({
  rank,
  username,
  record: { kind: 'score', score: Score.of(value) },
});
const SCORES: Leaderboard = {
  rows: [score(1, 'ada', 2048), score(1, 'grace', 2048), score(3, 'linus', 512)],
};
const STANDINGS: Leaderboard = {
  rows: [
    {
      rank: 1,
      username: 'ada',
      record: {
        kind: 'standing',
        stars: Stars.of(9),
        levelsCompleted: 3,
        moves: Moves.of(40),
        elapsed: ElapsedTime.ofMs(90000),
      },
    },
  ],
};
const LEVEL: Leaderboard = {
  rows: [
    {
      rank: 1,
      username: 'ada',
      record: {
        kind: 'level',
        stars: Stars.of(3),
        moves: Moves.of(12),
        elapsed: ElapsedTime.ofMs(45000),
      },
    },
  ],
};

// A use case that records each request and gives `result`.
class FakeBoard<TRequest> implements UseCase<TRequest, Leaderboard> {
  readonly requests: TRequest[] = [];
  constructor(private readonly result: Result<Leaderboard>) {}
  execute(request: TRequest): Promise<Result<Leaderboard>> {
    this.requests.push(request);
    return Promise.resolve(this.result);
  }
}

const failed = (code: Code) => Result.failure<Leaderboard>(new UseCaseError(code, 'It failed.'));

// The presenter of a board of Lines over two use cases. The global board gives `global`.
function presenterOf(global: Result<Leaderboard>, levelId?: LevelId) {
  const boards = {
    global: new FakeBoard<GlobalLeaderboardRequest>(global),
    level: new FakeBoard<LevelLeaderboardRequest>(global),
  };
  const request = levelId === undefined ? { gameId: LINES } : { gameId: FIT, levelId };
  return { boards, presenter: new LeaderboardPresenter(boards, request, es) };
}

// The view model of a presenter after it opens.
async function openedWith(global: Result<Leaderboard>, levelId?: LevelId) {
  const { presenter } = presenterOf(global, levelId);
  await presenter.onOpen();
  return presenter.viewModel();
}

describe('LeaderboardPresenter', () => {
  it('should_show_the_loading_text_and_no_row_when_the_screen_opens', () => {
    const { presenter } = presenterOf(Result.success(SCORES));
    const shown: LeaderboardViewModel[] = [];

    presenter.attach({ show: (model) => shown.push(model) });

    expect(shown).toEqual([
      {
        title: es['leaderboard.title'],
        back: es['leaderboard.back'],
        rows: [],
        loading: es['leaderboard.loading'],
      },
    ]);
  });

  it('should_read_the_global_board_and_show_each_high_score_with_the_rank_of_the_backend_when_the_screen_names_no_level', async () => {
    const { boards, presenter } = presenterOf(Result.success(SCORES));
    const shown: LeaderboardViewModel[] = [];
    presenter.attach({ show: (model) => shown.push(model) });

    await presenter.onOpen();

    expect(boards.global.requests).toEqual([{ gameId: LINES }]);
    expect(boards.level.requests).toEqual([]);
    expect(shown.at(-1)).toEqual({
      title: es['leaderboard.title'],
      back: es['leaderboard.back'],
      rows: [
        { id: 'ada', rank: '1', name: 'ada', value: '2048 puntos' },
        { id: 'grace', rank: '1', name: 'grace', value: '2048 puntos' },
        { id: 'linus', rank: '3', name: 'linus', value: '512 puntos' },
      ],
    });
  });

  it('should_show_the_stars_the_levels_the_moves_and_the_time_when_the_game_board_ranks_level_results', async () => {
    const model = await openedWith(Result.success(STANDINGS));

    expect(model.rows).toEqual([
      {
        id: 'ada',
        rank: '1',
        name: 'ada',
        value: '9 estrellas · 3 niveles · 40 movimientos · 1:30',
      },
    ]);
  });

  it('should_read_the_board_of_the_level_and_name_the_level_in_the_title_when_the_screen_names_a_level', async () => {
    const boards = {
      global: new FakeBoard<GlobalLeaderboardRequest>(Result.success(SCORES)),
      level: new FakeBoard<LevelLeaderboardRequest>(Result.success(LEVEL)),
    };
    const presenter = new LeaderboardPresenter(boards, { gameId: FIT, levelId: FIT_01 }, es);

    await presenter.onOpen();

    expect(boards.level.requests).toEqual([{ gameId: FIT, levelId: FIT_01 }]);
    expect(boards.global.requests).toEqual([]);
    expect(presenter.viewModel()).toEqual({
      title: `${es['leaderboard.level']} fit-01`,
      back: es['leaderboard.back'],
      rows: [{ id: 'ada', rank: '1', name: 'ada', value: '3 estrellas · 12 movimientos · 0:45' }],
    });
  });

  it('should_cut_the_name_to_16_characters_and_keep_the_whole_name_as_the_id_when_a_username_is_longer', async () => {
    const long = 'a-very-long-username-of-32-chars';

    const model = await openedWith(Result.success({ rows: [score(1, long, 10)] }));

    expect(model.rows[0]).toEqual({
      id: long,
      rank: '1',
      name: 'a-very-long-use…',
      value: '10 puntos',
    });
  });

  it('should_show_the_text_of_an_empty_board_when_the_board_has_no_row', async () => {
    const model = await openedWith(Result.success({ rows: [] }));

    expect(model).toEqual({
      title: es['leaderboard.title'],
      back: es['leaderboard.back'],
      rows: [],
      empty: es['leaderboard.none'],
    });
  });

  // The decision on #47: with no session and with a refused token, the screen asks the player to
  // sign in and offers the account screen.
  it.each([FailureCode.signInRequired, FailureCode.sessionExpired])(
    'should_ask_the_player_to_sign_in_and_offer_the_account_screen_when_the_board_needs_a_signed_in_player',
    async (code) => {
      const model = await openedWith(failed(code));

      expect(model).toEqual({
        title: es['leaderboard.title'],
        back: es['leaderboard.back'],
        rows: [],
        error: es['leaderboard.sign-in-needed'],
        signIn: es['leaderboard.sign-in'],
      });
    },
  );

  it.each([
    { code: FailureCode.levelHasNoBoard, text: es['leaderboard.no-board'] },
    { code: FailureCode.backendUnreachable, text: es['leaderboard.unreachable'] },
    { code: FailureCode.leaderboardFailed, text: es['leaderboard.error'] },
    { code: FailureCode.unexpectedFailure, text: es['leaderboard.error'] },
  ])(
    'should_show_the_text_of_the_failure_and_no_sign_in_when_the_board_fails_for_another_reason',
    async ({ code, text }) => {
      const model = await openedWith(failed(code), FIT_01);

      expect(model.error).toBe(text);
      expect(model.signIn).toBeUndefined();
      expect(model.loading).toBeUndefined();
      expect(model.rows).toEqual([]);
    },
  );

  it('should_show_no_later_view_model_when_the_view_detaches', async () => {
    const { presenter } = presenterOf(Result.success(SCORES));
    const shown: LeaderboardViewModel[] = [];
    presenter.attach({ show: (model) => shown.push(model) });
    presenter.detach();

    await presenter.onOpen();

    expect(shown).toHaveLength(1);
    expect(presenter.viewModel().rows).toHaveLength(3);
  });
});
