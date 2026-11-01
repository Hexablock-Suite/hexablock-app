// Wrong example: an adapter imports a driver of the outer layer.
import { deviceStore } from '../infrastructure/device-store';

export const localProgress = deviceStore;
