// Wrong example: the progress imports the engine and the achievements.
import { goal } from '../achievements/achievement-goal';
import { board } from '../engine/board/board';

export const gameProgress = [board, goal];
