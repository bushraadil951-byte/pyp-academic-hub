export const round1 = (n) => Math.round(n * 10) / 10;
export const safeAvg = (xs) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
