// Wrong example: `game/` imports `levels/`, and `levels/` imports `game/` through other files.
import { levelSummary } from '../levels/level-summary';

export const startGame = [levelSummary];
