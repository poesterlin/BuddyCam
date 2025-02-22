import { db } from '$lib/server/db';
import { eventsTable, friendsTable, matchupTable } from '$lib/server/db/schema';
import { generateId, validateAuth } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { EventType, type ReadyRequestData } from '$lib/events';
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
			.select({
				id: friendsTable.friendId
			})
			.from(friendsTable)
			.where(and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.accepted, true)));

		if (friends.length === 0) {
			redirect(302, '/friends');
		}

		// create a new matchup
		const matchId = generateId();
		await db.insert(matchupTable).values({
			id: matchId,
			userId: locals.user.id,
			createdAt: new Date(),
			friendId: null
		});

		// notify the friends
		const notifications = friends.map((friend) => {
			return {
				id: generateId(),
				userId: friend.id,
				createdAt: new Date(),
				type: EventType.READY,
				data: {
					fromUsername: locals.user.username,
					fromId: locals.user.id,
					matchId
				} satisfies ReadyRequestData,
				isTechnical: true
			} satisfies typeof eventsTable.$inferInsert;
		});

		await db.insert(eventsTable).values(notifications);

		redirect(302, '/cam/waiting-room/' + matchId);
	}
};
