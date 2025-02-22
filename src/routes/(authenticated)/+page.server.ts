import { db } from '$lib/server/db';
import { eventsTable, friendsTable } from '$lib/server/db/schema';
import { generateId, validateAuth } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { EventType } from '$lib/events';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);

	return { user: locals.user };
};

export const actions: Actions = {
	ready: async (event) => {
		const locals = validateAuth(event);

		// get friends
		const friends = await db
			.select()
			.from(friendsTable)
			.where(and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.accepted, true)));

		if (friends.length === 0) {
			redirect(302, '/friends');
		}

		// notify the friends
		const notifications = friends.map((friend) => {
			return {
				id: generateId(),
				userId: friend.friendId,
				createdAt: new Date(),
				type: EventType.READY
			} satisfies typeof eventsTable.$inferInsert;
		});

		await db.insert(eventsTable).values(notifications);
	}
};
