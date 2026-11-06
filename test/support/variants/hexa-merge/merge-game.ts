import { Board } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import {
  FixedListPieceSource,
  type IPieceSource,
} from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { MergeRules } from '../../../../src/domain/variants/hexa-merge/merge-rules';
import { MergeState } from '../../../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import type { NewTile } from '../../../../src/domain/variants/hexa-merge/new-tile';
import type { Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import { RecordingPublisher } from '../../engine/fake-game';
import { hexTopology, type HexAxis, type HexCoord } from './hex-topology';

// The Merge game for the rules tests, on the hexagonal double.
// The Merge scoring is issue #97, so the tests score no points.

export type HexMergeState = MergeState<MergeTile, HexCoord, HexAxis>;

export class NoPointScoring implements IScoringPolicy<HexMergeState> {
  score(): number {
    return 0;
  }
}

// A source that has ended, so no new tile appears after a slide.
// The tests of the slide itself use it, so they see only what the slide does.
export function noNewTiles(): IPieceSource<NewTile<MergeTile>> {
  return new FixedListPieceSource<NewTile<MergeTile>>([]);
}

// A hexagon of `size` rings with a tile of each given value at its coordinate.
export function mergeState(
  tiles: readonly [HexCoord, number][],
  size = 2,
  source: IPieceSource<NewTile<MergeTile>> = noNewTiles(),
): HexMergeState {
  const board = new Board<MergeTile, HexCoord, HexAxis>(
    hexTopology.region(RegionSize.of(size)),
    hexTopology,
  );
  for (const [at, value] of tiles) board.set(at, MergeTile.of(value));
  return new MergeState(board, source);
}

// The value of each filled cell, by the topology key of its coordinate.
export function values(state: HexMergeState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [at, tile] of state.board.cells()) out[hexTopology.key(at)] = tile.value;
  return out;
}

export function mergeGame(initial: HexMergeState, target = MergeTile.of(2048)) {
  const rules = new MergeRules<MergeTile, HexCoord, HexAxis>(target);
  const publisher = new RecordingPublisher();
  const engine = new GameEngine<MergeTile, HexCoord, Slide<HexAxis>, HexMergeState>(
    GameId.of('hexa-merge'),
    rules,
    new NoPointScoring(),
    publisher,
  );
  engine.start(initial);
  return { engine, rules, publisher };
}
