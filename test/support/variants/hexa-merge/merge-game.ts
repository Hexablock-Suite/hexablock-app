import type { GridAxis, GridTopology } from '../../../../src/domain/engine/grid-topology';
import { Score } from '../../../../src/domain/engine/score';
import { Board, type ReadonlyBoard } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import type { HexAxis, HexCoord } from '../../../../src/domain/engine/hex-topology';
import {
  FixedListPieceSource,
  type IPieceSource,
} from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import {
  MergeFactory,
  MergeSettings,
} from '../../../../src/domain/variants/hexa-merge/merge-factory';
import { MergeRules } from '../../../../src/domain/variants/hexa-merge/merge-rules';
import {
  MergeState,
  type MergeSnapshot,
} from '../../../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import type { NewTile } from '../../../../src/domain/variants/hexa-merge/new-tile';
import type { Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import { MATCH_ID } from '../../engine/match-id';
import { BOARD_ID, STATE_ID } from '../../engine/entity-ids';
import { delivered } from '../../engine/value-receiver';
import { boardOnTopologyLike } from '../../engine/variant-game';
import { seededRandom } from '../../engine/step-random';

// The Merge game for the rules tests, on the real hexagonal geometry.
// The rules tests score no points. The scoring tests pass their own policy.

export const hexTopology = new HexGeometry().createTopology();

export type HexMergeState = MergeState<MergeTile, HexCoord, HexAxis>;

export class NoPointScoring implements IScoringPolicy<HexMergeState> {
  score(): Score {
    return Score.of(0);
  }
}

// A source that has ended, so no new tile appears after a slide.
// The tests of the slide itself use it, so they see only what the slide does.
export function noNewTiles(): IPieceSource<NewTile<MergeTile>> {
  return new FixedListPieceSource<NewTile<MergeTile>>([]);
}

// A new empty hexagon of `size` rings with the id `BOARD_ID`.
// A photo hands out no board (issue #234), so a test that builds a state builds its board here.
export function mergeBoard(size = 2): Board<MergeTile, HexCoord, HexAxis> {
  return new Board<MergeTile, HexCoord, HexAxis>(
    BOARD_ID,
    hexTopology.region(RegionSize.of(size)),
    hexTopology,
  );
}

// A hexagon of `size` rings with a tile of each given value at its coordinate.
export function mergeState(
  tiles: readonly [HexCoord, number][],
  size = 2,
  source: IPieceSource<NewTile<MergeTile>> = noNewTiles(),
  matchId: MatchId = MATCH_ID,
  stateId: GameStateId = STATE_ID,
): HexMergeState {
  const board = mergeBoard(size);
  for (const [at, value] of tiles) board.occupy(at, MergeTile.of(value));
  return new MergeState(stateId, matchId, board, source);
}

// The number of a tile. The field is private, and a tile is worth its value in points (issue #59).
// The points are a `Score`, which delivers its number to a receiver (issue #228).
export function valueOf(tile: MergeTile): number {
  return delivered(tile.points());
}

// The value of each filled cell, by the topology key of its coordinate.
// It takes a photo, because only the photo shows the board of a state.
export function values<TAxis extends GridAxis>(photo: {
  boardCopy(): ReadonlyBoard<MergeTile, HexCoord, TAxis>;
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [at, tile] of photo.boardCopy().occupiedCells()) {
    out[delivered(hexTopology.key(at))] = valueOf(tile);
  }
  return out;
}

export function mergeGame(
  initial: HexMergeState,
  target = MergeTile.of(2048),
  scoring: IScoringPolicy<HexMergeState> = new NoPointScoring(),
) {
  const rules = new MergeRules<MergeTile, HexCoord, HexAxis>(target);
  const engine = new GameEngine<MergeTile, HexCoord, Slide<HexAxis>, HexMergeState>(
    MATCH_ID,
    GameId.of('hexa-merge'),
    rules,
    scoring,
  );
  engine.start(initial);
  return { engine, rules };
}

// A Merge factory on a hexagon of 2 rings, with the target 2048.
// Each match of the factory starts from the seed `seed` (issue #417).
export function mergeFactory(seed = 1): MergeFactory<HexCoord> {
  return new MergeFactory(
    new HexGeometry(),
    MergeSettings.of(RegionSize.of(2), MergeTile.of(2048)),
    seededRandom(seed),
  );
}

// A live state built again from a photo, so a test can ask the rules about the state that a game
// shows. The engine never gives its state away. So the helper builds a new state of the match
// `matchId` with the source of the photo and a new hexagonal board of the same shape, and the state
// takes the photo back with `restore()`. The photo hands out no board (issue #234), and it keeps
// its ids private (issue #245): the ids of the state and of the board come from `matchId`.
// The board takes the axis type of the photo, so the topology is cast to it.
export function mergeStateOf<TAxis extends GridAxis>(
  photo: MergeSnapshot<MergeTile, HexCoord, TAxis>,
  matchId: MatchId = MATCH_ID,
): MergeState<MergeTile, HexCoord, TAxis> {
  const topology = hexTopology as unknown as GridTopology<HexCoord, TAxis>;
  const board = boardOnTopologyLike(photo.boardCopy(), topology, matchId);
  const state = new MergeState(GameStateId.of(matchId), matchId, board, photo.tileSource());
  state.restore(photo);
  return state;
}
