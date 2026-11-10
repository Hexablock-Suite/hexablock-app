/** @jest-environment node */
import { TriangleAxis } from '../../../src/domain/engine/triangle-topology';
import { SquareAxis } from '../../../src/domain/engine/square-topology';
import { HexAxis } from '../../../src/domain/engine/hex-topology';
import { Outcome } from '../../../src/domain/engine/outcome';
import { BoardShape } from '../../../src/domain/engine/board-shape';
import type { BoardState } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import { Color } from '../../../src/domain/engine/color';
import { TopologyId, type GeometryFactory } from '../../../src/domain/engine/geometry-factory';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { MoveHistory } from '../../../src/domain/engine/move-history';
import { Piece } from '../../../src/domain/engine/piece';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Seed } from '../../../src/domain/engine/seed';
import { CellNode, ShapeGroup } from '../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../src/domain/engine/square-geometry';
import { TriangleGeometry } from '../../../src/domain/engine/triangle-geometry';
import { Turns } from '../../../src/domain/engine/turns';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { FitFactory } from '../../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../../../src/domain/variants/hexa-fit/fit-level';
import { PlaceFitPiece } from '../../../src/domain/variants/hexa-fit/fit-move';
import { LinesFactory, LinesSettings } from '../../../src/domain/variants/hexa-lines/lines-factory';
import { MergeFactory, MergeSettings } from '../../../src/domain/variants/hexa-merge/merge-factory';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { ColorStack } from '../../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../src/domain/variants/hexa-sort/sort-level';
import { ManualClock } from '../../support/engine/manual-clock';
import { phaseNameOf } from '../../support/engine/phase-name';
import { firstValidMove, startVariant, liveStateOf } from '../../support/engine/variant-game';
import { variantIdOf } from '../../support/variants/variant-id';
import { A, fitFactory, threeDominoFitFactory } from '../../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../../support/variants/hexa-sort/sort-game';
import { BOARD_ID, CountingTimerIds } from '../../support/engine/entity-ids';

// The engine runs the four variants through one code path (issue 99, APP-FR-03).
// `playOnce()` reads only `IVariantFactory`: it has no branch on the game id.

function playOnce<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { engine, rules } = startVariant(factory);
  const outcome = engine.play(firstValidMove(rules, liveStateOf(factory, engine.snapshot())));
  return {
    gameId: variantIdOf(factory.gameId),
    outcome,
    phase: phaseNameOf(engine.currentPhase()),
  };
}

// Two boards of one factory, in plain facts that a test compares across the four variants.
function twoBoards<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const first = factory.createBoard(BOARD_ID);
  const second = factory.createBoard(BOARD_ID);
  return { distinct: first !== second, filled: first.cells().length + second.cells().length };
}

// The history of each variant (APP-FR-08, classes.md decision 3). Its class stays out of the
// suite: each factory is read through `IVariantFactory`, and a game plays through it.
function historyOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const first = factory.createHistory();
  return { first, distinct: first !== factory.createHistory() };
}

// The count of moves that a game takes back after it plays `moves` moves.
// The limit of a history is private, so the test reads it through the undo capability.
function undosAfter<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>, moves: number): number {
  const { engine, rules } = startVariant(factory);
  for (let played = 0; played < moves; played += 1) {
    engine.play(firstValidMove(rules, liveStateOf(factory, engine.snapshot())));
  }
  const history = engine.undoable();
  let undone = 0;
  while (history?.canUndo()) {
    history.undo();
    undone += 1;
  }
  return undone;
}

// The #64 check (APP-FR-16). The settings hold no coordinate,
// so the argument of `startMerge()` is the only thing that changes between two figures.
const mergeSettings = MergeSettings.of(RegionSize.of(2), Seed.of(7), MergeTile.of(2048));

function startMerge<TCoord>(geometry: GeometryFactory<TCoord>) {
  const factory = new MergeFactory(geometry, mergeSettings);
  const { engine, rules } = startVariant(factory);
  const { board } = engine.snapshot();
  const tiles = board.cells().length;
  const outcome = engine.play(firstValidMove(rules, liveStateOf(factory, engine.snapshot())));
  return { cells: board.coordinates().length, axes: board.axes(), tiles, outcome };
}

