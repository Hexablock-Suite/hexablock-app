/** @jest-environment node */
import { AchievementCounters } from '../../../../src/domain/achievements/achievement-counters';
import { GameId } from '../../../../src/domain/shared/game-id';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { TileMerged } from '../../../../src/domain/variants/hexa-merge/tile-merged';
import { countsOf } from '../../../support/engine/counters-content';
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

  // Issue #406: the value of the made tile is a best count, the highest tile.
  it('should_keep_the_tile_value_as_the_best_count_when_the_event_records_in_the_counters', () => {
    const counters = AchievementCounters.start(MERGE);

    new TileMerged(MERGE, MATCH_ID, MergeTile.of(256)).recordIn(counters);
    new TileMerged(MERGE, MATCH_ID, MergeTile.of(8)).recordIn(counters);

    expect(countsOf(counters)).toEqual({ best: 256, total: 0 });
  });
});
