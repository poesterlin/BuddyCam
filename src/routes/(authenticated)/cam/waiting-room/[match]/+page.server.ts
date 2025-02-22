import { db } from '$lib/server/db';
import { eventsTable, matchupTable } from '$lib/server/db/schema';
import { assert, generateId, validateAuth } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { EventType, type StartData } from '$lib/events';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { match } = event.params;

	const [matchup] = await db
		.select()
		.from(matchupTable)
		.where(and(eq(matchupTable.id, match)))
		.limit(1);

	const isMine = matchup.userId === locals.user.id;
	if (!isMine) {
		await db
			.update(matchupTable)
			.set({ friendId: locals.user.id })
			.where(and(eq(matchupTable.id, match)));

		// insert a start event for both users
		await db.insert(eventsTable).values([
			{
				id: generateId(),
				userId: locals.user.id,
				type: EventType.START,
				createdAt: new Date(),
				data: { matchId: match } satisfies StartData
			},
			{
				id: generateId(),
				userId: matchup.userId,
				type: EventType.START,
				createdAt: new Date(),
				data: { matchId: match } satisfies StartData
			}
		]);
	}

	assert(matchup, 404, 'Match not found');
};
