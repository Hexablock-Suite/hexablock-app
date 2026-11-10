import { GameId } from '../../../src/domain/engine/game-id';

const VARIANT_IDS = ['hexa-lines', 'hexa-fit', 'hexa-sort', 'hexa-merge'];

// The id of a variant as text, for a table that a test compares.
// `GameId` keeps its value private, so the helper asks `equals()` for each known id.
export function variantIdOf(gameId: GameId): string {
  const found = VARIANT_IDS.find((id) => GameId.of(id).equals(gameId));
  if (found === undefined) throw new Error('The game id is not one of the four variants.');
  return found;
}
