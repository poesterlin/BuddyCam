import { db } from '$lib/server/db';
import { filesTable, matchupTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { and, eq, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

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

	assert(matchup, 404, 'Match not found');

	const files = await db.select().from(filesTable).where(eq(filesTable.matchupId, match));

	return { files: files.length, matchup };
};
