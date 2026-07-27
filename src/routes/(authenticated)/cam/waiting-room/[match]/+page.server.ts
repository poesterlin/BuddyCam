import { EventType, type StartData } from '$lib/events';
import { db } from '$lib/server/db';
import { friendsTable, matchupTable } from '$lib/server/db/schema';
import { queueTechnicalEvents } from '$lib/server/event-service';
import { assert, generateId, validateAuth } from '$lib/server/util';
import { redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { match } = event.params;

	const [matchup] = await db
		.select()
		.from(matchupTable)
		.where(
			eq(matchupTable.id, match)
			// or(eq(matchupTable.userId, locals.user.id), isNull(matchupTable.friendId))
		)
		.limit(1);

	assert(matchup, 404, 'Match not found');

	const isMine = matchup.userId === locals.user.id;
	const isAssigned = !!matchup.friendId;
	const isFriend = matchup.friendId === locals.user.id;

	if (isAssigned && isMine) {
		redirect(302, `/cam/${match}`);
	}

	if (!isAssigned && !isMine) {
		const [friendship] = await db
			.select({ id: friendsTable.id })
			.from(friendsTable)
			.where(
				and(
					eq(friendsTable.userId, matchup.userId),
					eq(friendsTable.friendId, locals.user.id),
					eq(friendsTable.accepted, true)
				)
			)
			.limit(1);
		assert(friendship, 403, 'You are not allowed to join this matchup');

		const [claimed] = await db
			.update(matchupTable)
			.set({ friendId: locals.user.id })
			.where(and(eq(matchupTable.id, match), isNull(matchupTable.friendId)))
			.returning();
		assert(claimed, 409, 'This matchup has already been claimed');

		await queueTechnicalEvents([
			{
				id: generateId(),
				userId: matchup.userId,
				type: EventType.START,
				createdAt: new Date(),
				data: { matchId: match } satisfies StartData
			}
		]);

		redirect(302, `/cam/${match}`);
	}

	if (isFriend) {
		redirect(302, `/cam/${match}`);
	}

	console.log({ isMine, isAssigned, match });
	return {
		matchup
	};
};
