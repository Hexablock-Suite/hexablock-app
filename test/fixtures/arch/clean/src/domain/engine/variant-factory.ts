// Right example: the engine imports the progress and the shared leaves.
import { gameProgress } from '../progress/game-progress';
import { score } from '../shared/score';

export const variantFactory = [gameProgress, score];
