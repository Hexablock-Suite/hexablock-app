/** @jest-environment node */
import { Outcome } from '../../src/domain/engine/outcome';
import type { BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { ElapsedTime } from '../../src/domain/engine/elapsed-time';
import { Moves } from '../../src/domain/engine/moves';
import { GameResult } from '../../src/domain/engine/progress-model';
import { Stars } from '../../src/domain/engine/stars';
import { Turns } from '../../src/domain/engine/turns';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { FitPlay, FitStarThreshold, fitStars } from '../../src/domain/variants/hexa-fit/fit-stars';
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

// One star threshold: at most `maxMoves` moves and at most `maxMs` milliseconds.
const star = (maxMoves: number, maxMs: number) =>
  FitStarThreshold.of({ maxMoves: Moves.of(maxMoves), maxElapsedMs: ElapsedTime.ofMs(maxMs) });

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

    expect(started.elapsedMs).toEqual(ElapsedTime.ofMs(0));
    expect(first.elapsedMs).toEqual(ElapsedTime.ofMs(0));
    expect(second.elapsedMs).toEqual(ElapsedTime.ofMs(2_000));
    expect(last.elapsedMs).toEqual(ElapsedTime.ofMs(5_000));
    expect(last.elapsedMs).toBeInstanceOf(ElapsedTime);
    expect(last.outcome).toBe(Outcome.victory);
    expect(engine.timed()?.elapsedMs()).toEqual(ElapsedTime.ofMs(5_000));
    expect(result.moves).toEqual(Moves.of(3));
    expect(result.elapsedMs).toEqual(ElapsedTime.ofMs(5_000));
    expect(
      fitStars(FitPlay.of({ moves: result.moves, elapsedMs: ElapsedTime.ofMs(5_000) }), [
        star(3, 5_000),
        star(3, 4_999),
      ]),
    ).toEqual(Stars.of(1));
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
    expect(undone.elapsedMs).toEqual(ElapsedTime.ofMs(2_000));
    expect(undone.payload.placed.map((id) => String(id))).toEqual(['a']);
    expect(replay.elapsedMs).toEqual(ElapsedTime.ofMs(3_000));
    expect(games.running().snapshot().moves).toEqual(Moves.of(2));
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
