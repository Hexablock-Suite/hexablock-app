/** @jest-environment node */
import { ApplyMove } from '../../src/application/apply-move';
import { GameId } from '../../src/domain/shared/game-id';
import { hex, HexAxis } from '../../src/domain/engine/hex-topology';
import { LineCount } from '../../src/domain/variants/hexa-lines/line-count';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import { Slide, SlideSense } from '../../src/domain/variants/hexa-merge/slide';
import { TileCount } from '../../src/domain/variants/hexa-sort/tile-count';
import { MemoryGameRepository, valueOf, errorOf } from '../support/application/game-use-cases';
import { RecordingPublisher } from '../support/application/recording-publisher';
import { dataOf } from '../support/engine/game-over';
import { MATCH_ID } from '../support/engine/match-id';
import { square, squareTopology, type SquareCoord } from '../support/engine/square-topology';
import { delivered } from '../support/engine/value-receiver';
import { linesClearedDataOf } from '../support/variants/hexa-lines/lines-cleared';
import { linesGame, linesState, piece } from '../support/variants/hexa-lines/lines-game';
import { mergeGame, mergeState } from '../support/variants/hexa-merge/merge-game';
import { tileMergedDataOf } from '../support/variants/hexa-merge/tile-merged';
import {
  place,
  row,
  sortGame,
  sortState,
  stack,
  tiles,
} from '../support/variants/hexa-sort/sort-game';
import { stackClearedDataOf } from '../support/variants/hexa-sort/stack-cleared';

// The events of a move (issue #361, part 1 of #277). Each test plays one move of a game
// through the real engine and `ApplyMove`, and a `RecordingPublisher` gets the events.
// A test reads an event only through a receiver double, as a listener of the edge does.

// The `ApplyMove` of one running engine, with a publisher that keeps each event.
function applyMoveOf<TEngine>(engine: TEngine) {
  // The repository double is generic over the engine, so the test passes the types through it.
  const games = new MemoryGameRepository();
  games.replace(engine as never);
  const publisher = new RecordingPublisher();
  return { applyMove: new ApplyMove(games, publisher), publisher };
}

function keys(cells: readonly SquareCoord[]): string[] {
  return cells.map((c) => delivered(squareTopology.key(c))).sort();
}

// A 3 × 3 square board where a piece of two cells on (0, 0) and (1, 0) fills
// the row 0 and the columns 0 and 1. The row 1, the row 2 and the column 2 stay open.
function threeLineGame() {
  return linesGame(
    linesState(squareTopology, 3, {
      filled: [square(2, 0), square(0, 1), square(1, 1), square(0, 2), square(1, 2)],
      tray: [piece(square(0, 0), square(1, 0)), piece(square(0, 0))],
    }),
  ).engine;
}

describe('ApplyMove events of a move', () => {
  it('should_deliver_one_lines_cleared_of_3_lines_when_a_lines_placement_clears_3_lines', async () => {
    const { applyMove, publisher } = applyMoveOf(threeLineGame());

    valueOf(await applyMove.execute({ move: new PlacePiece(TrayPosition.of(0), square(0, 0)) }));

    expect(publisher.events).toHaveLength(1);
    const data = linesClearedDataOf<SquareCoord>(publisher.events[0]);
    expect(data.gameId.equals(GameId.of('hexa-lines'))).toBe(true);
    expect(data.matchId.equals(MATCH_ID)).toBe(true);
    expect(data.lines.equals(LineCount.of(3))).toBe(true);
    expect(keys(data.cells)).toEqual(
      keys([
        square(0, 0),
        square(1, 0),
        square(2, 0),
        square(0, 1),
        square(0, 2),
        square(1, 1),
        square(1, 2),
      ]),
    );
  });

  it('should_deliver_one_tile_merged_of_the_made_tile_when_a_merge_slide_merges_two_tiles', async () => {
    const { engine } = mergeGame(
      mergeState(
        [
          [hex(-2, 0), 2],
          [hex(0, 0), 2],
        ],
        3,
      ),
    );
    const { applyMove, publisher } = applyMoveOf(engine);

    valueOf(await applyMove.execute({ move: Slide.of(HexAxis.q, SlideSense.forward) }));

    expect(publisher.events).toHaveLength(1);
    const data = tileMergedDataOf<MergeTile>(publisher.events[0]);
    expect(data.gameId.equals(GameId.of('hexa-merge'))).toBe(true);
    expect(data.matchId.equals(MATCH_ID)).toBe(true);
    expect(data.tile.equals(MergeTile.of(4))).toBe(true);
  });

  it('should_deliver_one_stack_cleared_with_its_cell_and_height_when_a_sort_turn_clears_a_stack', async () => {
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack('green', ...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 4)), stack('blue')],
      }),
    );
    const { applyMove, publisher } = applyMoveOf(game);

    valueOf(await applyMove.execute({ move: place(1) }));

    expect(publisher.events).toHaveLength(1);
    const data = stackClearedDataOf<SquareCoord>(publisher.events[0]);
    expect(data.gameId.equals(GameId.of('hexa-sort'))).toBe(true);
    expect(data.matchId.equals(MATCH_ID)).toBe(true);
    expect(data.at).toEqual(square(0, 0));
    expect(data.height.equals(TileCount.of(11))).toBe(true);
  });

  it('should_deliver_the_events_of_the_move_before_the_game_over_when_the_move_ends_the_game', async () => {
    const game = sortGame(
      sortState({
        board: row(3, [[square(0, 0), stack(...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 4)), stack('blue')],
        goalsNeeded: 1,
      }),
    );
    const { applyMove, publisher } = applyMoveOf(game);

    valueOf(await applyMove.execute({ move: place(1) }));

    expect(publisher.events).toHaveLength(2);
    expect(
      stackClearedDataOf<SquareCoord>(publisher.events[0]).height.equals(TileCount.of(10)),
    ).toBe(true);
    expect(dataOf(publisher.events[1]).gameId.equals(GameId.of('hexa-sort'))).toBe(true);
  });

  it('should_deliver_no_new_event_when_the_rules_reject_the_next_move', async () => {
    const { applyMove, publisher } = applyMoveOf(threeLineGame());
    valueOf(await applyMove.execute({ move: new PlacePiece(TrayPosition.of(0), square(0, 0)) }));
    const afterFirst = [...publisher.events];

    // The first placement took the piece of two cells, so the tray holds one piece.
    // No piece is at the tray position 1.
    const rejected = await applyMove.execute({
      move: new PlacePiece(TrayPosition.of(1), square(2, 2)),
    });

    expect(errorOf(rejected).code).toBe('move-rejected');
    expect(afterFirst).toHaveLength(1);
    expect(publisher.events).toEqual(afterFirst);
  });
});
