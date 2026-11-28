/** @jest-environment node */
import { Outcome } from '../../src/domain/engine/events/outcome';
import type { BoardState } from '../../src/domain/engine/board/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { GameResult } from '../../src/domain/progress/progress-model';
import { starsOf } from '../../src/domain/progress/star-count';
import { Stars } from '../../src/domain/progress/stars';
import { Turns } from '../../src/domain/engine/geometry/turns';
import type { IVariantFactory } from '../../src/domain/engine/factory/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { FitPlay, FitStarThreshold } from '../../src/domain/variants/hexa-fit/fit-stars';
import { gameUseCases, valueOf } from '../support/application/game-use-cases';
import { ManualClock } from '../support/engine/manual-clock';
import { delivered } from '../support/engine/value-receiver';
import { square } from '../support/engine/square-topology';
import { firstMoveOf } from '../support/engine/variant-game';
import { A, B, C, threeDominoFitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';
import { fitViewData } from '../support/variants/view-data';

// The time of a Hexa Fit level reaches the use cases and `GameResult` (issue 157, DS-5, DS-6).
// The path: `TimedRulesDecorator`, `GameEngine.elapsedTime()` and `MoveResult.elapsedMs`.

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
    const { clock, started, games, applyMove } = await fitLevel();
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
      gameId: GameId.of('hexa-fit'),
      score: last.score,
      moves: state.moveCount(),
      elapsedMs: last.elapsedMs,
    });

    expect(started.elapsedMs).toEqual(ElapsedTime.ofMs(0));
    expect(first.elapsedMs).toEqual(ElapsedTime.ofMs(0));
    expect(second.elapsedMs).toEqual(ElapsedTime.ofMs(2_000));
    expect(last.elapsedMs).toEqual(ElapsedTime.ofMs(5_000));
    expect(last.elapsedMs).toBeInstanceOf(ElapsedTime);
    expect(last.outcome).toBe(Outcome.victory);
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(5_000));
    // The fields of a result are private (issue #240), so the test compares the result.
    expect(
      result.equals(
        GameResult.of({
          gameId: GameId.of('hexa-fit'),
          score: last.score,
          moves: Moves.of(3),
          elapsedMs: ElapsedTime.ofMs(5_000),
        }),
      ),
    ).toBe(true);
    expect(
      starsOf(FitPlay.of({ moves: Moves.of(3), elapsedMs: ElapsedTime.ofMs(5_000) }), [
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
    expect(fitViewData(undone.payload).placed.map((id) => delivered(id))).toEqual(['a']);
    expect(replay.elapsedMs).toEqual(ElapsedTime.ofMs(3_000));
    expect(games.running().snapshot().moveCount()).toEqual(Moves.of(2));
  });

  it('should_give_no_elapsed_ms_field_when_the_variant_has_no_timer', async () => {
    const runs = [await firstTurnFields(linesFactory()), await firstTurnFields(mergeFactory())];

    for (const fields of runs) {
      expect(fields).not.toContain('elapsedMs');
    }
  });
});

// Issue #46: the backend asks for the time of each level result (DS-5), so Sort times its levels
// with `LevelTimer`, as Fit does. Sort gives no star by time (D22).
describe('The time of a Sort level', () => {
  it('should_give_the_elapsed_ms_of_the_play_when_a_fake_clock_times_a_sort_level', async () => {
    const clock = new ManualClock();
    const factory = sortFactory(undefined, undefined, clock);
    const { startGame, applyMove, games } = gameUseCases(factory);
    const started = valueOf(await startGame.execute({}));
    // The time before the first turn does not count.
    clock.advance(9_000);

    const played = valueOf(await applyMove.execute({ move: firstMoveOf(factory) }));
    clock.advance(4_000);

    expect(started.elapsedMs).toEqual(ElapsedTime.ofMs(0));
    expect(played.elapsedMs).toEqual(ElapsedTime.ofMs(0));
    expect(games.running().elapsedTime()).toEqual(ElapsedTime.ofMs(4_000));
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
