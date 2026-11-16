import type { LevelId } from '../domain/engine/level-id';
import type { Stars } from '../domain/engine/stars';

// The status of one level in the list of levels (S3-12 in #151, issue #168).
// It is a value object with a closed set of three instances, in the form of `Outcome`
// (classes.md decision 45): `completed`, `open` and `locked`.
// Each value has one shared instance, which is frozen. So `equals()` compares two statuses
// by identity, and no code compares a text to know a status.
// - `completed`: the progress keeps a result of the level, so the player won it.
// - `open`: the player can play the level. The first level of the list is open,
//   and the level after a completed level is open.
// - `locked`: the player cannot play the level yet.
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

  // Two statuses are equal when they are the same instance.
  equals(other: LevelStatus): boolean {
    return this === other;
  }
}

// One level in the list of levels: the plain response model of `ListLevels` (issue #168).
// It holds no `LevelDefinition`, so a presenter cannot build a level from it.
// `levelId` names the level, and a later start request names the level with it (#172).
// `stars` exists only for a completed level: the stars of the best result of the level,
// which can be zero. A use case never opens a domain object: the presenter of layer 3
// receives the text of the id and the number of the stars with `deliverTo()` (decision 29).
export interface LevelSummary {
  readonly levelId: LevelId;
  readonly status: LevelStatus;
  readonly stars?: Stars;
}
