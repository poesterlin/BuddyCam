import { db } from '$lib/server/db';
import { friendsTable, usersTable } from '$lib/server/db/schema';
import { validateAuth, validateForm } from '$lib/server/util';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);

	const { user } = await event.parent();

	const friends = await db
		.select({
			id: friendsTable.id,
			friend: friendsTable,
			user: usersTable.username
		})
		.from(friendsTable)
		.where(and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.accepted, true)))
		.fullJoin(usersTable, eq(friendsTable.userId, usersTable.id))
		.orderBy(asc(friendsTable.accepted), desc(usersTable.username));

	const myRequest = await db
		.select({
			id: friendsTable.id,
			friend: friendsTable,
			user: usersTable.username
		})
		.from(friendsTable)
		.fullJoin(usersTable, eq(friendsTable.friendId, usersTable.id))
		.where(and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.accepted, false)));

	return { friends, user, myRequest };
};

export const actions: Actions = {
	accept: validateForm(
		z.object({
			id: z.string()
		}),
		async (event, form) => {
			const locals = validateAuth(event);

			// accept friend request
			const [friend] = await db
				.update(friendsTable)
				.set({ accepted: true })
				.where(and(eq(friendsTable.id, form.id), eq(friendsTable.friendId, locals.user.id)))
				.returning();

			// add the reverse friend request
			await db
				.update(friendsTable)
				.set({ accepted: true })
				.where(
					and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.friendId, friend.userId))
				);
		}
	),
	del: validateForm(
		z.object({
			id: z.string()
		}),
		async (event, form) => {
			const locals = validateAuth(event);

			// delete friend request
			await db
				.delete(friendsTable)
				.where(and(eq(friendsTable.id, form.id), eq(friendsTable.friendId, locals.user.id)));
		}
	)
};
