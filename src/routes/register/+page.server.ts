import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { generateId, validateForm, validatePassword, validateUsername } from '$lib/server/util';
import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
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
	register: validateForm(
		z.object({
			username: z.string(),
			password: z.string(),
			email: z.string().optional(),
			redirect: z.string().optional()
		}),
		async (event, form) => {
			const { username, password } = form;

			if (!validateUsername(username)) {
				return fail(400, {
					message:
						'Oopsie! It looks like your username needs a little more love. Please try again! 😊'
				});
			}
			if (!validatePassword(password)) {
				return fail(400, {
					message:
						'Oopsie! It looks like your password needs a little more love. Please try again! 😊'
				});
			}

			const userId = generateId();
			const passwordHash = await hash(password, {
				// recommended minimum parameters
				memoryCost: 19456,
				timeCost: 2,
				outputLen: 32,
				parallelism: 1
			});

			try {
				await db.insert(table.usersTable).values({
					id: userId,
					email: null,
					createdAt: new Date(),
					lastLogin: new Date(),

					username,
					passwordHash
				});

				const sessionToken = auth.generateSessionToken();
				const session = await auth.createSession(sessionToken, userId);
				auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
			} catch {
				return fail(500, {
					message: 'Oopsie! It looks like something went wrong. Please try again! 😊'
				});
			}

			await db.insert(table.eventsTable).values({
				id: generateId(),
				userId: userId,
				type: EventType.REGISTER,
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
