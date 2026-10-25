import { render, screen } from '@testing-library/react-native';

import HomeScreen from '../../app/index';

describe('HomeScreen', () => {
  it('should_show_suite_title_when_home_screen_renders', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('HexaBlock Suite')).toBeOnTheScreen();
  });
});
