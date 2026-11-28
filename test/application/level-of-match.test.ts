/** @jest-environment node */
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LevelGameFactories } from '../../src/adapters/level-game-factories';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import { ApplyMove } from '../../src/application/apply-move';
import { StartGame } from '../../src/application/start-game';
import { UndoMove } from '../../src/application/undo-move';
import { HexGeometry } from '../../src/domain/engine/geometry/hex-geometry';
import { Turns } from '../../src/domain/engine/geometry/turns';
import { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { FitFactory } from '../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevelBuilder } from '../../src/domain/variants/hexa-fit/fit-level-builder';
import { fitLevelVariant } from '../../src/domain/variants/hexa-fit/fit-level-variant';
import type { FitMove } from '../../src/domain/variants/hexa-fit/fit-move';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import type { FitState } from '../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';
import type { HexCoord } from '../../src/domain/engine/geometry/hex-topology';
import { gameUseCases, MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { RecordingPublisher } from '../support/application/recording-publisher';
import { ManualClock } from '../support/engine/manual-clock';
import { CountingMatchIds } from '../support/engine/match-id';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';

// Issue #180 (decision 61, D26): the root of a match keeps the optional `LevelId` of its match,
// and `moveResultOf()` puts it in `MoveResult` with the move count of the level photo.
// A game with no levels has neither. The tests run the real `LevelGameFactories` over the
// bundled levels, as the composition root does.

const FIT = GameId.of('hexa-fit');
const geometry = new HexGeometry();
const clock = new ManualClock();

// The game use cases of Hexa Fit on the hexagon over the bundled levels. With no level id,
// the game starts with the factory of `fit-01`, as the registered game of a figure does.
function fitUseCases() {
  const factory = new FitFactory(
    geometry,
    LevelDefinition.of(fit01).buildWith(new FitLevelBuilder(geometry)),
    clock,
  );
  const games = new MemoryGameRepository<
    PieceId,
    HexCoord,
    FitMove<HexCoord>,
    FitState<HexCoord>
  >();
  const levels = new BundledLevelRepository();
  const factories = new LevelGameFactories(
    FIT,
    factory,
    new CountingMatchIds(),
    levels,
    fitLevelVariant(geometry, clock),
  );
  return {
    startGame: new StartGame(factories, games, levels, undefined, FIT, TopologyId.hex),
    applyMove: new ApplyMove(games, new RecordingPublisher()),
    undoMove: new UndoMove(games),
  };
}

// The first move of the witness of `fit-01`.
const FIRST_MOVE = new PlaceFitPiece(PieceId.of('a'), Turns.of(0), geometry.createCoord([0, 0]));

describe('the level of a match', () => {
  it('should_carry_the_level_id_and_the_move_count_when_a_bundled_level_starts_and_takes_a_move', async () => {
    const { startGame, applyMove } = fitUseCases();

    const started = valueOf(await startGame.execute({ levelId: LevelId.of('fit-01') }));
    const moved = valueOf(await applyMove.execute({ move: FIRST_MOVE }));

    expect(started.levelId?.equals(LevelId.of('fit-01'))).toBe(true);
    expect(started.moves?.equals(Moves.of(0))).toBe(true);
    expect(moved.levelId?.equals(LevelId.of('fit-01'))).toBe(true);
    expect(moved.moves?.equals(Moves.of(1))).toBe(true);
  });

  // Undo and redo never touch the level of the match (decision 61).
  it('should_keep_the_level_id_when_the_player_undoes_a_move_of_the_level', async () => {
    const { startGame, applyMove, undoMove } = fitUseCases();
    valueOf(await startGame.execute({ levelId: LevelId.of('fit-01') }));
    valueOf(await applyMove.execute({ move: FIRST_MOVE }));

    const undone = valueOf(await undoMove.execute({}));

    expect(undone.levelId?.equals(LevelId.of('fit-01'))).toBe(true);
    expect(undone.moves?.equals(Moves.of(0))).toBe(true);
  });

  // A start with no level id uses the registered factory, which names no level.
  it('should_carry_the_move_count_and_no_level_id_when_a_game_with_levels_starts_with_no_level', async () => {
    const { startGame } = fitUseCases();

    const started = valueOf(await startGame.execute({}));

    expect('levelId' in started).toBe(false);
    expect(started.moves?.equals(Moves.of(0))).toBe(true);
  });

  // Lines counts no moves and has no levels (D26), so its response has neither member.
  it('should_carry_neither_a_level_id_nor_a_move_count_when_a_game_with_no_levels_starts', async () => {
    const { startGame } = gameUseCases(linesFactory());

    const started = valueOf(await startGame.execute({}));

    expect(['levelId' in started, 'moves' in started]).toEqual([false, false]);
  });
});
