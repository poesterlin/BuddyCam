import { db } from '$lib/server/db';
import { friendsTable, matchupTable, usersTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { and, eq, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { friend: friendId } = event.params;

	const [friend] = await db
		.select({
			id: usersTable.id,
			username: usersTable.username
		})
		.from(usersTable)
		.where(eq(usersTable.id, friendId))
		.limit(1);

	assert(friend, 404, 'Friend not found');

	// TODO: this is not working
	const [friendship] = await db
		.select()
		.from(friendsTable)
		.where(
			and(
				eq(friendsTable.userId, locals.user.id),
				eq(friendsTable.friendId, friendId),
				eq(friendsTable.accepted, true)
			)
		)
		.limit(1);

	assert(friendship, 404, 'Friendship not found');

	// TODO: this is not working
	const matchups = await db
		.select()
		.from(matchupTable)
		.where(
			or(
				and(eq(matchupTable.userId, locals.user.id), eq(matchupTable.friendId, friendId)),
				and(eq(matchupTable.friendId, locals.user.id), eq(matchupTable.userId, friendId))
			)
		)
		.orderBy(matchupTable.createdAt);

	return { matchups: matchups.length, friend: friend };
};
