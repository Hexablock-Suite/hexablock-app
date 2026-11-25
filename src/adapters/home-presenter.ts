import { GameId } from '../domain/engine/game-id';
import type { GameProgress } from '../domain/engine/game-progress';
import type { TopologyId } from '../domain/engine/geometry-factory';
import type { ProgressRecord } from '../domain/engine/progress-model';
import type { TextKey, Texts } from './texts/text-catalog';

// One board figure of the figure selector (#171).
export interface FigureChoice {
  // The text of the `TopologyId` of the figure, for example `square`.
  // The home screen passes it to the game selector map, and the map to the game route.
  readonly id: string;
  readonly name: string;
}

// The view model of the home screen (MVP, layers.md). It holds plain texts only.
export interface HomeViewModel {
  // The name of the suite. The screen gives it to its logo as the accessible name.
  readonly title: string;
  // The two parts of the logo: the brand and the ribbon below it.
  readonly brand: string;
  readonly suite: string;
  // The label of the button that opens the game selector map.
  readonly play: string;
  // The label of the button that opens the achievements screen (#188).
  readonly achievements: string;
  // The label of the figure selector.
  readonly figure: string;
  // The board figures of the composition root, in its order. The first one is the default.
  readonly figures: readonly FigureChoice[];
}

// One game of the game selector map.
export interface GameChoice {
  // The text of the `GameId` of the game. The selector opens the game route with it.
  readonly id: string;
  readonly name: string;
  // The place of the game on the map, for example «Estación Línea».
  readonly place: string;
  // The saved high score of the game as one text, for example «Récord 36» (#181).
  // It exists only when the saved progress of the game keeps a high score.
  readonly highScore?: string;
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

// The saved progress of each game, as the map hook loads it (#181). Each pair joins a `GameId`
// with the progress that the device keeps for it, or `undefined` when the game has none.
export type SavedProgresses = readonly (readonly [GameId, GameProgress | undefined])[];

// The presenter of the home screen and of the game selector map (MVP, issue #169).
// It lives in layer 3 and imports no React. A route gives it the ids of the registered games,
// the board figures of the composition root (#171), the texts of one language and, since #181,
// the saved progress of each game, so a test builds it without a screen.
// The selector lists the games in the order of the registry. So a fifth variant adds one entry
// to the registry and its texts to the catalog, and this presenter does not change.
// `GameId` keeps its text private. The presenter finds the texts of a game with `GameId.equals()`:
// it compares the id of each game that the catalog names with the registered id.
// `TopologyId` delivers its text to a receiver (issue #237). A presenter is an adapter of the
// edge, so it takes that text as the id of a figure and finds its name under `figure.<id>`.
// The choice of a game whose saved progress keeps a high score also carries the record text:
// the presenter reads the `Score` of the high score through `deliverTo()`, the one exit of a
// value (rule R-no-delivery-call), and composes it with the `map.highScore` text of the catalog.
export class HomePresenter {
  constructor(
    private readonly games: readonly GameId[],
    private readonly figures: readonly TopologyId[],
    private readonly texts: Texts,
    private readonly saved: SavedProgresses = [],
  ) {}

  // A figure that the catalog does not name throws a RangeError.
  home(): HomeViewModel {
    return {
      title: this.texts['home.title'],
      brand: this.texts['home.brand'],
      suite: this.texts['home.suite'],
      play: this.texts['home.play'],
      achievements: this.texts['home.achievements'],
      figure: this.texts['home.figure'],
      figures: this.figures.map((figure) => this.figureChoiceOf(figure)),
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

  private figureChoiceOf(figure: TopologyId): FigureChoice {
    let id = '';
    figure.deliverTo({
      receive: (text) => {
        id = text;
      },
    });
    return { id, name: this.text(`figure.${id}`) };
  }

  private choiceOf(gameId: GameId): GameChoice {
    const id = this.namedIds().find((candidate) => GameId.of(candidate).equals(gameId));
    if (id === undefined) throw new RangeError('The text catalog names no game with this id.');
    const choice = { id, name: this.text(`game.${id}.name`), place: this.text(`game.${id}.place`) };
    const highScore = this.highScoreText(gameId);
    return highScore === undefined ? choice : { ...choice, highScore };
  }

  // The record text of the saved progress of `gameId`, or `undefined` when the game has no
  // saved progress or its progress keeps no high score. The presenter is an adapter of the
  // edge, so it receives the values through `deliverTo()` (rule R-no-delivery-call).
  private highScoreText(gameId: GameId): string | undefined {
    const progress = this.saved.find(([game]) => game.equals(gameId))?.[1];
    if (progress === undefined) return undefined;
    let highScore: ProgressRecord | undefined;
    progress.deliverTo({
      receive: (_id, record) => {
        highScore = record;
      },
    });
    if (highScore === undefined) return undefined;
    let score = 0;
    highScore.deliverTo({
      receive: (_id, scoreValue) => {
        scoreValue.deliverTo({
          receive: (value) => {
            score = value;
          },
        });
      },
    });
    return `${this.text('map.highScore')} ${score}`;
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
