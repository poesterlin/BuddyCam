import { beforeEach, describe, expect, test } from 'bun:test';
import { clearRateLimitsForTesting, consumeRateLimit } from '../src/lib/server/rate-limit';

describe('consumeRateLimit', () => {
	beforeEach(clearRateLimitsForTesting);

	test('allows requests up to the limit and reports remaining attempts', () => {
		expect(consumeRateLimit('login:1', { limit: 2, windowMs: 1000 }, 100)).toEqual({
			allowed: true,
			remaining: 1,
			retryAfterSeconds: 1
		});
		expect(consumeRateLimit('login:1', { limit: 2, windowMs: 1000 }, 101).allowed).toBe(true);
		expect(consumeRateLimit('login:1', { limit: 2, windowMs: 1000 }, 102).allowed).toBe(false);
	});

	test('resets an expired window', () => {
		consumeRateLimit('register:1', { limit: 1, windowMs: 1000 }, 100);
		expect(consumeRateLimit('register:1', { limit: 1, windowMs: 1000 }, 1100).allowed).toBe(true);
	});

	test('keeps action keys independent', () => {
		consumeRateLimit('login:1', { limit: 1, windowMs: 1000 }, 100);
		expect(consumeRateLimit('register:1', { limit: 1, windowMs: 1000 }, 100).allowed).toBe(true);
	});
});
