// Wrong example: `levels/` imports `game/`, and `game/` imports `levels/` through other files.
import { moveResult } from '../game/move-result';

export const listLevels = [moveResult];
