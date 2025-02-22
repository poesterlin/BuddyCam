import { error, type RequestHandler } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.session) {
		error(401);
	}

	await auth.invalidateSession(event.locals.session.id);
	auth.deleteSessionTokenCookie(event);

	return new Response(null, { status: 302, headers: { location: '/login' } });
};
