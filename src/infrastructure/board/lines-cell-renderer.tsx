import type { LinesCellView } from '../../adapters/lines-state-mapper';
import { lip, palette, worldTone } from '../ui/theme';
import type { CellShape } from '../../adapters/board/board-layout';
import type { CellRenderer } from './cell-renderer';
import { CellOutline } from './cell-outline';
import { SpaceCellRenderer } from './space-cell-renderer';

const TONES = new Map([
  ['red', { tone: palette.ribbon, wash: palette.ribbonDeep }],
  ['blue', worldTone(3)],
  ['green', worldTone(1)],
  ['yellow', { tone: palette.sun, wash: palette.sunDeep }],
]);

export class LinesCellRenderer implements CellRenderer<LinesCellView> {
  private readonly spaces = new SpaceCellRenderer();

  render(cell: LinesCellView, shape: CellShape) {
    return cell.color === undefined ? (
      this.spaces.render({ occupied: false }, shape)
    ) : (
      <LinesStone color={cell.color} shape={shape} testID="space-occupied" />
    );
  }
}

export function LinesStone({
  color,
  shape,
  testID,
}: {
  readonly color: string;
  readonly shape: CellShape;
  readonly testID?: string;
}) {
  const { tone, wash } = TONES.get(color) ?? worldTone(0);
  return (
    <CellOutline
      shape={shape}
      testID={testID}
      layers={[
        { scale: 0.86, fill: wash, drop: lip.sm },
        { scale: 0.86, fill: tone, stroke: wash, strokeWidth: 2 },
      ]}
    />
  );
}
