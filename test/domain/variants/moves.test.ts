/** @jest-environment node */
import { Turns } from '../../../src/domain/engine/turns';
import {
  PlaceFitPiece,
  RemoveFitPiece,
  RotateFitPiece,
} from '../../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../../src/domain/variants/hexa-fit/piece-id';
import { PlacePiece } from '../../../src/domain/variants/hexa-lines/place-piece';
import { Slide } from '../../../src/domain/variants/hexa-merge/slide';
import { PlaceStack } from '../../../src/domain/variants/hexa-sort/place-stack';
import { square, squareTopology } from '../../support/engine/square-topology';

// Issue #205, classes.md decision 43: every move of the four variants is a value object.
// Two moves with the same parts are the same move, and a move keeps its parts private.
// Each factory makes a new object, so an `equals` that compares instances gives
// `DIFFERENT` for two equal moves.

const EQUAL = [true, true];
const DIFFERENT = [false, false];

const A = PieceId.of('a');
const B = PieceId.of('b');

describe('equals of the moves', () => {
  it('should_be_equal_only_when_two_lines_placements_hold_the_same_tray_index_and_offset', () => {
    const same = (left: PlacePiece<unknown>, right: PlacePiece<unknown>) => [
      left.equals(right, squareTopology),
      right.equals(left, squareTopology),
    ];
    const move = new PlacePiece(1, square(2, 0));

    expect(same(move, new PlacePiece(1, square(2, 0)))).toEqual(EQUAL);
    expect(same(move, new PlacePiece(0, square(2, 0)))).toEqual(DIFFERENT);
    expect(same(move, new PlacePiece(1, square(0, 2)))).toEqual(DIFFERENT);
  });

  it('should_be_equal_only_when_two_slides_hold_the_same_axis_and_sense', () => {
    const same = (left: Slide<string>, right: Slide<string>) => [
      left.equals(right),
      right.equals(left),
    ];
    const slide = Slide.of('row', 'forward');

    expect(same(slide, Slide.of('row', 'forward'))).toEqual(EQUAL);
    expect(same(slide, Slide.of('column', 'forward'))).toEqual(DIFFERENT);
    expect(same(slide, Slide.of('row', 'backward'))).toEqual(DIFFERENT);
  });

  it('should_be_equal_only_when_two_fit_placements_hold_the_same_piece_rotation_and_offset', () => {
    const same = (left: PlaceFitPiece<unknown>, right: PlaceFitPiece<unknown>) => [
      left.equals(right, squareTopology),
      right.equals(left, squareTopology),
    ];
    const move = new PlaceFitPiece(A, Turns.of(1), square(0, 1));

    expect(same(move, new PlaceFitPiece(PieceId.of('a'), Turns.of(1), square(0, 1)))).toEqual(
      EQUAL,
    );
    expect(same(move, new PlaceFitPiece(B, Turns.of(1), square(0, 1)))).toEqual(DIFFERENT);
    expect(same(move, new PlaceFitPiece(A, Turns.of(2), square(0, 1)))).toEqual(DIFFERENT);
    expect(same(move, new PlaceFitPiece(A, Turns.of(1), square(1, 0)))).toEqual(DIFFERENT);
  });

  it('should_be_equal_only_when_two_fit_removals_name_the_same_piece', () => {
    const same = (left: RemoveFitPiece, right: RemoveFitPiece) => [
      left.equals(right),
      right.equals(left),
    ];

    expect(same(new RemoveFitPiece(A), new RemoveFitPiece(PieceId.of('a')))).toEqual(EQUAL);
    expect(same(new RemoveFitPiece(A), new RemoveFitPiece(B))).toEqual(DIFFERENT);
  });

  it('should_be_equal_only_when_two_fit_rotations_hold_the_same_piece_and_steps', () => {
    const same = (left: RotateFitPiece, right: RotateFitPiece) => [
      left.equals(right),
      right.equals(left),
    ];
    const move = new RotateFitPiece(A, Turns.of(1));

    expect(same(move, new RotateFitPiece(PieceId.of('a'), Turns.of(1)))).toEqual(EQUAL);
    expect(same(move, new RotateFitPiece(B, Turns.of(1)))).toEqual(DIFFERENT);
    expect(same(move, new RotateFitPiece(A, Turns.of(3)))).toEqual(DIFFERENT);
  });

  it('should_differ_when_two_fit_moves_of_two_kinds_name_the_same_piece', () => {
    const place = new PlaceFitPiece(A, Turns.of(1), square(0, 0));
    const remove = new RemoveFitPiece(A);
    const rotate = new RotateFitPiece(A, Turns.of(1));

    expect([
      place.equals(remove, squareTopology),
      place.equals(rotate, squareTopology),
      remove.equals(place),
      remove.equals(rotate),
      rotate.equals(place),
      rotate.equals(remove),
    ]).toEqual([false, false, false, false, false, false]);
  });

  it('should_be_equal_only_when_two_sort_placements_name_the_same_cell', () => {
    const same = (left: PlaceStack<unknown>, right: PlaceStack<unknown>) => [
      left.equals(right, squareTopology),
      right.equals(left, squareTopology),
    ];

    expect(same(PlaceStack.on(square(1, 2)), PlaceStack.on(square(1, 2)))).toEqual(EQUAL);
    expect(same(PlaceStack.on(square(1, 2)), PlaceStack.on(square(2, 1)))).toEqual(DIFFERENT);
  });
});

