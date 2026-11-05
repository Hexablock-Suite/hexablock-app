/** @jest-environment node */
import type { Outcome } from '../../../src/domain/engine/outcome';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules, type IGameRules } from '../../../src/domain/engine/rules';

// A fake rules subclass that exists only in this test. Its state is a number,
// a move is a number, and it writes the name of each step it runs.
class RecordingRules extends BaseGameRules<number, number> {
  readonly steps: string[] = [];

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

  resolve(state: number): Resolution<number> {
    this.steps.push('resolve');
    return Resolution.resolved(state * 10);
  }

  evaluate(state: number): Outcome {
    this.steps.push('evaluate');
    return state >= 100 ? 'victory' : 'playing';
  }
}

describe('BaseGameRules.playTurn()', () => {
  it('should_call_the_four_steps_in_order_when_the_move_is_valid', () => {
    const rules = new RecordingRules();

    rules.playTurn(1, 2);

    expect(rules.steps).toEqual(['isValid', 'apply', 'resolve', 'evaluate']);
  });

  it('should_return_the_resolved_state_and_its_outcome_when_the_move_is_valid', () => {
    const resolution = new RecordingRules().playTurn(5, 5);

    expect(resolution.accepted).toBe(true);
    expect(resolution.state).toBe(100);
    expect(resolution.outcome).toBe('victory');
  });

  it('should_stop_after_isvalid_when_the_move_is_invalid', () => {
    const rules = new RecordingRules();

    const resolution = rules.playTurn(1, -1);

    expect(rules.steps).toEqual(['isValid']);
    expect(resolution.accepted).toBe(false);
    expect(resolution.state).toBe(1);
    expect(resolution.outcome).toBe('playing');
  });
});

describe('IGameRules type parameters', () => {
  it('should_reject_a_cell_type_argument_when_a_reference_names_three_type_parameters', () => {
    // @ts-expect-error IGameRules takes two type parameters: the move and the state.
    const rules: IGameRules<never, number, number> = new RecordingRules();

    expect(rules.playTurn(1, 2).accepted).toBe(true);
  });
});
