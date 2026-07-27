import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	generateId,
	safeRedirectPath,
	validateForm,
	validatePassword,
	validateUsername
} from '$lib/server/util';
import { consumeRateLimit } from '$lib/server/rate-limit';
import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { EventType } from '$lib/events';
import { createDurableEvents } from '$lib/server/event-service';

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
			const rateLimit = consumeRateLimit(`register:${event.getClientAddress()}`, {
				limit: 5,
				windowMs: 60 * 60_000
			});
			event.setHeaders({ 'RateLimit-Remaining': String(rateLimit.remaining) });
			if (!rateLimit.allowed) {
				event.setHeaders({ 'Retry-After': String(rateLimit.retryAfterSeconds) });
				return fail(429, {
					message: 'Too many registration attempts. Please try again later.'
				});
			}

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
					email: form.email || null,
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

			await createDurableEvents({
				id: generateId(),
				userId: userId,
				type: EventType.REGISTER,
				data: null,
				createdAt: new Date()
			});

			return redirect(302, safeRedirectPath(form.redirect));
		}
	)
};
