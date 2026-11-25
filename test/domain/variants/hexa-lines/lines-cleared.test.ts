/** @jest-environment node */
import { GameId } from '../../../../src/domain/engine/game-id';
import { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';
import { LinesCleared } from '../../../../src/domain/variants/hexa-lines/lines-cleared';
import { MATCH_ID } from '../../../support/engine/match-id';
import { square, type SquareCoord } from '../../../support/engine/square-topology';
import { linesClearedDataOf } from '../../../support/variants/hexa-lines/lines-cleared';

// The event of a Lines placement that clears lines (issue #361). A test reads it only
// through a receiver double, as a listener of the edge does.

const LINES = GameId.of('hexa-lines');

describe('LinesCleared', () => {
  it('should_deliver_the_ids_the_line_count_and_the_cleared_cells_when_a_receiver_asks', () => {
    const cells = [square(0, 0), square(1, 0), square(2, 0)];

    const data = linesClearedDataOf<SquareCoord>(
      new LinesCleared(LINES, MATCH_ID, LineCount.of(1), cells),
    );

    expect(data.gameId.equals(LINES)).toBe(true);
    expect(data.matchId.equals(MATCH_ID)).toBe(true);
    expect(data.lines.equals(LineCount.of(1))).toBe(true);
    expect(data.cells).toEqual([square(0, 0), square(1, 0), square(2, 0)]);
  });

  it('should_keep_its_cells_when_the_caller_changes_the_list_after_the_event_exists', () => {
    const cells = [square(0, 0), square(1, 0)];
    const event = new LinesCleared(LINES, MATCH_ID, LineCount.of(1), cells);

    cells.push(square(2, 0));

    expect(linesClearedDataOf<SquareCoord>(event).cells).toEqual([square(0, 0), square(1, 0)]);
  });

  it('should_throw_a_range_error_when_the_placement_cleared_no_line', () => {
    expect(() => new LinesCleared(LINES, MATCH_ID, LineCount.of(0), [])).toThrow(RangeError);
  });
});
