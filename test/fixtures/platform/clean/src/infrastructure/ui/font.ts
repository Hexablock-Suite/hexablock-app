import { Platform } from 'react-native';

// Layer 4 may read the platform for a small visual detail.
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });
