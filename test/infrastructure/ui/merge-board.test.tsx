import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { Mulberry32Random } from '../../../src/domain/engine/random/mulberry32-random';
import { RegionSize } from '../../../src/domain/engine/geometry/region-size';
import { Seed } from '../../../src/domain/engine/random/seed';
import { slideWays } from '../../../src/adapters/merge-slide-ways';
import { boardFigures, mergeOn } from '../../../src/infrastructure/registered-games';
import { BOARD_ID } from '../../support/engine/entity-ids';

// Issue #369: one value gives the board region of Hexa Merge to `MergeSettings` and to the slide
// controls. On the triangle the way of a slide follows the longest line of the board,
// so its angle depends on the size of the board: 7 degrees from the east for a region of size 3,
// and 5 degrees for a region of size 4. A region of size 4 holds 32 triangles.

// The rotations of the chevrons of the slide buttons, in whole degrees. The two arms
// of each chevron turn 45 degrees and -45 degrees inside it, so the list leaves them out.
function chevronTurns(): string[] {
  const turns: string[] = [];
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const { props, children } = node as { props?: { style?: unknown }; children?: unknown[] };
    const styles = [props?.style].flat(Infinity) as { transform?: { rotate?: string }[] }[];
    for (const style of styles) {
      for (const step of style?.transform ?? []) {
        if (step.rotate !== undefined && !['45deg', '-45deg'].includes(step.rotate)) {
          turns.push(step.rotate);
        }
      }
    }
    for (const child of children ?? []) visit(child);
  };
  for (const button of screen.getAllByRole('button', { name: /^Deslizar/ })) visit(button);
  return turns.sort();
}

describe('mergeOn', () => {
  it('should_slide_along_the_lines_of_the_merge_board_when_the_merge_entry_takes_a_board_size', async () => {
    const triangle = boardFigures()[2];
    const size = RegionSize.of(4);

    const entry = mergeOn(triangle, Mulberry32Random.from(Seed.of(1)), size);
    const cells = entry.withFactory({
      use: (_gameId, factory) => factory.createBoard(BOARD_ID).coordinates().length,
    });
    await render(
      <GestureHandlerRootView>
        {entry.screen.controls.render({
          model: { back: '', board: '', cells: [], scoreLabel: '', score: 0, outcome: '' },
          texts: textCatalog.es,
          layoutOf: (cellSize) => entry.screen.layoutOf(cellSize),
          play: jest.fn(),
          undo: jest.fn(),
          redo: jest.fn(),
          board: () => null,
        })}
      </GestureHandlerRootView>,
    );

    const expected = slideWays(triangle.geometry.createTopology(), size, triangle.layoutOf(1))
      .map((way) => `${Math.round((way.angle * 180) / Math.PI)}deg`)
      .sort();
    expect(cells).toBe(32);
    expect(chevronTurns()).toEqual(expected);
  });
});
