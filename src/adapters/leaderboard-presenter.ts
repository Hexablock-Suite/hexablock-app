import type { GlobalLeaderboardRequest } from '../application/leaderboard/get-global-leaderboard';
import type { LevelLeaderboardRequest } from '../application/leaderboard/get-level-leaderboard';
import type {
  Leaderboard,
  LeaderboardRecord,
  LeaderboardRow,
} from '../application/ports/leaderboard';
import type { FailureCode, Result, UseCaseError } from '../application/result';
import type { UseCase } from '../application/use-case';
import type { LevelId } from '../domain/progress/level-id';
import type { GameId } from '../domain/shared/game-id';
import { valueOf } from './delivered';
import { clockText } from './game-presenter';
import type { TextKey, Texts } from './texts/text-catalog';

// One row of the leaderboard screen (#47).
export interface LeaderboardRowView {
  // The whole username. It names one player of the board, so the screen keys the row with it.
  readonly id: string;
  // The rank of the backend as a text. A full tie shares a rank: «1», «1», «3».
  readonly rank: string;
  // The username, cut to 16 characters, so a long name fits the row.
  readonly name: string;
  // The record of the player as one text, for example «2048 puntos».
  readonly value: string;
}

// The view model of the leaderboard screen (MVP, layers.md, issue #47). It is plain data that the
// presenter builds again after the answer of the board.
export interface LeaderboardViewModel {
  // The title of the board: the global board, or the board of the level with the level id.
  readonly title: string;
  // The label of the button that goes back.
  readonly back: string;
  // The rows in the order of the backend. The list is empty until the first successful answer.
  readonly rows: readonly LeaderboardRowView[];
  // The loading text. It exists only before the first answer.
  readonly loading?: string;
  // The text of a successful answer with no row. The screen shows it in place of the list.
  readonly empty?: string;
  // The text of a failed answer.
  readonly error?: string;
  // The label of the button that opens the account screen. It exists only when the board needs
  // a signed-in player: no session, or a token that the backend refused.
  readonly signIn?: string;
}

// The view of MVP: the screen that shows each new view model.
export interface LeaderboardView {
  show(model: LeaderboardViewModel): void;
}

// The two boards of the backend, each behind its own input port (hexablock-api#218).
export interface LeaderboardBoards {
  readonly global: UseCase<GlobalLeaderboardRequest, Leaderboard>;
  readonly level: UseCase<LevelLeaderboardRequest, Leaderboard>;
}

// The board of the screen: the game, and the level when the screen shows the board of a level.
export interface LeaderboardRequest {
  readonly gameId: GameId;
  readonly levelId?: LevelId;
}

// The longest name that a row shows. A longer name shows its first 15 characters and «…».
const NAME_LENGTH = 16;

// The text of each failure code (issue #322, classes.md decision 62). The table is a `Record`
// over the closed set of codes, so a new code with no text fails the type check.
// No session and a refused token ask the player to sign in (the decision on #47). A level that
// the backend does not hold and a backend that gives no answer have their own texts. Every other
// failure shows the general text `leaderboard.error`.
const ERROR_TEXTS: Readonly<Record<FailureCode, TextKey>> = {
  'start-failed': 'leaderboard.error',
  'no-running-game': 'leaderboard.error',
  'move-rejected': 'leaderboard.error',
  'move-failed': 'leaderboard.error',
  'publish-failed': 'leaderboard.error',
  'no-undo': 'leaderboard.error',
  'nothing-to-undo': 'leaderboard.error',
  'undo-failed': 'leaderboard.error',
  'nothing-to-redo': 'leaderboard.error',
  'redo-failed': 'leaderboard.error',
  'save-failed': 'leaderboard.error',
  'load-failed': 'leaderboard.error',
  'list-failed': 'leaderboard.error',
  'level-locked': 'leaderboard.error',
  'username-taken': 'leaderboard.error',
  'wrong-credentials': 'leaderboard.error',
  'invalid-credentials': 'leaderboard.error',
  'backend-unreachable': 'leaderboard.unreachable',
  'register-failed': 'leaderboard.error',
  'login-failed': 'leaderboard.error',
  'sign-in-after-sign-up-failed': 'leaderboard.error',
  'session-expired': 'leaderboard.sign-in-needed',
  'sync-failed': 'leaderboard.error',
  'sign-in-required': 'leaderboard.sign-in-needed',
  'level-has-no-board': 'leaderboard.no-board',
  'leaderboard-failed': 'leaderboard.error',
  'unexpected-failure': 'leaderboard.error',
};

