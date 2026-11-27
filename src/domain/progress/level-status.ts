import type { GameProgress } from './game-progress';
import type { LevelDefinition } from './level-definition';

// The status of one level of a game (S3-12 in #151, issues #168 and #326).
// It is a value object with a closed set of three instances, in the form of `Outcome`
// (classes.md decision 45): `completed`, `open` and `locked`.
// Each value has one shared instance, which is frozen. So `equals()` compares two statuses
// by identity, and no code compares a text to know a status.
// - `completed`: the progress keeps a result of the level, so the player won it.
// - `open`: the player can play the level. The first level of the list is open,
//   and the level after a completed level is open.
// - `locked`: the player cannot play the level yet.
// `ofEach()` holds the one rule of a won, open and locked level (classes.md decision 58).
// `ListLevels` and the goals of the achievements call it, and hold no copy of the rule.
export class LevelStatus {
  static readonly completed = new LevelStatus('completed');
  static readonly open = new LevelStatus('open');
  static readonly locked = new LevelStatus('locked');

  // The closed set. It exists after the last instance.
  private static readonly all: readonly LevelStatus[] = [
    LevelStatus.completed,
    LevelStatus.open,
    LevelStatus.locked,
  ];

  // The name tells two statuses apart in a test report. No operation returns it.
  private constructor(private readonly name: string) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (LevelStatus.all !== undefined) throw new RangeError('The set of level statuses is closed.');
    Object.freeze(this);
  }

  // Each level of `levels` with its status, in the order of `levels` (S3-12).
  // A level is completed when `progress` keeps the stars of a result of it, zero stars included.
  // The first level is open. The level after a completed level is open,
  // and every other level is locked. A game with no progress (`undefined`) has no completed level.
  // The caller chooses the levels and their order, so this rule reads no figure:
  // `ListLevels` gives the levels of one figure in the order of their files,
  // and a goal gives the levels of every figure. The order changes only `open` and `locked`.
  static ofEach(
    levels: readonly LevelDefinition[],
    progress: GameProgress | undefined,
  ): (readonly [LevelDefinition, LevelStatus])[] {
    const statuses: (readonly [LevelDefinition, LevelStatus])[] = [];
    let before: LevelStatus | undefined;
    for (const level of levels) {
      const status = LevelStatus.after(before, progress?.starsOf(level.levelId()) !== undefined);
      statuses.push([level, status]);
      before = status;
    }
    return statuses;
  }

  // The status of a level from the status of the level before it and from a kept result.
  // The first level has no level before it.
  private static after(before: LevelStatus | undefined, won: boolean): LevelStatus {
    if (won) return LevelStatus.completed;
    if (before === undefined || before.equals(LevelStatus.completed)) return LevelStatus.open;
    return LevelStatus.locked;
  }

  // Two statuses are equal when they are the same instance.
  equals(other: LevelStatus): boolean {
    return this === other;
  }
}
