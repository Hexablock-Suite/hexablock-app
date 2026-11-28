// Wrong example: `turn/` imports `board/`, and `board/` imports `turn/` through other files.
import { board } from '../board/board';

export const gameEngine = [board];
