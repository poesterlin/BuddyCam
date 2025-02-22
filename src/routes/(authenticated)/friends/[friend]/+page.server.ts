import { db } from '$lib/server/db';
import { friendsTable, matchupTable, usersTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { friend } = event.params;

	const [friendExists] = await db
		.select({
			id: usersTable.id,
			username: usersTable.username
		})
		.from(usersTable)
		.where(eq(usersTable.id, friend))
		.limit(1);

	assert(friendExists, 404, 'Friend not found');

	const [friendship] = await db
		.select()
		.from(friendsTable)
		.where(
			and(
				eq(friendsTable.userId, locals.user.id),
				eq(friendsTable.friendId, friend),
				eq(friendsTable.accepted, true)
			)
		)
		.limit(1);

	assert(friendship, 404, 'Friendship not found');

	const matchups = await db
		.select()
		.from(matchupTable)
		.where(and(eq(matchupTable.userId, locals.user.id), eq(matchupTable.friendId, friend)));

	return { matchups, friend: friendExists };
};
