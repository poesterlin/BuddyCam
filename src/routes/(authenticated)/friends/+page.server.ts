import { db } from '$lib/server/db';
import { eventsTable, friendsTable, usersTable } from '$lib/server/db/schema';
import { assert, validateAuth, validateForm } from '$lib/server/util';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { EventType } from '$lib/events';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);

	const { user } = await event.parent();

	const friends = await db
		.select({
			id: usersTable.id,
			user: usersTable.username
		})
		.from(friendsTable)
		.where(and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.accepted, true)))
		.innerJoin(usersTable, eq(friendsTable.userId, usersTable.id))
		.orderBy(asc(friendsTable.accepted), desc(usersTable.username));

	const myRequest = await db
		.select({
			id: friendsTable.id,
			friend: friendsTable,
			user: usersTable.username
		})
		.from(friendsTable)
		.innerJoin(usersTable, eq(friendsTable.friendId, usersTable.id))
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

			const [request] = await db
				.select()
				.from(friendsTable)
				.where(and(eq(friendsTable.id, form.id), eq(friendsTable.userId, locals.user.id)))
				.limit(1);

			assert(request, 400, 'Friend request not found');

			// delete friend request
			await db.delete(friendsTable).where(eq(friendsTable.id, form.id));

			// delete persistent event
			await db
				.delete(eventsTable)
				.where(
					and(
						eq(eventsTable.userId, request.friendId),
						eq(eventsTable.type, EventType.FRIEND_REQUEST),
						sql`data->>'userId' = ${locals.user.id}`
					)
				);
		}
	)
};
