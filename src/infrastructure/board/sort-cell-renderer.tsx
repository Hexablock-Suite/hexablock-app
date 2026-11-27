import type { ReactNode } from 'react';

import type { SortCellView } from '../../adapters/sort-state-mapper';
import { lip, palette, worldTone, type WorldTone } from '../ui/theme';
import type { CellShape } from '../../adapters/board/board-layout';
import type { CellRenderer } from './cell-renderer';
import { CellOutline } from './cell-outline';
import { SpaceCellRenderer } from './space-cell-renderer';

const TILE_SCALE = 0.64;
const TILE_RIM = 1.5;

const SORT_TONES = new Map<string, WorldTone>([
  ['red', { tone: palette.ribbon, wash: palette.ribbonDeep }],
  ['green', worldTone(1)],
  ['blue', worldTone(3)],
  ['yellow', { tone: palette.sun, wash: palette.sunDeep }],
]);

export class SortCellRenderer implements CellRenderer<SortCellView> {
  private readonly spaces = new SpaceCellRenderer();

  render(cell: SortCellView, shape: CellShape): ReactNode {
    return cell.colors.length === 0 ? (
      this.spaces.render({ occupied: false }, shape)
    ) : (
      <StackStone colors={cell.colors} shape={shape} testID="space-occupied" />
    );
  }
}

// The board and the stacks of the tray share the same drawing (#353). The top tile draws last.
export function StackStone({
  colors,
  shape,
  testID,
}: {
  readonly colors: readonly string[];
  readonly shape: CellShape;
  readonly testID?: string;
}) {
  // Bound the stack by the nearer edge. A triangle does not center its outline vertically.
  const gaps = Math.max(0, colors.length - 1);
  const edge = Math.min(shape.center.y, shape.height - shape.center.y);
  const room = Math.max(0, edge * (1 - TILE_SCALE) - TILE_RIM / 2);
  const step = Math.min(shape.inner * 0.15, (2 * room) / (gaps + 1));
  const layers = colors.flatMap((color, index) => {
    const drop = (gaps / 2 - index) * step;
    const { tone, wash } = sortTone(color);
    return [
      { scale: TILE_SCALE, fill: palette.shade, drop: drop + Math.min(lip.sm, step / 2) },
      { scale: TILE_SCALE, fill: tone, stroke: wash, strokeWidth: TILE_RIM, drop },
    ];
  });
  return <CellOutline shape={shape} layers={layers} testID={testID} />;
}

function sortTone(color: string): WorldTone {
  return (
    SORT_TONES.get(color) ??
    worldTone([...color].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0))
  );
}
