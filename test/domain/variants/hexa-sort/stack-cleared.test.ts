/** @jest-environment node */
import { GameId } from '../../../../src/domain/engine/game-id';
import { StackCleared } from '../../../../src/domain/variants/hexa-sort/stack-cleared';
import { TileCount } from '../../../../src/domain/variants/hexa-sort/tile-count';
import { MATCH_ID } from '../../../support/engine/match-id';
import { square, type SquareCoord } from '../../../support/engine/square-topology';
import { stackClearedDataOf } from '../../../support/variants/hexa-sort/stack-cleared';

// The event of one stack that a Sort turn clears, one goal of the level (issue #361).
// A test reads it only through a receiver double, as a listener of the edge does.

const SORT = GameId.of('hexa-sort');

describe('StackCleared', () => {
  it('should_deliver_the_ids_the_cell_and_the_height_when_a_receiver_asks', () => {
    const data = stackClearedDataOf<SquareCoord>(
      new StackCleared(SORT, MATCH_ID, square(1, 0), TileCount.of(11)),
    );

    expect(data.gameId.equals(SORT)).toBe(true);
    expect(data.matchId.equals(MATCH_ID)).toBe(true);
    expect(data.at).toEqual(square(1, 0));
    expect(data.height.equals(TileCount.of(11))).toBe(true);
  });
});
