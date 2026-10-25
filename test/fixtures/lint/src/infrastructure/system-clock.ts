// Right example: the outer layer wraps the system clock and Math.random.
export const systemClock = { now: () => Date.now() };
export const systemRandom = { next: () => Math.random() };
export const bootedAt = new Date();
