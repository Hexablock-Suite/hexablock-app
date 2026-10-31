// Wrong example: an aspect of the application layer reads ambient time and randomness.
export const startedAt = Date.now();
export const jitter = Math.random();
export const today = new Date();
