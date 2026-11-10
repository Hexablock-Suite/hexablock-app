import {
  GameOverPhase,
  PausedPhase,
  PlayingPhase,
  ResolvingPhase,
  VictoryPhase,
  type GamePhase,
} from '../../../src/domain/engine/game-phase';

const PHASE_NAMES = new Map<GamePhase, string>([
  [PlayingPhase.instance, 'playing'],
  [ResolvingPhase.instance, 'resolving'],
  [PausedPhase.instance, 'paused'],
  [GameOverPhase.instance, 'game-over'],
  [VictoryPhase.instance, 'victory'],
]);

// The name of a phase as text, for a table that a test compares.
// A phase keeps its name private, so the helper looks for the shared instance of each phase.
export function phaseNameOf(phase: GamePhase): string {
  const found = PHASE_NAMES.get(phase);
  if (found === undefined) throw new Error('The phase is not one of the five phases.');
  return found;
}
