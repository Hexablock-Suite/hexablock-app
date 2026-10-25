// Wrong example: domain code reads ambient randomness and time.
export const roll = Math.random();
export const startedAt = Date.now();
export const today = new Date();
export const readNow = Date.now;
