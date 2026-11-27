/** @jest-environment node */
import sort01 from '../../../../src/adapters/levels/sort/sort-01.json';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import { LevelDefinition } from '../../../../src/domain/progress/level-definition';
import { SortLevelBuilder } from '../../../../src/domain/variants/hexa-sort/sort-level-builder';
import { seededRandom, StepRandom } from '../../../support/engine/step-random';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/shared/score';
import { GameId } from '../../../../src/domain/shared/game-id';
import { Color } from '../../../../src/domain/engine/color';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { Seed } from '../../../../src/domain/engine/seed';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import type { SquareCoord } from '../../../../src/domain/engine/square-topology';
import { startVariant } from '../../../support/engine/variant-game';
import {
  chipsAt,
  names,
  placeFrom,
  row,
  sortFactory,
  sortState,
  stack,
  trayOf,
} from '../../../support/variants/hexa-sort/sort-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';
import { playMove } from '../../../support/engine/play-move';

// The Sort factory creates the whole family of Hexa Sort (issue 99, classes.md decision 31).

// The tray of a new game of `factory`, at the start and after each of two placements.
// The two cells are not neighbors, so no run moves.
function trayInGame(factory: SortFactory<SquareCoord>): string[][][] {
  const { engine } = startVariant(factory);
  const trays = [trayOf(engine.snapshot())];
  for (const move of [placeFrom(0, 0, 0), placeFrom(1, 1, 1)]) {
    playMove(engine, move);
    trays.push(trayOf(engine.snapshot()));
  }
  return trays;
}

// The stacks of a new match of `factory`: the three stacks of the tray (#353) and the next nine
// of its source.
function stacksOfMatch<TCoord>(factory: SortFactory<TCoord>): string[][] {
  const photo = startVariant(factory).engine.snapshot();
  const found = photo.trayStacks().map((slot) => names(slot));
  for (const offered of photo.pieceSource()) {
    found.push(names(offered));
    if (found.length === 12) break;
  }
  return found;
}

// The default Sort game: a level whose source draws from a new seed in each match (issue #417).
function eachMatchFactory(random: StepRandom): SortFactory<SquareCoord> {
  const colors: [Color, ...Color[]] = [Color.of('red'), Color.of('blue'), Color.of('green')];
  return new SortFactory(
    new SquareGeometry(),
    SortLevel.seededEachMatch(RegionSize.of(2), GoalCount.of(5), colors),
    random,
  );
}

