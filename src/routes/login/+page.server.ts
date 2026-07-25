import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	safeRedirectPath,
	validateForm,
	validatePassword,
	validateUsername
} from '$lib/server/util';
import { consumeRateLimit } from '$lib/server/rate-limit';
import { verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';

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
			const clientAddress = event.getClientAddress();
			const ipRateLimit = consumeRateLimit(`login-ip:${clientAddress}`, {
				limit: 30,
				windowMs: 15 * 60_000
			});
			const accountRateLimit = consumeRateLimit(`login-account:${username.toLowerCase()}`, {
				limit: 10,
				windowMs: 15 * 60_000
			});
			const remaining = Math.min(ipRateLimit.remaining, accountRateLimit.remaining);
			const retryAfterSeconds = Math.max(
				ipRateLimit.retryAfterSeconds,
				accountRateLimit.retryAfterSeconds
			);
			event.setHeaders({ 'RateLimit-Remaining': String(remaining) });
			if (!ipRateLimit.allowed || !accountRateLimit.allowed) {
				event.setHeaders({ 'Retry-After': String(retryAfterSeconds) });
				return fail(429, {
					message: 'Too many login attempts. Please try again later.'
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

			const results = await db
				.select()
				.from(table.usersTable)
				.where(eq(table.usersTable.username, username));

			const existingUser = results.at(0);
			if (!existingUser) {
				return fail(400, {
					message:
						"Oh no! We couldn't find that username or password. Please double-check and try again! 🌟"
				});
			}

			const validPassword = await verify(existingUser.passwordHash, password, {
				memoryCost: 19456,
				timeCost: 2,
				outputLen: 32,
				parallelism: 1
			});
			if (!validPassword) {
				return fail(400, {
					message:
						"Oh no! We couldn't find that username or password. Please double-check and try again! 🌟"
				});
			}

			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, existingUser.id);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

			await db
				.update(table.usersTable)
				.set({ lastLogin: new Date() })
				.where(eq(table.usersTable.id, existingUser.id));

			return redirect(302, safeRedirectPath(form.redirect));
		}
	)
};
