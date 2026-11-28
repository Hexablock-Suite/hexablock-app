// Wrong example: `board/` imports `turn/`, and `turn/` imports `board/` through other files.
import { clock } from '../turn/clock';

export const boardState = [clock];
