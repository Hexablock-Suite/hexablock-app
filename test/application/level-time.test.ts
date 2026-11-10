/** @jest-environment node */
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { GameResult } from '../../src/domain/engine/progress-model';
import { Turns } from '../../src/domain/engine/turns';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { fitStars } from '../../src/domain/variants/hexa-fit/fit-stars';
import { gameUseCases, valueOf } from '../support/application/game-use-cases';
import { ManualClock } from '../support/engine/manual-clock';
import { square } from '../support/engine/square-topology';
import { firstMoveOf } from '../support/engine/variant-game';
import { A, B, C, threeDominoFitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';

// The time of a Hexa Fit level reaches the use cases and `GameResult` (issue 157, DS-5, DS-6).
// The path: `TimedRulesDecorator`, `GameEngine.timed()` and `MoveResult.elapsedMs`.

const placeA = new PlaceFitPiece(A, Turns.of(0), square(0, 0));
const placeB = new PlaceFitPiece(B, Turns.of(0), square(2, 0));
const placeC = new PlaceFitPiece(C, Turns.of(0), square(4, 0));

async function fitLevel() {
  const clock = new ManualClock();
  const factory = threeDominoFitFactory(clock);
  const useCases = gameUseCases(factory);
  const started = valueOf(await useCases.startGame.execute({}));
  return { clock, factory, started, ...useCases };
}

describe('The time of a Fit level', () => {
  it('should_give_the_expected_elapsed_ms_and_game_result_when_a_fake_clock_times_a_fit_level', async () => {
    const { clock, factory, started, games, applyMove } = await fitLevel();
    // The time before the first turn does not count.
    clock.advance(9_000);

    const first = valueOf(await applyMove.execute({ move: placeA }));
    clock.advance(2_000);
    const second = valueOf(await applyMove.execute({ move: placeB }));
    clock.advance(3_000);
    const last = valueOf(await applyMove.execute({ move: placeC }));
    clock.advance(60_000);
    const engine = games.running();
    const state = engine.snapshot();
    const result = GameResult.of({
      gameId: factory.gameId,
      score: last.score,
      moves: state.moves,
      elapsedMs: last.elapsedMs,
    });

    expect(started.elapsedMs).toBe(0);
    expect(first.elapsedMs).toBe(0);
    expect(second.elapsedMs).toBe(2_000);
    expect(last.elapsedMs).toBe(5_000);
    expect(last.outcome).toBe('victory');
    expect(engine.timed()?.elapsedMs()).toBe(5_000);
    expect(result.moves).toBe(3);
    expect(result.elapsedMs).toBe(5_000);
    expect(
      fitStars({ moves: result.moves, elapsedMs: 5_000 }, [
        { maxMoves: 3, maxElapsedMs: 5_000 },
        { maxMoves: 3, maxElapsedMs: 4_999 },
      ]),
    ).toBe(1);
  });

  it('should_keep_the_clock_running_when_a_move_is_undone', async () => {
    const { clock, games, applyMove, undoMove } = await fitLevel();
    valueOf(await applyMove.execute({ move: placeA }));
    clock.advance(1_000);
    valueOf(await applyMove.execute({ move: placeB }));
    clock.advance(1_000);

    const undone = valueOf(await undoMove.execute({}));
    clock.advance(1_000);
    const replay = valueOf(await applyMove.execute({ move: placeB }));

    // The undo takes the move back and leaves the time.
    expect(undone.elapsedMs).toBe(2_000);
    expect(undone.payload.placed.map((id) => id.value)).toEqual(['a']);
    expect(replay.elapsedMs).toBe(3_000);
    expect(games.running().snapshot().moves).toBe(2);
  });

  it('should_give_no_elapsed_ms_field_when_the_variant_has_no_timer', async () => {
    const runs = [
      await firstTurnFields(linesFactory()),
      await firstTurnFields(sortFactory()),
      await firstTurnFields(mergeFactory()),
    ];

    for (const fields of runs) {
      expect(fields).not.toContain('elapsedMs');
    }
  });
});

// The field names of the responses of `StartGame` and of one played move.
async function firstTurnFields<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>): Promise<string[]> {
  const { startGame, applyMove } = gameUseCases(factory);
  const started = valueOf(await startGame.execute({}));
  const move = firstMoveOf(factory);
  const played = valueOf(await applyMove.execute({ move }));
  return [...Object.keys(started), ...Object.keys(played)];
}
