import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import type { MatchId } from '../../engine/match-id';
import { Piece } from '../../engine/piece';
import {
  FixedListPieceSource,
  SeededPieceSource,
  type IPieceSource,
} from '../../engine/piece-source';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import { CellNode } from '../../engine/shape-node';
import type { IVariantFactory } from '../../engine/variant-factory';
import type { ColorStack } from './color-stack';
import type { SortLevel } from './sort-level';
import { SortRules } from './sort-rules';
import { SortScoring } from './sort-scoring';
import type { PlaceStack } from './place-stack';
import { SortState } from './sort-state';

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Sort level.
// The geometry comes by composition (APP-FR-16, D11), so the factory runs on any figure.
export class SortFactory<TCoord> implements IVariantFactory<
  ColorStack,
  TCoord,
  PlaceStack<TCoord>,
  SortState<TCoord>
> {
  readonly gameId = GameId.of('hexa-sort');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly level: SortLevel,
  ) {}

  createRules(): IGameRules<PlaceStack<TCoord>, SortState<TCoord>> {
    return new SortRules<TCoord>();
  }

  createScoring(): IScoringPolicy<SortState<TCoord>> {
    return new SortScoring<TCoord>();
  }

  // A new source for each game, built from the data of the level (classes.md decision 47).
  // The level holds no source: it gives its seed and its draw, or its fixed list of stacks.
  // So every game of one level draws the same stacks, and no game moves the source of another.
  // A Sort piece is one cell with a stack (classes.md decision 6).
  createPieceSource(): IPieceSource<Piece<ColorStack, TCoord>> {
    const cell = this.pieceCell();
    const toPiece = (stack: ColorStack) => new Piece(new CellNode(cell), stack);
    return this.level.sourceWith<IPieceSource<Piece<ColorStack, TCoord>>>({
      seeded: (seed, draw) => new SeededPieceSource(seed, (random) => toPiece(draw(random))),
      fixed: (stacks) => new FixedListPieceSource(stacks.map(toPiece)),
    });
  }

  createBoard(boardId: BoardId): Board<ColorStack, TCoord> {
    return new BoardBuilder(this.geometry)
      .withRegion(this.level.boardSize())
      .build<ColorStack>(boardId);
  }

  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): SortState<TCoord> {
    return SortState.start({
      stateId,
      matchId,
      board: this.createBoard(boardId),
      source: this.createPieceSource(),
      goalsNeeded: this.level.goal(),
    });
  }

  // Hexa Sort has no undo (APP-FR-08, classes.md decision 3).
  createHistory(): undefined {
    return undefined;
  }

  // The cell of every Sort piece: the first cell of the level region.
  // The player names the cell of a placement, so the rules never read the cell of the piece.
  // A region has one cell or more, because a `RegionSize` is 1 or more.
  private pieceCell(): TCoord {
    const [cell] = this.geometry.createTopology().region(this.level.boardSize()).cells;
    if (cell === undefined) throw new RangeError('The region of the Sort level has no cell.');
    return cell;
  }
}