// The presenter of the leaderboard screen (MVP, issue #47, APP-FR-14). It lives in layer 3 and
// imports no React. It keeps both boards behind the `UseCase` input port (decision 9), so it never
// sees a concrete use case. A request with a level reads the board of that level through
// `GetLevelLeaderboard`, and a request with no level reads the global board of the game through
// `GetGlobalLeaderboard`.
// The backend ranks the rows (S3-03, DS-4): the presenter keeps their order and shows the rank
// of the backend, so a full tie shows one rank twice. It reads each value of a record with
// `valueOf()` of `delivered.ts` (rule R-no-delivery-call) and builds one text per row: the score,
// or the stars, the moves and the time, with the number of levels of a standing.
// A failed `Result` never throws (decision 28): the presenter shows the text of the failure.
// No session and a refused token also give the label of the button that opens the account screen.
// A view attaches to see each new view model. It sees the current one at once.
export class LeaderboardPresenter {
  private model: LeaderboardViewModel;
  private view: LeaderboardView | undefined;

  constructor(
    private readonly boards: LeaderboardBoards,
    private readonly request: LeaderboardRequest,
    private readonly texts: Texts,
  ) {
    this.model = {
      title: this.titleOf(request.levelId),
      back: texts['leaderboard.back'],
      rows: [],
      loading: texts['leaderboard.loading'],
    };
  }

  // The view sees the current view model at once, and each later one.
  attach(view: LeaderboardView): void {
    this.view = view;
    view.show(this.model);
  }

  // The view sees no later view model.
  detach(): void {
    this.view = undefined;
  }

  viewModel(): LeaderboardViewModel {
    return this.model;
  }

  // Reads the board of the request.
  async onOpen(): Promise<void> {
    const { gameId, levelId } = this.request;
    this.present(
      levelId === undefined
        ? await this.boards.global.execute({ gameId })
        : await this.boards.level.execute({ gameId, levelId }),
    );
  }

  private present(result: Result<Leaderboard>): void {
    const { title, back } = this.model;
    if (!result.ok) {
      this.model = { title, back, rows: [], ...this.failureOf(result.error) };
    } else if (result.value.rows.length === 0) {
      this.model = { title, back, rows: [], empty: this.texts['leaderboard.none'] };
    } else {
      this.model = { title, back, rows: result.value.rows.map((row) => this.rowOf(row)) };
    }
    this.view?.show(this.model);
  }

  // The error text of `error`, with the label of the sign-in button when the board needs a
  // signed-in player.
  private failureOf(error: UseCaseError): { error: string; signIn?: string } {
    const key = ERROR_TEXTS[error.code];
    return key === 'leaderboard.sign-in-needed'
      ? { error: this.texts[key], signIn: this.texts['leaderboard.sign-in'] }
      : { error: this.texts[key] };
  }

  private titleOf(levelId: LevelId | undefined): string {
    return levelId === undefined
      ? this.texts['leaderboard.title']
      : `${this.texts['leaderboard.level']} ${valueOf(levelId)}`;
  }

  private rowOf(row: LeaderboardRow): LeaderboardRowView {
    return {
      id: row.username,
      rank: String(row.rank),
      name: shortName(row.username),
      value: this.recordText(row.record),
    };
  }

  // The record as one text, for example «3 estrellas · 12 movimientos · 0:45».
  private recordText(record: LeaderboardRecord): string {
    const t = this.texts;
    switch (record.kind) {
      case 'score':
        return `${valueOf(record.score)} ${t['leaderboard.points']}`;
      case 'standing':
        return [
          `${valueOf(record.stars)} ${t['leaderboard.stars']}`,
          `${record.levelsCompleted} ${t['leaderboard.levels']}`,
          `${valueOf(record.moves)} ${t['leaderboard.moves']}`,
          clockText(record.elapsed),
        ].join(' · ');
      case 'level':
        return [
          `${valueOf(record.stars)} ${t['leaderboard.stars']}`,
          `${valueOf(record.moves)} ${t['leaderboard.moves']}`,
          clockText(record.elapsed),
        ].join(' · ');
    }
  }
}

// `username` cut to `NAME_LENGTH` characters: a longer name keeps its first characters and «…».
function shortName(username: string): string {
  const characters = [...username];
  return characters.length <= NAME_LENGTH
    ? username
    : `${characters.slice(0, NAME_LENGTH - 1).join('')}…`;
}
