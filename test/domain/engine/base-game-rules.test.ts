/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/events/outcome';
import { Resolution } from '../../../src/domain/engine/turn/resolution';
import { BaseGameRules, type IGameRules } from '../../../src/domain/engine/turn/rules';

// A fake rules subclass that exists only in this test. Its state is a number,
// a move is a number, and it writes the name of each step it runs.
// A `Resolution` holds no state, so `seen` keeps the state that `resolve()` and `evaluate()` get.
class RecordingRules extends BaseGameRules<number, number> {
  readonly steps: string[] = [];
  readonly seen: number[] = [];

  protected isValid(_state: number, move: number): boolean {
    this.steps.push('isValid');
    return move > 0;
  }

  *validMoves(): Iterable<number> {
    yield 1;
  }

  protected apply(state: number, move: number): number {
    this.steps.push('apply');
    return state + move;
  }

  protected resolve(state: number): Resolution {
    this.steps.push('resolve');
    this.seen.push(state);
    return Resolution.resolved();
  }

  protected evaluate(state: number): Outcome {
    this.steps.push('evaluate');
    this.seen.push(state);
    return state >= 100 ? Outcome.victory : Outcome.playing;
  }
}

// Rules whose `resolve()` refuses the move after `apply()` has changed the state.
class RejectingRules extends RecordingRules {
  protected override resolve(state: number): Resolution {
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
    expect(resolution.wasAccepted()).toBe(false);
    expect(rules.seen).toEqual([3]);
    expect(resolution.leadsTo()).toBe(Outcome.playing);
  });

  it('should_skip_evaluate_and_keep_playing_when_resolve_rejects_a_winning_move', () => {
    // Without the rejection, the state 201 would evaluate to 'victory'.
    const resolution = new RejectingRules().playTurn(1, 200);

    expect(resolution.wasAccepted()).toBe(false);
    expect(resolution.leadsTo()).toBe(Outcome.playing);
  });

  it('should_call_the_four_steps_in_order_when_the_move_is_valid', () => {
    const rules = new RecordingRules();

    rules.playTurn(1, 2);

    expect(rules.steps).toEqual(['isValid', 'apply', 'resolve', 'evaluate']);
  });

  it('should_resolve_and_evaluate_the_applied_state_and_return_its_outcome_when_the_move_is_valid', () => {
    const rules = new RecordingRules();
    const resolution = rules.playTurn(5, 95);

    expect(resolution.wasAccepted()).toBe(true);
    expect(rules.seen).toEqual([100, 100]);
    expect(resolution.leadsTo()).toBe(Outcome.victory);
  });

  it('should_stop_after_isvalid_when_the_move_is_invalid', () => {
    const rules = new RecordingRules();

    const resolution = rules.playTurn(1, -1);

    expect(rules.steps).toEqual(['isValid']);
    expect(resolution.wasAccepted()).toBe(false);
    expect(rules.seen).toEqual([]);
    expect(resolution.leadsTo()).toBe(Outcome.playing);
  });
});

// Issue #413: the contract keeps only the members that a caller needs (classes.md decision 21).
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.
describe('IGameRules members', () => {
  it('should_reject_at_compile_time_when_a_caller_asks_a_step_through_the_contract', () => {
    const rules: IGameRules<number, number> = new RecordingRules();
    const askSteps = () => [
      // @ts-expect-error The contract declares no isValid() (issue #413).
      rules.isValid(1, 2),
      // @ts-expect-error The contract declares no apply() (issue #413).
      rules.apply(1, 2),
      // @ts-expect-error The contract declares no resolve() (issue #413).
      rules.resolve(1),
      // @ts-expect-error The contract declares no evaluate() (issue #413).
      rules.evaluate(1),
    ];

    expect(askSteps).toBeInstanceOf(Function);
    expect(rules.playTurn(1, 2).wasAccepted()).toBe(true);
    expect([...rules.validMoves(1)]).toEqual([1]);
  });
});

describe('IGameRules type parameters', () => {
  it('should_reject_a_cell_type_argument_when_a_reference_names_three_type_parameters', () => {
    // @ts-expect-error IGameRules takes two type parameters: the move and the state.
    const rules: IGameRules<never, number, number> = new RecordingRules();

    expect(rules.playTurn(1, 2).wasAccepted()).toBe(true);
  });
});
