// Wrong example: domain code reads ambient randomness and time.
export const roll = Math.random();
export const startedAt = Date.now();
export const today = new Date();
export const readNow = Date.now;
export const elapsed = performance.now();
export const id = crypto.randomUUID();
export const bytes = crypto.getRandomValues(new Uint8Array(4));
export const todayText = Date();
