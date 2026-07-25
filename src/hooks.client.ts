import { handleErrorWithSentry } from '@sentry/sveltekit';
import { init as initializeSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

export function init() {
	initializeSentry({
		dsn: env.PUBLIC_SENTRY_DSN,
		tracesSampleRate: Number(env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
		enabled: Boolean(env.PUBLIC_SENTRY_DSN)
	});
}

export const handleError = handleErrorWithSentry();
