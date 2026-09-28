/**
 * A tiny seeded PRNG (mulberry32), so the sim is deterministic given a seed.
 * The prototype uses Math.random(), which cannot be seeded; this isn't a
 * bit-for-bit port of its draws, it's what makes *our* port reproducible.
 *
 * Pure: nextRandom takes a seed and returns [value, nextSeed]. Nothing here
 * holds hidden state — the seed IS the state, threaded explicitly by callers.
 */

export type Seed = number;

/** value is in [0, 1). nextSeed must be used for the following draw. */
export function nextRandom(seed: Seed): [value: number, nextSeed: Seed] {
  const a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, a];
}

/** A draw in [-spread/2, spread/2), matching the prototype's (Math.random()-.5)*spread idiom. */
export function nextSigned(seed: Seed, spread: number): [value: number, nextSeed: Seed] {
  const [v, next] = nextRandom(seed);
  return [(v - 0.5) * spread, next];
}
