import { Board } from '../../engine/board';
import type { Color } from './color';

// Wrong on purpose: a variant declares a board class of its own (APP-NFR-01).
export class LinesBoard<TCoord> extends Board<Color, TCoord, string> {}
