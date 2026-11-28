/** @jest-environment node */
import { CoordKey } from '../../../../src/domain/engine/geometry/coord-key';
import { TrayPosition } from '../../../../src/domain/variants/hexa-lines/tray-position';
import { squareTopology, square } from '../../../support/engine/square-topology';
import { delivered } from '../../../support/engine/value-receiver';

// The place of one piece in the Lines tray, from 0 (issue #232).
// A `PlacePiece` names its tray piece with it (classes.md decision 43).

const refusal = (index: number) =>
  new RangeError(`A tray index needs a whole number of 0 or more, not ${index}.`);

describe('TrayPosition', () => {
  it('should_refuse_the_index_when_it_is_not_a_safe_integer_of_zero_or_more', () => {
    for (const index of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => TrayPosition.of(index)).toThrow(refusal(index));
    }
  });

  it('should_be_equal_in_both_directions_when_two_positions_hold_the_same_index', () => {
    const first = TrayPosition.of(1);
    const second = TrayPosition.of(1);

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first)]).toEqual([true, true]);
    expect([first.equals(TrayPosition.of(2)), TrayPosition.of(2).equals(first)]).toEqual([
      false,
      false,
    ]);
    expect(TrayPosition.of(-0).equals(TrayPosition.of(0))).toBe(true);
  });

  it('should_give_the_piece_at_its_index_when_the_tray_has_one', () => {
    const tray = ['first', 'second', 'third'];

    expect(TrayPosition.of(0).pieceIn(tray)).toBe('first');
    expect(TrayPosition.of(2).pieceIn(tray)).toBe('third');
    expect(TrayPosition.of(3).pieceIn(tray)).toBeUndefined();
  });

  it('should_give_the_tray_without_its_piece_and_keep_the_tray_when_a_piece_is_taken', () => {
    const tray = ['first', 'second', 'third'];

    expect(TrayPosition.of(1).trayWithout(tray)).toEqual(['first', 'third']);
    expect(TrayPosition.of(3).trayWithout(tray)).toEqual(['first', 'second', 'third']);
    expect(tray).toEqual(['first', 'second', 'third']);
  });

  it('should_name_its_index_when_it_builds_the_error_of_a_refused_placement', () => {
    expect(TrayPosition.of(2).missingPiece()).toEqual(
      new RangeError('The tray has no piece at index 2.'),
    );
    // Issue #246: the error carries the key as its `cause`, and the edge delivers its text.
    const error = TrayPosition.of(1).misfitAt(squareTopology.key(square(2, 0)));
    expect(error).toEqual(
      new RangeError('The piece at tray index 1 does not fit at its cell.', {
        cause: CoordKey.of('2,0'),
      }),
    );
    expect(delivered(error.cause as CoordKey)).toBe('2,0');
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_index', () => {
    const readers = [
      // @ts-expect-error `TrayPosition.index` is private.
      () => TrayPosition.of(1).index,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_index', () => {
    const position = TrayPosition.of(1);

    expect(Reflect.set(position, 'index', 4)).toBe(false);
    expect(position.equals(TrayPosition.of(1))).toBe(true);
  });
});
