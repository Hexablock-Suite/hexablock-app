/** @jest-environment node */
import { GameId } from '../../../../src/domain/shared/game-id';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { TileMerged } from '../../../../src/domain/variants/hexa-merge/tile-merged';
import { MATCH_ID } from '../../../support/engine/match-id';
import { tileMergedDataOf } from '../../../support/variants/hexa-merge/tile-merged';

// The event of one merge of a Merge slide (issue #361). A test reads it only
// through a receiver double, as a listener of the edge does.

const MERGE = GameId.of('hexa-merge');

describe('TileMerged', () => {
  it('should_deliver_the_ids_and_the_made_tile_when_a_receiver_asks', () => {
    const data = tileMergedDataOf<MergeTile>(new TileMerged(MERGE, MATCH_ID, MergeTile.of(256)));

    expect(data.gameId.equals(MERGE)).toBe(true);
    expect(data.matchId.equals(MATCH_ID)).toBe(true);
    expect(data.tile.equals(MergeTile.of(256))).toBe(true);
  });
});
