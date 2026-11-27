/** @jest-environment node */
import { ApiFailure } from '../../src/adapters/api/api-failure';
import { ApiLevelRepository } from '../../src/adapters/api/api-level-repository';
import { GameId } from '../../src/domain/shared/game-id';
import { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import {
  AnsweringLevelsApi,
  DeferredLevelsApi,
  levelsAnswer,
  UnreachableLevelsApi,
} from '../support/adapters/levels-api-double';
import { describeLevelRepositoryContract } from '../support/contracts/level-repository-contract';
import { delivered } from '../support/engine/value-receiver';
import { fitLevelFile } from '../support/variants/hexa-fit/fit-level-file';
import { sortLevelFile } from '../support/variants/hexa-sort/sort-level-file';

// `ApiLevelRepository` implements the `LevelRepository` port over the levels of hexablock-api
// (#48, A6, classes.md decision 22, option B of the decision of 2026-11-27 on #48). It keeps the
// last good answer of `GET /v1/levels` in memory and answers each call from it at once, so no use
// case waits for the network (D27). Each call starts one refresh when none is in flight.
// The tests give it a transport double, and `DeferredLevelsApi` lets each test settle a request
// when it wants, with no timer.
describeLevelRepositoryContract('ApiLevelRepository', async (levels) => {
  const repository = new ApiLevelRepository(new AnsweringLevelsApi(levels));
  await repository.refresh();
  return repository;
});

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');
const FIT_01 = LevelId.of('fit-01');

// The text of the id of each level of `levels`.
const idsOf = (levels: readonly { levelId(): LevelId }[]) =>
  levels.map((level) => delivered(level.levelId()));

describe('ApiLevelRepository', () => {
  // The backend answers each level in the shared level format, with its version (DS-6).
  it('should_give_the_definition_of_each_backend_level_of_the_game_when_a_refresh_has_read_the_answer', async () => {
    const newer = { ...fitLevelFile(), version: 2 };
    const repository = new ApiLevelRepository(new AnsweringLevelsApi([newer, sortLevelFile()]));

    await repository.refresh();
    const fit = await repository.list(FIT);
    const found = await repository.levelOf(FIT, FIT_01);

    expect(fit).toHaveLength(1);
    expect(fit[0]?.equals(LevelDefinition.of(newer))).toBe(true);
    expect(found?.equals(LevelDefinition.of(newer))).toBe(true);
    expect(idsOf(await repository.list(SORT))).toEqual(['sort-01']);
  });

  // Issue #307: the backend names each stored level that breaks a rule in `unavailable`.
  it('should_name_each_unavailable_level_of_the_game_when_the_answer_lists_it_as_unavailable', async () => {
    const repository = new ApiLevelRepository(
      new AnsweringLevelsApi(
        [fitLevelFile()],
        [
          { gameId: 'hexa-fit', levelId: 'fit-16', reason: 'invalid-section' },
          { gameId: 'hexa-sort', levelId: 'sort-11', reason: 'invalid-pieces' },
          { gameId: 'hexa-fit', levelId: 'fit-17', reason: 'invalid-witness' },
        ],
      ),
    );

    await repository.refresh();
    const fit = await repository.unavailable(FIT);
    const sort = await repository.unavailable(SORT);

    expect(fit.map((levelId) => delivered(levelId))).toEqual(['fit-16', 'fit-17']);
    expect(sort.map((levelId) => delivered(levelId))).toEqual(['sort-11']);
    expect(idsOf(await repository.list(FIT))).toEqual(['fit-01']);
  });

  // D27: no screen waits for the network. Before the first answer the repository holds no
  // backend level, so it answers at once with none while the request hangs.
  it('should_answer_at_once_with_no_backend_level_when_the_first_request_hangs', async () => {
    const api = new DeferredLevelsApi();
    const repository = new ApiLevelRepository(api);

    const answers = [
      await repository.list(FIT),
      await repository.levelOf(FIT, FIT_01),
      await repository.unavailable(FIT),
    ];

    expect(answers).toEqual([[], undefined, []]);
    expect(api.calls()).toBe(1);
  });

  // A new backend level appears on the next call after the refresh, not on the call that
  // started it.
  it('should_give_the_backend_levels_on_the_next_call_when_the_refresh_has_resolved', async () => {
    const api = new DeferredLevelsApi();
    const repository = new ApiLevelRepository(api);

    const first = await repository.list(FIT);
    api.answer(levelsAnswer([fitLevelFile()]));
    await repository.refresh();
    const second = await repository.list(FIT);

    expect(idsOf(first)).toEqual([]);
    expect(idsOf(second)).toEqual(['fit-01']);
  });

  // One request serves every call that comes while it is in flight: `list()`, `levelOf()`,
  // `unavailable()` and `refresh()`. A call after the answer starts the next request.
  it('should_send_one_request_at_most_when_several_calls_come_while_a_refresh_is_in_flight', async () => {
    const api = new DeferredLevelsApi();
    const repository = new ApiLevelRepository(api);

    const inFlight = repository.refresh();
    await repository.list(FIT);
    await repository.levelOf(FIT, FIT_01);
    await repository.unavailable(SORT);
    const callsInFlight = api.calls();
    api.answer(levelsAnswer([]));
    await inFlight;
    await repository.list(FIT);

    expect([callsInFlight, api.calls()]).toEqual([1, 2]);
  });

  // A failed refresh keeps the last good answer: a phone that loses the network keeps the
  // backend levels that it read before.
  it('should_keep_the_last_good_answer_when_a_later_refresh_fails', async () => {
    const api = new DeferredLevelsApi();
    const repository = new ApiLevelRepository(api);
    const unavailable = [{ gameId: 'hexa-fit', levelId: 'fit-16', reason: 'invalid-section' }];

    const first = repository.refresh();
    api.answer(levelsAnswer([fitLevelFile()], unavailable));
    await first;
    const second = repository.refresh();
    api.fail(new ApiFailure(undefined, 'GET /v1/levels got no answer.'));
    await second;

    expect(idsOf(await repository.list(FIT))).toEqual(['fit-01']);
    expect((await repository.unavailable(FIT)).map((levelId) => delivered(levelId))).toEqual([
      'fit-16',
    ]);
  });

  // An answer with a level that the app cannot read counts as a failed refresh: the repository
  // keeps the last good answer whole, and it never shows half of an answer.
  it('should_keep_the_last_good_answer_when_a_later_answer_holds_a_level_that_the_app_cannot_read', async () => {
    const api = new DeferredLevelsApi();
    const repository = new ApiLevelRepository(api);

    const first = repository.refresh();
    api.answer(levelsAnswer([fitLevelFile()]));
    await first;
    const second = repository.refresh();
    api.answer(
      levelsAnswer([
        { ...fitLevelFile(), levelId: 'fit-02', order: 2 },
        { ...fitLevelFile(), levelId: 'fit-03', order: 3, topology: 'hexagon' },
      ]),
    );
    await second;

    expect(idsOf(await repository.list(FIT))).toEqual(['fit-01']);
  });

  // With no network each call still answers: no backend level, and no call rejects.
  it('should_give_no_backend_level_and_reject_no_call_when_the_backend_does_not_answer', async () => {
    const api = new UnreachableLevelsApi();
    const repository = new ApiLevelRepository(api);

    await repository.refresh();
    const answers = [
      await repository.list(FIT),
      await repository.levelOf(FIT, FIT_01),
      await repository.unavailable(FIT),
    ];

    expect(answers).toEqual([[], undefined, []]);
    expect(api.calls()).toBeGreaterThan(0);
  });
});
