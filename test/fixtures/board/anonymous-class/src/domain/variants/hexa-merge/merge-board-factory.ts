import { Board } from '../../engine/board';
import type { MergeTile } from './merge-tile';

// Wrong on purpose: an anonymous class extends the engine `Board` (APP-NFR-01).
export const mergeBoardClass = <TCoord>() => class extends Board<MergeTile, TCoord, string> {};
