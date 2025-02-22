import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { generateId, validateForm, validatePassword, validateUsername } from '$lib/server/util';
import { verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { EventType } from '$lib/events';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}

	return {};
};

export const actions: Actions = {
	login: validateForm(
		z.object({
			username: z.string(),
			password: z.string(),
			redirect: z.string().optional()
		}),
		async (event, form) => {
			const { username, password } = form;

			if (!validateUsername(username)) {
				return fail(400, {
					message: 'Invalid username (min 3, max 31 characters, alphanumeric only)'
				});
			}
			if (!validatePassword(password)) {
				return fail(400, { message: 'Invalid password (min 6, max 255 characters)' });
			}

			const results = await db
				.select()
				.from(table.usersTable)
				.where(eq(table.usersTable.username, username));

			const existingUser = results.at(0);
			if (!existingUser) {
				return fail(400, { message: 'Incorrect username or password' });
			}

			const validPassword = await verify(existingUser.passwordHash, password, {
				memoryCost: 19456,
				timeCost: 2,
				outputLen: 32,
				parallelism: 1
			});
			if (!validPassword) {
				return fail(400, { message: 'Incorrect username or password' });
			}

			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, existingUser.id);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

			await db.insert(table.eventsTable).values({
				id: generateId(),
				userId: existingUser.id,
				type: EventType.LOGIN,
				data: null,
				sendAt: null,
				createdAt: new Date()
			} as any);

			let to = '/';
			const redirectUrl = 'http://t' + form.redirect;
			try {
				const url = new URL(redirectUrl);
				to = url.searchParams.get('redirect') || '/';
			} catch {}

			return redirect(302, to);
		}
	)
};
