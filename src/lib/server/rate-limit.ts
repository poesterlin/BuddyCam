interface RateLimitOptions {
	limit: number;
	windowMs: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
}

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const entries = new Map<string, RateLimitEntry>();
let callsSinceCleanup = 0;

export function consumeRateLimit(
	key: string,
	options: RateLimitOptions,
	now = Date.now()
): RateLimitResult {
	if (++callsSinceCleanup >= 100) {
		for (const [entryKey, entry] of entries) {
			if (entry.resetAt <= now) entries.delete(entryKey);
		}
		callsSinceCleanup = 0;
	}

	const current = entries.get(key);
	const entry =
		!current || current.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : current;

	entry.count++;
	entries.set(key, entry);

	return {
		allowed: entry.count <= options.limit,
		remaining: Math.max(0, options.limit - entry.count),
		retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
	};
}

export function clearRateLimitsForTesting() {
	entries.clear();
	callsSinceCleanup = 0;
}
