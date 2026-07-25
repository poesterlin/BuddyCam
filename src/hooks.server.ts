import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit';
import * as auth from '$lib/server/auth.js';
import { env } from '$env/dynamic/private';

Sentry.init({
	dsn: env.SENTRY_DSN,
	tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
	enabled: Boolean(env.SENTRY_DSN)
});

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);
	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);
	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(self), microphone=(), geolocation=(), payment=()'
	);
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	return response;
};

export const handle: Handle = sequence(Sentry.sentryHandle(), handleAuth, handleSecurityHeaders);

// global error handler
process.on('unhandledRejection', (error) => {
	console.error('Unhandled rejection:', error);
});
export const handleError = Sentry.handleErrorWithSentry();
