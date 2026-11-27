/** @jest-environment node */
import { valueOf, type Delivers } from '../../src/adapters/delivered';
import { FitStateMapper } from '../../src/adapters/fit-state-mapper';
import { GamePresenter } from '../../src/adapters/game-presenter';
import { HomePresenter } from '../../src/adapters/home-presenter';
import { LevelSelectorPresenter } from '../../src/adapters/level-selector-presenter';
import { LinesStateMapper } from '../../src/adapters/lines-state-mapper';
import { MergeStateMapper } from '../../src/adapters/merge-state-mapper';
import { ResultPresenter } from '../../src/adapters/result-presenter';
import { SortStateMapper } from '../../src/adapters/sort-state-mapper';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { LevelSummary } from '../../src/application/level-summary';
import type { MoveResult } from '../../src/application/move-result';
import { Result } from '../../src/application/result';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { Outcome } from '../../src/domain/engine/outcome';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';

// Issue #408: layer 3 reads each value of the domain with one shared helper, `valueOf()` of
// `src/adapters/delivered.ts` (rule R-no-delivery-call). A domain object that delivers several
// parts at once goes through `onlyValue()` of the same file. A source that delivers no value,
// or more than one value, throws one `Error` with one message, in every mapper and presenter.

const NOTHING = new Error('The domain object delivered 0 values, not 1.');

// A domain object that delivers nothing, as a broken value object or view would.
function silent<T>(): T {
  return { deliverTo: (): void => undefined } as unknown as T;
}

const FIT = GameId.of('hexa-fit');

// The plain response of a game with the score `score`, as a use case gives it.
function responseWith(
  score: Score,
  more: Partial<MoveResult<string, string, number>> = {},
): MoveResult<string, string, number> {
  return {
    cells: [],
    freeSpaces: [],
    score,
    outcome: Outcome.playing,
    canUndo: false,
    canRedo: false,
    hasUndo: false,
    payload: 0,
    ...more,
  };
}

// A game presenter whose `StartGame` answers `response`. No other port runs.
function gamePresenterWith(response: MoveResult<string, string, number>) {
  const answer = { execute: async () => Result.success(response) };
  const unused = {
    execute: async (): Promise<never> => {
      throw new RangeError('No test calls this port.');
    },
  };
  return new GamePresenter(
    answer,
    unused,
    unused,
    unused,
    { toView: (cell: string) => cell, freeView: () => '', toPayload: (count: number) => count },
    { toMove: (intent: string) => intent },
    textCatalog.es,
  );
}

// A result presenter of Fit on the square whose `ListLevels` answers `levels`.
// Its `SaveProgress` saves each result with success.
function resultPresenterWith(levels: LevelSummary[] = []) {
  return new ResultPresenter(
    FIT,
    TopologyId.square,
    {
      saveProgressOf: async () => ({ execute: async () => Result.success(undefined) }),
      listLevels: () => ({ execute: async () => Result.success({ levels, unavailable: [] }) }),
    },
    textCatalog.es,
  );
}

// A level selector of Fit on the square whose `ListLevels` answers `levels`.
function levelSelectorWith(levels: LevelSummary[]) {
  return new LevelSelectorPresenter(
    { execute: async () => Result.success({ levels, unavailable: [] }) },
    { gameId: FIT, figure: TopologyId.square },
    textCatalog.es,
  );
}

describe('valueOf', () => {
  it('should_give_the_value_when_a_value_object_delivers_one_value', () => {
    expect([valueOf(Score.of(7)), valueOf(PieceId.of('a')), valueOf(TopologyId.hex)]).toEqual([
      7,
      'a',
      'hex',
    ]);
  });

  it('should_throw_one_error_when_a_value_object_delivers_no_value', () => {
    expect(() => valueOf(silent<Score>())).toThrow(NOTHING);
  });

  it('should_throw_one_error_when_a_value_object_delivers_two_values', () => {
    const twice: Delivers<number> = {
      deliverTo: (receiver) => {
        receiver.receive(1);
        receiver.receive(2);
      },
    };

    expect(() => valueOf(twice)).toThrow(new Error('The domain object delivered 2 values, not 1.'));
  });
});

// Each mapper reads a cell and the view of the payload with the shared helpers, so each one
// throws the same error for a cell or a view that delivers nothing.
describe('the state mappers of layer 3', () => {
  it('should_throw_the_one_delivery_error_when_a_cell_or_a_view_delivers_nothing', () => {
    const fit = new FitStateMapper(new HexGeometry().createTopology());
    const lines = new LinesStateMapper();
    const sort = new SortStateMapper();
    const merge = new MergeStateMapper();

    expect(() => fit.toView(silent())).toThrow(NOTHING);
    expect(() => fit.toPayload(silent())).toThrow(NOTHING);
    expect(() => lines.toView(silent())).toThrow(NOTHING);
    expect(() => lines.toPayload(silent())).toThrow(NOTHING);
    expect(() => sort.toView(silent())).toThrow(NOTHING);
    expect(() => sort.toPayload(silent())).toThrow(NOTHING);
    expect(() => merge.toView(silent())).toThrow(NOTHING);
    expect(() => merge.toPayload(silent())).toThrow(NOTHING);
  });
});

// Each presenter reads a score, a time, a level id, stars, a figure or a saved progress with the
// shared helpers, so each one throws the same error for a value that delivers nothing.
describe('the presenters of layer 3', () => {
  it('should_throw_the_one_delivery_error_when_a_presenter_reads_a_value_that_delivers_nothing', async () => {
    const won = LevelId.of('fit-01');
    const silentNext: LevelSummary[] = [
      { levelId: won, status: LevelStatus.completed },
      { levelId: silent(), status: LevelStatus.open },
    ];
    const lostLevel = { outcome: Outcome.gameOver, levelId: won, moves: Moves.of(3) };
    const wonLevel = { outcome: Outcome.victory, levelId: won, moves: Moves.of(3) };

    await expect(gamePresenterWith(responseWith(silent())).onStart()).rejects.toThrow(NOTHING);
    await expect(
      gamePresenterWith(responseWith(Score.of(5), { elapsedMs: silent<ElapsedTime>() })).onStart(),
    ).rejects.toThrow(NOTHING);
    await expect(resultPresenterWith().onFinish(responseWith(silent(), lostLevel))).rejects.toThrow(
      NOTHING,
    );
    await expect(
      resultPresenterWith(silentNext).onFinish(responseWith(Score.of(5), wonLevel)),
    ).rejects.toThrow(NOTHING);
    await expect(
      levelSelectorWith([{ levelId: silent(), status: LevelStatus.open }]).onOpen(),
    ).rejects.toThrow(NOTHING);
    await expect(
      levelSelectorWith([
        { levelId: won, status: LevelStatus.completed, stars: silent() },
      ]).onOpen(),
    ).rejects.toThrow(NOTHING);
    expect(() => new HomePresenter([], [silent()], textCatalog.es).home()).toThrow(NOTHING);
    expect(() =>
      new HomePresenter([GameId.of('hexa-lines')], [], textCatalog.es, [
        [GameId.of('hexa-lines'), silent()],
      ]).gameSelector(),
    ).toThrow(NOTHING);
  });
});
