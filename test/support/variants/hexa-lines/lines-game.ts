import { Board } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import type { GridTopology } from '../../../../src/domain/engine/grid-topology';
import { Piece } from '../../../../src/domain/engine/piece';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { Color } from '../../../../src/domain/variants/hexa-lines/color';
import { LinesRules } from '../../../../src/domain/variants/hexa-lines/lines-rules';
import { LinesState } from '../../../../src/domain/variants/hexa-lines/lines-state';
import type { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { RecordingPublisher } from '../../engine/fake-game';

// Builders for the Hexa Lines rules tests. They exist only in test/.

export const red = Color.of('red');

// A piece of the given cells. The cells are relative to the origin of the piece.
export function piece<TCoord>(...cells: TCoord[]): Piece<Color, TCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), red);
}

// A region of the topology with `filled` cells, the tray and the pieces left in the source.
export function linesState<TCoord>(
  topology: GridTopology<TCoord, string, string>,
  size: number,
  values: {
    filled?: readonly TCoord[];
    tray: Piece<Color, TCoord>[];
    source?: readonly Piece<Color, TCoord>[];
  },
): LinesState<TCoord> {
  const board = new Board<Color, TCoord, string>(topology.region(RegionSize.of(size)), topology);
  for (const c of values.filled ?? []) board.set(c, red);
  return new LinesState(board, values.tray, new FixedListPieceSource(values.source ?? []));
}

// The rules tests give no points. The scoring tests pass their own policy.
class NoScoring<TCoord> implements IScoringPolicy<LinesState<TCoord>> {
  score(): number {
    return 0;
  }
}

// A started Lines game on the real engine. The engine calls only the rules contract.
export function linesGame<TCoord>(
  initial: LinesState<TCoord>,
  scoring: IScoringPolicy<LinesState<TCoord>> = new NoScoring<TCoord>(),
) {
  const publisher = new RecordingPublisher();
  const engine = new GameEngine<Color, TCoord, PlacePiece<TCoord>, LinesState<TCoord>>(
    GameId.of('hexa-lines'),
    new LinesRules<TCoord>(),
    scoring,
    publisher,
  );
  engine.start(initial);
  return { engine, publisher };
}

// The keys of the filled cells, sorted, so a test compares boards by value.
export function filledKeys<TCoord>(state: LinesState<TCoord>): string[] {
  return state.board
    .cells()
    .map(([c]) => state.board.topology.key(c))
    .sort();
}
