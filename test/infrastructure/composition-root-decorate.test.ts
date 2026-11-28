/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Clock } from '../../src/domain/engine/turn/clock';
import { ClockReading } from '../../src/domain/engine/turn/clock-reading';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { RecordingLogger } from '../support/application/recording-logger';
import { ManualClock } from '../support/engine/manual-clock';
import { repoRoot } from '../support/run-tool';

// Issue #323: the composition root gives every use case its aspects through one `decorate()`,
// and it builds one `LocalProgressRepository` for every consumer of the saved progress.

const ROOT_SOURCE = path.join(repoRoot, 'src/infrastructure/composition-root.ts');

// The use cases that the root builds today.
const USE_CASES = [
  'StartGame',
  'ApplyMove',
  'UndoMove',
  'RedoMove',
  'ListAchievements',
  'LoadProgress',
  'ListLevels',
];

// A clock that moves 7 ms forward at each reading.
class SteppingClock implements Clock {
  private ms = 1_000_000;

  now(): ClockReading {
    this.ms += 7;
    return ClockReading.of(this.ms);
  }
}

// The number of matches of `pattern` in `text`.
function countOf(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

describe('CompositionRoot decorate', () => {
  // A new aspect enters the chain in one place, so the root builds `LoggingAspect` once,
  // and it builds each use case only as the first argument of `decorate()`.
  it('should_build_every_use_case_of_the_root_inside_decorate_when_the_root_source_is_read', () => {
    const source = readFileSync(ROOT_SOURCE, 'utf8');

    const wrapped = USE_CASES.map((name) => [
      name,
      countOf(source, new RegExp(`new ${name}\\(`, 'g')),
      countOf(source, new RegExp(`decorate\\(\\s*new ${name}\\(`, 'g')),
    ]);

    expect(countOf(source, /new LoggingAspect\(/g)).toBe(1);
    expect(wrapped).toEqual(USE_CASES.map((name) => [name, 1, 1]));
  });

  it('should_log_each_use_case_under_its_own_name_when_the_root_decorates_it', async () => {
    const logger = new RecordingLogger();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      store: new InMemoryKeyValueStore(),
    });
    const { startGame, applyMove, undoMove, redoMove } = root.gameUseCases(GameId.of('hexa-lines'));

    await applyMove.execute({ move: undefined });
    await startGame.execute({});
    await undoMove.execute({});
    await redoMove.execute({});
    await root.listAchievements().execute({});
    await root.loadProgress().execute({ gameId: GameId.of('hexa-lines') });
    await root.listLevels().execute({ gameId: GameId.of('hexa-fit'), figure: TopologyId.hex });

    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['ApplyMove', 'failure'],
      ['StartGame', 'success'],
      ['UndoMove', 'failure'],
      ['RedoMove', 'failure'],
      ['ListAchievements', 'success'],
      ['LoadProgress', 'success'],
      ['ListLevels', 'success'],
    ]);
  });

  // The root gives `LoggingAspect` the clock of its drivers (issue #343).
  // `LoadProgress` reads no clock, so the aspect reads it twice: one step of 7 ms.
  it('should_log_the_duration_from_the_clock_of_its_drivers_when_the_root_decorates_a_use_case', async () => {
    const logger = new RecordingLogger();
    const root = new CompositionRoot({
      clock: new SteppingClock(),
      logger,
      store: new InMemoryKeyValueStore(),
    });

    await root.loadProgress().execute({ gameId: GameId.of('hexa-lines') });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].useCase).toBe('LoadProgress');
    expect(logger.entries[0].elapsedMs?.equals(ElapsedTime.ofMs(7))).toBe(true);
  });

  // The progress repository of the root is one object for every consumer of the saved progress.
  it('should_build_the_local_progress_repository_once_when_the_root_source_is_read', () => {
    const source = readFileSync(ROOT_SOURCE, 'utf8');

    expect(countOf(source, /new LocalProgressRepository\(/g)).toBe(1);
  });

  // A root with no local store offers no achievements: the root throws the typed error
  // of an offer that it does not have, as it does for a board figure.
  it('should_throw_a_range_error_when_a_root_with_no_store_is_asked_for_its_achievements', () => {
    const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });

    expect(() => root.listAchievements()).toThrow(RangeError);
    expect(() => root.listAchievements()).toThrow(
      'The root has no local store, so it lists no achievements.',
    );
  });
});
