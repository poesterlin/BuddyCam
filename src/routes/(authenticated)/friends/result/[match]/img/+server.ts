import { db } from '$lib/server/db';
import { filesTable, matchupTable } from '$lib/server/db/schema';
import { assert, validateAuth } from '$lib/server/util';
import { and, eq, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getFile, getFileStream } from '$lib/server/s3';
import { ImageVideoProcessor } from '$lib/server/process';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
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
		);

	assert(matchup, 404, 'Match not found');

	const files = await db.select().from(filesTable).where(eq(filesTable.matchupId, match)).limit(2);
	if (files.length === 0) {
		error(404, 'Files not found');
	}

	if (files.length === 1) {
		// @ts-expect-error - stream is supported but not in the types
		return new Response(await getFileStream(files[0].id), {
			headers: {
				'Content-Type': 'image/jpeg'
			}
		});
	}

	const [file1, file2] = await Promise.all(files.map((file) => getFile(file.id)));

	const processor = new ImageVideoProcessor({ folder: matchup.id });
	const buffer = await processor.mergeSideBySide(file1, file2);

	return new Response(buffer, {
		headers: {
			'Content-Type': 'image/jpeg'
		}
	});
};
