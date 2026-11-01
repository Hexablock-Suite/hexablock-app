// Right example: a presenter imports a use case and the domain.
import { startGame } from '../application/start-game';
import { engine } from '../domain/engine/game-engine';

export const gamePresenter = [startGame, engine];
