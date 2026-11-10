import { Score } from '../../../../src/domain/engine/score';
import { Board, type ReadonlyBoard } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import type { GameStateId } from '../../../../src/domain/engine/game-state-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import type { GridTopology } from '../../../../src/domain/engine/grid-topology';
import { Piece } from '../../../../src/domain/engine/piece';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { Seed } from '../../../../src/domain/engine/seed';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { CellNode, ShapeGroup, type ShapeNode } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { Color } from '../../../../src/domain/engine/color';
import {
  LinesFactory,
  LinesSettings,
} from '../../../../src/domain/variants/hexa-lines/lines-factory';
import { LinesRules } from '../../../../src/domain/variants/hexa-lines/lines-rules';
import {
  LinesState,
  type LinesSnapshot,
} from '../../../../src/domain/variants/hexa-lines/lines-state';
import type { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { RecordingPublisher } from '../../engine/fake-game';
import { square, type SquareCoord } from '../../engine/square-topology';
import { MATCH_ID } from '../../engine/match-id';
import { BOARD_ID, STATE_ID } from '../../engine/entity-ids';

// Builders for the Hexa Lines rules tests. They exist only in test/.

export const red = Color.of('red');
export const blue = Color.of('blue');

// A piece of the given cells. The cells are relative to the origin of the piece.
export function piece<TCoord>(...cells: TCoord[]): Piece<Color, TCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), red);
}

// A region of the topology with `filled` cells, the tray and the pieces left in the source.
export function linesState<TCoord>(
  topology: GridTopology<TCoord>,
  size: number,
  values: {
    filled?: readonly TCoord[];
    tray: Piece<Color, TCoord>[];
    source?: readonly Piece<Color, TCoord>[];
    matchId?: MatchId;
    stateId?: GameStateId;
  },
): LinesState<TCoord> {
  const board = new Board<Color, TCoord>(BOARD_ID, topology.region(RegionSize.of(size)), topology);
  for (const c of values.filled ?? []) board.occupy(c, red);
  return new LinesState(
    values.stateId ?? STATE_ID,
    values.matchId ?? MATCH_ID,
    board,
    values.tray,
    new FixedListPieceSource(values.source ?? []),
  );
}

// The rules tests give no points. The scoring tests pass their own policy.
class NoScoring<TCoord> implements IScoringPolicy<LinesState<TCoord>> {
  score(): Score {
    return Score.of(0);
  }
}

// A started Lines game on the real engine. The engine calls only the rules contract.
export function linesGame<TCoord>(
  initial: LinesState<TCoord>,
  scoring: IScoringPolicy<LinesState<TCoord>> = new NoScoring<TCoord>(),
) {
  const publisher = new RecordingPublisher();
  const engine = new GameEngine<Color, TCoord, PlacePiece<TCoord>, LinesState<TCoord>>(
    MATCH_ID,
    GameId.of('hexa-lines'),
    new LinesRules<TCoord>(),
    scoring,
    publisher,
  );
  engine.start(initial);
  return { engine, publisher };
}

// The keys of the filled cells, sorted, so a test compares boards by value.
// It takes a photo, because only the photo shows the board of a state.
export function filledKeys<TCoord>(state: {
  readonly board: ReadonlyBoard<Color, TCoord>;
}): string[] {
  return state.board
    .cells()
    .map(([c]) => state.board.key(c))
    .sort();
}

// A Lines factory on a 3 × 3 square board. By default each piece is one red cell.
export function linesFactory(
  seed = 1,
  shapes: readonly [ShapeNode<SquareCoord>, ...ShapeNode<SquareCoord>[]] = [
    new CellNode(square(0, 0)),
  ],
  colors: readonly [Color, ...Color[]] = [red],
): LinesFactory<SquareCoord> {
  return new LinesFactory(
    new SquareGeometry(),
    LinesSettings.of(RegionSize.of(3), Seed.of(seed), shapes, colors),
  );
}

// A live state built again from a photo, so a test can ask the rules about the state that a game
// shows. The engine never gives its state away. So the helper builds a new state with the ids,
// the board and the source of the photo, and the state takes the photo back with `restore()`.
export function linesStateOf<TCoord>(photo: LinesSnapshot<TCoord>): LinesState<TCoord> {
  const state = new LinesState(photo.stateId, photo.matchId, photo.board.clone(), [], photo.source);
  state.restore(photo);
  return state;
}
