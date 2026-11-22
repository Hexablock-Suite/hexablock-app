const { Platform: Host } = require('react-native');

// A destructured require with an alias still reads the platform.
export const size = Host.OS === 'ios' ? 7 : 9;
