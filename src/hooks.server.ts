import {sequence} from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit';
import * as auth from '$lib/server/auth.js';

Sentry.init({
    dsn: "https://6553df36b67b69b498548c602f128991@o4505130185261056.ingest.us.sentry.io/4508938668474368",
    tracesSampleRate: 1
})

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

export const handle: Handle = sequence(Sentry.sentryHandle(), handleAuth);

// global error handler
process.on('unhandledRejection', (error) => {
				console.error('Unhandled rejection:', error);
				process.exit(1);
});
export const handleError = Sentry.handleErrorWithSentry();