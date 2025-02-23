import { db } from '$lib/server/db';
import { eventsTable, filesTable, matchupTable, usersTable } from '$lib/server/db/schema';
import { assert, generateId, validateAuth } from '$lib/server/util';
import { and, eq, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { EventType, type DeleteMatchupData } from '$lib/events';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { match } = event.params;

	const [matchup] = await db
		.select()
		.from(matchupTable)
		.where(
			and(
				eq(matchupTable.id, match),
				or(eq(matchupTable.friendId, locals.user.id), eq(matchupTable.userId, locals.user.id))
			)
		)
		.limit(1);

	if (!matchup) {
		redirect(302, '/');
	}

	const files = await db.select().from(filesTable).where(eq(filesTable.matchupId, match));

	return { files: files.length, matchup };
};

export const actions: Actions = {
	del: async (event) => {
		const locals = validateAuth(event);
		const { match } = event.params;

		const [matchup] = await db
			.select()
			.from(matchupTable)
			.where(
				and(
					eq(matchupTable.id, match),
					or(eq(matchupTable.friendId, locals.user.id), eq(matchupTable.userId, locals.user.id))
				)
			)
			.limit(1);

		assert(matchup, 404, 'Match not found');

		await db.delete(filesTable).where(eq(filesTable.matchupId, match));
		await db.delete(matchupTable).where(eq(matchupTable.id, match));

		// add delete event for other user
		const otherUserId = locals.user.id === matchup.userId ? matchup.friendId : matchup.userId;
		assert(otherUserId, 500, 'Other user not found');

		const [otherUser] = await db
			.select({ username: usersTable.username })
			.from(usersTable)
			.where(eq(usersTable.id, otherUserId))
			.limit(1);

		await db.insert(eventsTable).values({
			id: generateId(),
			userId: otherUserId,
			type: EventType.DELETE_MATCHUP,
			createdAt: new Date(),
			data: { matchId: match, fromUsername: otherUser.username } satisfies DeleteMatchupData,
			isTechnical: false
		});

		redirect(302, '/');
	}
};
