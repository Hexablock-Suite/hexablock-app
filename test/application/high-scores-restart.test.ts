/** @jest-environment node */
import type { KeyValueStore } from '../../src/adapters/key-value-store';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { LoadProgress } from '../../src/application/progress/load-progress';
import { SaveProgress } from '../../src/application/progress/save-progress';
import { Result } from '../../src/application/result';
import { HighScoreProgress } from '../../src/domain/progress/high-score-progress';
import { GameId } from '../../src/domain/shared/game-id';
import type { GameProgress } from '../../src/domain/progress/game-progress';
import { Moves } from '../../src/domain/shared/moves';
import {
  GameResult,
  ProgressRecord,
  type IProgressModel,
} from '../../src/domain/progress/progress-model';
import { Score } from '../../src/domain/shared/score';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';

// The integration tests of APP-NFR-15 for the two games with no levels (issue #181, APP-FR-04),
// as `level-results-restart.test.ts` runs them for Fit and Sort. A high score that
// `SaveProgress` saves through the `HighScoreProgress` model of the game survives a restart:
// run 1 saves it over one store, and run 2 builds a new repository over the same store and
// reads the progress back with `LoadProgress`. The tests use `SaveProgress` directly, because
// no screen saves a result yet (#180 wires it).

// One game with no levels and its progress model, as the variant factory gives it (decision 31).
interface ScoredGame {
  readonly gameId: GameId;
  readonly model: IProgressModel;
}

const LINES: ScoredGame = { gameId: GameId.of('hexa-lines'), model: new HighScoreProgress() };
const MERGE: ScoredGame = { gameId: GameId.of('hexa-merge'), model: new HighScoreProgress() };

// The result of one finished play with `score` points. A game with no levels has no level id,
// and its record keeps no moves (decision 61), so the count is irrelevant.
function resultOf(game: ScoredGame, score: number): GameResult {
  return GameResult.of({ gameId: game.gameId, score: Score.of(score), moves: Moves.of(0) });
}

// The high-score record that the progress of `game` keeps for a play with `score` points.
function recordOf(game: ScoredGame, score: number): ProgressRecord {
  return ProgressRecord.of({ gameId: game.gameId, score: Score.of(score) });
}

// The objects of one run of the app for `game` over the device storage `store`.
// Each call builds a new repository, so a second call is a restart.
function runOf(game: ScoredGame, store: KeyValueStore) {
  const repository = new LocalProgressRepository(store);
  return {
    // Saves the result of a play with `score` points through `SaveProgress`.
    save(score: number): Promise<Result<void>> {
      return new SaveProgress(repository, game.model, game.gameId).execute(resultOf(game, score));
    },
    // Reads the saved progress of the game through `LoadProgress`.
    load(): Promise<Result<GameProgress | undefined>> {
      return new LoadProgress(repository).execute({ gameId: game.gameId });
    },
  };
}

describe('The high scores after a restart', () => {
  // The check of APP-NFR-15 for the two games that rank by their high score (S3-03, S3-16).
  it('should_read_the_saved_high_scores_of_both_games_when_the_app_restarts_after_two_results_are_saved', async () => {
    const store = new InMemoryKeyValueStore();

    const saved = [
      await runOf(LINES, store).save(36),
      await runOf(MERGE, store).save(2048),
      await runOf(LINES, store).save(20),
    ];
    const loadedLines = await runOf(LINES, store).load();
    const loadedMerge = await runOf(MERGE, store).load();

    expect(saved).toEqual([
      Result.success(undefined),
      Result.success(undefined),
      Result.success(undefined),
    ]);
    // The worse result of 20 points does not replace the high score of 36 (DS-12).
    expect(loadedLines.ok ? loadedLines.value?.keeps(recordOf(LINES, 36)) : false).toBe(true);
    expect(loadedLines.ok ? loadedLines.value?.keeps(recordOf(LINES, 20)) : true).toBe(false);
    expect(loadedMerge.ok ? loadedMerge.value?.keeps(recordOf(MERGE, 2048)) : false).toBe(true);
  });

  // A game that run 1 never played loads no progress after the restart.
  it('should_load_no_progress_when_the_restarted_app_reads_a_game_with_nothing_saved', async () => {
    const store = new InMemoryKeyValueStore();
    await runOf(LINES, store).save(36);

    const loadedMerge = await runOf(MERGE, store).load();

    expect(loadedMerge).toEqual(Result.success(undefined));
  });
});
