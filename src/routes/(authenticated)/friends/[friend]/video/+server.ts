import { db } from '$lib/server/db';
import { filesTable, matchupTable } from '$lib/server/db/schema';
import { ImageVideoProcessor, type ImagePair } from '$lib/server/process';
import { validateAuth } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import { getFile } from '$lib/server/s3';
import { readFile } from 'fs/promises';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	const { friend } = event.params;

	const matchups = await db
		.select({
			first: filesTable.id,
			second: filesTable.id
		})
		.from(matchupTable)
		.innerJoin(
			filesTable,
			and(eq(matchupTable.userId, filesTable.userId), eq(matchupTable.id, filesTable.matchupId))
		)
		.innerJoin(
			filesTable,
			and(eq(matchupTable.friendId, filesTable.userId), eq(matchupTable.id, filesTable.matchupId))
		)
		.where(and(eq(matchupTable.userId, locals.user.id), eq(matchupTable.friendId, friend)));

	const processor = new ImageVideoProcessor({
		videoOutput: 'output.mp4',
		fps: 24,
		cleanup: true
	});

	const images = await Promise.all(
		matchups.map(async (matchup) => {
			const [first, second] = await Promise.all([getFile(matchup.first), getFile(matchup.second)]);

			return { first, second } as ImagePair;
		})
	);

	const videoPath = await processor.processImagesAndCreateVideo(images);
	const buffer = await readFile(videoPath);

	return new Response(buffer, {
		headers: {
			'Content-Type': 'video/mp4'
		}
	});
};
