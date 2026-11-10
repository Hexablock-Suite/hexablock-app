/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules, type IGameRules } from '../../../src/domain/engine/rules';

// A fake rules subclass that exists only in this test. Its state is a number,
// a move is a number, and it writes the name of each step it runs.
// A `Resolution` holds no state, so `seen` keeps the state that `resolve()` and `evaluate()` get.
class RecordingRules extends BaseGameRules<number, number> {
  readonly steps: string[] = [];
  readonly seen: number[] = [];

  isValid(_state: number, move: number): boolean {
    this.steps.push('isValid');
    return move > 0;
  }

  *validMoves(): Iterable<number> {
    yield 1;
  }

  apply(state: number, move: number): number {
    this.steps.push('apply');
    return state + move;
  }

  resolve(state: number): Resolution {
    this.steps.push('resolve');
    this.seen.push(state);
    return Resolution.resolved();
  }

  evaluate(state: number): Outcome {
    this.steps.push('evaluate');
    this.seen.push(state);
    return state >= 100 ? Outcome.victory : Outcome.playing;
  }
}

// Rules whose `resolve()` refuses the move after `apply()` has changed the state.
class RejectingRules extends RecordingRules {
  override resolve(state: number): Resolution {
    this.steps.push('resolve');
    this.seen.push(state);
    return Resolution.rejected();
  }
}

describe('BaseGameRules.playTurn()', () => {
  it('should_return_the_rejected_resolution_when_resolve_rejects_after_apply', () => {
    const rules = new RejectingRules();

    const resolution = rules.playTurn(1, 2);

    expect(rules.steps).toEqual(['isValid', 'apply', 'resolve']);
    expect(resolution.accepted).toBe(false);
    expect(rules.seen).toEqual([3]);
    expect(resolution.outcome).toBe(Outcome.playing);
  });

  it('should_skip_evaluate_and_keep_playing_when_resolve_rejects_a_winning_move', () => {
    // Without the rejection, the state 201 would evaluate to 'victory'.
    const resolution = new RejectingRules().playTurn(1, 200);

    expect(resolution.accepted).toBe(false);
    expect(resolution.outcome).toBe(Outcome.playing);
  });

  it('should_call_the_four_steps_in_order_when_the_move_is_valid', () => {
    const rules = new RecordingRules();

    rules.playTurn(1, 2);

    expect(rules.steps).toEqual(['isValid', 'apply', 'resolve', 'evaluate']);
  });

  it('should_resolve_and_evaluate_the_applied_state_and_return_its_outcome_when_the_move_is_valid', () => {
    const rules = new RecordingRules();
    const resolution = rules.playTurn(5, 95);

    expect(resolution.accepted).toBe(true);
    expect(rules.seen).toEqual([100, 100]);
    expect(resolution.outcome).toBe(Outcome.victory);
  });

  it('should_stop_after_isvalid_when_the_move_is_invalid', () => {
    const rules = new RecordingRules();

    const resolution = rules.playTurn(1, -1);

    expect(rules.steps).toEqual(['isValid']);
    expect(resolution.accepted).toBe(false);
    expect(rules.seen).toEqual([]);
    expect(resolution.outcome).toBe(Outcome.playing);
  });
});

describe('IGameRules type parameters', () => {
  it('should_reject_a_cell_type_argument_when_a_reference_names_three_type_parameters', () => {
    // @ts-expect-error IGameRules takes two type parameters: the move and the state.
    const rules: IGameRules<never, number, number> = new RecordingRules();

    expect(rules.playTurn(1, 2).accepted).toBe(true);
  });
});
