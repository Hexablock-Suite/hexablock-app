/** @jest-environment node */
import { GamePresenter } from '../../src/adapters/game-presenter';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import type { MoveResult } from '../../src/application/move-result';
import { Result } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { Outcome } from '../../src/domain/engine/events/outcome';
import { Score } from '../../src/domain/shared/score';

// Issue #180: the end of a game reaches `ResultPresenter`. `GamePresenter` gives the response
// of the move that ends the game to its end listener, and it gives no other response.

type Answer = Result<MoveResult<string, string, number>>;

// A port that answers each call with the next answer of its list.
function scripted<TRequest>(
  answers: Answer[],
): UseCase<TRequest, MoveResult<string, string, number>> {
  return {
    execute: async () => {
      const next = answers.shift();
      if (next === undefined) throw new RangeError('The script has no more answers.');
      return next;
    },
  };
}

function answer(outcome: Outcome, score: number): Answer {
  return Result.success({
    cells: [],
    freeSpaces: [],
    score: Score.of(score),
    outcome,
    canUndo: false,
    canRedo: false,
    hasUndo: false,
    payload: 0,
  });
}

// A presenter whose `ApplyMove` answers `moves`, with an end listener that keeps each response.
function presenterWith(moves: Answer[]) {
  const ended: MoveResult<unknown, unknown>[] = [];
  const presenter = new GamePresenter(
    scripted([answer(Outcome.playing, 0)]),
    scripted(moves),
    scripted([]),
    scripted([]),
    { toView: (cell: string) => cell, freeView: () => 'free', toPayload: (count: number) => count },
    { toMove: (intent: string) => intent },
    textCatalog.es,
    { onFinish: async (response) => void ended.push(response) },
  );
  return { presenter, ended };
}

describe('GamePresenter end of a game', () => {
  it('should_give_the_final_response_to_the_end_listener_when_a_move_ends_the_game', async () => {
    const final = answer(Outcome.gameOver, 30);
    const { presenter, ended } = presenterWith([answer(Outcome.playing, 10), final]);
    await presenter.onStart();

    await presenter.onMove('first');
    await presenter.onMove('last');

    expect(ended).toEqual([final.ok ? final.value : undefined]);
    expect(presenter.viewModel().outcome).toBe('Fin del juego');
  });

  it('should_give_nothing_to_the_end_listener_when_the_move_keeps_the_game_playing', async () => {
    const { presenter, ended } = presenterWith([answer(Outcome.playing, 10)]);
    await presenter.onStart();

    await presenter.onMove('first');

    expect(ended).toEqual([]);
  });
});
