import { db } from '$lib/server/db';
import { subscriptionsTable, usersTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

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
			passwordHash: undefined
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
	}
};
