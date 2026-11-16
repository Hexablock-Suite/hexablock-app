import { GameId } from '../domain/engine/game-id';
import type { TextKey, Texts } from './texts/text-catalog';

// The view model of the home screen (MVP, layers.md). It holds plain texts only.
export interface HomeViewModel {
  // The name of the suite. The screen gives it to its logo as the accessible name.
  readonly title: string;
  // The two parts of the logo: the brand and the ribbon below it.
  readonly brand: string;
  readonly suite: string;
  // The label of the button that opens the game selector map.
  readonly play: string;
}

// One game of the game selector map.
export interface GameChoice {
  // The text of the `GameId` of the game. The selector opens the game route with it.
  readonly id: string;
  readonly name: string;
  // The place of the game on the map, for example «Estación Línea».
  readonly place: string;
}

// The view model of the game selector map.
export interface GameSelectorViewModel {
  readonly title: string;
  // The label of the button that goes back to the home screen.
  readonly back: string;
  // The registered games, in the order of the registry.
  readonly games: readonly GameChoice[];
}

// The key of the name of a game in the text catalog: `game.<id>.name`.
const GAME_NAME = /^game\.([a-z0-9-]+)\.name$/;

// The presenter of the home screen and of the game selector map (MVP, issue #169).
// It lives in layer 3 and imports no React. A route gives it the ids of the registered games
// and the texts of one language, so a test builds it without a screen.
// The selector lists the games in the order of the registry. So a fifth variant adds one entry
// to the registry and its texts to the catalog, and this presenter does not change.
// `GameId` keeps its text private and has no `deliverTo()`. So the presenter finds the texts
// of a game with `GameId.equals()`: it compares the id of each game that the catalog names
// with the registered id.
export class HomePresenter {
  constructor(
    private readonly games: readonly GameId[],
    private readonly texts: Texts,
  ) {}

  home(): HomeViewModel {
    return {
      title: this.texts['home.title'],
      brand: this.texts['home.brand'],
      suite: this.texts['home.suite'],
      play: this.texts['home.play'],
    };
  }

  // A registered game that the catalog does not name throws a RangeError.
  gameSelector(): GameSelectorViewModel {
    return {
      title: this.texts['map.title'],
      back: this.texts['map.back'],
      games: this.games.map((gameId) => this.choiceOf(gameId)),
    };
  }

  private choiceOf(gameId: GameId): GameChoice {
    const id = this.namedIds().find((candidate) => GameId.of(candidate).equals(gameId));
    if (id === undefined) throw new RangeError('The text catalog names no game with this id.');
    return { id, name: this.text(`game.${id}.name`), place: this.text(`game.${id}.place`) };
  }

  // The id of each game that the catalog names, from its keys `game.<id>.name`.
  private namedIds(): string[] {
    return Object.keys(this.texts).flatMap((key) => {
      const match = GAME_NAME.exec(key);
      return match === null ? [] : [match[1]];
    });
  }

  // A key that the catalog does not hold throws a RangeError.
  private text(key: string): string {
    if (!holds(this.texts, key)) {
      throw new RangeError(`The text catalog has no text for the key "${key}".`);
    }
    return this.texts[key];
  }
}

// Whether `texts` holds the key `key`. `Object.hasOwn` reads only the own keys.
function holds(texts: Texts, key: string): key is TextKey {
  return Object.hasOwn(texts, key);
}
