/** @jest-environment node */
import { GameId } from '../../../src/domain/shared/game-id';
import { GameProgress } from '../../../src/domain/progress/game-progress';
import { LevelDefinition } from '../../../src/domain/progress/level-definition';
import { LevelId } from '../../../src/domain/progress/level-id';
import { LevelStatus } from '../../../src/domain/progress/level-status';
import { ProgressRecord } from '../../../src/domain/progress/progress-model';
import { Score } from '../../../src/domain/shared/score';
import { Stars } from '../../../src/domain/progress/stars';
import { delivered } from '../../support/engine/value-receiver';

// `LevelStatus.ofEach()` is the one rule of a won, open and locked level (S3-12 in #151,
// issue #326). A level is won (`completed`) when the progress keeps a result of it,
// zero stars included. The first level is open, the level after a won level is open,
// and every other level is locked. The caller gives the levels and their order.

const gameId = GameId.of('fake-game');

// A level of the fake game. The section is empty, because the rule reads no section.
const level = (id: string, order: number, topology = 'hex') =>
  LevelDefinition.of({ levelId: id, order, version: 1, topology, section: {} });

// A progress that keeps a result with `stars` stars for each level of `won`.
function progressWith(won: readonly string[], stars = 2): GameProgress {
  const progress = GameProgress.start(gameId);
  for (const levelId of won) {
    progress.recordLevel(
      ProgressRecord.of({
        gameId,
        score: Score.of(0),
        levelId: LevelId.of(levelId),
        stars: Stars.of(stars),
      }),
    );
  }
  return progress;
}

const names: readonly (readonly [LevelStatus, string])[] = [
  [LevelStatus.completed, 'completed'],
  [LevelStatus.open, 'open'],
  [LevelStatus.locked, 'locked'],
];

// Each level id with the name of its status, in the order of the operation.
function rowsOf(levels: readonly LevelDefinition[], progress: GameProgress | undefined) {
  return LevelStatus.ofEach(levels, progress).map(([definition, status]) => [
    delivered(definition.levelId()),
    names.find(([named]) => named.equals(status))?.[1] ?? 'unknown',
  ]);
}

describe('LevelStatus.ofEach', () => {
  it('should_complete_each_won_level_and_open_the_next_one_when_the_progress_keeps_results', () => {
    const levels = [level('l1', 1), level('l2', 2), level('l3', 3), level('l4', 4), level('l5', 5)];

    expect(rowsOf(levels, progressWith(['l1', 'l3']))).toEqual([
      ['l1', 'completed'],
      ['l2', 'open'],
      ['l3', 'completed'],
      ['l4', 'open'],
      ['l5', 'locked'],
    ]);
  });

  // A win with zero stars is a win (D22), so it opens the next level.
  it('should_open_the_next_level_when_a_level_is_won_with_zero_stars', () => {
    const levels = [level('l1', 1), level('l2', 2), level('l3', 3)];

    expect(rowsOf(levels, progressWith(['l1'], 0))).toEqual([
      ['l1', 'completed'],
      ['l2', 'open'],
      ['l3', 'locked'],
    ]);
  });

  it('should_open_only_the_first_level_when_the_game_has_no_progress', () => {
    const levels = [level('l1', 1), level('l2', 2), level('l3', 3)];

    expect(rowsOf(levels, undefined)).toEqual([
      ['l1', 'open'],
      ['l2', 'locked'],
      ['l3', 'locked'],
    ]);
  });

  it('should_give_no_status_when_no_level_is_given', () => {
    expect(LevelStatus.ofEach([], progressWith(['l1']))).toEqual([]);
  });

  // The operation keeps the order of the caller and reads no figure: the caller chooses
  // the levels that it wants counted (issue #326).
  it('should_keep_the_order_and_the_figures_of_the_caller_when_the_levels_are_given', () => {
    const levels = [level('l3', 3), level('square-1', 1, 'square'), level('l1', 1)];

    expect(rowsOf(levels, progressWith(['square-1']))).toEqual([
      ['l3', 'open'],
      ['square-1', 'completed'],
      ['l1', 'open'],
    ]);
  });
});