describe('the tray index of a Lines placement', () => {
  it('should_throw_a_range_error_when_the_tray_index_is_negative_decimal_or_not_a_number', () => {
    for (const index of [-1, 0.5, Number.NaN]) {
      expect(() => new PlacePiece(index, square(0, 0))).toThrow(
        new RangeError(`A tray index needs a whole number of 0 or more, not ${index}.`),
      );
    }
  });

  it('should_throw_a_range_error_when_the_tray_index_is_infinite_or_past_the_safe_integers', () => {
    for (const index of [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => new PlacePiece(index, square(0, 0))).toThrow(
        new RangeError(`A tray index needs a whole number of 0 or more, not ${index}.`),
      );
    }
  });

  it('should_build_the_move_when_the_tray_index_is_a_whole_number_of_0_or_more', () => {
    const tray = ['first', 'second', 'third'];

    expect(new PlacePiece(0, square(0, 0)).pieceIn(tray)).toBe('first');
    expect(new PlacePiece(2, square(0, 0)).pieceIn(tray)).toBe('third');
    expect(new PlacePiece(3, square(0, 0)).pieceIn(tray)).toBeUndefined();
  });
});

// The class of 2026-11-09: the attributes of a value object are private.
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.
describe('private fields of the moves', () => {
  it('should_reject_at_compile_time_when_a_caller_reads_a_field_of_a_move', () => {
    const placePiece = new PlacePiece(0, square(0, 0));
    const slide = Slide.of('row', 'forward');
    const placeFit = new PlaceFitPiece(A, Turns.of(0), square(0, 0));
    const removeFit = new RemoveFitPiece(A);
    const rotateFit = new RotateFitPiece(A, Turns.of(1));
    const placeStack = PlaceStack.on(square(0, 0));
    const readers = [
      // @ts-expect-error `PlacePiece.trayIndex` is private.
      () => placePiece.trayIndex,
      // @ts-expect-error `PlacePiece.at` is private.
      () => placePiece.at,
      // @ts-expect-error `Slide.axis` is private.
      () => slide.axis,
      // @ts-expect-error `Slide.toward` is private.
      () => slide.toward,
      // @ts-expect-error `PlaceFitPiece.pieceId` is private.
      () => placeFit.pieceId,
      // @ts-expect-error `PlaceFitPiece.rotation` is private.
      () => placeFit.rotation,
      // @ts-expect-error `PlaceFitPiece.at` is private.
      () => placeFit.at,
      // @ts-expect-error `RemoveFitPiece.pieceId` is private.
      () => removeFit.pieceId,
      // @ts-expect-error `RotateFitPiece.pieceId` is private.
      () => rotateFit.pieceId,
      // @ts-expect-error `RotateFitPiece.steps` is private.
      () => rotateFit.steps,
      // @ts-expect-error `PlaceStack.at` is private.
      () => placeStack.at,
    ];

    expect(readers).toHaveLength(11);
  });

  it('should_reject_at_compile_time_when_a_caller_builds_a_sort_placement_as_a_literal', () => {
    // @ts-expect-error `PlaceStack` is a class with a private field, so a literal is not a move.
    const literal: PlaceStack<unknown> = { at: square(0, 0) };

    expect(literal).not.toBeInstanceOf(PlaceStack);
  });

  it('should_reject_at_compile_time_when_a_caller_reads_the_kind_of_a_fit_move', () => {
    const readers = [
      // @ts-expect-error A Fit move has no `kind` field. The class tells the moves apart.
      () => new RemoveFitPiece(A).kind,
    ];

    expect(readers).toHaveLength(1);
  });
});
