import { Board as Grid } from '../../engine/board';
import type { Color } from './color';

// Wrong on purpose: a class extends the engine `Board` through an import alias (APP-NFR-01).
export class LinesCells<TCoord> extends Grid<Color, TCoord, string> {}
