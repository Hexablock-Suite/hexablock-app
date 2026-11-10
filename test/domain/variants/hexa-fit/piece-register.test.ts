/** @jest-environment node */
import { Turns } from '../../../../src/domain/engine/turns';
import { PlaceFitPiece, RemoveFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { PieceRegister } from '../../../../src/domain/variants/hexa-fit/piece-register';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';
import { MATCH_ID } from '../../../support/engine/match-id';
import { square } from '../../../support/engine/square-topology';
import { A, B, C, threeDominoFitFactory } from '../../../support/variants/hexa-fit/fit-game';

// Issue #211 (classes.md decision 49): `FitState` keeps its pieces and its placements
// in a collection that finds an entry by `PieceId.equals()`, not by the text of the id.

describe('PieceRegister', () => {
  it('should_find_the_entry_when_the_id_is_an_equal_id_that_is_another_object', () => {
    const register = PieceRegister.empty<string>().with(A, 'first');

    expect(PieceId.of('a')).not.toBe(A);
    expect(register.find(PieceId.of('a'))).toBe('first');
    expect(register.has(PieceId.of('a'))).toBe(true);
  });

  it('should_find_no_entry_when_the_register_does_not_hold_the_id', () => {
    const register = PieceRegister.empty<string>().with(A, 'first');

    expect(register.find(B)).toBeUndefined();
    expect(register.has(B)).toBe(false);
    expect(PieceRegister.empty<string>().entries()).toEqual([]);
  });

  // An id that the register holds keeps its place and takes the new entry.
  it('should_keep_the_place_of_the_id_when_an_equal_id_takes_a_new_entry', () => {
    const register = PieceRegister.empty<string>().with(A, 'first').with(B, 'second');
    const again = PieceId.of('a');

    const next = register.with(again, 'third');

    expect(next.entries()).toEqual([
      [A, 'third'],
      [B, 'second'],
    ]);
    expect(next.entries()[0]?.[0]).toBe(again);
  });

  it('should_put_the_id_at_the_end_when_it_comes_back_after_it_left_the_register', () => {
    const register = PieceRegister.empty<string>().with(A, 'first').with(B, 'second');

    const next = register.without(PieceId.of('a')).with(A, 'again');

    expect(next.entries()).toEqual([
      [B, 'second'],
      [A, 'again'],
    ]);
  });

  it('should_give_an_equal_register_when_it_drops_an_id_that_it_does_not_hold', () => {
    const register = PieceRegister.empty<string>().with(A, 'first');

    const next = register.without(C);

    expect(next.entries()).toEqual([[A, 'first']]);
    expect(next.equals(register, (left, right) => left === right)).toBe(true);
  });

  // A register is a value object: `with()` and `without()` give a new register.
  it('should_keep_its_entries_when_a_new_register_is_made_from_it', () => {
    const register = PieceRegister.empty<string>().with(A, 'first');

    register.with(B, 'second');
    register.with(A, 'changed');
    register.without(A);

    expect(register.entries()).toEqual([[A, 'first']]);
    expect(Object.isFrozen(register)).toBe(true);
  });

  it('should_keep_its_entries_when_a_caller_changes_the_list_or_a_pair_that_it_gave', () => {
    const register = PieceRegister.empty<string>().with(A, 'first');
    const given = register.entries();

    given[0]![1] = 'changed';
    given.pop();

    expect(register.entries()).toEqual([[A, 'first']]);
  });

  it('should_be_equal_only_when_two_registers_hold_equal_ids_in_one_order_with_equal_entries', () => {
    const same = (left: string, right: string) => left === right;
    const register = PieceRegister.empty<string>().with(A, 'first').with(B, 'second');
    const twin = PieceRegister.empty<string>()
      .with(PieceId.of('a'), 'first')
      .with(PieceId.of('b'), 'second');
    const otherOrder = PieceRegister.empty<string>().with(B, 'second').with(A, 'first');
    const otherEntry = register.with(B, 'third');
    const shorter = register.without(B);

    expect([register.equals(twin, same), twin.equals(register, same)]).toEqual([true, true]);
    expect([
      register.equals(otherOrder, same),
      register.equals(otherEntry, same),
      register.equals(shorter, same),
      shorter.equals(register, same),
    ]).toEqual([false, false, false, false]);
    expect(PieceRegister.empty<string>().equals(PieceRegister.empty<string>(), same)).toBe(true);
  });
});

// The move of a player names its piece with a new `PieceId` object.
describe('a Fit game with an equal piece id that is another object', () => {
  it('should_find_place_and_remove_the_piece_when_the_move_names_it_with_another_id_object', () => {
    const factory = threeDominoFitFactory();
    const rules = factory.createRules();
    const state = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const other = PieceId.of('b');
    const place = new PlaceFitPiece(other, Turns.of(0), square(2, 0));

    expect(other).not.toBe(B);
    expect(state.piece(other)).toBe(state.piece(B));
    expect(rules.isValid(state, place)).toBe(true);

    rules.apply(state, place);

    expect(state.placementOf(PieceId.of('b'))).toBeDefined();
    expect(state.placed()).toEqual([B]);
    expect(state.remaining().map((piece) => String(piece.cell()))).toEqual(['a', 'c']);
    expect(state.snapshot().placements.map(([id]) => String(id))).toEqual(['b']);

    rules.apply(state, new RemoveFitPiece(PieceId.of('b')));

    expect(state.placed()).toEqual([]);
    expect(state.placementOf(B)).toBeUndefined();
    expect(state.snapshot().board.cells()).toEqual([]);
  });
});
