import { render } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '../../app/_layout';
import { useCompositionRoot } from '../../src/infrastructure/composition-root-provider';

// The root layout gives the composition root the storage of the device (#188).
// The mock keeps the values in memory, so the test needs no device.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A route that reads the composition root and shows the count of registered games.
function GameCount() {
  const root = useCompositionRoot();
  return <Text>{`${root.registry().gameIds().length} games`}</Text>;
}

// Issue #162: `app/_layout.tsx` only calls the composition root and holds no wiring.
// Each route reads the root that the layout builds.
describe('RootLayout', () => {
  it('should_give_each_route_the_composition_root_when_the_root_layout_renders', async () => {
    await renderRouter({ _layout: RootLayout, index: GameCount });

    expect(screen.getByText('4 games')).toBeOnTheScreen();
  });

  it('should_throw_an_error_when_a_component_reads_the_root_outside_the_layout', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(render(<GameCount />)).rejects.toThrow(
      'The composition root is missing: render the component inside the root layout.',
    );
    error.mockRestore();
  });
});
