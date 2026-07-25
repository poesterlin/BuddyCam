import { db } from '$lib/server/db';
import { filesTable, matchupTable, subscriptionsTable, usersTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { deleteFile } from '$lib/server/s3';
import * as auth from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import { eq, inArray, or } from 'drizzle-orm';
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
		const matchups = await db
			.select({ id: matchupTable.id })
			.from(matchupTable)
			.where(
				or(eq(matchupTable.userId, locals.user.id), eq(matchupTable.friendId, locals.user.id))
			);
		if (matchups.length) {
			const files = await db
				.select({ id: filesTable.id })
				.from(filesTable)
				.where(
					inArray(
						filesTable.matchupId,
						matchups.map((matchup) => matchup.id)
					)
				);
			await Promise.all(files.map((file) => deleteFile(file.id)));
		}

		await db.delete(usersTable).where(eq(usersTable.id, locals.user.id));
		auth.deleteSessionTokenCookie(event);
		redirect(302, '/login');
	},

	logout: async (event) => {
		validateAuth(event);
	}
};
