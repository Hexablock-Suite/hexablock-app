/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/shared/score';
import { GameId } from '../../../../src/domain/shared/game-id';
import type { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import {
  LinesFactory,
  LinesSettings,
} from '../../../../src/domain/variants/hexa-lines/lines-factory';
import type { Color } from '../../../../src/domain/engine/color';
import { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';
import { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../../../src/domain/variants/hexa-lines/tray-position';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { firstValidMove, startVariant, liveStateOf } from '../../../support/engine/variant-game';
import {
  blue,
  filledKeys,
  linesFactory,
  linesGame,
  linesState,
  piece,
  red,
} from '../../../support/variants/hexa-lines/lines-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';
import { delivered } from '../../../support/engine/value-receiver';
import { StepRandom } from '../../../support/engine/step-random';

// The Lines factory creates the whole family of Hexa Lines (issue 99, classes.md decision 31).

const domino = new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]);

// A piece as text: its color and the keys of its cells, so two pieces compare by value.
// `Color` keeps its name private, so `equals()` names the color. These tests draw red or blue.
function describe_(piece: Piece<Color, SquareCoord>): string {
  const keys = piece.coveredCoordinates().map((c) => delivered(squareTopology.key(c)));
  const color = piece.occupant().equals(red) ? 'red' : 'blue';
  return `${color} ${keys.join(' ')}`;
}

function firstPieces(seed: number, count: number): string[] {
  const source = linesFactory(
    seed,
    [new CellNode(square(0, 0)), domino],
    [red, blue],
  ).createPieceSource();
  const pieces: string[] = [];
  for (const piece of source) {
    pieces.push(describe_(piece));
    if (pieces.length === count) break;
  }
  return pieces;
}

// A Lines factory on a 3 × 3 square board with two shapes and two colors.
// Each match draws its seed from `random` (issue #417).
function factoryWith(random: StepRandom): LinesFactory<SquareCoord> {
  return new LinesFactory(
    new SquareGeometry(),
    LinesSettings.of(RegionSize.of(3), [new CellNode(square(0, 0)), domino], [red, blue]),
    random,
  );
}

// The pieces of a new match of `factory`: the three tray pieces and the next nine of its source.
function piecesOfMatch(factory: LinesFactory<SquareCoord>): string[] {
  const photo = startVariant(factory).engine.snapshot();
  const pieces = photo.trayPieces().map(describe_);
  for (const piece of photo.pieceSource()) {
    pieces.push(describe_(piece));
    if (pieces.length === 12) break;
  }
  return pieces;
}

describe('LinesFactory', () => {
  // Issue #417: each match draws a new seed, so a replay in one app session gets other pieces.
  it('should_draw_other_pieces_when_two_matches_start_with_a_random_source_that_gives_other_draws', () => {
    const factory = factoryWith(new StepRandom([0.1, 0.6]));

    const first = piecesOfMatch(factory);
    const second = piecesOfMatch(factory);

    expect(first).toHaveLength(12);
    expect(second).not.toEqual(first);
  });

  // APP-NFR-07: the randomness comes by injection, so a fixed source gives the same game.
  it('should_draw_the_same_pieces_twice_when_the_random_source_gives_the_same_draw_each_time', () => {
    const factory = factoryWith(new StepRandom([0.3]));

    const first = piecesOfMatch(factory);

    expect(piecesOfMatch(factory)).toEqual(first);
    expect(piecesOfMatch(factoryWith(new StepRandom([0.3])))).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it('should_start_a_game_that_plays_one_move_when_the_lines_factory_builds_it', () => {
    const factory = linesFactory();

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine, rules } = startVariant(factory);
    const outcome = engine.play(firstValidMove(rules, liveStateOf(factory, engine.snapshot())));

    expect(factory.isFor(GameId.of('hexa-lines'))).toBe(true);
    expect(factory.createBoard(BOARD_ID).coordinates()).toHaveLength(9);
    expect(initial.snapshot().boardCopy().occupiedCells()).toEqual([]);
    expect(initial.snapshot().trayPieces()).toHaveLength(3);
    expect(outcome).toBe(Outcome.playing);
    expect(filledKeys(engine.snapshot())).toEqual(['0,0']);
    expect(engine.snapshot().trayPieces()).toHaveLength(2);
    // One placed cell gives 1 point: the factory picks the Lines scoring.
    expect(engine.snapshot().scoreSoFar()).toEqual(Score.of(1));
    expect(engine.takeEvents()).toEqual([]);
  });

  it('should_draw_the_same_pieces_when_two_lines_factories_share_a_seed', () => {
    const pieces = firstPieces(42, 12);

    expect(firstPieces(42, 12)).toEqual(pieces);
    expect(firstPieces(43, 12)).not.toEqual(pieces);
    // The draw picks among the shapes and the colors of the settings.
    expect(new Set(pieces).size).toBeGreaterThan(1);
    expect(
      linesFactory(42)
        .createInitialState(MATCH_ID, STATE_ID, BOARD_ID)
        .snapshot()
        .trayPieces()
        .map(describe_),
    ).toEqual(
      linesFactory(42)
        .createInitialState(MATCH_ID, STATE_ID, BOARD_ID)
        .snapshot()
        .trayPieces()
        .map(describe_),
    );
  });

  it('should_multiply_the_line_bonus_by_the_combo_when_the_lines_factory_scoring_scores_two_lines', () => {
    // One cell at the origin fills row 0 and column 0 of a 3 × 3 board.
    const one = piece(square(0, 0));
    const { engine } = linesGame(
      linesState(squareTopology, 3, {
        filled: [square(1, 0), square(2, 0), square(0, 1), square(0, 2), square(2, 2)],
        tray: [one, one],
      }),
      linesFactory().createScoring(),
    );

    engine.play(new PlacePiece(TrayPosition.of(0), square(0, 0)));

    expect(engine.snapshot().lastCombo()).toEqual(LineCount.of(2));
    // 1 cell + 10 × 2 lines × (2 + 1 - 1). The base scoring alone gives 21.
    expect(engine.snapshot().scoreSoFar()).toEqual(Score.of(41));
  });
});
