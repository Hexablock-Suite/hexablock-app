import type { AchievementGoal } from '../domain/engine/achievement-goal';

// One achievement of the achievements screen (issue #188). It is plain data.
// `id` names the achievement: the presenter finds its name under `achievement.<id>` in the text
// catalog. `goal` decides when the player completes it. The goals live in the domain
// (issue #326, classes.md decision 60). An achievement with no goal stays in progress:
// no game event gives its data yet, for example the lines of one placement.
export interface Achievement {
  readonly id: string;
  readonly goal?: AchievementGoal;
}
