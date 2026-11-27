// Right: a route is an entry point. Expo Router loads it by its path.
import { startGame } from '../src/application/start-game';

export default function Home(): string {
  return startGame();
}
