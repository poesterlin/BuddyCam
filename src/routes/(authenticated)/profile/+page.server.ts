import { db } from '$lib/server/db';
import { subscriptionsTable, usersTable } from '$lib/server/db/schema';
import { assert, generateId, validateAuth } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);

	const [user] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, locals.user.id))
		.limit(1);

	const [hasNotifications] = await db
		.select()
		.from(subscriptionsTable)
		.where(eq(subscriptionsTable.userId, locals.user.id))
		.limit(1);

	assert(user, 404, 'User not found');

	return {
		user: {
			...user,
			passwordHash: undefined,
		},
		hasNotifications: !!hasNotifications
	};
};

export const actions: Actions = {
	delete: async (event) => {
		const locals = validateAuth(event);

		// delete the user
		await db.delete(usersTable).where(eq(usersTable.id, locals.user.id));
		redirect(302, '/login');
	},

	logout: async (event) => {
		validateAuth(event);
	},

	addPushSubscription: async (event) => {
		const locals = validateAuth(event);
		const { request } = event;

		const json = await request.json();
		const schema = z.object({
			endpoint: z.string(),
			expirationTime: z.string().optional(),
			keys: z.object({
				p256dh: z.string(),
				auth: z.string()
			})
		});

		const { endpoint, keys, expirationTime } = schema.parse(json);;

		if (expirationTime && new Date(expirationTime) < new Date()) {
			return { success: false, message: 'Expiration time must be in the future' };
		}

		// delete any existing subscription
		await db
			.delete(subscriptionsTable)
			.where(and(
				eq(subscriptionsTable.userId, locals.user.id),
				eq(subscriptionsTable.endpoint, endpoint)
			));

		// insert the new subscription
		await db
			.insert(subscriptionsTable)
			.values({
				id: generateId(),
				userId: locals.user.id,
				endpoint,
				keys,
				expirationTime: expirationTime ? new Date(expirationTime) : undefined
			});
	},
};