// Gives the tests of one figure. The result keeps the coordinate type inside it.
// The tests read the figure only through the `GeometryFactory` contract.
function figureTests<TCoord>(geometry: GeometryFactory<TCoord>, cellCount: number): () => void {
  const size = RegionSize.of(2);
  const origin = geometry.createCoord([0, 0]);
  const next = geometry.createCoord([1, 0]);
  const topology = geometry.createTopology();
  const keys = (cells: readonly TCoord[]) => cells.map((c) => topology.key(c));
  const region = keys(topology.region(size).coordinates());

  // A level of two cells and one domino that covers them.
  function fitLevel(named: TopologyId): FitLevel<TCoord> {
    const domino = new ShapeGroup([new CellNode(origin), new CellNode(next)]);
    return FitLevel.of(named, BoardShape.of([origin, next]), [new Piece(domino, A)]);
  }

  return () => {
    it('should_start_lines_on_the_region_of_the_geometry_when_the_lines_factory_gets_it', () => {
      const factory = new LinesFactory(
        geometry,
        LinesSettings.of(size, Seed.of(1), [new CellNode(origin)], [Color.of('red')]),
      );
      const { engine, rules } = startVariant(factory);
      const start = engine.snapshot();

      const outcome = engine.play(firstValidMove(rules, liveStateOf(factory, start)));

      expect(region).toHaveLength(cellCount);
      expect(keys(start.board.coordinates())).toEqual(region);
      expect(start.board.cells()).toEqual([]);
      expect(start.tray).toHaveLength(3);
      expect(outcome).toBe(Outcome.playing);
      expect(engine.snapshot().cellsPlaced).toBe(1);
      expect(engine.snapshot().tray).toHaveLength(2);
    });

    it('should_start_sort_on_the_region_of_the_geometry_when_the_sort_factory_gets_it', () => {
      const offered = ColorStack.of([Color.of('red')]);
      const factory = new SortFactory(
        geometry,
        SortLevel.fixed(size, GoalCount.of(5), [offered, offered]),
      );
      const { engine, rules } = startVariant(factory);
      const start = engine.snapshot();

      const outcome = engine.play(firstValidMove(rules, liveStateOf(factory, start)));

      expect(keys(start.board.coordinates())).toEqual(region);
      expect(start.board.cells()).toEqual([]);
      expect(start.offered?.cell().equals(ColorStack.of([Color.of('red')]))).toBe(true);
      expect(outcome).toBe(Outcome.playing);
      expect(engine.snapshot().board.cells()).toHaveLength(1);
    });

    it('should_start_and_win_the_fit_level_when_its_topology_names_the_geometry', () => {
      const { engine } = startVariant(
        new FitFactory(geometry, fitLevel(geometry.id), new ManualClock(), new CountingTimerIds()),
      );
      const start = engine.snapshot();

      const outcome = engine.play(new PlaceFitPiece(A, Turns.of(0), origin));

      expect(keys(start.board.coordinates())).toEqual(keys([origin, next]));
      expect(start.view().remaining.map((piece) => String(piece.cell()))).toEqual(['a']);
      expect(outcome).toBe(Outcome.victory);
    });

    it('should_throw_a_range_error_when_the_fit_level_names_another_topology', () => {
      const others = [TopologyId.hex, TopologyId.square, TopologyId.triangle].filter(
        (id) => !id.equals(geometry.id),
      );

      // Only a cast puts a free string here, as a broken level file would.
      for (const named of [...others, 'hexagon' as unknown as TopologyId]) {
        const create = () =>
          new FitFactory(geometry, fitLevel(named), new ManualClock(), new CountingTimerIds());

        expect(create).toThrow(RangeError);
        expect(create).toThrow(
          `A Fit level of topology ${String(named)} cannot start on the ${String(geometry.id)} geometry.`,
        );
      }
    });
  };
}

const figures = [
  ['hex', figureTests(new HexGeometry(), 7)],
  ['square', figureTests(new SquareGeometry(), 4)],
  ['triangle', figureTests(new TriangleGeometry(), 8)],
] as const;

describe('IVariantFactory', () => {
  it('should_play_each_variant_through_the_same_path_when_the_engine_gets_the_four_factories', () => {
    const results = [
      playOnce(linesFactory()),
      playOnce(fitFactory()),
      playOnce(sortFactory()),
      playOnce(mergeFactory()),
    ];

    expect(results.map((r) => [r.gameId, r.outcome])).toEqual([
      ['hexa-lines', Outcome.playing],
      ['hexa-fit', Outcome.victory],
      ['hexa-sort', Outcome.playing],
      ['hexa-merge', Outcome.playing],
    ]);
    expect(new Set(results.map((r) => r.gameId)).size).toBe(4);
  });

  it('should_give_each_variant_the_history_of_its_requirement_when_a_factory_is_asked', () => {
    const lines = historyOf(linesFactory());
    const fit = historyOf(fitFactory());
    const sort = historyOf(sortFactory());
    const merge = historyOf(mergeFactory());

    // APP-FR-08: Fit undoes with no limit, Merge undoes one move, Lines and Sort have no undo.
    expect(lines.first).toBeUndefined();
    expect(sort.first).toBeUndefined();
    expect(fit.first).toBeInstanceOf(MoveHistory);
    expect(undosAfter(threeDominoFitFactory(), 3)).toBe(3);
    expect(merge.first).toBeInstanceOf(MoveHistory);
    expect(undosAfter(mergeFactory(), 3)).toBe(1);
    expect([fit.distinct, merge.distinct]).toEqual([true, true]);
  });

  // The limit of a history is private, so no test reads «no limit» itself.
  // A long Fit game takes back every move: far more than the limit of 1 that Merge has,
  // the only limit that a variant uses.
  it('should_take_back_every_move_of_a_long_fit_game_when_another_variant_stops_at_its_limit', () => {
    expect(undosAfter(threeDominoFitFactory(), 50)).toBe(50);
    expect(undosAfter(mergeFactory(), 3)).toBe(1);
  });

  it('should_give_a_new_empty_board_when_a_factory_is_asked_twice', () => {
    const fresh = { distinct: true, filled: 0 };

    expect([
      twoBoards(linesFactory()),
      twoBoards(fitFactory()),
      twoBoards(sortFactory()),
      twoBoards(mergeFactory()),
    ]).toEqual([fresh, fresh, fresh, fresh]);
  });

  it('should_change_the_figure_of_the_game_when_only_the_geometry_factory_changes', () => {
    expect([
      startMerge(new HexGeometry()),
      startMerge(new SquareGeometry()),
      startMerge(new TriangleGeometry()),
    ]).toEqual([
      { cells: 7, axes: [HexAxis.q, HexAxis.r, HexAxis.s], tiles: 2, outcome: Outcome.playing },
      { cells: 4, axes: [SquareAxis.col, SquareAxis.row], tiles: 2, outcome: Outcome.playing },
      {
        cells: 8,
        axes: [TriangleAxis.row, TriangleAxis.downRight, TriangleAxis.downLeft],
        tiles: 2,
        outcome: Outcome.playing,
      },
    ]);
  });
});

describe.each(figures)('the %s figure', (_name, tests) => {
  tests();
});
