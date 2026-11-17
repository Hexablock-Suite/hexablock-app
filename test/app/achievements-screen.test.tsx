import path from 'node:path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { GameId } from '../../src/domain/engine/game-id';
import { GameProgress } from '../../src/domain/engine/game-progress';
import { LevelId } from '../../src/domain/engine/level-id';
import { Moves } from '../../src/domain/engine/moves';
import { ProgressRecord } from '../../src/domain/engine/progress-model';
import { Score } from '../../src/domain/engine/score';
import { Stars } from '../../src/domain/engine/stars';
import { DeviceKeyValueStore } from '../../src/infrastructure/device-key-value-store';
import { delivered } from '../support/engine/value-receiver';
import { repoRoot } from '../support/run-tool';

// The routes of `app/`, with the root layout and its composition root.
const appDir = path.join(repoRoot, 'app');

const FIT = GameId.of('hexa-fit');

// The Spanish name of each achievement of issue #188, in the order of the screen.
const SEVEN = [
  'Completa 3 líneas a la vez',
  'Llega a 256 en Hexa Merge',
  'Llega a 2048 en Hexa Merge',
  'Gana 3 niveles de Hexa Fit',
  'Gana 3 niveles de Hexa Sort',
  'Gana todos los niveles de Hexa Fit',
  'Cumple 10 metas en Hexa Sort',
];

// Saves a won result of each bundled Fit level on the device, as the victory screen of #180 does.
async function saveEveryWonFitLevel(): Promise<void> {
  const progress = GameProgress.start(FIT);
  const levels = await new BundledLevelRepository().list(FIT);
  for (const levelId of levels.map((level) => delivered(level.levelId()))) {
    progress.recordLevel(
      ProgressRecord.of({
        gameId: FIT,
        score: Score.of(0),
        levelId: LevelId.of(levelId),
        stars: Stars.of(1),
        moves: Moves.of(3),
      }),
    );
  }
  await new LocalProgressRepository(new DeviceKeyValueStore()).save(progress);
}

// The names in the section of the screen whose test id is `section`, in the order of the screen.
function namesIn(section: string): string[] {
  return SEVEN.filter((name) => within(screen.getByTestId(section)).queryByText(name) !== null);
}

// Issue #188: the achievements screen shows each achievement as in progress or completed.
// It reads the saved progress of the device through the composition root. The real root logs
// each use case call to the console, so the tests keep the console quiet.
describe('achievements route', () => {
  let info: jest.SpyInstance;

  beforeEach(async () => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    await AsyncStorage.clear();
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('should_show_every_achievement_in_progress_when_the_device_keeps_no_progress', async () => {
    await renderRouter(appDir, { initialUrl: '/achievements' });

    await screen.findByText(SEVEN[0]);

    expect(screen.getByRole('header', { name: 'Logros' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'En progreso' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Completados' })).toBeOnTheScreen();
    expect(namesIn('achievements-in-progress')).toEqual(SEVEN);
    expect(namesIn('achievements-completed')).toEqual([]);
    expect(
      within(screen.getByTestId('achievements-completed')).getByText(
        'Aún no completas ningún logro.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Cargando los logros')).toBeNull();
  });

  it('should_show_the_fit_achievements_completed_when_the_device_keeps_every_won_fit_level', async () => {
    await saveEveryWonFitLevel();

    await renderRouter(appDir, { initialUrl: '/achievements' });
    await screen.findByText(SEVEN[0]);

    expect(namesIn('achievements-completed')).toEqual([
      'Gana 3 niveles de Hexa Fit',
      'Gana todos los niveles de Hexa Fit',
    ]);
    expect(namesIn('achievements-in-progress')).toEqual(
      SEVEN.filter((name) => !name.includes('Hexa Fit')),
    );
  });

  // Decision of 2026-11-16 on issue #188: the home screen opens the achievements screen,
  // and its back button goes home again.
  it('should_open_the_achievements_from_home_and_go_back_when_the_player_presses_both_buttons', async () => {
    await renderRouter(appDir, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('button', { name: 'Logros' }));
    await screen.findByText(SEVEN[0]);

    expect(screen).toHavePathname('/achievements');
    expect(screen.getByRole('header', { name: 'Logros' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Atrás' }));

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'HexaBlock Suite' })).toBeOnTheScreen();
  });

  // A failed read of the device shows the error text as an alert, and no achievement.
  it('should_show_the_error_text_when_the_device_cannot_read_the_progress', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('No disk.'));

    await renderRouter(appDir, { initialUrl: '/achievements' });

    expect(
      await screen.findByRole('alert', {
        name: 'No se pudieron leer los logros. Vuelve atrás y ábrelos otra vez.',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(SEVEN[0])).toBeNull();
    getItem.mockRestore();
  });
});
