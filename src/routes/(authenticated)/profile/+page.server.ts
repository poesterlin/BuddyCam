import { db } from '$lib/server/db';
import { usersTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);

	const [user] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, locals.user.id))
		.limit(1);

	assert(user, 404, 'User not found');

	return {
		user: {
			...user,
			passwordHash: undefined
		}
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