describe('SortFactory', () => {
  // Issue #417: the default Sort game draws a new seed in each match.
  it('should_draw_other_stacks_when_two_matches_of_the_default_level_start_with_other_draws', () => {
    const factory = eachMatchFactory(new StepRandom([0.1, 0.6]));

    const first = stacksOfMatch(factory);

    expect(first).toHaveLength(12);
    expect(stacksOfMatch(factory)).not.toEqual(first);
  });

  // APP-NFR-07: the randomness comes by injection, so a fixed source gives the same game.
  it('should_draw_the_same_stacks_twice_when_the_random_source_of_the_default_level_gives_one_draw', () => {
    const factory = eachMatchFactory(new StepRandom([0.3]));

    const first = stacksOfMatch(factory);

    expect(stacksOfMatch(factory)).toEqual(first);
    expect(stacksOfMatch(eachMatchFactory(new StepRandom([0.3])))).toEqual(first);
  });

  // A level file keeps its seed (A4): `sort-01` gives the same stacks in each match,
  // whatever the random source of the factory draws.
  it('should_draw_the_same_stacks_in_each_match_when_the_level_file_holds_its_seed', () => {
    const geometry = new HexGeometry();
    const level = LevelDefinition.of(sort01).buildWith(new SortLevelBuilder(geometry));
    const factory = new SortFactory(geometry, level, new StepRandom([0.1, 0.6]));

    const first = stacksOfMatch(factory);

    expect(stacksOfMatch(factory)).toEqual(first);
    expect(stacksOfMatch(new SortFactory(geometry, level, new StepRandom([0.9])))).toEqual(first);
  });

  it('should_start_the_level_and_place_one_stack_when_the_sort_factory_builds_it', () => {
    const factory = sortFactory([stack('red', 'red'), stack('blue')]);

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine } = startVariant(factory);
    const outcome = playMove(engine, placeFrom(0, 0, 0));

    expect(factory.isFor(GameId.of('hexa-sort'))).toBe(true);
    expect(factory.createBoard(BOARD_ID).coordinates()).toHaveLength(4);
    expect(trayOf(initial.snapshot())).toEqual([['red', 'red'], ['blue'], []]);
    expect(initial.snapshot().goal().equals(GoalCount.of(5))).toBe(true);
    expect(outcome).toBe(Outcome.playing);
    expect(chipsAt(engine, 0, 0)).toEqual(['red', 'red']);
    expect(trayOf(engine.snapshot())).toEqual([[], ['blue'], []]);
    expect(engine.snapshot().scoreSoFar()).toEqual(Score.of(0));
    expect(engine.takeEvents()).toEqual([]);
  });

  it('should_throw_a_range_error_and_build_no_game_when_the_level_goal_is_zero', () => {
    // A goal of 0 once won the game before the first move (sort-rules.ts, `evaluate()`).
    // The level and the state now hold a `GoalCount`, which rejects it (#129).
    const message = 'A goal count needs a whole number of 1 or more, not 0.';

    expect(() => sortFactory([stack('red')], 0)).toThrow(new RangeError(message));
    expect(() => sortState({ board: row(2), offered: [stack('red')], goalsNeeded: 0 })).toThrow(
      new RangeError(message),
    );
  });

  it('should_draw_the_same_stacks_when_two_games_start_from_one_level', () => {
    const levels = [
      SortLevel.fixed(RegionSize.of(2), GoalCount.of(5), [
        stack('red'),
        stack('blue'),
        stack('green'),
        stack('yellow'),
      ]),
      SortLevel.seeded(RegionSize.of(2), GoalCount.of(5), Seed.of(7), [
        Color.of('red'),
        Color.of('blue'),
        Color.of('green'),
      ]),
    ];

    for (const level of levels) {
      const factory = new SortFactory(new SquareGeometry(), level, seededRandom(1));
      const first = trayInGame(factory);
      const second = trayInGame(factory);
      // A second factory of an equal level draws the same stacks too.
      const third = trayInGame(new SortFactory(new SquareGeometry(), level, seededRandom(1)));

      expect(first).toHaveLength(3);
      for (const tiles of first[0] ?? []) expect(tiles).not.toEqual([]);
      expect(second).toEqual(first);
      expect(third).toEqual(first);
    }
  });

  it('should_keep_the_second_game_at_the_first_stack_when_the_first_game_of_the_level_draws', () => {
    const levels = [
      SortLevel.fixed(RegionSize.of(2), GoalCount.of(5), [
        stack('red'),
        stack('blue'),
        stack('green'),
      ]),
      SortLevel.seeded(RegionSize.of(2), GoalCount.of(5), Seed.of(7), [
        Color.of('red'),
        Color.of('blue'),
        Color.of('green'),
      ]),
    ];

    for (const level of levels) {
      const factory = new SortFactory(new SquareGeometry(), level, seededRandom(1));
      const { engine: first } = startVariant(factory);
      const { engine: second } = startVariant(factory);
      const start = trayOf(second.snapshot());
      const sourceAtStart = second.snapshot().pieceSource();

      playMove(first, placeFrom(0, 0, 0));
      playMove(first, placeFrom(1, 1, 1));

      expect(trayOf(first.snapshot())).not.toEqual(start);
      expect(trayOf(second.snapshot())).toEqual(start);
      expect(second.snapshot().pieceSource()).toBe(sourceAtStart);
      expect(trayOf(startVariant(factory).engine.snapshot())).toEqual(start);
    }
  });

  it('should_build_a_new_source_from_the_level_data_when_the_sort_factory_creates_the_piece_source', () => {
    const level = SortLevel.fixed(RegionSize.of(2), GoalCount.of(1), [stack('red'), stack('blue')]);
    const factory = new SortFactory(new SquareGeometry(), level, seededRandom(1));

    const one = factory.createPieceSource();
    const other = factory.createPieceSource();

    // The level holds no source, so each call builds one, and both give the stacks of the level.
    // The source gives each stack itself: Sort binds `TPiece` to `ColorStack` (issue #423).
    expect(one).not.toBe(other);
    expect([...one].map((offered) => names(offered))).toEqual([['red'], ['blue']]);
    expect([...other].map((offered) => names(offered))).toEqual([['red'], ['blue']]);
  });
});
