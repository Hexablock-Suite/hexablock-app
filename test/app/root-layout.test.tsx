import { render } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '../../app/_layout';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { useScreenServices } from '../../src/infrastructure/ui/screen-services';

// A route that reads the screen services of the root and shows the count of registered games.
function GameCount() {
  const services = useScreenServices();
  return <Text>{`${services.gameIds(TopologyId.hex).length} games`}</Text>;
}

// Issue #162: `app/_layout.tsx` only calls the composition root and holds no wiring.
// Each route reads the root that the layout builds, through the closed interface
// `ScreenServices` (#411).
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
