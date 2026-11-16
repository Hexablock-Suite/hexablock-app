import { createContext, useContext, useState, type ReactNode } from 'react';

import { CompositionRoot } from './composition-root';
import { ConsoleLogger } from './console-logger';
import { DeviceKeyValueStore } from './device-key-value-store';
import { SystemClock } from './system-clock';

// The composition root of the app for the routes below the root layout.
const RootContext = createContext<CompositionRoot | undefined>(undefined);

// Builds the composition root once for the life of the app and gives it to every route below.
// `app/_layout.tsx` renders it around the routes, so the layout holds no wiring (issue #162).
// The root takes the drivers of the app: the system clock, the console logger and the storage
// of the device, which keeps the saved progress after a restart (#188).
export function CompositionRootProvider({ children }: { readonly children: ReactNode }) {
  const [root] = useState(
    () =>
      new CompositionRoot({
        clock: new SystemClock(),
        logger: new ConsoleLogger(),
        store: new DeviceKeyValueStore(),
      }),
  );
  return <RootContext value={root}>{children}</RootContext>;
}

// The composition root of the app. A component outside the root layout throws an Error.
export function useCompositionRoot(): CompositionRoot {
  const root = useContext(RootContext);
  if (root === undefined) {
    throw new Error(
      'The composition root is missing: render the component inside the root layout.',
    );
  }
  return root;
}
