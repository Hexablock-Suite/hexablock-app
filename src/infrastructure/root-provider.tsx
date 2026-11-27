import { useState, type ReactNode } from 'react';

import { apiBaseUrl } from './api/api-url';
import { createApiClient } from './api/client';
import { CompositionRoot } from './composition-root';
import { ConsoleLogger } from './console-logger';
import { DeviceKeyValueStore } from './device-key-value-store';
import { DeviceSecretStore } from './device-secret-store';
import { SystemClock } from './system-clock';
import { ScreenServicesContext } from './ui/screen-services';

// Builds the composition root once for the life of the app and gives it to every route below.
// `app/_layout.tsx` renders it around the routes, so the layout holds no wiring (issue #162).
// The root takes the drivers of the app: the system clock, the console logger and the storage
// of the device, which keeps the saved progress after a restart (#188). It also takes the HTTP
// client of hexablock-api at the address of the build and the secure storage of the session (#45).
// The context holds the root as `ScreenServices`, the closed interface of the screens (#411).
// This module is the only importer of the root (rule `only-provider-imports-root`).
export function CompositionRootProvider({ children }: { readonly children: ReactNode }) {
  const [root] = useState(
    () =>
      new CompositionRoot({
        clock: new SystemClock(),
        logger: new ConsoleLogger(),
        store: new DeviceKeyValueStore(),
        api: createApiClient(apiBaseUrl()),
        secrets: new DeviceSecretStore(),
      }),
  );
  return <ScreenServicesContext value={root}>{children}</ScreenServicesContext>;
}
