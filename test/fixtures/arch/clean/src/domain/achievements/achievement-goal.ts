// Right example: an achievement goal imports the shared leaves and the progress.
import { gameProgress } from '../progress/game-progress';
import { score } from '../shared/score';

export const goal = [gameProgress, score];
